import { CStructError } from "../errors";
import type { JsonValue } from "../json";
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
 * Packed field with custom read/write and JSON round-trip via {@link toJson} / {@link fromJson}.
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
export abstract class AdvancedType<TValue, TJson extends JsonValue> {
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

  abstract toJson(value: TValue, label: string): TJson;

  abstract fromJson(value: unknown, label: string): TValue;
}
