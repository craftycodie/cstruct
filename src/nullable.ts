import {
  COMPILE,
  type Codec,
  type CompileEnv,
  compileType,
  NO_PARENT,
  readWith,
  writeWith,
} from "./engine/codec";
import { createCtx } from "./engine/ctx";
import {
  type FieldOptions,
  type FieldType,
  getFieldOptions,
  type StructFieldValue,
  unwrapFieldType,
} from "./field";
import { alignOf, CFieldType, type Endian } from "./field-type";
import { CBigint } from "./field-types/bigint";
import { CNumber } from "./field-types/number";
import type { output } from "./struct";

/** The integer an enum, bitfield or bit-field type stores its value in. */
function storageOf(type: FieldType): FieldType | undefined {
  const storage = (type as { type?: unknown }).type;
  return storage instanceof CNumber || storage instanceof CBigint
    ? storage
    : undefined;
}

/**
 * A field whose `sentinel` value stands for `null`, like Blam's `NONE` (-1):
 *
 *   c.i32().nullable(-1)                              // number | null
 *   c.Bitfield(flags, c.u32()).nullable(0xffff_ffff)  // flags | null
 *
 * The sentinel is compared with the stored bytes, so for an enum or bitfield
 * it is a raw storage integer. Size, alignment and padding come from the
 * inner field.
 */
export class CNullable<const Inner> extends CFieldType<
  output<Inner> | null,
  FieldOptions
> {
  readonly inner: Inner;
  readonly sentinel: unknown;

  constructor(inner: Inner, sentinel: unknown) {
    const { padBefore, padAfter } = getFieldOptions(inner as StructFieldValue);
    super({ padBefore, padAfter });
    this.inner = inner;
    this.sentinel = sentinel;
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

  read(
    buffer: Uint8Array,
    offset: number,
    endian: Endian
  ): output<Inner> | null {
    return readWith(this, buffer, offset, endian);
  }

  write(
    buffer: Uint8Array,
    offset: number,
    value: output<Inner> | null,
    endian: Endian
  ): void {
    writeWith(this, buffer, offset, value, endian);
  }

  [COMPILE](env: CompileEnv): Codec<unknown> {
    const type = this.innerType;
    const codec = compileType(type, env);
    const size = type.getSize();
    const stored = new Uint8Array(size);
    try {
      compileType(storageOf(type) ?? type, env).write(
        createCtx(stored),
        0,
        this.sentinel,
        NO_PARENT
      );
    } catch (error) {
      throw new Error(
        `nullable(): sentinel ${String(this.sentinel)} cannot be stored in this field: ${(error as Error).message}`,
        { cause: error }
      );
    }
    const isSentinel = (u8: Uint8Array, at: number): boolean => {
      for (let i = 0; i < size; i++) {
        if (u8[at + i] !== stored[i]) {
          return false;
        }
      }
      return true;
    };
    return {
      usesParent: codec.usesParent,
      read: (ctx, at, parent) =>
        isSentinel(ctx.u8, at) ? null : codec.read(ctx, at, parent),
      write: (ctx, at, value, parent) => {
        if (value === null) {
          ctx.u8.set(stored, at);
          return;
        }
        codec.write(ctx, at, value, parent);
      },
    };
  }
}
