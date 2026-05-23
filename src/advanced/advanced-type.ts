import { CStructError } from "../errors";
import type { Endian } from "../primitive";

export function need_bytes(
  bytes: Uint8Array,
  offset: number,
  size: number,
  label: string
): void {
  if (offset + size > bytes.length) {
    throw new CStructError(
      `Cannot read ${label}: need ${size} bytes at offset ${offset}, have ${bytes.length - offset}`
    );
  }
}

/**
 * Packed field with custom read/write (see {@link "advanced/time64"!CTime64}, {@link "advanced/wstring"!CWString}, and {@link "advanced/string"!CString}).
 *
 * Intended for types that map to a single `@c.field` slot. Multi-field layouts should use `@c.struct` instead.
 *
 * @example
 * ```ts
 * import { c } from "@craftycodie/cstruct";
 *
 * @c.struct()
 * class Record {
 *   @c.field(c.String(16))
 *   name!: string;
 *   @c.field(c.Time64())
 *   created!: Date;
 * }
 * ```
 */
export abstract class AdvancedType<TValue> {
  abstract readonly byteSize: number;

  abstract read(
    bytes: Uint8Array,
    offset: number,
    endian: Endian,
    label: string
  ): TValue;

  abstract write(
    bytes: Uint8Array,
    offset: number,
    value: TValue,
    endian: Endian,
    label: string
  ): void;
}
