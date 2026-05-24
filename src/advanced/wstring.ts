import type { Endian } from "../primitive";
import { AdvancedType, need_bytes } from "./advanced-type";

function swap_utf16(bytes: Uint8Array): Uint8Array {
  const out = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length - 1; i += 2) {
    out[i] = bytes[i + 1] ?? 0;
    out[i + 1] = bytes[i] ?? 0;
  }
  return out;
}

/** Strip U+FEFF whether it came from a BOM in the buffer or a prior mis-decode. */
function strip_wstring_bom(value: string): string {
  return value.charCodeAt(0) === 0xfe_ff ? value.slice(1) : value;
}

/**
 * UTF-16 wchar buffers often use a 16-bit NUL; UTF-8 mis-stored in the same slot
 * uses a single 0x00 and leaves odd-index bytes non-zero (e.g. 0xC3 0xA9 for "é").
 */
function looks_like_utf8_in_wchar_slot(bytes: Uint8Array): boolean {
  if (bytes.length === 0) {
    return false;
  }
  let utf16_ascii_pairs = 0;
  for (let i = 1; i < bytes.length; i += 2) {
    const high = bytes[i] ?? 0;
    const low = bytes[i - 1] ?? 0;
    if (high === 0 && low > 0 && low < 0x80) {
      utf16_ascii_pairs += 1;
    }
  }
  if (utf16_ascii_pairs >= 2) {
    return false;
  }
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return true;
  } catch {
    return false;
  }
}

function decode_wstring_bytes(bytes: Uint8Array): string {
  if (bytes.length === 0) {
    return "";
  }
  if (looks_like_utf8_in_wchar_slot(bytes)) {
    const zero = bytes.indexOf(0);
    const end = zero < 0 ? bytes.length : zero;
    return strip_wstring_bom(
      new TextDecoder("utf-8").decode(bytes.subarray(0, end))
    );
  }
  return strip_wstring_bom(new TextDecoder("utf-16le").decode(bytes));
}

function encode_utf16le(value: string, max_bytes: number): Uint8Array {
  const stripped = strip_wstring_bom(value);
  const max_code_units = Math.floor(max_bytes / 2);
  const count = Math.min(stripped.length, max_code_units);
  const out = new Uint8Array(count * 2);
  const view = new DataView(out.buffer, out.byteOffset, out.byteLength);
  for (let i = 0; i < count; i++) {
    view.setUint16(i * 2, stripped.charCodeAt(i), true);
  }
  return out;
}

/** UTF-16LE wide string with a fixed character capacity (NUL-terminated). */
export class CWString extends AdvancedType<string> {
  readonly byteSize: number;
  readonly chars: number;

  constructor(chars: number) {
    super();
    this.chars = chars;
    this.byteSize = chars * 2;
  }

  read(
    bytes: Uint8Array,
    offset: number,
    endian: Endian,
    _label: string
  ): string {
    need_bytes(bytes, offset, this.byteSize, "wide string");
    const slice = bytes.subarray(offset, offset + this.byteSize);
    let end = 0;
    while (
      end < slice.length - 1 &&
      (slice[end] !== 0 || slice[end + 1] !== 0)
    ) {
      end += 2;
    }
    const raw = slice.subarray(0, end);
    const le_bytes = endian === "little" ? raw : swap_utf16(raw);
    return decode_wstring_bytes(le_bytes);
  }

  write(
    bytes: Uint8Array,
    offset: number,
    value: string,
    endian: Endian,
    _label: string
  ): void {
    need_bytes(bytes, offset, this.byteSize, "wide string");
    bytes.fill(0, offset, offset + this.byteSize);
    const le_bytes = encode_utf16le(value, this.byteSize);
    const encoded = endian === "little" ? le_bytes : swap_utf16(le_bytes);
    bytes.set(encoded, offset);
  }
}

/**
 * Fixed-size UTF-16 string field (`chars` is wchar count, byte size is `chars * 2`).
 *
 * @example
 * ```ts
 * import { c } from "@craftycodie/cstruct";
 *
 * @c.struct()
 * class Label {
 *   @c.field(c.WString(4))
 *   text!: string;
 * }
 *
 * const bytes = c.write(Label, { text: "ab" } as Label, "little");
 * ```
 */
export function WString(chars: number): CWString {
  return new CWString(chars);
}
