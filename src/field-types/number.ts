import {
  COMPILE,
  type Codec,
  type CompileEnv,
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

/** Validates a written value and returns it as a number. */
type Check = (value: unknown) => number;

/**
 * Accepted write range per integer kind: anything that fits the bit width as
 * either signed or unsigned, so the C idiom of writing -1 to a u32 still works.
 */
const INTEGER_RANGES: Partial<Record<NumberKind, readonly [number, number]>> = {
  u8: [-0x80, 0xff],
  i8: [-0x80, 0xff],
  u16: [-0x80_00, 0xff_ff],
  i16: [-0x80_00, 0xff_ff],
  u32: [-0x80_00_00_00, 0xff_ff_ff_ff],
  i32: [-0x80_00_00_00, 0xff_ff_ff_ff],
};

function rangeCheck(kind: NumberKind): Check {
  const range = INTEGER_RANGES[kind];
  if (!range) {
    return expectNumber;
  }
  const [min, max] = range;
  return (value) => {
    const n = expectNumber(value);
    if (!Number.isInteger(n)) {
      throw new RangeError(`${n} is not an integer (${kind})`);
    }
    if (n < min || n > max) {
      throw new RangeError(`${n} is out of range for ${kind}`);
    }
    return n;
  };
}

/** [little-endian, big-endian] codecs per kind, validating writes with `check`. */
const CODEC_FACTORIES: Record<
  NumberKind,
  (check: Check) => readonly [NumberCodec, NumberCodec]
> = {
  u8: (check) => {
    const codec: NumberCodec = {
      read: (ctx, at) => ctx.u8[at],
      readSource: (at) => `u8[${at}]`,
      write: (ctx, at, value) => {
        ctx.u8[at] = check(value);
      },
    };
    return [codec, codec];
  },
  i8: (check) => {
    const codec: NumberCodec = {
      read: (ctx, at) => (ctx.u8[at] << 24) >> 24,
      readSource: (at) => `((u8[${at}] << 24) >> 24)`,
      write: (ctx, at, value) => {
        ctx.u8[at] = check(value);
      },
    };
    return [codec, codec];
  },
  u16: (check) => [
    {
      read: (ctx, at) => ctx.dv.getUint16(at, true),
      readSource: (at) => `dv.getUint16(${at}, true)`,
      write: (ctx, at, value) => ctx.dv.setUint16(at, check(value), true),
    },
    {
      read: (ctx, at) => ctx.dv.getUint16(at, false),
      readSource: (at) => `dv.getUint16(${at}, false)`,
      write: (ctx, at, value) => ctx.dv.setUint16(at, check(value), false),
    },
  ],
  i16: (check) => [
    {
      read: (ctx, at) => ctx.dv.getInt16(at, true),
      readSource: (at) => `dv.getInt16(${at}, true)`,
      write: (ctx, at, value) => ctx.dv.setInt16(at, check(value), true),
    },
    {
      read: (ctx, at) => ctx.dv.getInt16(at, false),
      readSource: (at) => `dv.getInt16(${at}, false)`,
      write: (ctx, at, value) => ctx.dv.setInt16(at, check(value), false),
    },
  ],
  u32: (check) => [
    {
      read: (ctx, at) => ctx.dv.getUint32(at, true),
      readSource: (at) => `dv.getUint32(${at}, true)`,
      write: (ctx, at, value) => ctx.dv.setUint32(at, check(value), true),
    },
    {
      read: (ctx, at) => ctx.dv.getUint32(at, false),
      readSource: (at) => `dv.getUint32(${at}, false)`,
      write: (ctx, at, value) => ctx.dv.setUint32(at, check(value), false),
    },
  ],
  i32: (check) => [
    {
      read: (ctx, at) => ctx.dv.getInt32(at, true),
      readSource: (at) => `dv.getInt32(${at}, true)`,
      write: (ctx, at, value) => ctx.dv.setInt32(at, check(value), true),
    },
    {
      read: (ctx, at) => ctx.dv.getInt32(at, false),
      readSource: (at) => `dv.getInt32(${at}, false)`,
      write: (ctx, at, value) => ctx.dv.setInt32(at, check(value), false),
    },
  ],
  f32: (check) => [
    {
      read: (ctx, at) => ctx.dv.getFloat32(at, true),
      readSource: (at) => `dv.getFloat32(${at}, true)`,
      write: (ctx, at, value) => ctx.dv.setFloat32(at, check(value), true),
    },
    {
      read: (ctx, at) => ctx.dv.getFloat32(at, false),
      readSource: (at) => `dv.getFloat32(${at}, false)`,
      write: (ctx, at, value) => ctx.dv.setFloat32(at, check(value), false),
    },
  ],
  f64: (check) => [
    {
      read: (ctx, at) => ctx.dv.getFloat64(at, true),
      readSource: (at) => `dv.getFloat64(${at}, true)`,
      write: (ctx, at, value) => ctx.dv.setFloat64(at, check(value), true),
    },
    {
      read: (ctx, at) => ctx.dv.getFloat64(at, false),
      readSource: (at) => `dv.getFloat64(${at}, false)`,
      write: (ctx, at, value) => ctx.dv.setFloat64(at, check(value), false),
    },
  ],
};

type CodecTable = Record<NumberKind, readonly [NumberCodec, NumberCodec]>;
const UNCHECKED_CODECS = {} as CodecTable;
const CHECKED_CODECS = {} as CodecTable;
for (const kind of Object.keys(CODEC_FACTORIES) as NumberKind[]) {
  UNCHECKED_CODECS[kind] = CODEC_FACTORIES[kind](expectNumber);
  CHECKED_CODECS[kind] = CODEC_FACTORIES[kind](rangeCheck(kind));
}

export function numberCodec(kind: NumberKind, env: CompileEnv): NumberCodec {
  const table = env.checked ? CHECKED_CODECS : UNCHECKED_CODECS;
  return table[kind][env.endian === "big" ? 1 : 0];
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

  getAlign(): number {
    return NUMBER_TYPE_SIZES[this.kind];
  }

  read(buffer: Uint8Array, offset: number, endian: Endian): NumberTypeToTS<K> {
    return readWith(this, buffer, offset, endian);
  }

  write(
    buffer: Uint8Array,
    offset: number,
    value: NumberTypeToTS<K>,
    endian: Endian
  ): void {
    writeWith(this, buffer, offset, value, endian);
  }

  [COMPILE](env: CompileEnv): NumberCodec {
    return numberCodec(this.kind, env);
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
