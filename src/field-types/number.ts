import {
  COMPILE,
  type Codec,
  expectNumber,
  readWith,
  writeWith,
} from "../engine/codec";
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

type NumberCodec = Codec<number>;

const U8: NumberCodec = {
  read: (ctx, at) => ctx.u8[at],
  write: (ctx, at, value) => {
    ctx.u8[at] = expectNumber(value);
  },
};

const I8: NumberCodec = {
  read: (ctx, at) => (ctx.u8[at] << 24) >> 24,
  write: (ctx, at, value) => {
    ctx.u8[at] = expectNumber(value);
  },
};

/** [little-endian, big-endian] codec per kind. */
const NUMBER_CODECS: Record<NumberKind, readonly [NumberCodec, NumberCodec]> = {
  u8: [U8, U8],
  i8: [I8, I8],
  u16: [
    {
      read: (ctx, at) => ctx.dv.getUint16(at, true),
      write: (ctx, at, value) =>
        ctx.dv.setUint16(at, expectNumber(value), true),
    },
    {
      read: (ctx, at) => ctx.dv.getUint16(at, false),
      write: (ctx, at, value) =>
        ctx.dv.setUint16(at, expectNumber(value), false),
    },
  ],
  i16: [
    {
      read: (ctx, at) => ctx.dv.getInt16(at, true),
      write: (ctx, at, value) => ctx.dv.setInt16(at, expectNumber(value), true),
    },
    {
      read: (ctx, at) => ctx.dv.getInt16(at, false),
      write: (ctx, at, value) =>
        ctx.dv.setInt16(at, expectNumber(value), false),
    },
  ],
  u32: [
    {
      read: (ctx, at) => ctx.dv.getUint32(at, true),
      write: (ctx, at, value) =>
        ctx.dv.setUint32(at, expectNumber(value), true),
    },
    {
      read: (ctx, at) => ctx.dv.getUint32(at, false),
      write: (ctx, at, value) =>
        ctx.dv.setUint32(at, expectNumber(value), false),
    },
  ],
  i32: [
    {
      read: (ctx, at) => ctx.dv.getInt32(at, true),
      write: (ctx, at, value) => ctx.dv.setInt32(at, expectNumber(value), true),
    },
    {
      read: (ctx, at) => ctx.dv.getInt32(at, false),
      write: (ctx, at, value) =>
        ctx.dv.setInt32(at, expectNumber(value), false),
    },
  ],
  f32: [
    {
      read: (ctx, at) => ctx.dv.getFloat32(at, true),
      write: (ctx, at, value) =>
        ctx.dv.setFloat32(at, expectNumber(value), true),
    },
    {
      read: (ctx, at) => ctx.dv.getFloat32(at, false),
      write: (ctx, at, value) =>
        ctx.dv.setFloat32(at, expectNumber(value), false),
    },
  ],
  f64: [
    {
      read: (ctx, at) => ctx.dv.getFloat64(at, true),
      write: (ctx, at, value) =>
        ctx.dv.setFloat64(at, expectNumber(value), true),
    },
    {
      read: (ctx, at) => ctx.dv.getFloat64(at, false),
      write: (ctx, at, value) =>
        ctx.dv.setFloat64(at, expectNumber(value), false),
    },
  ],
};

export function numberCodec(kind: NumberKind, endian: Endian): NumberCodec {
  return NUMBER_CODECS[kind][endian === "big" ? 1 : 0];
}

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
    return readWith(this, buffer, offset, endian);
  }

  write(
    buffer: Buffer,
    offset: number,
    value: NumberTypeToTS<K>,
    endian: Endian
  ): void {
    writeWith(this, buffer, offset, value, endian);
  }

  [COMPILE](endian: Endian): NumberCodec {
    return numberCodec(this.kind, endian);
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
