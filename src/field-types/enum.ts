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
import { CBigint } from "./bigint";
import { type CNumeric, numericCodec } from "./numeric";

type EnumKeys<T> = T extends readonly string[]
  ? T[number]
  : T extends Record<infer K, number>
    ? K extends string
      ? K
      : keyof T & string
    : never;

/** C-style enum backed by a numeric field type. */
export class CEnum<
  const T extends readonly string[] | Record<string, number>,
  PT extends CNumeric,
  const O extends FieldOptions = {},
> extends CFieldType<EnumKeys<T>, O> {
  private readonly keys: readonly string[];
  private readonly valueMap: Map<string, number>;
  private readonly keyMap: Map<number, string>;
  private readonly type: PT;

  constructor(keysOrMap: T, type: PT, options?: O) {
    super(options);
    this.type = type;

    if (Array.isArray(keysOrMap)) {
      this.keys = keysOrMap;
      this.valueMap = new Map();
      this.keyMap = new Map();
      for (let i = 0; i < keysOrMap.length; i++) {
        const key = keysOrMap[i];
        this.valueMap.set(key, i);
        this.keyMap.set(i, key);
      }
    } else {
      this.keys = Object.keys(keysOrMap) as readonly string[];
      this.valueMap = new Map();
      this.keyMap = new Map();
      for (const [key, value] of Object.entries(keysOrMap)) {
        this.valueMap.set(key, value);
        this.keyMap.set(value, key);
      }
    }
  }

  getSize(): number {
    return this.type.getSize();
  }

  read(buffer: Uint8Array, offset: number, endian: Endian): EnumKeys<T> {
    return readWith(this, buffer, offset, endian);
  }

  write(
    buffer: Uint8Array,
    offset: number,
    value: EnumKeys<T>,
    endian: Endian
  ): void {
    writeWith(this, buffer, offset, value, endian);
  }

  [COMPILE](env: CompileEnv): Codec<string> {
    const storage = numericCodec(this.type, env);
    const wide = this.type instanceof CBigint;
    const { keyMap, valueMap } = this;
    return {
      read: (ctx, at) => {
        const numericValue = Number(storage.read(ctx, at, NO_PARENT));
        const key = keyMap.get(numericValue);
        if (key === undefined) {
          throw new Error(
            `Enum value ${numericValue} is not a valid enum value`
          );
        }
        return key;
      },
      write: (ctx, at, value) => {
        const mapped = valueMap.get(value);
        if (mapped === undefined) {
          throw new Error(`Invalid enum key: ${value}`);
        }
        storage.write(ctx, at, wide ? BigInt(mapped) : mapped, NO_PARENT);
      },
    };
  }
}
