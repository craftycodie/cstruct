import {
  COMPILE,
  type Codec,
  type CompileEnv,
  readWith,
  writeWith,
} from "../engine/codec";
import type { FieldOptions } from "../field";
import { CFieldType, type Endian } from "../field-type";

const utf8Encoder = new TextEncoder();
const utf8Decoder = new TextDecoder();

export class CMagicString<
  S extends string,
  const O extends FieldOptions = {},
> extends CFieldType<S, O> {
  readonly magic: S;
  private readonly bytes: Uint8Array;

  constructor(magic: S, options?: O) {
    super(options);
    this.magic = magic;
    this.bytes = utf8Encoder.encode(magic);
  }

  getSize(): number {
    return this.bytes.length;
  }

  read(buffer: Uint8Array, offset: number, endian: Endian): S {
    return readWith(this, buffer, offset, endian);
  }

  write(buffer: Uint8Array, offset: number, value: S, endian: Endian): void {
    writeWith(this, buffer, offset, value, endian);
  }

  [COMPILE](_env: CompileEnv): Codec<S> {
    const { magic, bytes } = this;
    const size = bytes.length;
    return {
      read: (ctx, at) => {
        for (let i = 0; i < size; i++) {
          if (ctx.u8[at + i] !== bytes[i]) {
            const got = utf8Decoder.decode(ctx.u8.subarray(at, at + size));
            throw new Error(
              `Magic string mismatch: expected ${magic}, got ${got}`
            );
          }
        }
        return magic;
      },
      write: (ctx, at, value) => {
        if (value !== undefined && value !== magic) {
          throw new Error(
            `Magic string mismatch: expected ${magic}, got ${value}`
          );
        }
        ctx.u8.set(bytes, at);
      },
    };
  }
}
