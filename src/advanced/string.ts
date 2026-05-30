import { CStructError } from "../errors";
import type { Endian } from "../primitive";
import { AdvancedType, need_bytes } from "./advanced-type";

/** Decode one Latin-1 byte per code unit (Reach `extended_ascii` / author name slots). */
function decode_latin1(bytes: Uint8Array): string {
  let out = "";
  for (const byte of bytes) {
    out += globalThis.String.fromCharCode(byte);
  }
  return out;
}

function encode_latin1(value: string, max_bytes: number): Uint8Array {
  const out = new Uint8Array(Math.min(value.length, max_bytes));
  for (let i = 0; i < value.length && i < out.length; i++) {
    const code = value.charCodeAt(i);
    if (code > 0xff) {
      throw new CStructError(
        `Cannot encode U+${code.toString(16)} in Latin-1 string (max U+00FF)`
      );
    }
    out[i] = code;
  }
  return out;
}

/**
 * Fixed-size Latin-1 string (NUL-terminated within the slot).
 * Not UTF-8 — one byte per character (e.g. U+00A6 → 0xA6, not C2 A6).
 */
export class CString extends AdvancedType<string, string> {
  readonly byteSize: number;
  readonly size: number;

  constructor(size: number) {
    super();
    this.size = size;
    this.byteSize = size;
  }

  read(
    bytes: Uint8Array,
    offset: number,
    _endian: Endian,
    _label: string
  ): string {
    need_bytes(bytes, offset, this.byteSize, "string field");
    let end = offset;
    const stop = offset + this.byteSize;
    while (end < stop && bytes[end] !== 0) {
      end += 1;
    }
    return decode_latin1(bytes.subarray(offset, end));
  }

  write(
    bytes: Uint8Array,
    offset: number,
    value: string,
    _endian: Endian,
    _label: string
  ): void {
    need_bytes(bytes, offset, this.byteSize, "string field");
    bytes.fill(0, offset, offset + this.byteSize);
    const encoded = encode_latin1(value, this.byteSize);
    bytes.set(encoded, offset);
  }

  toJson(value: string): string {
    return value;
  }

  fromJson(value: unknown, label: string): string {
    if (typeof value !== "string") {
      throw new CStructError(`${label}: expected string`);
    }
    return value;
  }
}

/**
 * Fixed-size Latin-1 string field (NUL-terminated within the slot).
 *
 * @example
 * ```ts
 * import { c } from "@craftycodie/cstruct";
 *
 * @c.struct()
 * class Tag {
 *   @c.field(c.String(8))
 *   name!: string;
 * }
 *
 * const bytes = c.write(Tag, { name: "foo" } as Tag);
 * ```
 */
// biome-ignore lint/suspicious/noShadowRestrictedNames: public API is c.String(n)
export function String(size: number): CString {
  return new CString(size);
}
