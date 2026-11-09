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

/** The storage integer: `bigint` for 64-bit storage, else `number`. */
export type RawOf<T extends CNumeric> =
  T extends CBigint<any, any> ? bigint : number;

/** Named bits of one storage integer, with conversions to and from flags. */
class FlagLayout {
  readonly names: string[];
  readonly bits: number[];
  /** 64-bit storage, handled as bigint. */
  readonly wide: boolean;
  private readonly signed: boolean;
  private readonly width: number;

  constructor(flags: BitfieldFlags, type: CNumeric) {
    const capacity = type.getSize() * 8;
    if (Array.isArray(flags) && flags.length > capacity) {
      throw new Error(
        `Bitfield has ${flags.length} flags but ${type.kind} storage holds ${capacity}`
      );
    }
    const parsed = parseFlags(flags, capacity, type.kind);
    this.names = parsed.names;
    this.bits = parsed.bits;
    this.wide = type instanceof CBigint;
    this.signed = isSignedNumeric(type);
    this.width = capacity;
  }

  /** Bring a 32-bit-or-narrower pattern into the storage type's range. */
  private toStorage(raw: number): number {
    return this.signed ? toSigned(raw, this.width) : raw >>> 0;
  }

  toRaw(value: unknown): number | bigint {
    const flags = expectObject(value);
    const { names, bits } = this;
    if (this.wide) {
      let raw = 0n;
      for (let i = 0; i < names.length; i++) {
        if (flags[names[i]]) {
          raw |= 1n << BigInt(bits[i]);
        }
      }
      return this.signed ? BigInt.asIntN(64, raw) : raw;
    }
    let raw = 0;
    for (let i = 0; i < names.length; i++) {
      if (flags[names[i]]) {
        raw |= 1 << bits[i];
      }
    }
    return this.toStorage(raw);
  }

  fromRaw(raw: number | bigint): Record<string, boolean> {
    const { names, bits } = this;
    const out: Record<string, boolean> = {};
    if (typeof raw === "bigint" || this.wide) {
      const big = BigInt.asUintN(64, BigInt(raw));
      for (let i = 0; i < names.length; i++) {
        out[names[i]] = ((big >> BigInt(bits[i])) & 1n) === 1n;
      }
      return out;
    }
    for (let i = 0; i < names.length; i++) {
      out[names[i]] = ((raw >>> bits[i]) & 1) === 1;
    }
    return out;
  }

  /** A raw integer in the storage type's representation. */
  normalizeRaw(raw: number | bigint): number | bigint {
    if (this.wide) {
      return typeof raw === "bigint" ? raw : BigInt(raw);
    }
    return typeof raw === "bigint" ? Number(raw) : raw;
  }
}

function isRaw(value: unknown): value is number | bigint {
  return typeof value === "number" || typeof value === "bigint";
}

/**
 * Boolean flags packed into an integer (a cstruct extension: in C, flags are
 * a plain integer with masks, which is `c.u32()` here):
 *
 *   c.Bitfield(["iron", "black_eye"], c.u32())    // bits 0 and 1
 *   c.Bitfield({ iron: 0, mythic: 9 }, c.u32())   // explicit bits
 *
 * Reads give `{ iron: boolean, ... }`. Writes take that object or the raw
 * integer. `toRaw` / `fromRaw` convert between the two. Unnamed bits read
 * as nothing and are written as 0 (unless a raw integer is written).
 */
export class CBitfield<
  const K extends BitfieldFlags,
  T extends CNumeric,
  const O extends FieldOptions = {},
> extends CFieldType<BitfieldValue<K>, O> {
  readonly flags: K;
  readonly type: T;
  private readonly layout: FlagLayout;

  constructor(flags: K, type: T, options?: O) {
    super(options);
    this.layout = new FlagLayout(flags, type);
    this.flags = flags;
    this.type = type;
  }

  /** The storage integer for a flags object. */
  toRaw(flags: BitfieldValue<K>): RawOf<T> {
    return this.layout.toRaw(flags) as RawOf<T>;
  }

  /** The flags object for a storage integer. */
  fromRaw(raw: number | bigint): BitfieldValue<K> {
    return this.layout.fromRaw(raw) as BitfieldValue<K>;
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
    value: BitfieldValue<K> | RawOf<T>,
    endian: Endian
  ): void {
    writeWith(this, buffer, offset, value, endian);
  }

  [COMPILE](env: CompileEnv): Codec<Record<string, boolean>> {
    const layout = this.layout;
    const storage = numericCodec(this.type, env);
    return {
      read: (ctx, at) => layout.fromRaw(storage.read(ctx, at, NO_PARENT)),
      write: (ctx, at, value) => {
        const raw = isRaw(value)
          ? layout.normalizeRaw(value)
          : layout.toRaw(value);
        storage.write(ctx, at, raw, NO_PARENT);
      },
    };
  }
}
