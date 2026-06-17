import type { FieldOptions } from "../field";
import { CFieldType, type Endian } from "../field-type";

/** Fixed-length character array. */
export class CString<
  L extends number,
  const O extends FieldOptions = {},
> extends CFieldType<string, O> {
  readonly length!: L;
  private readonly encoding: BufferEncoding;

  constructor(length: L, encoding: BufferEncoding = "utf8", options?: O) {
    super(options);
    this.length = length;
    this.encoding = encoding;
  }

  read(buffer: Buffer, offset: number, _endian: Endian): string {
    const bytes = buffer.subarray(offset, offset + this.length);
    let nullIndex = bytes.indexOf(0);
    if (nullIndex === -1) {
      nullIndex = this.length;
    }
    return bytes.subarray(0, nullIndex).toString(this.encoding);
  }

  write(buffer: Buffer, offset: number, value: string, _endian: Endian): void {
    const stringBytes = Buffer.from(value, this.encoding);
    const bytesToWrite =
      stringBytes.length > this.length
        ? stringBytes.subarray(0, this.length)
        : stringBytes;
    bytesToWrite.copy(buffer, offset);
    if (bytesToWrite.length < this.length) {
      buffer.fill(0, offset + bytesToWrite.length, offset + this.length);
    }
  }

  getSize(): number {
    return this.length;
  }
}
