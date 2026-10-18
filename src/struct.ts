import { COMPILE, ownCodec } from "./engine/codec";
import {
  allocBytes,
  type BytesLike,
  checkRange,
  createCtx,
} from "./engine/ctx";
import { compileStruct, type StructPlan } from "./engine/plan";
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
import { computeLayout, type Layout } from "./layout";
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
              : T extends CFieldType<infer AT, any>
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
  NestedStructSchema<T> extends never
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

export class Struct<F extends StructFields = StructFields> {
  private readonly layout: Layout;
  private readonly size: number;

  private constructor(fields: F) {
    this.layout = computeLayout(fields);
    this.size = this.layout.size;
  }

  static struct<const F extends StructFields>(fields: F): Struct<F> {
    return new Struct(fields);
  }

  field<const O extends IFieldOptions = {}>(
    options?: O
  ): CStructField<this, O> {
    return new CStructField(this, options);
  }

  /** @internal Compiled plan for this layout at one endianness. */
  plan(endian: EndianType): StructPlan {
    return ownCodec(this, endian) as StructPlan;
  }

  [COMPILE](endian: EndianType): StructPlan {
    return compileStruct(this.layout, endian);
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
      checkRange(ctx.u8, offset, this.size);
      return plan.readInto(ctx, offset, out);
    } catch (error) {
      throw asCStructError(error, "read");
    }
  }

  read(
    buffer: BytesLike,
    offset = 0,
    endian: EndianType = "little"
  ): StructSchemaToTS<F> {
    return this.readInto(buffer, offset, endian, {}) as StructSchemaToTS<F>;
  }

  /** Returns a `Buffer` when the runtime has one, else a `Uint8Array`. */
  write(data: Record<string, any>, endian: EndianType = "little"): Buffer {
    const buffer = allocBytes(this.size);
    const plan = this.plan(endian);
    try {
      plan.write(createCtx(buffer), 0, data);
    } catch (error) {
      throw asCStructError(error, "write");
    }
    return buffer;
  }

  getSize(): number {
    return this.size;
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

export function struct<const F extends StructFields>(fields: F): Struct<F> {
  return Struct.struct(fields);
}
