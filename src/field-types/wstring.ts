import {
  COMPILE,
  type Codec,
  type CompileEnv,
  expected,
  readWith,
  writeWith,
} from "../engine/codec";
import { decodeUtf16, encodeUtf16 } from "../engine/text";
import type { FieldOptions } from "../field";
import { CFieldType, type Endian } from "../field-type";

/** Fixed-length wchar_t array (UTF-16, 2 bytes per character). */
export class CWString<
  L extends number,
  const O extends FieldOptions = {},
> extends CFieldType<string, O> {
  readonly length!: L;

  constructor(length: L, options?: O) {
    super(options);
    this.length = length;
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
    return this.length * 2;
  }

  [COMPILE](env: CompileEnv): Codec<string> {
    const length = this.length;
    const little = env.endian === "little";
    return {
      read: (ctx, at) => decodeUtf16(ctx.u8, at, length, little),
      write: (ctx, at, value) => {
        if (typeof value !== "string") {
          expected("string", value);
        }
        encodeUtf16(ctx.u8, at, length, value, little);
      },
    };
  }
}
