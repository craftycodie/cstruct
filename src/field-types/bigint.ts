import type { FieldOptions } from "../field";
import { CFieldType, type Endian } from "../field-type";

export type BigintKind = "u64" | "i64";

export type BigintTypeToTS<_K extends BigintKind> = bigint;

const BIGINT_TYPE_SIZES: Record<BigintKind, number> = {
  u64: 8,
  i64: 8,
};

export class CBigint<
  K extends BigintKind = BigintKind,
  const O extends FieldOptions = {},
> extends CFieldType<BigintTypeToTS<K>, O> {
  readonly kind: K;

  constructor(kind: K, options?: O) {
    super(options);
    this.kind = kind;
  }

  getSize(): number {
    return BIGINT_TYPE_SIZES[this.kind];
  }

  read(buffer: Buffer, offset: number, endian: Endian): BigintTypeToTS<K> {
    const view = new DataView(
      buffer.buffer,
      buffer.byteOffset,
      buffer.byteLength
    );
    return readBigintValue(
      view,
      offset,
      this,
      endian === "little"
    ) as BigintTypeToTS<K>;
  }

  write(
    buffer: Buffer,
    offset: number,
    value: BigintTypeToTS<K>,
    endian: Endian
  ): void {
    const view = new DataView(
      buffer.buffer,
      buffer.byteOffset,
      buffer.byteLength
    );
    writeBigintValue(view, offset, this, value, endian === "little");
  }
}

export const u64 = <const O extends FieldOptions = {}>(options?: O) =>
  new CBigint("u64", options);
export const i64 = <const O extends FieldOptions = {}>(options?: O) =>
  new CBigint("i64", options);

export function getBigintTypeSize(type: CBigint): number {
  return type.getSize();
}

export function readBigintValue(
  view: DataView,
  offset: number,
  type: CBigint,
  littleEndian = true
): bigint {
  switch (type.kind) {
    case "u64":
      return view.getBigUint64(offset, littleEndian);
    case "i64":
      return view.getBigInt64(offset, littleEndian);
    default:
      throw new Error(`Unsupported bigint kind: ${type.kind}`);
  }
}

export function writeBigintValue(
  view: DataView,
  offset: number,
  type: CBigint,
  value: bigint,
  littleEndian = true
): void {
  switch (type.kind) {
    case "u64":
      view.setBigUint64(offset, value, littleEndian);
      break;
    case "i64":
      view.setBigInt64(offset, value, littleEndian);
      break;
    default:
      throw new Error(`Unsupported bigint kind: ${type.kind}`);
  }
}
