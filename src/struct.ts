import { isCArray } from "./array";
import { COMPILE, type CompileEnv, envFor, ownCodec } from "./engine/codec";
import { type BytesLike, checkRange, createCtx } from "./engine/ctx";
import { compileStruct, type StructPlan } from "./engine/plan";
import { runWrite } from "./engine/run";
import { asCStructError } from "./errors";
import {
  CStructField,
  type FieldType,
  type FieldOptions as IFieldOptions,
  type StructFieldValue,
} from "./field";
import type { Endian as EndianType } from "./field-type";
import type {
  BigintTypeToTS,
  CBigint,
  CFieldType,
  CNumber,
  CPadding,
  NumberTypeToTS,
} from "./field-types";
import { isCPadding } from "./field-types/padding";
import { computeLayout, type Layout } from "./layout";
import {
  type ReadOptions,
  resolveRead,
  resolveWrite,
  type StructOptions,
  type WriteOptions,
} from "./options";
import type { CDiscriminatedUnion, UnionOfArms } from "./unions";
import type { FlattenIntersection, Tuple, UnionToIntersection } from "./utils";

export type StructFields = Record<string, StructFieldValue>;

type IsAny<T> = 0 extends 1 & T ? true : false;

type FieldValueType<T extends FieldType> =
  IsAny<T> extends true
    ? any
    : T extends CPadding
      ? never
      : T extends CNumber<infer P>
        ? NumberTypeToTS<P>
        : T extends CBigint<infer P>
          ? BigintTypeToTS<P>
          : T extends Struct<infer F>
            ? StructSchemaToTS<F>
            : T extends CDiscriminatedUnion<infer Arms, any>
              ? UnionOfArms<Arms> | null
              : T extends CFieldType<any, any>
                ? DecodedType<T>
                : never;

/** What a field type's `read` returns (its write input may be wider). */
type DecodedType<T> = T extends {
  read(buffer: any, offset: any, endian: any): infer AT;
}
  ? AT
  : never;

type ProcessArrayField<K extends string, T, N extends number> = number extends N
  ? { [Key in K]: T[] }
  : { [Key in K]: Tuple<T, N> };

type NestedStructSchema<T> = T extends { readonly struct: infer S }
  ? S extends Struct<infer F>
    ? StructSchemaToTS<F>
    : never
  : never;

type ElementFieldType<T> = T extends {
  readonly __carray: true;
  readonly element: infer ET;
  readonly count: infer N extends number;
}
  ? Tuple<ElementFieldType<ET>, N>
  : NestedStructSchema<T> extends never
    ? T extends FieldType
      ? FieldValueType<T>
      : never
    : NestedStructSchema<T>;

type ProcessSchemaField<K extends string, F extends StructFieldValue> =
  IsAny<F> extends true
    ? { [Key in K]: any }
    : F extends {
          readonly __carray: true;
          readonly element: infer ET;
          readonly count: infer N extends number;
        }
      ? ProcessArrayField<K, ElementFieldType<ET>, N>
      : NestedStructSchema<F> extends never
        ? F extends CPadding
          ? {}
          : F extends FieldType
            ? { [Key in K]: FieldValueType<F> }
            : never
        : { [Key in K]: NestedStructSchema<F> };

export type StructSchemaToTS<F extends StructFields> = FlattenIntersection<
  UnionToIntersection<
    {
      [K in keyof F]: ProcessSchemaField<K & string, F[K]>;
    }[keyof F]
  >
>;

export interface StructField {
  count?: number;
  name: string;
  type: FieldType;
}

const PATH_INDEX = /\[(\d+)\]/g;

/** Split `a.b[2].c` (or `a.b.2.c`) into segments. */
function parsePath(path: string): string[] {
  return path.replace(PATH_INDEX, ".$1").split(".").filter(Boolean);
}

interface PathCursor {
  /** Element count when the cursor is on an array; undefined otherwise. */
  count: number | undefined;
  elementSize: number;
  type: unknown;
}

function cursorFor(type: FieldType): PathCursor {
  if (isCArray(type)) {
    const element = type.elementType;
    return { type: element, count: type.count, elementSize: element.getSize() };
  }
  return { type, count: undefined, elementSize: type.getSize() };
}

export class Struct<F extends StructFields = StructFields> {
  readonly options: StructOptions;
  private readonly layout: Layout;
  private readonly byteSize: number;

  private constructor(fields: F, options?: StructOptions) {
    this.options = options ?? {};
    this.layout = computeLayout(fields);
    this.byteSize = this.layout.size;
  }

  static struct<const F extends StructFields>(
    fields: F,
    options?: StructOptions
  ): Struct<F> {
    return new Struct(fields, options);
  }

  /** Packed size in bytes. */
  get size(): number {
    return this.byteSize;
  }

  field<const O extends IFieldOptions = {}>(
    options?: O
  ): CStructField<this, O> {
    return new CStructField(this, options);
  }

  /** @internal Compiled plan for this layout. */
  plan(endian: EndianType, checked = true): StructPlan {
    return ownCodec(this, envFor(endian, checked)) as StructPlan;
  }

  [COMPILE](env: CompileEnv): StructPlan {
    return compileStruct(this.layout, env);
  }

  /** @internal Read into `out` (a fresh record or a class instance). */
  readInto<T extends object>(
    buffer: BytesLike,
    offset: number,
    endian: EndianType,
    out: T
  ): T {
    const plan = this.plan(endian);
    try {
      const ctx = createCtx(buffer);
      checkRange(ctx.u8, offset, this.byteSize);
      return plan.readInto(ctx, offset, out);
    } catch (error) {
      throw asCStructError(error, "read");
    }
  }

  read(
    buffer: BytesLike,
    offset?: number,
    endian?: EndianType
  ): StructSchemaToTS<F>;
  read(buffer: BytesLike, endian: EndianType): StructSchemaToTS<F>;
  read(buffer: BytesLike, options: ReadOptions): StructSchemaToTS<F>;
  read(
    buffer: BytesLike,
    offsetOrOptions?: number | EndianType | ReadOptions,
    endian?: EndianType
  ): StructSchemaToTS<F> {
    const resolved = resolveRead(offsetOrOptions, endian);
    return this.readInto(
      buffer,
      resolved.offset,
      resolved.endian,
      {}
    ) as StructSchemaToTS<F>;
  }

  /**
   * Serialize `data`. Returns a new `Buffer` (a `Uint8Array` without Buffer),
   * or the `into` target when one is given.
   */
  write(data: Record<string, any>, endian?: EndianType): Buffer;
  write(data: Record<string, any>, options: WriteOptions): Buffer;
  write(
    data: Record<string, any>,
    endianOrOptions?: EndianType | WriteOptions
  ): Buffer {
    const resolved = resolveWrite(endianOrOptions);
    return runWrite(
      this.plan(resolved.endian, resolved.checked),
      this.byteSize,
      data,
      resolved
    );
  }

  /** Serialize `data` into `target` at `offset`, zeroing the struct's bytes first. */
  writeInto(
    target: Uint8Array,
    data: Record<string, any>,
    offset = 0,
    endian?: EndianType
  ): void {
    this.write(data, { into: target, offset, endian });
  }

  /**
   * Byte offset of a field from the start of the struct, like C `offsetof`.
   * Accepts nested paths and array indexes: `"header.points[2].x"`.
   */
  offsetOf(path: (keyof F & string) | (string & {})): number {
    let cursor: PathCursor = {
      type: this,
      count: undefined,
      elementSize: this.byteSize,
    };
    let offset = 0;
    for (const segment of parsePath(path)) {
      if (cursor.count !== undefined) {
        const index = Number(segment);
        if (!Number.isInteger(index) || index < 0 || index >= cursor.count) {
          throw new RangeError(
            `'${segment}' is not an index into an array of ${cursor.count} in '${path}'`
          );
        }
        offset += index * cursor.elementSize;
        cursor = cursorFor(cursor.type as FieldType);
        continue;
      }
      if (cursor.type instanceof Struct) {
        const field = (cursor.type.layout as Layout).fields.find(
          (candidate) => candidate.name === segment
        );
        if (!field || isCPadding(field.type)) {
          throw new Error(`no field '${segment}' in '${path}'`);
        }
        offset += field.offset;
        cursor =
          field.count === undefined
            ? cursorFor(field.type)
            : {
                type: field.type,
                count: field.count,
                elementSize: field.elementSize,
              };
        continue;
      }
      throw new Error(
        `'${segment}' does not name a struct field or array element in '${path}'`
      );
    }
    return offset;
  }

  getSize(): number {
    return this.byteSize;
  }
}

type InferType<T> =
  T extends Struct<infer F>
    ? StructSchemaToTS<F>
    : NestedStructSchema<T> extends never
      ? T extends {
          readonly __carray: true;
          readonly element: infer ET;
          readonly count: infer N extends number;
        }
        ? number extends N
          ? InferType<ET>[]
          : Tuple<InferType<ET>, N>
        : T extends {
              readonly __cdiscriminatedUnion: true;
              readonly arms: infer Arms;
            }
          ? Arms extends readonly import("./unions").UnionArmInput[]
            ? UnionOfArms<Arms> | null
            : never
          : T extends FieldType
            ? FieldValueType<T>
            : never
      : NestedStructSchema<T>;

export type UnionOf<Arms extends readonly import("./unions").UnionArmInput[]> =
  UnionOfArms<Arms>;

export type infer<T> = InferType<T>;

export function struct<const F extends StructFields>(
  fields: F,
  options?: StructOptions
): Struct<F> {
  return Struct.struct(fields, options);
}
