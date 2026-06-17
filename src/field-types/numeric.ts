import { CBigint, readBigintValue, writeBigintValue } from "./bigint";
import { type CNumber, readNumberValue, writeNumberValue } from "./number";

export type CNumeric = CNumber | CBigint;

export function getNumericTypeSize(type: CNumeric): number {
  return type.getSize();
}

export function readNumericValue(
  view: DataView,
  offset: number,
  type: CNumeric,
  littleEndian = true
): number | bigint {
  if (type instanceof CBigint) {
    return readBigintValue(view, offset, type, littleEndian);
  }
  return readNumberValue(view, offset, type, littleEndian);
}

export function writeNumericValue(
  view: DataView,
  offset: number,
  type: CNumeric,
  value: number | bigint,
  littleEndian = true
): void {
  if (type instanceof CBigint) {
    writeBigintValue(view, offset, type, value as bigint, littleEndian);
    return;
  }
  writeNumberValue(view, offset, type, value as number, littleEndian);
}
