import { create_array_field } from "./array";
import type { BitfieldField, BitfieldFlagDefinition } from "./bitfield";
import { create_bitfield_field } from "./bitfield";
import { compute_struct_size } from "./codec";
import type { EnumField } from "./enum";
import { create_enum_field } from "./enum";
import { CStructError } from "./errors";
import { is_pad_field, type PadField } from "./pad";
import type { PrimitiveType } from "./primitive";
import {
  CSTRUCT_LAYOUT,
  type FieldType,
  is_struct_constructor,
  register_struct_meta,
  type StructFieldMeta,
  type StructLayoutCtor,
  type StructMeta,
} from "./struct";
import type { UnionArmInput, UnionField, UnionOptions } from "./union";
import { create_union } from "./union";

/** Optional padding around a field in the parent struct layout. */
export interface FieldOptions {
  /** Repeat the field `count` times as a fixed-length array. */
  count?: number;
  pad_after?: number;
  pad_before?: number;
}

export { Bool, String, Time64, WString } from "./advanced";
export { arm } from "./union";

const STRUCT_FIELDS = Symbol.for("cstruct.struct.fields");

export interface StructDecoratorMetadata {
  [STRUCT_FIELDS]?: StructFieldMeta[];
}

function field_metadata(
  context: ClassFieldDecoratorContext
): StructDecoratorMetadata {
  const metadata = context.metadata as StructDecoratorMetadata | undefined;
  if (metadata == null) {
    throw new CStructError(
      "Decorator metadata is missing. Import from @craftycodie/cstruct (loads Symbol.metadata polyfill) before any @c.struct class."
    );
  }
  return metadata;
}

function field_list(context: ClassFieldDecoratorContext): StructFieldMeta[] {
  const metadata = field_metadata(context);
  metadata[STRUCT_FIELDS] ??= [];
  return metadata[STRUCT_FIELDS];
}

function is_field_options(value: unknown): value is FieldOptions {
  return (
    typeof value === "object" &&
    value !== null &&
    !("kind" in value) &&
    ("pad_before" in value || "pad_after" in value || "count" in value)
  );
}

function resolve_field_type(
  typeOrOptions: FieldType | FieldOptions | undefined,
  maybeOptions: FieldOptions | undefined,
  structCtor: FieldType | undefined
): { type: FieldType; options?: FieldOptions } {
  if (typeOrOptions === undefined) {
    if (structCtor === undefined) {
      throw new CStructError(
        "@c.field() requires a struct constructor, e.g. @c.field(MyStruct)"
      );
    }
    return { type: structCtor };
  }
  if (is_field_options(typeOrOptions)) {
    if (structCtor === undefined) {
      throw new CStructError(
        "@c.field({ ... }) on a nested struct requires the struct constructor as the first argument"
      );
    }
    return { type: structCtor, options: typeOrOptions };
  }
  return { type: typeOrOptions, options: maybeOptions };
}

/**
 * Packed struct field. Pass a `@c.struct` class for nested layouts.
 *
 * @example Primitive
 * ```ts
 * import { c } from "@craftycodie/cstruct";
 *
 * @c.struct()
 * class Header {
 *   @c.field("u16")
 *   magic!: number;
 *
 *   @c.field("u32", { pad_before: 2 })
 *   length!: number;
 * }
 * ```
 *
 * @example Nested struct
 * ```ts
 * @c.struct()
 * class Point {
 *   @c.field("i16")
 *   x!: number;
 *   @c.field("i16")
 *   y!: number;
 * }
 *
 * @c.struct()
 * class Shape {
 *   @c.field(Point)
 *   origin!: Point;
 * }
 * ```
 */
export function field(
  structCtor?: StructLayoutCtor,
  options?: FieldOptions
): (value: undefined, context: ClassFieldDecoratorContext) => void;
export function field(
  type: FieldType,
  options?: FieldOptions
): (value: undefined, context: ClassFieldDecoratorContext) => void;
export function field(
  typeOrOptions?: FieldType | FieldOptions | StructLayoutCtor,
  maybeOptions?: FieldOptions
) {
  const structCtor =
    typeof typeOrOptions === "function" && is_struct_constructor(typeOrOptions)
      ? typeOrOptions
      : undefined;

  return (_value: undefined, context: ClassFieldDecoratorContext): void => {
    const name = String(context.name);
    const { type, options } = resolve_field_type(
      typeOrOptions,
      maybeOptions,
      structCtor
    );

    if (is_pad_field(type) && name.startsWith("_")) {
      if (options?.count !== undefined) {
        throw new CStructError(
          "c.pad() cannot be used with { count } — use one pad field per reserved region"
        );
      }
      field_list(context).push({
        name,
        type,
        pad_before: options?.pad_before,
        pad_after: options?.pad_after,
      });
      return;
    }

    const resolved_type =
      options?.count === undefined
        ? type
        : create_array_field(type, options.count);

    field_list(context).push({
      name,
      type: resolved_type,
      pad_before: options?.pad_before,
      pad_after: options?.pad_after,
    });
  };
}

/**
 * Builds a union field descriptor for {@link field}.
 *
 * @example
 * ```ts
 * import { c } from "@craftycodie/cstruct";
 *
 * @c.struct()
 * class ArmA {
 *   @c.field("u8")
 *   value!: number;
 *   @c.field(c.pad(3))
 *   private _pad!: never;
 * }
 *
 * @c.struct()
 * class Host {
 *   @c.field("u8")
 *   kind!: number;
 *
 *   @c.field(
 *     c.unionField({ size: 4 }, c.arm(ArmA, (m) => m.kind === 1))
 *   )
 *   data: ArmA | null = null;
 * }
 * ```
 */
export function unionField<T extends object>(
  options: UnionOptions,
  ...arms: readonly UnionArmInput<T>[]
): UnionField<T> {
  return create_union("", options, arms);
}

/**
 * Mark a class as a packed binary struct and attach read/write helpers.
 *
 * @example
 * ```ts
 * import { c } from "@craftycodie/cstruct";
 *
 * @c.struct()
 * class Example {
 *   @c.field("u32")
 *   value!: number;
 * }
 *
 * const bytes = c.write(Example, { value: 42 } as Example, "big");
 * const instance = c.read(Example, bytes, "big");
 * console.log(c.sizeof(Example)); // 4
 * ```
 */
export function struct<T extends abstract new (...args: any) => object>() {
  return (
    target: T,
    context: ClassDecoratorContext
  ): T & StructLayoutCtor<InstanceType<T>> => {
    const metadata = context.metadata as StructDecoratorMetadata;
    const fields = metadata[STRUCT_FIELDS] ?? [];
    if (fields.length === 0) {
      throw new CStructError(
        `${target.name}: no @c.field metadata — ensure SWC/TS use decoratorVersion "2022-03" (not legacy decorators)`
      );
    }

    const meta: StructMeta = {
      fields,
      size: compute_struct_size(fields),
    };

    register_struct_meta(target, meta);
    Object.defineProperty(target, CSTRUCT_LAYOUT, {
      value: true,
      enumerable: false,
      configurable: false,
    });
    delete metadata[STRUCT_FIELDS];
    return target as T & StructLayoutCtor<InstanceType<T>>;
  };
}

/**
 * Conditional struct slot (fixed size). Prefer {@link field} with {@link unionField}.
 *
 * @example
 * ```ts
 * import { c } from "@craftycodie/cstruct";
 *
 * @c.struct()
 * class ArmA {
 *   @c.field("u8")
 *   value!: number;
 *   @c.field(c.pad(3))
 *   private _pad!: never;
 * }
 *
 * @c.struct()
 * class Host {
 *   @c.field("u8")
 *   kind!: number;
 *
 *   @c.union({ size: 4 }, c.arm(ArmA, (m) => m.kind === 1))
 *   data: ArmA | null = null;
 * }
 * ```
 */
export function union<T extends object>(
  options: UnionOptions,
  ...arms: readonly UnionArmInput<T>[]
) {
  const union_type = create_union("", options, arms);
  return (_value: undefined, context: ClassFieldDecoratorContext): void => {
    const name = String(context.name);
    field_list(context).push({
      name,
      type: { ...union_type, name } as FieldType,
    });
  };
}

/**
 * Reserve `count` zero bytes inside a struct layout.
 *
 * @example
 * ```ts
 * @c.struct()
 * class Header {
 *   @c.field("u16")
 *   magic!: number;
 *   @c.field(c.pad(4))
 *   private _reserved!: never;
 * }
 * ```
 */
export const pad = (count: number): PadField => ({ kind: "pad", count });

/**
 * Integer enum field: `c.enum("i8", my_enum)` inside {@link field}.
 *
 * @example
 * ```ts
 * const Status = { Ok: 0, Error: 1 } as const;
 *
 * @c.struct()
 * class Packet {
 *   @c.field(c.enum("u8", Status))
 *   status!: number;
 * }
 * ```
 */
export function enumType(storage: PrimitiveType, enumObj: object): EnumField {
  return create_enum_field(storage, enumObj);
}

/**
 * Bitfield flags in an integer primitive: `c.bitfield("u32", flags)`.
 *
 * @example
 * ```ts
 * const Skulls = ["iron", "black_eye", "mythic"] as const;
 *
 * @c.struct()
 * class Challenge {
 *   @c.field(c.bitfield("u32", Skulls))
 *   skulls!: c.Bitfield<typeof Skulls>;
 * }
 * ```
 */
export function bitfieldType(
  storage: PrimitiveType,
  flags: BitfieldFlagDefinition,
  options?: { strict?: boolean }
): BitfieldField {
  return create_bitfield_field(storage, flags, options);
}

/**
 * Fixed-length array field. Use for nested arrays or when `{ count }` is awkward.
 *
 * @example
 * ```ts
 * @c.field(c.array("u32", 4))
 * row!: number[];
 *
 * @c.field(c.array(c.array("u8", 2), 3))
 * grid!: number[][];
 * ```
 */
export function arrayType(
  element: FieldType,
  count: number
): import("./array").ArrayField {
  return create_array_field(element, count);
}
