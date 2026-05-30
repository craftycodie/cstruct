import { type AdvancedType, is_advanced_type } from "./advanced";
import { is_array_field, validate_array_length } from "./array";
import { assert, VALID_INDEX } from "./assert";
import { is_enum_field, read_enum } from "./enum";
import { CStructError } from "./errors";
import { is_pad_field } from "./pad";
import { is_primitive_type, type PrimitiveType } from "./primitive";
import type { FieldType } from "./struct";
import { get_struct_meta, is_struct_constructor } from "./struct";
import { is_union_field, type StructClass, type UnionField } from "./union";

export type JsonPrimitive = string | number | boolean | null;

export interface JsonObject {
  [key: string]: JsonValue;
}

/** `true` when `T` is a fixed-length tuple (not a mutable array type). */
type IsReadonlyTuple<T extends readonly unknown[]> = number extends T["length"]
  ? false
  : true;

/** JSON shape for a struct field value type (or advanced field class). */
export type JsonEncoded<T> = [T] extends [never]
  ? never
  : IsReadonlyTuple<T & readonly unknown[]> extends true
    ? { [K in keyof T]: JsonEncoded<T[K]> }
    : T extends readonly (infer U)[]
      ? JsonEncoded<U>[]
      : T extends AdvancedType<unknown, infer TJson>
        ? TJson
        : T extends bigint
          ? string
          : T extends Date
            ? string
            : T extends JsonPrimitive
              ? T
              : T extends object
                ? InferJsonType<T>
                : never;

/** JSON array whose elements are encoded as `T` (default: any {@link JsonValue}). */
export type JsonArray<T extends JsonValue = JsonValue> = JsonEncoded<T>[];

/** JSON-serializable value: primitives, nested arrays, and plain objects. */
export type JsonValue = JsonPrimitive | JsonObject | readonly JsonValue[];

/** JSON shape for an {@link AdvancedType} field from its value and JSON type parameters. */
export type JsonEncodedAdvanced<F> =
  F extends AdvancedType<infer TValue, infer TJson>
    ? TValue extends JsonPrimitive
      ? TValue
      : TJson
    : never;

/**
 * JSON object for a `@c.struct()` instance: each field is typed from its declared
 * value type (`never` pad slots are omitted from the key union).
 */
export type InferJsonType<T extends object> = {
  [K in keyof T as T[K] extends never ? never : K]: JsonEncoded<T[K]>;
};

function is_integer_primitive(type: PrimitiveType): boolean {
  return type !== "f32" && type !== "f64";
}

function json_primitive_value(
  value: unknown,
  type: PrimitiveType,
  label: string
): JsonValue {
  if (type === "u64" || type === "i64") {
    throw new CStructError(
      `${label}: primitive ${type} has no JSON mapping — use c.U64() or c.I64()`
    );
  }
  return value as number;
}

function resolve_union_arm_ctor(
  union: UnionField,
  parent: Record<string, unknown>,
  value: unknown,
  label: string
): StructClass | null {
  if (value === null || value === undefined) {
    return null;
  }
  const object = value as object;
  for (const arm of union.arms) {
    if (object instanceof arm) {
      return arm;
    }
  }
  const index = union.select(parent as object);
  if (index !== null) {
    return union.arms[index] ?? null;
  }
  throw new CStructError(
    `${label}: value does not match any union arm and parent select returned null`
  );
}

function json_field_value(
  value: unknown,
  type: FieldType,
  parent: Record<string, unknown>,
  label: string
): JsonValue {
  if (is_pad_field(type)) {
    throw new CStructError(`Cannot serialize pad field ${label}`);
  }

  if (is_primitive_type(type)) {
    return json_primitive_value(value, type, label);
  }

  if (is_enum_field(type)) {
    return value as number;
  }

  if (is_array_field(type)) {
    const items = value as unknown[];
    return items.map((item, i) =>
      json_field_value(item, type.element, parent, `${label}[${i}]`)
    );
  }

  if (is_union_field(type)) {
    if (value === null || value === undefined) {
      return null;
    }
    const arm = resolve_union_arm_ctor(type, parent, value, label);
    if (arm === null) {
      return null;
    }
    return toJson(arm, value as InstanceType<typeof arm>) as JsonValue;
  }

  if (is_struct_constructor(type)) {
    return toJson(type, value as InstanceType<typeof type>) as JsonValue;
  }

  if (is_advanced_type(type)) {
    return json_advanced_value(value, type, label);
  }

  throw new CStructError(`Unknown field type on ${label}`);
}

/** Serialize a `@c.struct()` instance to a plain JSON-friendly object (struct fields only). */
export function toJson<T extends object>(
  ctor: new () => T,
  instance: T
): InferJsonType<T> {
  const out = {} as InferJsonType<T>;

  for (const field of get_struct_meta(ctor).fields) {
    if (is_pad_field(field.type)) {
      continue;
    }
    const key = field.name as keyof InferJsonType<T>;
    out[key] = json_field_value(
      instance[key as keyof T],
      field.type,
      instance as Record<string, unknown>,
      field.name
    ) as InferJsonType<T>[typeof key];
  }

  return out;
}

function json_primitive_from_value(
  value: unknown,
  type: PrimitiveType,
  label: string
): number {
  if (type === "u64" || type === "i64") {
    throw new CStructError(
      `${label}: primitive ${type} has no JSON mapping — use c.U64() or c.I64()`
    );
  }

  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new CStructError(`${label}: expected number`);
  }
  if (is_integer_primitive(type) && !Number.isInteger(value)) {
    throw new CStructError(`${label}: expected integer for ${type}`);
  }
  return value;
}

function from_json_union_value(
  value: unknown,
  union: UnionField,
  parent: Record<string, unknown>,
  label: string
): unknown {
  if (value === null || value === undefined) {
    return null;
  }

  const index = union.select(parent as object);
  if (index === null) {
    return null;
  }

  assert(VALID_INDEX(index, union.arms.length));
  const arm = union.arms[index];
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new CStructError(`${label}: expected object for active union arm`);
  }
  return fromJson(arm, value as InferJsonType<InstanceType<typeof arm>>);
}

function json_advanced_value(
  value: unknown,
  type: AdvancedType<unknown, JsonValue>,
  label: string
): JsonValue {
  return type.toJson(value, label);
}

function from_json_advanced_value(
  value: unknown,
  type: AdvancedType<unknown, JsonValue>,
  label: string
): unknown {
  return type.fromJson(value, label);
}

function from_json_field_value(
  value: unknown,
  type: FieldType,
  parent: Record<string, unknown>,
  label: string
): unknown {
  if (is_pad_field(type)) {
    throw new CStructError(`Cannot deserialize pad field ${label}`);
  }

  if (is_primitive_type(type)) {
    return json_primitive_from_value(value, type, label);
  }

  if (is_enum_field(type)) {
    if (typeof value !== "number" || !Number.isInteger(value)) {
      throw new CStructError(`${label}: expected integer enum value`);
    }
    return read_enum(value, type, label);
  }

  if (is_array_field(type)) {
    validate_array_length(value, type, label);
    const items = value as unknown[];
    return items.map((item, i) =>
      from_json_field_value(item, type.element, parent, `${label}[${i}]`)
    );
  }

  if (is_union_field(type)) {
    return from_json_union_value(value, type, parent, label);
  }

  if (is_struct_constructor(type)) {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      throw new CStructError(`${label}: expected nested object`);
    }
    return fromJson(type, value as InferJsonType<InstanceType<typeof type>>);
  }

  if (is_advanced_type(type)) {
    return from_json_advanced_value(value, type, label);
  }

  throw new CStructError(`Unknown field type on ${label}`);
}

function require_struct_json_property<
  T extends object,
  K extends keyof InferJsonType<T>,
>(data: InferJsonType<T>, name: K, label: string): JsonValue {
  if (!(name in data)) {
    throw new CStructError(`${label}: missing JSON property "${String(name)}"`);
  }
  return data[name];
}

function from_json_into<T extends object>(
  ctor: new () => T,
  target: T,
  data: InferJsonType<T>
): void {
  const record = target as Record<string, unknown>;

  for (const field of get_struct_meta(ctor).fields) {
    if (is_pad_field(field.type)) {
      continue;
    }

    const key = field.name as keyof InferJsonType<T>;
    const raw = require_struct_json_property(data, key, field.name);
    if (is_union_field(field.type)) {
      record[field.name] = from_json_union_value(
        raw,
        field.type,
        record,
        field.name
      );
    } else {
      record[field.name] = from_json_field_value(
        raw,
        field.type,
        record,
        field.name
      );
    }
  }
}

/**
 * Build a `@c.struct()` class instance from a JSON-friendly object (e.g. from
 * {@link toJson} or `JSON.parse`). Nested structs become nested class instances.
 * Fields are applied in layout order so union discriminants are available first.
 *
 * @param data - {@link InferJsonType} keyed by `keyof T` (pad `never` fields omitted)
 */
export function fromJson<T extends object>(
  ctor: new () => T,
  data: InferJsonType<T>
): T {
  const instance = new ctor();
  from_json_into(ctor, instance, data);
  return instance;
}
