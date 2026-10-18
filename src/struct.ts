import { isCArray } from "./array";
import type { Chainable } from "./chain";
import { COMPILE, type CompileEnv, envFor, ownCodec } from "./engine/codec";
import { type BytesLike, checkRange, createCtx } from "./engine/ctx";
import { compileStruct, type StructPlan } from "./engine/plan";
import { runWrite } from "./engine/run";
import { asCStructError } from "./errors";
import {
  type CClassField,
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
import type { CMagicNumber } from "./field-types/magic-number";
import type { CMagicString } from "./field-types/magic-string";
import { isCPadding } from "./field-types/padding";
import { computeLayout, type Layout } from "./layout";
import type { CMatch } from "./match";
import type { OptionalInput } from "./modifiers";
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

type ElementFieldType<T> =
  T extends CClassField<any, any, infer I>
    ? I
    : T extends {
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

/** Data properties of a class instance (methods dropped). */
type ClassData<I> = {
  [K in keyof I as I[K] extends (...args: any[]) => any ? never : K]: I[K];
};

type ProcessSchemaField<K extends string, F extends StructFieldValue> =
  IsAny<F> extends true
    ? { [Key in K]: any }
    : F extends CClassField<any, any, infer I>
      ? { [Key in K]: I }
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

export type StructSchemaToTS<F extends StructFields> =
  // The wide `Struct` (any fields) decodes to any record, so every concrete
  // struct stays assignable to `c.Struct`.
  string extends keyof F
    ? Record<string, any>
    : FlattenIntersection<
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

// Key-remapping mapped types (not Pick/Omit, which go through `keyof F` and
// would make Struct<F> invariant, breaking assignability to c.Struct).
type PickFields<F, K> = { [P in keyof F as P extends K ? P : never]: F[P] };
type OmitFields<F, K> = { [P in keyof F as P extends K ? never : P]: F[P] };
type Extended<F, G> = OmitFields<F, keyof G> & G;

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

// Chain methods (.array, .default, .transform, ...) are installed at startup by chain.ts.
// biome-ignore lint/correctness/noUnusedVariables: type parameters must match the class they merge into
export interface Struct<F extends StructFields = StructFields>
  extends Chainable {}

export class Struct<F extends StructFields = StructFields> {
  readonly options: StructOptions;
  /**
   * The field definitions this struct was built from. (A mapped type rather
   * than plain `F`, which would make Struct<F> invariant.)
   */
  readonly shape: { readonly [K in keyof F]: F[K] };
  private readonly layout: Layout;
  private readonly byteSize: number;

  private constructor(fields: F, options?: StructOptions) {
    this.shape = fields;
    this.options = options ?? {};
    this.layout = computeLayout(fields, this.options);
    this.byteSize = this.layout.size;
  }

  static struct<const F extends StructFields>(
    fields: F,
    options?: StructOptions
  ): Struct<F> {
    return new Struct(fields, options);
  }

  /** Size in bytes (including alignment padding when `align`/`pack` is set). */
  get size(): number {
    return this.byteSize;
  }

  // These methods take `this: Struct<S>` instead of using `F` directly so
  // they do not affect Struct's variance: every Struct<F> must stay
  // assignable to the wide c.Struct.

  /**
   * A new struct with `fields` appended, e.g. a derived header that starts
   * with a base header. A field with an existing name replaces it in place.
   * Options are inherited unless overridden.
   */
  extend<S extends StructFields, const G extends StructFields>(
    this: Struct<S>,
    fields: G,
    options?: StructOptions
  ): Struct<Extended<S, G>> {
    return new Struct({ ...this.shape, ...fields } as Extended<S, G>, {
      ...this.options,
      ...options,
    });
  }

  /** A new struct with only `keys`, in their original order. */
  pick<S extends StructFields, const K extends keyof S & string>(
    this: Struct<S>,
    ...keys: K[]
  ): Struct<PickFields<S, K>> {
    const wanted = new Set<string>(keys);
    return this.filterShape((name) => wanted.has(name)) as unknown as Struct<
      PickFields<S, K>
    >;
  }

  /** A new struct without `keys`. */
  omit<S extends StructFields, const K extends keyof S & string>(
    this: Struct<S>,
    ...keys: K[]
  ): Struct<OmitFields<S, K>> {
    const unwanted = new Set<string>(keys);
    return this.filterShape((name) => !unwanted.has(name)) as unknown as Struct<
      OmitFields<S, K>
    >;
  }

  private filterShape(keep: (name: string) => boolean): Struct<StructFields> {
    const fields: StructFields = {};
    for (const [name, value] of Object.entries(this.shape)) {
      if (keep(name)) {
        fields[name] = value;
      }
    }
    return new Struct(fields, this.options);
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
  write<S extends StructFields>(
    this: Struct<S>,
    data: StructInput<S>,
    endian?: EndianType
  ): Buffer;
  write<S extends StructFields>(
    this: Struct<S>,
    data: StructInput<S>,
    options: WriteOptions
  ): Buffer;
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
  writeInto<S extends StructFields>(
    this: Struct<S>,
    target: Uint8Array,
    data: StructInput<S>,
    offset = 0,
    endian?: EndianType
  ): void {
    this.write(data, { into: target, offset, endian });
  }

  /**
   * Byte offset of a field from the start of the struct, like C `offsetof`.
   * Accepts nested paths and array indexes: `"header.points[2].x"`.
   */
  offsetOf<S extends StructFields>(
    this: Struct<S>,
    path: (keyof S & string) | (string & {})
  ): number {
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

  /** 1 for packed structs (the default), else the largest field alignment. */
  getAlign(): number {
    return this.layout.align;
  }
}

type InferType<T> =
  T extends Struct<infer F>
    ? StructSchemaToTS<F>
    : T extends CClassField<any, any, infer I>
      ? I
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

/** Decoded type of a schema or field: what `c.read` returns. */
export type infer<T> = InferType<T>;

/** Alias of `c.infer`: the decoded (read) type. */
export type output<T> = InferType<T>;

/**
 * Accepted (write) type of a schema or field. Padding is omitted; magic
 * values, unions and fields with `.default()` are optional; `c.bytes`
 * accepts any byte source.
 */
export type input<T> = InputType<T>;

/** What a field type's `write` accepts as its value. */
type WriteValue<T> = T extends {
  write(buffer: any, offset: any, value: infer V, endian: any): any;
}
  ? V
  : never;

type IsOptionalInput<T> = T extends OptionalInput
  ? true
  : T extends
        | CMagicNumber<any, any, any>
        | CMagicString<any, any>
        | CDiscriminatedUnion<any, any>
        | CMatch<any, any, any>
    ? true
    : T extends { readonly field: infer Inner }
      ? IsOptionalInput<Inner>
      : false;

type InputKeys<F extends StructFields, Optional extends boolean> = {
  [K in keyof F]: F[K] extends CPadding
    ? never
    : IsOptionalInput<F[K]> extends Optional
      ? K
      : never;
}[keyof F];

/** Write-side shape of a struct. */
export type StructInput<F extends StructFields> = string extends keyof F
  ? Record<string, any>
  : FlattenIntersection<
      { [K in InputKeys<F, false>]: InputType<F[K]> } & {
        [K in InputKeys<F, true>]?: InputType<F[K]>;
      }
    >;

type ArrayInput<E, N extends number> = number extends N
  ? readonly InputType<E>[]
  : Readonly<Tuple<InputType<E>, N>>;

type InputType<T> =
  IsAny<T> extends true
    ? any
    : T extends Struct<infer F>
      ? StructInput<F>
      : T extends CClassField<any, any, infer I>
        ? FlattenIntersection<ClassData<I>>
        : T extends { readonly struct: infer S }
          ? InputType<S>
          : T extends {
                readonly __cstructAnnotatedField: true;
                readonly field: infer Inner;
              }
            ? InputType<Inner>
            : T extends {
                  readonly __carray: true;
                  readonly element: infer E;
                  readonly count: infer N extends number;
                }
              ? ArrayInput<E, N>
              : T extends {
                    readonly __cdiscriminatedUnion: true;
                    readonly arms: infer Arms;
                  }
                ? Arms extends readonly (readonly [infer S, any])[]
                  ? InputType<S> | null
                  : never
                : T extends CFieldType<any, any>
                  ? WriteValue<T>
                  : never;

export function struct<const F extends StructFields>(
  fields: F,
  options?: StructOptions
): Struct<F> {
  return Struct.struct(fields, options);
}
