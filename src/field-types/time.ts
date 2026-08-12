import type { FieldOptions } from "../field";
import { CFieldType, type Endian } from "../field-type";

/**
 * 64-bit C time_t equivalent (seconds since Unix epoch).
 * Encodes/decodes as signed i64 and maps to JavaScript Date.
 */
export class time64_t<const O extends FieldOptions = {}> extends CFieldType<
  Date,
  O
> {
  getSize(): number {
    return 8;
  }

  read(buffer: Buffer, offset: number, endian: Endian): Date {
    const view = new DataView(
      buffer.buffer,
      buffer.byteOffset,
      buffer.byteLength
    );
    const seconds = view.getBigInt64(offset, endian === "little");
    return new Date(Number(seconds) * 1000);
  }

  write(buffer: Buffer, offset: number, value: Date, endian: Endian): void {
    const view = new DataView(
      buffer.buffer,
      buffer.byteOffset,
      buffer.byteLength
    );
    const seconds = BigInt(Math.trunc(value.getTime() / 1000));
    view.setBigInt64(offset, seconds, endian === "little");
  }
}

export const Time64 = <const O extends FieldOptions = {}>(options?: O) =>
  new time64_t(options);
