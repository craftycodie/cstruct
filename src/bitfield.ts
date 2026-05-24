import { CStructError } from "./errors";
import type { PrimitiveType } from "./primitive";
import { primitive_size } from "./primitive";

/** `as const` tuple of flag names (bit index = array index). */
export type BitfieldFlagNames = readonly string[];

/** Explicit flag name → bit index (sparse layouts). */
export type BitfieldFlagMap = Readonly<Record<string, number>>;

export type BitfieldFlagDefinition = BitfieldFlagNames | BitfieldFlagMap;

/** JS value for a {@link BitfieldField}: one boolean per flag name. */
export type Bitfield<T extends BitfieldFlagDefinition> =
  T extends BitfieldFlagNames
    ? { [K in T[number]]: boolean }
    : T extends BitfieldFlagMap
      ? { [K in keyof T & string]: boolean }
      : never;

export interface BitfieldFlag {
  readonly bit: number;
  readonly name: string;
}

/**
 * Packed bit flags in an integer primitive (Halo-style `bitfield!` enums).
 * Prefer {@link create_bitfield_field} via `c.bitfield(storage, flags)` on a field.
 */
export interface BitfieldField {
  readonly flags: readonly BitfieldFlag[];
  readonly kind: "bitfield";
  /** Bits that may be set by known flags (for optional strict validation). */
  readonly mask: bigint;
  readonly storage: PrimitiveType;
  /** When true, reject values with bits outside {@link mask}. */
  readonly strict?: boolean;
}

export function is_bitfield_field(type: unknown): type is BitfieldField {
  return (
    typeof type === "object" &&
    type !== null &&
    "kind" in type &&
    type.kind === "bitfield"
  );
}

function storage_bit_width(storage: PrimitiveType): number {
  return primitive_size(storage) * 8;
}

function parse_bitfield_flags(def: BitfieldFlagDefinition): BitfieldFlag[] {
  const flags: BitfieldFlag[] = [];
  if (Array.isArray(def)) {
    for (let bit = 0; bit < def.length; bit++) {
      const name = def[bit];
      if (typeof name !== "string" || name.length === 0) {
        throw new CStructError(
          "c.bitfield() flag names must be non-empty strings"
        );
      }
      flags.push({ name, bit });
    }
    return flags;
  }

  for (const [name, bit] of Object.entries(def)) {
    if (!Number.isInteger(bit) || bit < 0) {
      throw new CStructError(
        `c.bitfield() flag "${name}" must use a non-negative integer bit index`
      );
    }
    flags.push({ name, bit });
  }

  flags.sort((a, b) => a.bit - b.bit);
  return flags;
}

function build_mask(flags: readonly BitfieldFlag[]): bigint {
  let mask = 0n;
  for (const { bit } of flags) {
    mask |= 1n << BigInt(bit);
  }
  return mask;
}

/**
 * Build a {@link BitfieldField} for {@link decorators.field}.
 *
 * @example Sequential bits (blf_lib `bitfield!` order)
 * ```ts
 * const Skulls = ["iron", "black_eye", "mythic"] as const;
 *
 * @c.field(c.bitfield("u32", Skulls))
 * skulls!: c.Bitfield<typeof Skulls>;
 * ```
 *
 * @example Explicit bit indices
 * ```ts
 * const Difficulty = { easy: 0, normal: 1, heroic: 2, legendary: 3 } as const;
 *
 * @c.field(c.bitfield("u8", Difficulty))
 * difficulty!: c.Bitfield<typeof Difficulty>;
 * ```
 */
export function create_bitfield_field(
  storage: PrimitiveType,
  flags: BitfieldFlagDefinition,
  options?: { strict?: boolean }
): BitfieldField {
  const parsed = parse_bitfield_flags(flags);
  if (parsed.length === 0) {
    throw new CStructError("c.bitfield() requires at least one flag");
  }

  const width = storage_bit_width(storage);
  const seen_bits = new Set<number>();
  const seen_names = new Set<string>();

  for (const { name, bit } of parsed) {
    if (seen_names.has(name)) {
      throw new CStructError(`c.bitfield() duplicate flag name "${name}"`);
    }
    seen_names.add(name);
    if (seen_bits.has(bit)) {
      throw new CStructError(`c.bitfield() duplicate bit index ${bit}`);
    }
    seen_bits.add(bit);
    if (bit >= width) {
      throw new CStructError(
        `c.bitfield() bit ${bit} on "${name}" does not fit in ${storage} (${width} bits)`
      );
    }
  }

  return {
    kind: "bitfield",
    storage,
    flags: parsed,
    mask: build_mask(parsed),
    strict: options?.strict,
  };
}

function raw_to_bigint(raw: number | bigint): bigint {
  return typeof raw === "bigint" ? raw : BigInt(raw >>> 0);
}

function is_bitfield_value(value: unknown): value is Record<string, boolean> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Decode integer to `{ flag: boolean, ... }`. */
export function bitfield_from_raw(
  raw: number | bigint,
  field: BitfieldField
): Record<string, boolean> {
  const bits = raw_to_bigint(raw);
  const strict = field.strict === true;
  if (strict && (bits & ~field.mask) !== 0n) {
    throw new CStructError(
      `Invalid bitfield: value 0x${bits.toString(16)} has bits outside the defined mask`
    );
  }

  const out: Record<string, boolean> = {};
  for (const { name, bit } of field.flags) {
    out[name] = ((bits >> BigInt(bit)) & 1n) === 1n;
  }
  return out;
}

/** Pack `{ flag: boolean, ... }` to an integer. */
export function bitfield_to_raw(
  value: unknown,
  field: BitfieldField,
  label: string
): number | bigint {
  if (!is_bitfield_value(value)) {
    throw new CStructError(`${label}: expected a bitfield object`);
  }

  let bits = 0n;
  for (const { name, bit } of field.flags) {
    const flag_value = value[name];
    if (flag_value === undefined) {
      continue;
    }
    if (typeof flag_value !== "boolean") {
      throw new CStructError(`${label}.${name}: expected boolean`);
    }
    if (flag_value) {
      bits |= 1n << BigInt(bit);
    }
  }

  for (const key of Object.keys(value)) {
    if (!field.flags.some((f) => f.name === key)) {
      throw new CStructError(`${label}: unknown bitfield flag "${key}"`);
    }
  }

  if (field.storage === "u64" || field.storage === "i64") {
    return bits;
  }
  return Number(bits);
}

export function read_bitfield(
  raw: number | bigint,
  field: BitfieldField
): Record<string, boolean> {
  return bitfield_from_raw(raw, field);
}

export function write_bitfield(
  value: unknown,
  field: BitfieldField,
  label: string
): number | bigint {
  return bitfield_to_raw(value, field, label);
}
