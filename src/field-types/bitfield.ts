import type { FieldOptions } from "../field";
import { CFieldType, type Endian } from "../field-type";
import {
  type CNumeric,
  getNumericTypeSize,
  readNumericValue,
  writeNumericValue,
} from "./numeric";

export class CBitfield<
  const K extends readonly string[],
  T extends CNumeric,
  const O extends FieldOptions = {},
> extends CFieldType<
  {
    [Key in K[number]]: boolean;
  },
  O
> {
  private readonly keys: readonly string[];
  private readonly type: T;

  constructor(keys: K, type: T, options?: O) {
    super(options);
    this.keys = keys;
    this.type = type;
  }

  getSize(): number {
    return getNumericTypeSize(this.type);
  }

  read(
    buffer: Buffer,
    offset: number,
    endian: Endian
  ): {
    [Key in K[number]]: boolean;
  } {
    const value = readNumericValue(
      new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength),
      offset,
      this.type,
      endian === "little"
    );
    const result: Record<string, boolean> = {};
    for (let i = 0; i < this.keys.length; i++) {
      const key = this.keys[i];
      result[key] = (((value as number) >> i) & 1) === 1;
    }
    return result as { [Key in K[number]]: boolean };
  }

  write(
    buffer: Buffer,
    offset: number,
    value: { [Key in K[number]]: boolean },
    endian: Endian
  ): void {
    let result = 0;
    for (let i = 0; i < this.keys.length; i++) {
      const key = this.keys[i];
      result |= (value[key as K[number]] ? 1 : 0) << i;
    }
    writeNumericValue(
      new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength),
      offset,
      this.type,
      result,
      endian === "little"
    );
  }
}
