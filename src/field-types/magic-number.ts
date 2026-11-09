import {
  COMPILE,
  type Codec,
  type CompileEnv,
  NO_PARENT,
  readWith,
  writeWith,
} from "../engine/codec";
import type { FieldOptions } from "../field";
import { CFieldType, type Endian } from "../field-type";
import { MAGIC_VALUE } from "../modifiers";
import { CBigint } from "./bigint";
import { type CNumeric, numericCodec } from "./numeric";

export class CMagicNumber<
  N extends number,
  PT extends CNumeric,
  const O extends FieldOptions = {},
> extends CFieldType<N, O> {
  private readonly magic: N;
  private readonly type: PT;

  constructor(magic: N, type: PT, options?: O) {
    super(options);
    this.magic = magic;
    this.type = type;
  }

  get [MAGIC_VALUE](): N {
    return this.magic;
  }

  getSize(): number {
    return this.type.getSize();
  }

  getAlign(): number {
    return this.type.getAlign();
  }

  read(buffer: Uint8Array, offset: number, endian: Endian): N {
    return readWith(this, buffer, offset, endian);
  }

  write(buffer: Uint8Array, offset: number, value: N, endian: Endian): void {
    writeWith(this, buffer, offset, value, endian);
  }

  [COMPILE](env: CompileEnv): Codec<N> {
    const storage = numericCodec(this.type, env);
    const magic = this.magic;
    // u64/i64 storage reads bigint; compare in the storage's own domain.
    const stored: number | bigint =
      this.type instanceof CBigint ? BigInt(magic) : magic;
    return {
      read: (ctx, at) => {
        const value = storage.read(ctx, at, NO_PARENT);
        if (value !== stored) {
          throw new Error(
            `Magic number mismatch: expected ${magic}, got ${value} at offset ${at}`
          );
        }
        return magic;
      },
      write: (ctx, at, value) => {
        // The constant is always written; a supplied value must agree with it.
        if (
          value !== undefined &&
          value !== magic &&
          (value as unknown) !== stored
        ) {
          throw new Error(
            `Magic number mismatch: expected ${magic}, got ${value}`
          );
        }
        storage.write(ctx, at, stored, NO_PARENT);
      },
    };
  }
}
