import type { Endian } from "./field-type";

export interface StructOptions {
  /** Byte order for every field of this struct, overriding the call site. */
  endian?: Endian;
}

export interface ReadOptions {
  /** Default byte order for structs and fields that do not pin their own. */
  endian?: Endian;
  /** Byte offset to start reading at. Default 0. */
  offset?: number;
}

export interface WriteOptions {
  /**
   * Validate integer values on write (default true). Integers must fit the
   * field's bit width as signed or unsigned; `false` wraps them instead.
   */
  checked?: boolean;
  /** Default byte order for structs and fields that do not pin their own. */
  endian?: Endian;
  /**
   * Write into this buffer instead of allocating one. The struct's byte range
   * is zeroed first, so padding and inactive union bytes end up zero.
   */
  into?: Uint8Array;
  /** Byte offset inside `into`. Default 0. */
  offset?: number;
}

export interface ResolvedRead {
  endian: Endian;
  offset: number;
}

export interface ResolvedWrite {
  checked: boolean;
  endian: Endian;
  into: Uint8Array | undefined;
  offset: number;
}

export function isEndian(value: unknown): value is Endian {
  return value === "little" || value === "big";
}

/** Normalize `(offset?, endian?)`, `(endian)` or `(options)` read arguments. */
export function resolveRead(
  offsetOrOptions?: number | Endian | ReadOptions,
  endian?: Endian
): ResolvedRead {
  if (isEndian(offsetOrOptions)) {
    return { offset: 0, endian: offsetOrOptions };
  }
  if (typeof offsetOrOptions === "object" && offsetOrOptions !== null) {
    return {
      offset: offsetOrOptions.offset ?? 0,
      endian: offsetOrOptions.endian ?? "little",
    };
  }
  return { offset: offsetOrOptions ?? 0, endian: endian ?? "little" };
}

/** Normalize `(endian?)` or `(options)` write arguments. */
export function resolveWrite(
  endianOrOptions?: Endian | WriteOptions
): ResolvedWrite {
  if (typeof endianOrOptions === "object" && endianOrOptions !== null) {
    if (endianOrOptions.offset !== undefined && !endianOrOptions.into) {
      throw new TypeError("write option 'offset' requires 'into'");
    }
    return {
      checked: endianOrOptions.checked ?? true,
      endian: endianOrOptions.endian ?? "little",
      into: endianOrOptions.into,
      offset: endianOrOptions.offset ?? 0,
    };
  }
  return {
    checked: true,
    endian: endianOrOptions ?? "little",
    into: undefined,
    offset: 0,
  };
}
