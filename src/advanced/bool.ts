import { CStructError } from "../errors";
import type { Endian } from "../primitive";
import { AdvancedType, need_bytes } from "./advanced-type";

/** Single-byte boolean (0 = false, non-zero = true on read; writes 0 or 1). */
export class CBool extends AdvancedType<boolean> {
  readonly byteSize = 1;

  read(
    bytes: Uint8Array,
    offset: number,
    _endian: Endian,
    _label: string
  ): boolean {
    need_bytes(bytes, offset, this.byteSize, "bool");
    return bytes[offset] !== 0;
  }

  write(
    bytes: Uint8Array,
    offset: number,
    value: boolean,
    _endian: Endian,
    label: string
  ): void {
    if (typeof value !== "boolean") {
      throw new CStructError(`${label}: expected boolean`);
    }
    need_bytes(bytes, offset, this.byteSize, "bool");
    bytes[offset] = value ? 1 : 0;
  }
}

const BOOL = new CBool();

/**
 * 1-byte wire boolean mapped to TypeScript `boolean`.
 *
 * @example
 * ```ts
 * import { c } from "@craftycodie/cstruct";
 *
 * @c.struct()
 * class Flags {
 *   @c.field(c.Bool())
 *   is_online!: boolean;
 * }
 *
 * const bytes = c.write(Flags, { is_online: true } as Flags);
 * ```
 */
export function Bool(): CBool {
  return BOOL;
}
