import {
  COMPILE,
  type Codec,
  expected,
  readWith,
  writeWith,
} from "../engine/codec";
import type { FieldOptions } from "../field";
import { CFieldType, type Endian } from "../field-type";

const BOOL_CODEC: Codec<boolean> = {
  read: (ctx, at) => ctx.u8[at] !== 0,
  write: (ctx, at, value) => {
    if (value === undefined || value === null) {
      expected("boolean", value);
    }
    ctx.u8[at] = value ? 1 : 0;
  },
};

/** Single-byte boolean (0 = false, non-zero = true on read; writes 0 or 1). */
export class CBool<const O extends FieldOptions = {}> extends CFieldType<
  boolean,
  O
> {
  getSize(): number {
    return 1;
  }

  read(buffer: Buffer, offset: number, endian: Endian): boolean {
    return readWith(this, buffer, offset, endian);
  }

  write(buffer: Buffer, offset: number, value: boolean, endian: Endian): void {
    writeWith(this, buffer, offset, value, endian);
  }

  [COMPILE](_endian: Endian): Codec<boolean> {
    return BOOL_CODEC;
  }
}

export const bool = <const O extends FieldOptions = {}>(options?: O) =>
  new CBool(options);
