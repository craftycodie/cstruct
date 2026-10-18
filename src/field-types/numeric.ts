import type { Codec, CompileEnv } from "../engine/codec";
import { bigintCodec, CBigint } from "./bigint";
import { type CNumber, numberCodec } from "./number";

export type CNumeric = CNumber | CBigint;

/** Codec for the storage type behind enums, bitfields and magic numbers. */
export function numericCodec(
  type: CNumeric,
  env: CompileEnv
): Codec<number | bigint> {
  return type instanceof CBigint
    ? bigintCodec(type.kind, env)
    : numberCodec(type.kind, env);
}

export function isSignedNumeric(type: CNumeric): boolean {
  return type.kind.startsWith("i");
}
