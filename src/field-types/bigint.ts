import {
  COMPILE,
  type Codec,
  expectBigint,
  readWith,
  writeWith,
} from "../engine/codec";
import type { FieldOptions } from "../field";
import { CFieldType, type Endian } from "../field-type";

export type BigintKind = "u64" | "i64";

export type BigintTypeToTS<_K extends BigintKind> = bigint;

type BigintCodec = Codec<bigint>;

/** [little-endian, big-endian] codec per kind. */
const BIGINT_CODECS: Record<BigintKind, readonly [BigintCodec, BigintCodec]> = {
  u64: [
    {
      read: (ctx, at) => ctx.dv.getBigUint64(at, true),
      write: (ctx, at, value) =>
        ctx.dv.setBigUint64(at, expectBigint(value), true),
    },
    {
      read: (ctx, at) => ctx.dv.getBigUint64(at, false),
      write: (ctx, at, value) =>
        ctx.dv.setBigUint64(at, expectBigint(value), false),
    },
  ],
  i64: [
    {
      read: (ctx, at) => ctx.dv.getBigInt64(at, true),
      write: (ctx, at, value) =>
        ctx.dv.setBigInt64(at, expectBigint(value), true),
    },
    {
      read: (ctx, at) => ctx.dv.getBigInt64(at, false),
      write: (ctx, at, value) =>
        ctx.dv.setBigInt64(at, expectBigint(value), false),
    },
  ],
};

export function bigintCodec(kind: BigintKind, endian: Endian): BigintCodec {
  return BIGINT_CODECS[kind][endian === "big" ? 1 : 0];
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

  [COMPILE](endian: Endian): BigintCodec {
    return bigintCodec(this.kind, endian);
  }
}

export const u64 = <const O extends FieldOptions = {}>(options?: O) =>
  new CBigint("u64", options);
export const i64 = <const O extends FieldOptions = {}>(options?: O) =>
  new CBigint("i64", options);
