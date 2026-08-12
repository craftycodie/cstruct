import type { FieldOptions } from "../field";
import { CFieldType, type Endian } from "../field-type";

/** Fixed-length wchar_t array (UTF-16, 2 bytes per character). */
export class CWString<
  L extends number,
  const O extends FieldOptions = {},
> extends CFieldType<string, O> {
  readonly length!: L;

  constructor(length: L, options?: O) {
    super(options);
    this.length = length;
  }

  private swapUtf16ByteOrder(bytes: Buffer): Buffer {
    const swapped = Buffer.from(bytes);
    for (let i = 0; i < swapped.length - 1; i += 2) {
      const first = swapped[i];
      swapped[i] = swapped[i + 1];
      swapped[i + 1] = first;
    }
    return swapped;
  }

  read(buffer: Buffer, offset: number, endian: Endian): string {
    const byteLength = this.length * 2;
    const bytes = buffer.subarray(offset, offset + byteLength);

    let nullIndex = -1;
    for (let i = 0; i < bytes.length - 1; i += 2) {
      if (bytes[i] === 0 && bytes[i + 1] === 0) {
        nullIndex = i;
        break;
      }
    }

    const lengthToRead = nullIndex === -1 ? byteLength : nullIndex;
    const stringBytes = bytes.subarray(0, lengthToRead);
    const littleEndianBytes =
      endian === "little" ? stringBytes : this.swapUtf16ByteOrder(stringBytes);
    return littleEndianBytes.toString("utf16le");
  }

  write(buffer: Buffer, offset: number, value: string, endian: Endian): void {
    const byteLength = this.length * 2;
    const stringBytes = Buffer.from(value, "utf16le");
    const bytesToWrite =
      stringBytes.length > byteLength
        ? stringBytes.subarray(0, byteLength)
        : stringBytes;
    const outputBytes =
      endian === "little"
        ? bytesToWrite
        : this.swapUtf16ByteOrder(bytesToWrite);
    outputBytes.copy(buffer, offset);
    if (outputBytes.length < byteLength) {
      buffer.fill(0, offset + outputBytes.length, offset + byteLength);
    }
  }

  getSize(): number {
    return this.length * 2;
  }
}
