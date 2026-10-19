import {
  COMPILE,
  type Codec,
  type CompileEnv,
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

/**
 * Flag definitions, in a form whose meaning never depends on object key
 * order: a list of names (bit = index) or a map of name to bit number.
 */
export type BitfieldFlags =
  | readonly string[]
  | Readonly<Record<string, number>>;

export type BitfieldValue<K extends BitfieldFlags> = K extends readonly string[]
  ? { [Key in K[number]]: boolean }
  : { [Key in keyof K & string]: boolean };

/** Normalize flags to parallel name/bit lists, checking bits are valid. */
function parseFlags(
  flags: BitfieldFlags,
  capacity: number,
  kind: string
): { names: string[]; bits: number[] } {
  const entries: [string, number][] = Array.isArray(flags)
    ? (flags as readonly string[]).map((name, bit) => [name, bit])
    : Object.entries(flags as Record<string, number>);
  const used = new Map<number, string>();
  for (const [name, bit] of entries) {
    if (!Number.isInteger(bit) || bit < 0) {
      throw new RangeError(
        `Bitfield flag '${name}' must use a non-negative integer bit, got ${bit}`
      );
    }
    if (bit >= capacity) {
      throw new RangeError(
        `Bitfield flag '${name}' uses bit ${bit} but ${kind} storage holds ${capacity} bits`
      );
    }
    const other = used.get(bit);
    if (other !== undefined) {
      throw new Error(
        `Bitfield flags '${other}' and '${name}' share bit ${bit}`
      );
    }
    used.set(bit, name);
  }
  return {
    names: entries.map(([name]) => name),
    bits: entries.map(([, bit]) => bit),
  };
}

/**
 * Boolean flags packed into an integer:
 *
 *   c.bitfield(["iron", "black_eye"], c.u32())    // bits 0 and 1
 *   c.bitfield({ iron: 0, mythic: 9 }, c.u32())   // explicit bits
 *
 * Bits not named read as nothing and are written as 0.
 */
export class CBitfield<
  const K extends BitfieldFlags,
  T extends CNumeric,
  const O extends FieldOptions = {},
> extends CFieldType<BitfieldValue<K>, O> {
  readonly flags: K;
  private readonly names: string[];
  private readonly bits: number[];
  private readonly type: T;

  constructor(flags: K, type: T, options?: O) {
    super(options);
    const capacity = type.getSize() * 8;
    if (Array.isArray(flags) && flags.length > capacity) {
      throw new Error(
        `Bitfield has ${flags.length} flags but ${type.kind} storage holds ${capacity}`
      );
    }
    const parsed = parseFlags(flags, capacity, type.kind);
    this.flags = flags;
    this.names = parsed.names;
    this.bits = parsed.bits;
    this.type = type;
  }

  getSize(): number {
    return this.type.getSize();
  }

  getAlign(): number {
    return this.type.getAlign();
  }

  read(buffer: Uint8Array, offset: number, endian: Endian): BitfieldValue<K> {
    return readWith(this, buffer, offset, endian);
  }

  write(
    buffer: Uint8Array,
    offset: number,
    value: BitfieldValue<K>,
    endian: Endian
  ): void {
    writeWith(this, buffer, offset, value, endian);
  }

  [COMPILE](env: CompileEnv): Codec<Record<string, boolean>> {
    const { names, bits } = this;
    const count = names.length;

    if (this.type instanceof CBigint) {
      // 64-bit storage: work on two 32-bit words to stay in number arithmetic.
      const little = env.endian === "little";
      const loAt = little ? 0 : 4;
      const hiAt = little ? 4 : 0;
      return {
        read: (ctx, at) => {
          const lo = ctx.dv.getUint32(at + loAt, little);
          const hi = ctx.dv.getUint32(at + hiAt, little);
          const out: Record<string, boolean> = {};
          for (let i = 0; i < count; i++) {
            const bit = bits[i];
            const word = bit < 32 ? lo : hi;
            out[names[i]] = ((word >>> (bit & 31)) & 1) === 1;
          }
          return out;
        },
        write: (ctx, at, value) => {
          const flags = expectObject(value);
          let lo = 0;
          let hi = 0;
          for (let i = 0; i < count; i++) {
            if (flags[names[i]]) {
              const bit = bits[i];
              if (bit < 32) {
                lo |= 1 << bit;
              } else {
                hi |= 1 << (bit - 32);
              }
            }
          }
          ctx.dv.setUint32(at + loAt, lo >>> 0, little);
          ctx.dv.setUint32(at + hiAt, hi >>> 0, little);
        },
      };
    }

    // Bits are built to fit the storage width, so no range check is needed.
    const storage = numericCodec(this.type, {
      endian: env.endian,
      checked: false,
    }) as Codec<number>;
    const width = this.type.getSize() * 8;
    const signed = isSignedNumeric(this.type);
    return {
      read: (ctx, at) => {
        const raw = storage.read(ctx, at, NO_PARENT);
        const out: Record<string, boolean> = {};
        for (let i = 0; i < count; i++) {
          out[names[i]] = ((raw >>> bits[i]) & 1) === 1;
        }
        return out;
      },
      write: (ctx, at, value) => {
        const flags = expectObject(value);
        let raw = 0;
        for (let i = 0; i < count; i++) {
          if (flags[names[i]]) {
            raw |= 1 << bits[i];
          }
        }
        storage.write(
          ctx,
          at,
          signed ? toSigned(raw, width) : raw >>> 0,
          NO_PARENT
        );
      },
    };
  }
}
