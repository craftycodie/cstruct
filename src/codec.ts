import { is_advanced_type } from "./advanced";
import { assert, VALID_INDEX } from "./assert";
import { is_enum_field, read_enum, write_enum } from "./enum";
import { CStructError } from "./errors";
import { is_pad_field } from "./pad";
import {
  type Endian,
  is_primitive_type,
  primitive_size,
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

function field_byte_size(type: FieldType): number {
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
  throw new CStructError(`Unknown field type: ${String(type)}`);
}

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

function read_union(
  target: Record<string, unknown>,
  bytes: Uint8Array,
  offset: number,
  endian: Endian,
  union: UnionField
): number {
  need_bytes(bytes, offset, union.size, `union(${union.name})`);

  const index = union.select(target);

  if (index === null) {
    need_bytes(
      bytes,
      offset,
      union.inactive.count,
      `union(${union.name}) inactive`
    );
    target[union.name] = null;
  } else {
    assert(VALID_INDEX(index, union.arms.length));
    const struct = union.arms[index];
    const arm_size = struct_byte_size(struct);
    target[union.name] = read(
      struct,
      bytes.subarray(offset, offset + arm_size),
      endian
    );
  }
  return offset + union.size;
}

function write_union(
  target: Record<string, unknown>,
  bytes: Uint8Array,
  offset: number,
  endian: Endian,
  union: UnionField
): number {
  const index = union.select(target);

  if (index === null) {
    bytes.fill(0, offset, offset + union.inactive.count);
    return offset + union.size;
  }

  assert(VALID_INDEX(index, union.arms.length));
  const value = target[union.name];
  if (value === null || value === undefined) {
    throw new CStructError(
      `Union "${union.name}" select returned ${index} but the field is not set`
    );
  }

  const struct = union.arms[index];
  const arm_bytes = write(struct, value as object, endian);
  bytes.set(arm_bytes, offset);
  if (arm_bytes.length < union.size) {
    bytes.fill(0, offset + arm_bytes.length, offset + union.size);
  }

  return offset + union.size;
}

function read_into<T extends object>(
  ctor: new () => T,
  target: T,
  bytes: Uint8Array,
  offset: number,
  endian: Endian
): number {
  const view = data_view(bytes);
  const record = target as Record<string, unknown>;
  let o = offset;

  for (const field of get_struct_meta(ctor).fields) {
    o += field.pad_before ?? 0;

    const type = field.type;
    if (is_pad_field(type)) {
      o += type.count;
    } else if (is_union_field(type)) {
      o = read_union(record, bytes, o, endian, type);
    } else if (is_enum_field(type)) {
      need_bytes(bytes, o, primitive_size(type.storage), field.name);
      const raw = read_primitive(view, o, type.storage, endian);
      record[field.name] = read_enum(raw, type, field.name);
      o += primitive_size(type.storage);
    } else if (is_primitive_type(type)) {
      need_bytes(bytes, o, primitive_size(type), field.name);
      record[field.name] = read_primitive(view, o, type, endian);
      o += primitive_size(type);
    } else if (is_struct_constructor(type)) {
      const size = struct_byte_size(type);
      record[field.name] = read(type, bytes.subarray(o, o + size), endian);
      o += size;
    } else if (is_advanced_type(type)) {
      record[field.name] = type.read(bytes, o, endian, field.name);
      o += type.byteSize;
    } else {
      throw new CStructError(`Unknown field type on ${field.name}`);
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
  const view = data_view(bytes);
  const record = instance as Record<string, unknown>;
  let o = 0;

  for (const field of meta.fields) {
    o += field.pad_before ?? 0;
    const type = field.type;

    if (is_pad_field(type)) {
      o += type.count;
    } else if (is_union_field(type)) {
      o = write_union(record, bytes, o, endian, type);
    } else {
      const value = record[field.name];
      if (is_enum_field(type)) {
        write_primitive(
          view,
          o,
          type.storage,
          write_enum(value, type, field.name),
          endian
        );
        o += primitive_size(type.storage);
      } else if (is_primitive_type(type)) {
        write_primitive(view, o, type, value as number | bigint, endian);
        o += primitive_size(type);
      } else if (is_struct_constructor(type)) {
        const nested_bytes = write(type, value as object, endian);
        bytes.set(nested_bytes, o);
        o += struct_byte_size(type);
      } else if (is_advanced_type(type)) {
        type.write(bytes, o, value, endian, field.name);
        o += type.byteSize;
      } else {
        throw new CStructError(`Unknown field type on ${field.name}`);
      }
    }

    o += field.pad_after ?? 0;
  }

  return bytes;
}

/** Packed byte size of a `@c.struct()` class. */
export function size(ctor: new () => object): number {
  return struct_byte_size(ctor);
}
