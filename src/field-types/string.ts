import {
  COMPILE,
  type Codec,
  expected,
  readWith,
  writeWith,
} from "../engine/codec";
import { ctxBuffer } from "../engine/ctx";
import type { FieldOptions } from "../field";
import { CFieldType, type Endian } from "../field-type";

/** Fixed-length character array. */
export class CString<
  L extends number,
  const O extends FieldOptions = {},
> extends CFieldType<string, O> {
  readonly length!: L;
  readonly encoding: BufferEncoding;

  constructor(length: L, encoding: BufferEncoding = "utf8", options?: O) {
    super(options);
    this.length = length;
    this.encoding = encoding;
  }

  read(buffer: Buffer, offset: number, endian: Endian): string {
    return readWith(this, buffer, offset, endian);
  }

  write(buffer: Buffer, offset: number, value: string, endian: Endian): void {
    writeWith(this, buffer, offset, value, endian);
  }

  getSize(): number {
    return this.length;
  }

  [COMPILE](_endian: Endian): Codec<string> {
    const { length, encoding } = this;
    return {
      read: (ctx, at) => {
        const u8 = ctx.u8;
        const limit = at + length;
        let end = at;
        while (end < limit && u8[end] !== 0) {
          end++;
        }
        return ctxBuffer(ctx).toString(encoding, at, end);
      },
      write: (ctx, at, value) => {
        if (typeof value !== "string") {
          expected("string", value);
        }
        const buffer = ctxBuffer(ctx);
        // Buffer#write truncates at `length` without splitting a character.
        const written = buffer.write(value, at, length, encoding);
        if (written < length) {
          buffer.fill(0, at + written, at + length);
        }
      },
    };
  }
}
