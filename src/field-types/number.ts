import type { FieldOptions } from "../field";
import { CFieldType, type Endian } from "../field-type";

export type NumberKind =
  | "u8"
  | "u16"
  | "u32"
  | "i8"
  | "i16"
  | "i32"
  | "f32"
  | "f64";

export type NumberTypeToTS<_K extends NumberKind> = number;

const NUMBER_TYPE_SIZES: Record<NumberKind, number> = {
  u8: 1,
  u16: 2,
  u32: 4,
  i8: 1,
  i16: 2,
  i32: 4,
  f32: 4,
  f64: 8,
};

export class CNumber<
  K extends NumberKind = NumberKind,
  const O extends FieldOptions = {},
> extends CFieldType<NumberTypeToTS<K>, O> {
  readonly kind: K;

  constructor(kind: K, options?: O) {
    super(options);
    this.kind = kind;
  }

  getSize(): number {
    return NUMBER_TYPE_SIZES[this.kind];
  }

  read(buffer: Buffer, offset: number, endian: Endian): NumberTypeToTS<K> {
    const view = new DataView(
      buffer.buffer,
      buffer.byteOffset,
      buffer.byteLength
    );
    return readNumberValue(
      view,
      offset,
      this,
      endian === "little"
    ) as NumberTypeToTS<K>;
  }

  write(
    buffer: Buffer,
    offset: number,
    value: NumberTypeToTS<K>,
    endian: Endian
  ): void {
    const view = new DataView(
      buffer.buffer,
      buffer.byteOffset,
      buffer.byteLength
    );
    writeNumberValue(view, offset, this, value, endian === "little");
  }
}

export const u8 = <const O extends FieldOptions = {}>(options?: O) =>
  new CNumber("u8", options);
export const u16 = <const O extends FieldOptions = {}>(options?: O) =>
  new CNumber("u16", options);
export const u32 = <const O extends FieldOptions = {}>(options?: O) =>
  new CNumber("u32", options);
export const i8 = <const O extends FieldOptions = {}>(options?: O) =>
  new CNumber("i8", options);
export const i16 = <const O extends FieldOptions = {}>(options?: O) =>
  new CNumber("i16", options);
export const i32 = <const O extends FieldOptions = {}>(options?: O) =>
  new CNumber("i32", options);
export const f32 = <const O extends FieldOptions = {}>(options?: O) =>
  new CNumber("f32", options);
export const f64 = <const O extends FieldOptions = {}>(options?: O) =>
  new CNumber("f64", options);

export function getNumberTypeSize(type: CNumber): number {
  return type.getSize();
}

export function readNumberValue(
  view: DataView,
  offset: number,
  type: CNumber,
  littleEndian = true
): number {
  switch (type.kind) {
    case "u8":
      return view.getUint8(offset);
    case "u16":
      return view.getUint16(offset, littleEndian);
    case "u32":
      return view.getUint32(offset, littleEndian);
    case "i8":
      return view.getInt8(offset);
    case "i16":
      return view.getInt16(offset, littleEndian);
    case "i32":
      return view.getInt32(offset, littleEndian);
    case "f32":
      return view.getFloat32(offset, littleEndian);
    case "f64":
      return view.getFloat64(offset, littleEndian);
    default:
      throw new Error(`Unsupported number kind: ${type.kind}`);
  }
}

export function writeNumberValue(
  view: DataView,
  offset: number,
  type: CNumber,
  value: number,
  littleEndian = true
): void {
  switch (type.kind) {
    case "u8":
      view.setUint8(offset, value);
      break;
    case "u16":
      view.setUint16(offset, value, littleEndian);
      break;
    case "u32":
      view.setUint32(offset, value, littleEndian);
      break;
    case "i8":
      view.setInt8(offset, value);
      break;
    case "i16":
      view.setInt16(offset, value, littleEndian);
      break;
    case "i32":
      view.setInt32(offset, value, littleEndian);
      break;
    case "f32":
      view.setFloat32(offset, value, littleEndian);
      break;
    case "f64":
      view.setFloat64(offset, value, littleEndian);
      break;
    default:
      throw new Error(`Unsupported number kind: ${type.kind}`);
  }
}
