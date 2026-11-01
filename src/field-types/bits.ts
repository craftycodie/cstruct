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

/**
 * Bit-field definitions, in a form whose meaning never depends on object
 * key order (JSON and many stores reorder keys, and integer-like keys always
 * sort first):
 *
 * - a list of `[name, width]` pairs, packed from bit 0 up in list order, or
 * - a map of `name: { bit, width }` with explicit positions (gaps allowed).
 */
export type BitsSpec =
  | readonly (readonly [name: string, width: number])[]
  | Readonly<Record<string, { readonly bit: number; readonly width: number }>>;

export type BitsValue<S extends BitsSpec> = S extends readonly (readonly [
  infer _Name,
  number,
])[]
  ? { [K in S[number][0] & string]: number }
  : { [K in keyof S & string]: number };

interface BitRange {
  name: string;
  shift: number;
  width: number;
}

/** Sign-extend the low `bits` bits of `value` (for signed storage types). */
function toSigned(value: number, bits: number): number {
  const shift = 32 - bits;
  return (value << shift) >> shift;
}

/** Mask of `width` low bits, as an unsigned 32-bit number. */
function maskOf(width: number): number {
  return width === 32 ? 0xff_ff_ff_ff : (1 << width) - 1;
}

/** Normalize a spec to explicit ranges, checking names, widths and overlaps. */
function parseBitsSpec(spec: BitsSpec, capacity: number, kind: string) {
  const ranges: BitRange[] = [];
  if (Array.isArray(spec)) {
    let shift = 0;
    for (const entry of spec as readonly (readonly [string, number])[]) {
      if (!Array.isArray(entry) || typeof entry[0] !== "string") {
        throw new TypeError("c.bits list entries must be [name, width] pairs");
      }
      ranges.push({ name: entry[0], shift, width: entry[1] });
      shift += entry[1];
    }
  } else if (typeof spec === "object" && spec !== null) {
    for (const [name, range] of Object.entries(spec)) {
      if (typeof range !== "object" || range === null) {
        throw new TypeError(
          `bit-field '${name}' must be { bit, width }; use a [name, width] list for sequential fields`
        );
      }
      ranges.push({ name, shift: range.bit, width: range.width });
    }
  }

  const seen = new Set<string>();
  for (const { name, shift, width } of ranges) {
    if (seen.has(name)) {
      throw new Error(`bit-field '${name}' is declared more than once`);
    }
    seen.add(name);
    if (!Number.isInteger(width) || width < 1 || width > 32) {
      throw new RangeError(
        `bit-field '${name}' width must be an integer from 1 to 32, got ${width}`
      );
    }
    if (!Number.isInteger(shift) || shift < 0) {
      throw new RangeError(
        `bit-field '${name}' bit must be a non-negative integer, got ${shift}`
      );
    }
    if (shift + width > capacity) {
      throw new RangeError(
        `bit-field '${name}' needs bits ${shift}..${shift + width - 1} but ${kind} storage holds ${capacity}`
      );
    }
  }
  const ordered = [...ranges].sort((a, b) => a.shift - b.shift);
  for (let i = 1; i < ordered.length; i++) {
    const previous = ordered[i - 1];
    if (ordered[i].shift < previous.shift + previous.width) {
      throw new RangeError(
        `bit-fields '${previous.name}' and '${ordered[i].name}' overlap`
      );
    }
  }
  return ranges;
}

/**
 * C bit-fields packed into one storage unit:
 *
 *   c.bits([["mode", 3], ["flags", 5]], c.u8())  // uint8_t mode : 3, flags : 5;
 *   c.bits({ mode: { bit: 0, width: 3 }, flags: { bit: 3, width: 5 } }, c.u8())
 *
 * Bit 0 is the least significant bit, as GCC, Clang and MSVC assign
 * bit-fields on little-endian targets. Values are unsigned, 1 to 32 bits.
 */
export class CBits<
  const S extends BitsSpec,
  T extends CNumeric,
  const O extends FieldOptions = {},
> extends CFieldType<BitsValue<S>, O> {
  readonly spec: S;
  readonly type: T;
  readonly names: string[];
  readonly shifts: number[];
  readonly widths: number[];

  constructor(spec: S, type: T, options?: O) {
    super(options);
    this.spec = spec;
    this.type = type;
    const ranges = parseBitsSpec(spec, type.getSize() * 8, type.kind);
    this.names = ranges.map((range) => range.name);
    this.shifts = ranges.map((range) => range.shift);
    this.widths = ranges.map((range) => range.width);
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
