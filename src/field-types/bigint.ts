import {
  COMPILE,
  type Codec,
  type CompileEnv,
  expectBigint,
  readWith,
  writeWith,
} from "../engine/codec";
import type { FieldOptions } from "../field";
import { CFieldType, type Endian } from "../field-type";

export type BigintKind = "u64" | "i64";

export type BigintTypeToTS<_K extends BigintKind> = bigint;

type BigintCodec = Codec<bigint>;

/** Validates a written value and returns it as a bigint. */
type Check = (value: unknown) => bigint;

const MIN_64 = -(2n ** 63n);
const MAX_64 = 2n ** 64n - 1n;

function rangeCheck(kind: BigintKind): Check {
  return (value) => {
    const n = expectBigint(value);
    if (n < MIN_64 || n > MAX_64) {
      throw new RangeError(`${n} is out of range for ${kind}`);
    }
    return n;
  };
}

/** [little-endian, big-endian] codecs per kind, validating writes with `check`. */
const CODEC_FACTORIES: Record<
  BigintKind,
  (check: Check) => readonly [BigintCodec, BigintCodec]
> = {
  u64: (check) => [
    {
      read: (ctx, at) => ctx.dv.getBigUint64(at, true),
      write: (ctx, at, value) => ctx.dv.setBigUint64(at, check(value), true),
    },
    {
      read: (ctx, at) => ctx.dv.getBigUint64(at, false),
      write: (ctx, at, value) => ctx.dv.setBigUint64(at, check(value), false),
    },
  ],
  i64: (check) => [
    {
      read: (ctx, at) => ctx.dv.getBigInt64(at, true),
      write: (ctx, at, value) => ctx.dv.setBigInt64(at, check(value), true),
    },
    {
      read: (ctx, at) => ctx.dv.getBigInt64(at, false),
      write: (ctx, at, value) => ctx.dv.setBigInt64(at, check(value), false),
    },
  ],
};

const UNCHECKED_CODECS = {
  u64: CODEC_FACTORIES.u64(expectBigint),
  i64: CODEC_FACTORIES.i64(expectBigint),
};
const CHECKED_CODECS = {
  u64: CODEC_FACTORIES.u64(rangeCheck("u64")),
  i64: CODEC_FACTORIES.i64(rangeCheck("i64")),
};

export function bigintCodec(kind: BigintKind, env: CompileEnv): BigintCodec {
  const table = env.checked ? CHECKED_CODECS : UNCHECKED_CODECS;
  return table[kind][env.endian === "big" ? 1 : 0];
}

export class CBigint<
  K extends BigintKind = BigintKind,
  const O extends FieldOptions = {},
> extends CFieldType<BigintTypeToTS<K>, O> {
  readonly kind: K;

  constructor(kind: K, options?: O) {
    super(options);
    this.kind = kind;
  }

  getSize(): number {
    return 8;
  }

  getAlign(): number {
    return 8;
  }

  read(buffer: Uint8Array, offset: number, endian: Endian): BigintTypeToTS<K> {
    return readWith(this, buffer, offset, endian);
  }

  write(
    buffer: Uint8Array,
    offset: number,
    value: BigintTypeToTS<K>,
    endian: Endian
  ): void {
    writeWith(this, buffer, offset, value, endian);
  }

  [COMPILE](env: CompileEnv): BigintCodec {
    return bigintCodec(this.kind, env);
  }
}

export const u64 = <const O extends FieldOptions = {}>(options?: O) =>
  new CBigint("u64", options);
export const i64 = <const O extends FieldOptions = {}>(options?: O) =>
  new CBigint("i64", options);
