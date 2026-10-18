import {
  COMPILE,
  type Codec,
  expectObject,
  NO_PARENT,
  readWith,
  writeWith,
} from "../engine/codec";
import type { FieldOptions } from "../field";
import { CFieldType, type Endian } from "../field-type";
import { CBigint } from "./bigint";
import { type CNumeric, isSignedNumeric, numericCodec } from "./numeric";

/** Sign-extend the low `bits` bits of `value` (for signed storage types). */
function toSigned(value: number, bits: number): number {
  const shift = 32 - bits;
  return (value << shift) >> shift;
}

export class CBitfield<
  const K extends readonly string[],
  T extends CNumeric,
  const O extends FieldOptions = {},
> extends CFieldType<
  {
    [Key in K[number]]: boolean;
  },
  O
> {
  private readonly keys: readonly string[];
  private readonly type: T;

  constructor(keys: K, type: T, options?: O) {
    super(options);
    const capacity = type.getSize() * 8;
    if (keys.length > capacity) {
      throw new Error(
        `Bitfield has ${keys.length} flags but ${type.kind} storage holds ${capacity}`
      );
    }
    this.keys = keys;
    this.type = type;
  }

  getSize(): number {
    return this.type.getSize();
  }

  read(
    buffer: Buffer,
    offset: number,
    endian: Endian
  ): {
    [Key in K[number]]: boolean;
  } {
    return readWith(this, buffer, offset, endian);
  }

  write(
    buffer: Buffer,
    offset: number,
    value: { [Key in K[number]]: boolean },
    endian: Endian
  ): void {
    writeWith(this, buffer, offset, value, endian);
  }

  [COMPILE](endian: Endian): Codec<Record<string, boolean>> {
    const keys = this.keys;
    const count = keys.length;

    if (this.type instanceof CBigint) {
      // 64-bit storage: work on two 32-bit words to stay in number arithmetic.
      const little = endian === "little";
      const loAt = little ? 0 : 4;
      const hiAt = little ? 4 : 0;
      return {
        read: (ctx, at) => {
          const lo = ctx.dv.getUint32(at + loAt, little);
          const hi = ctx.dv.getUint32(at + hiAt, little);
          const out: Record<string, boolean> = {};
          for (let i = 0; i < count; i++) {
            const word = i < 32 ? lo : hi;
            out[keys[i]] = ((word >>> (i & 31)) & 1) === 1;
          }
          return out;
        },
        write: (ctx, at, value) => {
          const flags = expectObject(value);
          let lo = 0;
          let hi = 0;
          for (let i = 0; i < count; i++) {
            if (flags[keys[i]]) {
              if (i < 32) {
                lo |= 1 << i;
              } else {
                hi |= 1 << (i - 32);
              }
            }
          }
          ctx.dv.setUint32(at + loAt, lo >>> 0, little);
          ctx.dv.setUint32(at + hiAt, hi >>> 0, little);
        },
      };
    }

    const storage = numericCodec(this.type, endian) as Codec<number>;
    const width = this.type.getSize() * 8;
    const signed = isSignedNumeric(this.type);
    return {
      read: (ctx, at) => {
        const bits = storage.read(ctx, at, NO_PARENT);
        const out: Record<string, boolean> = {};
        for (let i = 0; i < count; i++) {
          out[keys[i]] = ((bits >>> i) & 1) === 1;
        }
        return out;
      },
      write: (ctx, at, value) => {
        const flags = expectObject(value);
        let bits = 0;
        for (let i = 0; i < count; i++) {
          if (flags[keys[i]]) {
            bits |= 1 << i;
          }
        }
        storage.write(
          ctx,
          at,
          signed ? toSigned(bits, width) : bits >>> 0,
          NO_PARENT
        );
      },
    };
  }
}
