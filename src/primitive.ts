/** Byte order for multi-byte primitives (`"little"` or `"big"`). */
export type Endian = "little" | "big";

/**
 * Primitive type for packed integers and floats passed to `@c.field("u32")`, `c.enum("i8", …)`, etc.
 *
 * `u64` and `i64` read and write as JavaScript `bigint`.
 */
export type PrimitiveType =
  | "u8"
  | "u16"
  | "u32"
  | "u64"
  | "i8"
  | "i16"
  | "i32"
  | "i64"
  | "f32"
  | "f64";

const PRIMITIVE_TYPE_SIZES: Record<PrimitiveType, number> = {
  u8: 1,
  u16: 2,
  u32: 4,
  u64: 8,
  i8: 1,
  i16: 2,
  i32: 4,
  i64: 8,
  f32: 4,
  f64: 8,
};

/** @internal */
export function is_primitive_type(type: unknown): type is PrimitiveType {
  return typeof type === "string" && type in PRIMITIVE_TYPE_SIZES;
}

/** @internal */
export function primitive_size(type: PrimitiveType): number {
  return PRIMITIVE_TYPE_SIZES[type];
}

/** @internal */
export function read_primitive(
  view: DataView,
  offset: number,
  type: PrimitiveType,
  endian: Endian
): number | bigint {
  const le = endian === "little";
  switch (type) {
    case "u8":
      return view.getUint8(offset);
    case "u16":
      return view.getUint16(offset, le);
    case "u32":
      return view.getUint32(offset, le);
    case "u64":
      return view.getBigUint64(offset, le);
    case "i8":
      return view.getInt8(offset);
    case "i16":
      return view.getInt16(offset, le);
    case "i32":
      return view.getInt32(offset, le);
    case "i64":
      return view.getBigInt64(offset, le);
    case "f32":
      return view.getFloat32(offset, le);
    case "f64":
      return view.getFloat64(offset, le);
    default:
      throw new Error(`Unsupported primitive type: ${type satisfies never}`);
  }
}

/** @internal */
export function write_primitive(
  view: DataView,
  offset: number,
  type: PrimitiveType,
  value: number | bigint,
  endian: Endian
): void {
  const le = endian === "little";
  switch (type) {
    case "u8":
      view.setUint8(offset, value as number);
      break;
    case "u16":
      view.setUint16(offset, value as number, le);
      break;
    case "u32":
      view.setUint32(offset, value as number, le);
      break;
    case "u64":
      view.setBigUint64(offset, value as bigint, le);
      break;
    case "i8":
      view.setInt8(offset, value as number);
      break;
    case "i16":
      view.setInt16(offset, value as number, le);
      break;
    case "i32":
      view.setInt32(offset, value as number, le);
      break;
    case "i64":
      view.setBigInt64(offset, value as bigint, le);
      break;
    case "f32":
      view.setFloat32(offset, value as number, le);
      break;
    case "f64":
      view.setFloat64(offset, value as number, le);
      break;
    default:
      throw new Error(`Unsupported primitive type: ${type satisfies never}`);
  }
}
