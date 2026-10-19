import {
  COMPILE,
  type Codec,
  type CompileEnv,
  expected,
  readWith,
  writeWith,
} from "../engine/codec";
import { allocBytes, type BytesLike, toBytes } from "../engine/ctx";
import type { FieldOptions } from "../field";
import { CFieldType, type Endian } from "../field-type";

function isBytesLike(value: unknown): value is BytesLike {
  return ArrayBuffer.isView(value) || value instanceof ArrayBuffer;
}

/**
 * Raw fixed-length bytes (`uint8_t data[N]`): hashes, GUIDs, opaque blobs.
 * Reads copy into a new `Buffer` (a `Uint8Array` without Buffer). Writes
 * accept any byte source; shorter input is zero-padded.
 */
export class CBytes<
  L extends number,
  const O extends FieldOptions = {},
> extends CFieldType<Buffer, O> {
  readonly length: L;

  constructor(length: L, options?: O) {
    super(options);
    if (!Number.isInteger(length) || length < 0) {
      throw new RangeError(
        `c.bytes length must be a non-negative integer, got ${length}`
      );
    }
    this.length = length;
  }

  getSize(): number {
    return this.length;
  }

  read(buffer: Uint8Array, offset: number, endian: Endian): Buffer {
    return readWith(this, buffer, offset, endian);
  }

  write(buffer: Uint8Array, offset: number, value: BytesLike, endian: Endian) {
    writeWith(this, buffer, offset, value, endian);
  }

  [COMPILE](env: CompileEnv): Codec<Buffer> {
    const length = this.length;
    const { checked } = env;
    return {
      read: (ctx, at) => {
        const out = allocBytes(length);
        out.set(ctx.u8.subarray(at, at + length));
        return out;
      },
      write: (ctx, at, value) => {
        if (!isBytesLike(value)) {
          expected("bytes (Uint8Array, ArrayBuffer or DataView)", value);
        }
        let source = toBytes(value);
        if (source.length > length) {
          if (checked) {
            throw new RangeError(
              `${source.length} bytes do not fit in bytes(${length})`
            );
          }
          source = source.subarray(0, length);
        }
        ctx.u8.set(source, at);
        ctx.u8.fill(0, at + source.length, at + length);
      },
    };
  }
}

export function bytes<L extends number, const O extends FieldOptions = {}>(
  length: L,
  options?: O
): CBytes<L, O> {
  return new CBytes(length, options);
}
