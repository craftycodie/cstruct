import { CStructError } from "./errors";
import { field_byte_size } from "./field-size";
import { is_pad_field } from "./pad";
import type { FieldType } from "./struct";

export interface ArrayField {
  readonly count: number;
  readonly element: FieldType;
  readonly elementSize: number;
  readonly kind: "array";
}

export function is_array_field(type: unknown): type is ArrayField {
  return (
    typeof type === "object" &&
    type !== null &&
    "kind" in type &&
    type.kind === "array"
  );
}

/** Fixed-length array field (`@c.field(type, { count })` or `c.array(type, count)`). */
export function create_array_field(
  element: FieldType,
  count: number
): ArrayField {
  if (!Number.isInteger(count) || count < 0) {
    throw new CStructError("Field count must be a non-negative integer");
  }
  if (is_pad_field(element)) {
    throw new CStructError(
      "c.pad() cannot be used as an array element — please use the c.pad(n) API instead"
    );
  }
  const elementSize = field_byte_size(element);
  return { kind: "array", element, count, elementSize };
}

export function validate_array_length(
  value: unknown,
  field: ArrayField,
  label: string
): void {
  if (!Array.isArray(value)) {
    throw new CStructError(`${label}: expected an array`);
  }
  if (value.length !== field.count) {
    throw new CStructError(
      `${label}: expected ${field.count} elements, got ${value.length}`
    );
  }
}
