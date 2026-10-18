import {
  COMPILE,
  type Codec,
  type CompileEnv,
  expectNumber,
  expectObject,
  NO_PARENT,
  readWith,
  writeWith,
} from "../engine/codec";
import type { FieldOptions } from "../field";
import { CFieldType, type Endian } from "../field-type";
import { CBigint } from "./bigint";
import { type CNumeric, isSignedNumeric, numericCodec } from "./numeric";

export type BitsSpec = Readonly<Record<string, number>>;

export type BitsValue<S extends BitsSpec> = { [K in keyof S]: number };

/** Sign-extend the low `bits` bits of `value` (for signed storage types). */
function toSigned(value: number, bits: number): number {
  const shift = 32 - bits;
  return (value << shift) >> shift;
}

/** Mask of `width` low bits, as an unsigned 32-bit number. */
function maskOf(width: number): number {
  return width === 32 ? 0xff_ff_ff_ff : (1 << width) - 1;
}

/**
 * C bit-fields packed into one storage unit, e.g.
 * `c.bits({ mode: 3, flags: 5 }, c.u8())` for `uint8_t mode : 3, flags : 5;`.
 * Fields are assigned from the least significant bit up, as GCC, Clang and
 * MSVC do on little-endian targets. Values are unsigned, 1 to 32 bits wide.
 */
export class CBits<
  const S extends BitsSpec,
  T extends CNumeric,
  const O extends FieldOptions = {},
> extends CFieldType<BitsValue<S>, O> {
  readonly spec: S;
  readonly type: T;
  private readonly names: string[];
  private readonly shifts: number[];
  private readonly widths: number[];

  constructor(spec: S, type: T, options?: O) {
    super(options);
    this.spec = spec;
    this.type = type;
    this.names = Object.keys(spec);
    this.shifts = [];
    this.widths = [];
    const capacity = type.getSize() * 8;
    let shift = 0;
    for (const name of this.names) {
      const width = spec[name];
      if (!Number.isInteger(width) || width < 1 || width > 32) {
        throw new RangeError(
          `bit-field '${name}' width must be an integer from 1 to 32, got ${width}`
        );
      }
      this.shifts.push(shift);
      this.widths.push(width);
      shift += width;
    }
    if (shift > capacity) {
      throw new RangeError(
        `bit-fields need ${shift} bits but ${type.kind} storage holds ${capacity}`
      );
    }
  }

  getSize(): number {
    return this.type.getSize();
  }

  getAlign(): number {
    return this.type.getAlign();
  }

  read(buffer: Uint8Array, offset: number, endian: Endian): BitsValue<S> {
    return readWith(this, buffer, offset, endian);
  }

  write(
    buffer: Uint8Array,
    offset: number,
    value: BitsValue<S>,
    endian: Endian
  ): void {
    writeWith(this, buffer, offset, value, endian);
  }

  [COMPILE](env: CompileEnv): Codec<Record<string, number>> {
    const { names, shifts, widths } = this;
    const count = names.length;
    const masks = widths.map(maskOf);
    const { checked } = env;

    /** Validate (checked) or mask (unchecked) one field value. */
    const fieldValue = (index: number, value: unknown): number => {
      const n = expectNumber(value);
      const mask = masks[index];
      if (checked) {
        if (!Number.isInteger(n) || n < 0 || n > mask) {
          throw new RangeError(
            `${n} does not fit in ${widths[index]}-bit field '${names[index]}'`
          );
        }
        return n;
      }
      return (n & mask) >>> 0;
    };

    if (this.type instanceof CBigint) {
      // 64-bit storage: two 32-bit words so all arithmetic stays in numbers.
      const little = env.endian === "little";
      const loAt = little ? 0 : 4;
      const hiAt = little ? 4 : 0;
      return {
        read: (ctx, at) => {
          const lo = ctx.dv.getUint32(at + loAt, little);
          const hi = ctx.dv.getUint32(at + hiAt, little);
          const out: Record<string, number> = {};
          for (let i = 0; i < count; i++) {
            const shift = shifts[i];
            let bits: number;
            if (shift >= 32) {
              bits = hi >>> (shift - 32);
            } else if (shift + widths[i] > 32) {
              bits = (lo >>> shift) | (hi << (32 - shift));
            } else {
              bits = lo >>> shift;
            }
            out[names[i]] = (bits & masks[i]) >>> 0;
          }
          return out;
        },
        write: (ctx, at, value) => {
          const fields = expectObject(value);
          let lo = 0;
          let hi = 0;
          for (let i = 0; i < count; i++) {
            const bits = fieldValue(i, fields[names[i]]);
            const shift = shifts[i];
            if (shift >= 32) {
              hi |= bits << (shift - 32);
            } else {
              lo |= bits << shift;
              if (shift + widths[i] > 32) {
                hi |= bits >>> (32 - shift);
              }
            }
          }
          ctx.dv.setUint32(at + loAt, lo >>> 0, little);
          ctx.dv.setUint32(at + hiAt, hi >>> 0, little);
        },
      };
    }

    const storage = numericCodec(this.type, {
      endian: env.endian,
      checked: false,
    }) as Codec<number>;
    const width = this.type.getSize() * 8;
    const signed = isSignedNumeric(this.type);
    return {
      read: (ctx, at) => {
        const bits = storage.read(ctx, at, NO_PARENT);
        const out: Record<string, number> = {};
        for (let i = 0; i < count; i++) {
          out[names[i]] = ((bits >>> shifts[i]) & masks[i]) >>> 0;
        }
        return out;
      },
      write: (ctx, at, value) => {
        const fields = expectObject(value);
        let bits = 0;
        for (let i = 0; i < count; i++) {
          bits |= fieldValue(i, fields[names[i]]) << shifts[i];
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

export function bits<
  const S extends BitsSpec,
  T extends CNumeric,
  const O extends FieldOptions = {},
>(spec: S, type: T, options?: O): CBits<S, T, O> {
  return new CBits(spec, type, options);
}
