import type { FieldOptions } from "../field";
import { CFieldType, type Endian } from "../field-type";
import {
  type CNumeric,
  getNumericTypeSize,
  readNumericValue,
  writeNumericValue,
} from "./numeric";

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

  getSize(): number {
    return getNumericTypeSize(this.type);
  }

  read(buffer: Buffer, offset: number, endian: Endian): N {
    const value = readNumericValue(
      new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength),
      offset,
      this.type,
      endian === "little"
    );

    if (value !== this.magic) {
      throw new Error(
        `Magic number mismatch: expected ${this.magic}, got ${value} at offset ${offset}`
      );
    }

    return this.magic;
  }

  write(buffer: Buffer, offset: number, value: N, endian: Endian): void {
    writeNumericValue(
      new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength),
      offset,
      this.type,
      value,
      endian === "little"
    );
  }
}
