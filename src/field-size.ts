import { is_advanced_type } from "./advanced";
import { is_enum_field } from "./enum";
import { CStructError } from "./errors";
import { is_pad_field } from "./pad";
import { is_primitive_type, primitive_size } from "./primitive";
import type { FieldType } from "./struct";
import { is_struct_constructor, struct_byte_size } from "./struct";
import { is_union_field } from "./union";

function is_array_field(type: unknown): type is import("./array").ArrayField {
  return (
    typeof type === "object" &&
    type !== null &&
    "kind" in type &&
    (type as { kind: string }).kind === "array"
  );
}

/** Packed byte size of a single field type (not including per-field padding). */
export function field_byte_size(type: FieldType): number {
  if (is_primitive_type(type)) {
    return primitive_size(type);
  }
  if (is_struct_constructor(type)) {
    return struct_byte_size(type);
  }
  if (is_advanced_type(type)) {
    return type.byteSize;
  }
  if (is_pad_field(type)) {
    return type.count;
  }
  if (is_union_field(type)) {
    return type.size;
  }
  if (is_enum_field(type)) {
    return primitive_size(type.storage);
  }
  if (is_array_field(type)) {
    if (type.count === undefined) {
      throw new CStructError(
        "Array field requires a count for static struct layouts"
      );
    }
    return type.count * type.elementSize;
  }
  throw new CStructError(`Unknown field type: ${String(type)}`);
}
