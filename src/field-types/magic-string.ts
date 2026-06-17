import type { FieldOptions } from "../field";
import { CFieldType, type Endian } from "../field-type";

export class CMagicString<
  S extends string,
  const O extends FieldOptions = {},
> extends CFieldType<S, O> {
  private readonly magic: S;

  constructor(magic: S, options?: O) {
    super(options);
    this.magic = magic;
  }

  getSize(): number {
    return this.magic.length;
  }

  read(buffer: Buffer, offset: number, _endian: Endian): S {
    const magic = buffer.subarray(offset, offset + this.magic.length);
    if (magic.toString("utf8") !== this.magic) {
      throw new Error(
        `Magic string mismatch: expected ${this.magic}, got ${magic.toString("utf8")}`
      );
    }
    return this.magic;
  }

  write(buffer: Buffer, offset: number, _value: S, _endian: Endian): void {
    buffer.write(this.magic, offset);
  }
}
