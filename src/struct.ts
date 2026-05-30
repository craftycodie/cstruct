import type { AdvancedType } from "./advanced";
import type { ArrayField } from "./array";
import type { EnumField } from "./enum";
import { CStructError } from "./errors";
import type { JsonValue } from "./json";
import type { PadField } from "./pad";
import type { PrimitiveType } from "./primitive";
import type { StructClass, UnionField } from "./union";

const STRUCT_METADATA = new WeakMap<Function, StructMeta>();

export function register_struct_meta(ctor: Function, meta: StructMeta): void {
  STRUCT_METADATA.set(ctor, meta);
}

export function get_struct_meta(ctor: Function): StructMeta {
  const meta = STRUCT_METADATA.get(ctor);
  if (!meta) {
    throw new CStructError(
      `${ctor.name || "Struct"} is missing @c.struct() — apply @c.struct on the class and register fields with @c.field`
    );
  }
  return meta;
}

/** Packed byte size of a `@c.struct()` class. */
export function struct_byte_size(ctor: Function): number {
  return get_struct_meta(ctor).size;
}

/** Brand applied by `@c.struct` to mark a class as a packed layout type. */
export const CSTRUCT_LAYOUT = Symbol.for("cstruct.struct.layout");

export interface StructLayoutBrand {
  readonly [CSTRUCT_LAYOUT]: true;
}

export function is_struct_constructor(type: unknown): type is StructLayoutCtor {
  return typeof type === "function" && CSTRUCT_LAYOUT in (type as object);
}

export type FieldType =
  | PrimitiveType
  | AdvancedType<unknown, JsonValue>
  | PadField
  | EnumField
  | ArrayField
  | UnionField
  | StructLayoutCtor
  | StructClass;

export interface StructFieldMeta {
  name: string;
  pad_after?: number;
  pad_before?: number;
  type: FieldType;
}

export interface StructMeta {
  fields: StructFieldMeta[];
  size: number;
}

/** `@c.struct()` class constructor (instance type + layout brand). */
export type StructLayoutCtor<T extends object = object> = (new () => T) &
  StructLayoutBrand;
