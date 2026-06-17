import type { FieldOptions } from "../field";
import { CFieldType, type Endian } from "../field-type";

/** Single-byte boolean (0 = false, non-zero = true on read; writes 0 or 1). */
export class CBool<const O extends FieldOptions = {}> extends CFieldType<
  boolean,
  O
> {
  getSize(): number {
    return 1;
  }

  read(buffer: Buffer, offset: number, _endian: Endian): boolean {
    return buffer[offset] !== 0;
  }

  write(buffer: Buffer, offset: number, value: boolean, _endian: Endian): void {
    buffer[offset] = value ? 1 : 0;
  }
}

export const bool = <const O extends FieldOptions = {}>(options?: O) =>
  new CBool(options);
