import {
  COMPILE,
  type Codec,
  type CompileEnv,
  compileType,
  readWith,
  writeWith,
} from "./engine/codec";
import {
  type FieldOptions,
  getFieldOptions,
  type StructFieldValue,
  unwrapFieldType,
} from "./field";
import { alignOf, CFieldType, type Endian } from "./field-type";

/**
 * A field stored as `inner` but exposed as `Out`, e.g. fixed-point numbers:
 *
 *   c.i32().transform((raw) => raw / 65536, (value) => Math.round(value * 65536))
 *
 * Size, alignment and padding come from the inner field.
 */
export class CTransform<const Inner, Out> extends CFieldType<
  Out,
  FieldOptions
> {
  readonly inner: Inner;
  readonly decode: (raw: any) => Out;
  readonly encode: (value: Out) => any;

  constructor(
    inner: Inner,
    decode: (raw: any) => Out,
    encode: (value: Out) => any
  ) {
    const { padBefore, padAfter } = getFieldOptions(inner as StructFieldValue);
    super({ padBefore, padAfter });
    this.inner = inner;
    this.decode = decode;
    this.encode = encode;
  }

  private get innerType() {
    return unwrapFieldType(this.inner as StructFieldValue);
  }

  getSize(): number {
    return this.innerType.getSize();
  }

  getAlign(): number {
    return alignOf(this.innerType);
  }

  read(buffer: Uint8Array, offset: number, endian: Endian): Out {
    return readWith(this, buffer, offset, endian);
  }

  write(buffer: Uint8Array, offset: number, value: Out, endian: Endian): void {
    writeWith(this, buffer, offset, value, endian);
  }

  [COMPILE](env: CompileEnv): Codec<Out> {
    const codec = compileType(this.innerType, env);
    const { decode, encode } = this;
    return {
      read: (ctx, at, parent) => decode(codec.read(ctx, at, parent)),
      write: (ctx, at, value, parent) =>
        codec.write(ctx, at, encode(value), parent),
    };
  }
}
