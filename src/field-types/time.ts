import {
  COMPILE,
  type Codec,
  expected,
  readWith,
  writeWith,
} from "../engine/codec";
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

  read(buffer: Uint8Array, offset: number, endian: Endian): Date {
    return readWith(this, buffer, offset, endian);
  }

  write(buffer: Uint8Array, offset: number, value: Date, endian: Endian): void {
    writeWith(this, buffer, offset, value, endian);
  }

  [COMPILE](endian: Endian): Codec<Date> {
    const little = endian === "little";
    return {
      read: (ctx, at) =>
        new Date(Number(ctx.dv.getBigInt64(at, little)) * 1000),
      write: (ctx, at, value) => {
        if (!(value instanceof Date)) {
          expected("Date", value);
        }
        const seconds = BigInt(Math.trunc(value.getTime() / 1000));
        ctx.dv.setBigInt64(at, seconds, little);
      },
    };
  }
}

export const Time64 = <const O extends FieldOptions = {}>(options?: O) =>
  new time64_t(options);
