import type { Codec } from "../engine/codec";
import type { Endian } from "../field-type";
import { bigintCodec, CBigint } from "./bigint";
import { type CNumber, numberCodec } from "./number";

export type CNumeric = CNumber | CBigint;

/** Codec for the storage type behind enums, bitfields and magic numbers. */
export function numericCodec(
  type: CNumeric,
  endian: Endian
): Codec<number | bigint> {
  return type instanceof CBigint
    ? bigintCodec(type.kind, endian)
    : numberCodec(type.kind, endian);
}

export function isSignedNumeric(type: CNumeric): boolean {
  return type.kind.startsWith("i");
}
