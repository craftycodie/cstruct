import {
  COMPILE,
  type Codec,
  type CompileEnv,
  expected,
  readWith,
  writeWith,
} from "../engine/codec";
import { ctxBuffer } from "../engine/ctx";
import { decodeBytes, encodeBytes } from "../engine/text";
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

  read(buffer: Uint8Array, offset: number, endian: Endian): string {
    return readWith(this, buffer, offset, endian);
  }

  write(
    buffer: Uint8Array,
    offset: number,
    value: string,
    endian: Endian
  ): void {
    writeWith(this, buffer, offset, value, endian);
  }

  getSize(): number {
    return this.length;
  }

  [COMPILE](_env: CompileEnv): Codec<string> {
    const { length, encoding } = this;
    return {
      read: (ctx, at) => {
        const u8 = ctx.u8;
        const limit = at + length;
        let end = at;
        while (end < limit && u8[end] !== 0) {
          end++;
        }
        const buffer = ctxBuffer(ctx);
        return buffer
          ? buffer.toString(encoding, at, end)
          : decodeBytes(u8, at, end, encoding);
      },
      write: (ctx, at, value) => {
        if (typeof value !== "string") {
          expected("string", value);
        }
        const buffer = ctxBuffer(ctx);
        // Both paths truncate at `length` without splitting a character.
        const written = buffer
          ? buffer.write(value, at, length, encoding)
          : encodeBytes(ctx.u8, at, length, value, encoding);
        ctx.u8.fill(0, at + written, at + length);
      },
    };
  }
}
