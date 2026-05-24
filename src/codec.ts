import { is_advanced_type } from "./advanced";
import {
  type ArrayField,
  is_array_field,
  validate_array_length,
} from "./array";
import { assert, VALID_INDEX } from "./assert";
import { is_bitfield_field, read_bitfield, write_bitfield } from "./bitfield";
import { is_enum_field, read_enum, write_enum } from "./enum";
import { CStructError } from "./errors";
import { field_byte_size } from "./field-size";
import { is_pad_field } from "./pad";
import {
  type Endian,
  is_primitive_type,
  read_primitive,
  write_primitive,
} from "./primitive";
import type { FieldType, StructFieldMeta } from "./struct";
import {
  get_struct_meta,
  is_struct_constructor,
  struct_byte_size,
} from "./struct";
import { is_union_field, type UnionField } from "./union";

export function compute_struct_size(fields: StructFieldMeta[]): number {
  let size = 0;
  for (const field of fields) {
    size += field.pad_before ?? 0;
    size += field_byte_size(field.type);
    size += field.pad_after ?? 0;
  }
  return size;
}

function data_view(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

function need_bytes(
  bytes: Uint8Array,
  offset: number,
  size: number,
  label: string
): void {
  if (offset + size > bytes.length) {
    throw new CStructError(
      `Cannot read ${label}: need ${size} bytes at offset ${offset}, have ${bytes.length - offset}`
    );
  }
}

function read_union_slot(
  parent: Record<string, unknown>,
  bytes: Uint8Array,
  offset: number,
  endian: Endian,
  union: UnionField,
  label: string
): { value: unknown; offset: number } {
  need_bytes(bytes, offset, union.size, label);
  const index = union.select(parent);

  if (index === null) {
    need_bytes(bytes, offset, union.inactive.count, `${label} inactive`);
    return { value: null, offset: offset + union.size };
  }

  assert(VALID_INDEX(index, union.arms.length));
  const struct = union.arms[index];
  const arm_size = struct_byte_size(struct);
  return {
    value: read(struct, bytes.subarray(offset, offset + arm_size), endian),
    offset: offset + union.size,
  };
}

function resolve_union_arm_index(
  union: UnionField,
  parent: Record<string, unknown>,
  value: unknown,
  label: string
): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  const object = value as object;
  for (let i = 0; i < union.arms.length; i++) {
    if (object instanceof union.arms[i]) {
      return i;
    }
  }
  const from_select = union.select(parent);
  if (from_select !== null) {
    return from_select;
  }
  throw new CStructError(
    `${label}: value does not match any union arm and parent select returned null`
  );
}

function write_union_slot(
  bytes: Uint8Array,
  offset: number,
  endian: Endian,
  union: UnionField,
  value: unknown,
  label: string,
  parent: Record<string, unknown>
): number {
  const arm_index = resolve_union_arm_index(union, parent, value, label);

  if (arm_index === null) {
    bytes.fill(0, offset, offset + union.inactive.count);
    return offset + union.size;
  }

  assert(VALID_INDEX(arm_index, union.arms.length));
  const struct = union.arms[arm_index];
  const arm_bytes = write(struct, value as object, endian);
  bytes.set(arm_bytes, offset);
  if (arm_bytes.length < union.size) {
    bytes.fill(0, offset + arm_bytes.length, offset + union.size);
  }
  return offset + union.size;
}

function read_array_elements(
  field: ArrayField,
  bytes: Uint8Array,
  offset: number,
  endian: Endian,
  label: string,
  parent: Record<string, unknown>
): { value: unknown[]; offset: number } {
  const { count, element, elementSize } = field;
  need_bytes(bytes, offset, count * elementSize, label);

  const items: unknown[] = [];
  let o = offset;
  for (let i = 0; i < count; i++) {
    const result = read_element(
      element,
      bytes,
      o,
      endian,
      `${label}[${i}]`,
      parent
    );
    items.push(result.value);
    o = result.offset;
  }
  return { value: items, offset: o };
}

function write_array_elements(
  field: ArrayField,
  bytes: Uint8Array,
  offset: number,
  endian: Endian,
  label: string,
  value: unknown,
  parent: Record<string, unknown>
): number {
  const { count, element } = field;

  validate_array_length(value, field, label);
  const items = value as unknown[];
  let o = offset;
  for (let i = 0; i < count; i++) {
    o = write_element(
      element,
      bytes,
      o,
      endian,
      `${label}[${i}]`,
      items[i],
      parent
    );
  }
  return o;
}

function read_element(
  element: FieldType,
  bytes: Uint8Array,
  offset: number,
  endian: Endian,
  label: string,
  parent: Record<string, unknown>
): { value: unknown; offset: number } {
  const view = data_view(bytes);
  const size = field_byte_size(element);

  if (is_pad_field(element)) {
    need_bytes(bytes, offset, size, label);
    return { value: undefined, offset: offset + size };
  }

  if (is_union_field(element)) {
    return read_union_slot(parent, bytes, offset, endian, element, label);
  }

  if (is_enum_field(element)) {
    need_bytes(bytes, offset, size, label);
    const raw = read_primitive(view, offset, element.storage, endian);
    return {
      value: read_enum(raw, element, label),
      offset: offset + size,
    };
  }

  if (is_bitfield_field(element)) {
    need_bytes(bytes, offset, size, label);
    const raw = read_primitive(view, offset, element.storage, endian);
    return {
      value: read_bitfield(raw, element),
      offset: offset + size,
    };
  }

  if (is_array_field(element)) {
    return read_array_elements(element, bytes, offset, endian, label, parent);
  }

  if (is_primitive_type(element)) {
    need_bytes(bytes, offset, size, label);
    return {
      value: read_primitive(view, offset, element, endian),
      offset: offset + size,
    };
  }

  if (is_struct_constructor(element)) {
    need_bytes(bytes, offset, size, label);
    return {
      value: read(element, bytes.subarray(offset, offset + size), endian),
      offset: offset + size,
    };
  }

  if (is_advanced_type(element)) {
    return {
      value: element.read(bytes, offset, endian, label),
      offset: offset + element.byteSize,
    };
  }

  throw new CStructError(`Unknown field type on ${label}`);
}

function write_element(
  element: FieldType,
  bytes: Uint8Array,
  offset: number,
  endian: Endian,
  label: string,
  value: unknown,
  parent: Record<string, unknown>
): number {
  const view = data_view(bytes);
  const size = field_byte_size(element);

  if (is_pad_field(element)) {
    bytes.fill(0, offset, offset + size);
    return offset + size;
  }

  if (is_union_field(element)) {
    return write_union_slot(
      bytes,
      offset,
      endian,
      element,
      value,
      label,
      parent
    );
  }

  if (is_enum_field(element)) {
    write_primitive(
      view,
      offset,
      element.storage,
      write_enum(value, element, label),
      endian
    );
    return offset + size;
  }

  if (is_bitfield_field(element)) {
    write_primitive(
      view,
      offset,
      element.storage,
      write_bitfield(value, element, label),
      endian
    );
    return offset + size;
  }

  if (is_array_field(element)) {
    return write_array_elements(
      element,
      bytes,
      offset,
      endian,
      label,
      value,
      parent
    );
  }

  if (is_primitive_type(element)) {
    write_primitive(view, offset, element, value as number | bigint, endian);
    return offset + size;
  }

  if (is_struct_constructor(element)) {
    const nested_bytes = write(element, value as object, endian);
    bytes.set(nested_bytes, offset);
    return offset + size;
  }

  if (is_advanced_type(element)) {
    element.write(bytes, offset, value, endian, label);
    return offset + element.byteSize;
  }

  throw new CStructError(`Unknown field type on ${label}`);
}

function read_union(
  target: Record<string, unknown>,
  bytes: Uint8Array,
  offset: number,
  endian: Endian,
  union: UnionField
): number {
  const result = read_union_slot(
    target,
    bytes,
    offset,
    endian,
    union,
    `union(${union.name})`
  );
  target[union.name] = result.value;
  return result.offset;
}

function write_union(
  target: Record<string, unknown>,
  bytes: Uint8Array,
  offset: number,
  endian: Endian,
  union: UnionField
): number {
  return write_union_slot(
    bytes,
    offset,
    endian,
    union,
    target[union.name],
    `union(${union.name})`,
    target
  );
}

function read_into<T extends object>(
  ctor: new () => T,
  target: T,
  bytes: Uint8Array,
  offset: number,
  endian: Endian
): number {
  const record = target as Record<string, unknown>;
  let o = offset;

  for (const field of get_struct_meta(ctor).fields) {
    o += field.pad_before ?? 0;

    const type = field.type;
    if (is_pad_field(type)) {
      o += type.count;
    } else if (is_union_field(type)) {
      o = read_union(record, bytes, o, endian, type);
    } else {
      const result = read_element(type, bytes, o, endian, field.name, record);
      record[field.name] = result.value;
      o = result.offset;
    }

    o += field.pad_after ?? 0;
  }

  return o;
}

/** Parse a `@c.struct()` class from bytes (read starts at index 0; slice the buffer if needed). */
export function read<T extends object>(
  ctor: new () => T,
  bytes: Uint8Array,
  endian: Endian = "little"
): T {
  const instance = new ctor();
  read_into(ctor, instance, bytes, 0, endian);
  return instance;
}

/** Serialize a `@c.struct()` instance to a new `Uint8Array`. */
export function write<T extends object>(
  ctor: new () => T,
  instance: T,
  endian: Endian = "little"
): Uint8Array {
  const meta = get_struct_meta(ctor);
  const bytes = new Uint8Array(meta.size);
  const record = instance as Record<string, unknown>;
  let o = 0;

  for (const field of meta.fields) {
    o += field.pad_before ?? 0;
    const type = field.type;

    if (is_union_field(type)) {
      o = write_union(record, bytes, o, endian, type);
    } else {
      const value = is_pad_field(type) ? undefined : record[field.name];
      o = write_element(type, bytes, o, endian, field.name, value, record);
    }

    o += field.pad_after ?? 0;
  }

  return bytes;
}

/** Packed byte size of a `@c.struct()` class. */
export function size(ctor: new () => object): number {
  return struct_byte_size(ctor);
}
