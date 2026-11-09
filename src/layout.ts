import { isCArray, unwrapArrayElement } from "./array";
import {
  type FieldType,
  getFieldOptions,
  type StructFieldValue,
  unwrapFieldType,
} from "./field";
import { alignOf, type Endian } from "./field-type";
import { createPadding } from "./field-types";

/** A field at a fixed byte offset inside its struct. */
export interface LayoutField {
  /** Element count for arrays; undefined for a single value. */
  readonly count: number | undefined;
  /** Byte size of one element (equal to `size` when not an array). */
  readonly elementSize: number;
  /** Byte order pinned by the field's options. */
  readonly endian: Endian | undefined;
  readonly name: string;
  /** Byte offset from the start of the struct. */
  readonly offset: number;
  readonly size: number;
  readonly type: FieldType;
  /**
   * Options of a wrapper around the field type (`c.array(...)`,
   * `struct.field(...)`, ...), whose defaults and assertions apply to the
   * whole field. The field type's own options are applied by the compiler.
   */
  readonly wrapperOptions: object | undefined;
}

export interface Layout {
  /** Struct alignment: 1 when packed, else the largest field alignment. */
  readonly align: number;
  readonly fields: readonly LayoutField[];
  /** Total size, including trailing padding up to `align`. */
  readonly size: number;
}

export interface LayoutOptions {
  /** Align fields naturally, like a C compiler without `#pragma pack`. */
  align?: boolean;
  /** Cap field alignment at this many bytes, like `#pragma pack(n)`. */
  pack?: 1 | 2 | 4 | 8 | 16;
}

const PACK_VALUES = new Set([1, 2, 4, 8, 16]);

/** Largest alignment a field may get: 1 when packed (the default). */
function maxAlign(options: LayoutOptions): number {
  if (options.pack !== undefined) {
    if (!PACK_VALUES.has(options.pack)) {
      throw new RangeError(
        `pack must be 1, 2, 4, 8 or 16, got ${String(options.pack)}`
      );
    }
    return options.pack;
  }
  return options.align ? Number.POSITIVE_INFINITY : 1;
}

function roundUp(value: number, align: number): number {
  return Math.ceil(value / align) * align;
}

interface NormalizedField {
  count?: number;
  endian?: Endian;
  name: string;
  type: FieldType;
  wrapperOptions?: object;
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
    const endian = fieldOptions.endian;
    if (isCArray(value)) {
      result.push({
        name,
        type: unwrapArrayElement(value.element),
        count: value.count,
        endian,
        wrapperOptions: value.options,
      });
    } else {
      const type = unwrapFieldType(value);
      result.push({
        name,
        type,
        endian,
        wrapperOptions: type === value ? undefined : fieldOptions,
      });
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

/**
 * Assign byte offsets to every field in declaration order. Packed by
 * default; with `align` or `pack`, each field starts at a multiple of
 * min(its natural alignment, pack) and the size rounds up to the struct's
 * alignment, as C compilers do.
 */
export function computeLayout(
  fields: Record<string, StructFieldValue>,
  options: LayoutOptions = {}
): Layout {
  const limit = maxAlign(options);
  const out: LayoutField[] = [];
  let offset = 0;
  let structAlign = 1;
  for (const field of normalizeFields(fields)) {
    if (field.name === "__proto__") {
      throw new Error("'__proto__' cannot be used as a field name");
    }
    const elementSize = sizeOfType(field.name, field.type);
    const size = elementSize * (field.count ?? 1);
    const align = Math.min(alignOf(field.type), limit);
    structAlign = Math.max(structAlign, align);
    offset = roundUp(offset, align);
    out.push({
      name: field.name,
      type: field.type,
      count: field.count,
      endian: field.endian,
      wrapperOptions: field.wrapperOptions,
      offset,
      elementSize,
      size,
    });
    offset += size;
  }
  return {
    fields: out,
    align: structAlign,
    size: roundUp(offset, structAlign),
  };
}
