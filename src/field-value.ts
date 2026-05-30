import type { AdvancedType } from "./advanced";
import type { ArrayField } from "./array";
import type { EnumField } from "./enum";
import type { PadField } from "./pad";
import type { PrimitiveType } from "./primitive";
import type { FieldType, StructLayoutCtor } from "./struct";
import type { StructClass, UnionField, UnionOf } from "./union";

/** In-memory TypeScript type for each {@link PrimitiveType}. */
export interface PrimitiveJsType {
  f32: number;
  f64: number;
  i8: number;
  i16: number;
  i32: number;
  i64: bigint;
  u8: number;
  u16: number;
  u32: number;
  u64: bigint;
}

/** In-memory value type for a layout field descriptor. */
export type FieldValue<F extends FieldType> = F extends PrimitiveType
  ? PrimitiveJsType[F]
  : F extends AdvancedType<infer V>
    ? V
    : F extends EnumField
      ? number
      : F extends ArrayField
        ? FieldValue<F["element"]>[]
        : F extends UnionField<
              object,
              infer TArms extends readonly StructClass[]
            >
          ? UnionOf<TArms>
          : F extends PadField
            ? never
            : F extends StructLayoutCtor<infer T>
              ? T
              : F extends StructClass
                ? InstanceType<F>
                : never;

/** Property type for `@c.field(type, options)` given field descriptor and options. */
export type FieldDecoratorValue<
  F extends FieldType,
  O extends FieldOptionsShape | undefined = undefined,
> = O extends { count: number } ? FieldValue<F>[] : FieldValue<F>;

/** Options accepted by {@link decorators.field}. */
export interface FieldOptionsShape {
  count?: number;
  pad_after?: number;
  pad_before?: number;
}

/** Stage 3 field decorator enforcing `FieldValue` on the property. */
export type FieldDecorator<
  F extends FieldType,
  O extends FieldOptionsShape | undefined = undefined,
> = (
  value: undefined,
  context: ClassFieldDecoratorContext<object, FieldDecoratorValue<F, O>>
) => void;

/** Property type for `@c.field(NestedStruct, options)`. */
export type StructFieldDecoratorValue<
  F extends object,
  O extends FieldOptionsShape | undefined = undefined,
> = O extends { count: number } ? F[] : F;

/** Stage 3 field decorator for nested struct constructors. */
export type StructFieldDecorator<
  F extends object,
  O extends FieldOptionsShape | undefined = undefined,
> = (
  value: undefined,
  context: ClassFieldDecoratorContext<object, StructFieldDecoratorValue<F, O>>
) => void;
