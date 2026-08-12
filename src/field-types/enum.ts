import type { FieldOptions } from "../field";
import { CFieldType, type Endian } from "../field-type";
import {
  type CNumeric,
  getNumericTypeSize,
  readNumericValue,
  writeNumericValue,
} from "./numeric";

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
    return getNumericTypeSize(this.type);
  }

  read(buffer: Buffer, offset: number, endian: Endian): EnumKeys<T> {
    const value = readNumericValue(
      new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength),
      offset,
      this.type,
      endian === "little"
    );
    const numericValue = Number(value);
    const key = this.keyMap.get(numericValue);
    if (key !== undefined) {
      return key as EnumKeys<T>;
    }
    throw new Error(`Enum value ${numericValue} is not a valid enum value`);
  }

  write(
    buffer: Buffer,
    offset: number,
    value: EnumKeys<T>,
    endian: Endian
  ): void {
    const mappedValue = this.valueMap.get(value);
    if (mappedValue === undefined) {
      throw new Error(`Invalid enum key: ${value}`);
    }
    writeNumericValue(
      new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength),
      offset,
      this.type,
      mappedValue,
      endian === "little"
    );
  }
}
