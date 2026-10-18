import { isCArray, unwrapArrayElement } from "./array";
import {
  type FieldType,
  getFieldOptions,
  type StructFieldValue,
  unwrapFieldType,
} from "./field";
import { createPadding } from "./field-types";

/** A field at a fixed byte offset inside its struct. */
export interface LayoutField {
  /** Element count for arrays; undefined for a single value. */
  readonly count: number | undefined;
  /** Byte size of one element (equal to `size` when not an array). */
  readonly elementSize: number;
  readonly name: string;
  /** Byte offset from the start of the struct. */
  readonly offset: number;
  readonly size: number;
  readonly type: FieldType;
}

export interface Layout {
  readonly fields: readonly LayoutField[];
  readonly size: number;
}

interface NormalizedField {
  count?: number;
  name: string;
  type: FieldType;
}

function normalizeFields(
  fields: Record<string, StructFieldValue>
): NormalizedField[] {
  const result: NormalizedField[] = [];
  for (const [name, value] of Object.entries(fields)) {
    const fieldOptions = getFieldOptions(value);
    if (fieldOptions.padBefore) {
      result.push({
        name: `__pad_before_${name}`,
        type: createPadding(fieldOptions.padBefore),
      });
    }
    if (isCArray(value)) {
      result.push({
        name,
        type: unwrapArrayElement(value.element),
        count: value.count,
      });
    } else {
      result.push({ name, type: unwrapFieldType(value) });
    }
    if (fieldOptions.padAfter) {
      result.push({
        name: `__pad_after_${name}`,
        type: createPadding(fieldOptions.padAfter),
      });
    }
  }
  return result;
}

function sizeOfType(name: string, type: FieldType): number {
  if (typeof (type as { getSize?: unknown }).getSize !== "function") {
    throw new Error(`Unsupported field type for '${name}'`);
  }
  return type.getSize();
}

/** Assign packed byte offsets to every field, in declaration order. */
export function computeLayout(
  fields: Record<string, StructFieldValue>
): Layout {
  const out: LayoutField[] = [];
  let offset = 0;
  for (const field of normalizeFields(fields)) {
    if (field.name === "__proto__") {
      throw new Error("'__proto__' cannot be used as a field name");
    }
    const elementSize = sizeOfType(field.name, field.type);
    const size = elementSize * (field.count ?? 1);
    out.push({
      name: field.name,
      type: field.type,
      count: field.count,
      offset,
      elementSize,
      size,
    });
    offset += size;
  }
  return { fields: out, size: offset };
}
