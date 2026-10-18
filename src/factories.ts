import { CArray } from "./array";
import type { FieldOptions as IFieldOptions, StructFieldValue } from "./field";
import type { Endian as EndianType } from "./field-type";
import {
  i64 as bigintI64,
  u64 as bigintU64,
  bool as boolField,
  bytes as bytesField,
  CBitfield,
  CEnum,
  CMagicNumber,
  CMagicString,
  type CNumeric,
  CPadding,
  CString,
  CWString,
  f32 as numberF32,
  f64 as numberF64,
  i8 as numberI8,
  i16 as numberI16,
  i32 as numberI32,
  u8 as numberU8,
  u16 as numberU16,
  u32 as numberU32,
  pad as padField,
  Time64 as time64Field,
} from "./field-types";
import type { Struct } from "./struct";
import {
  CUnion,
  discriminatedUnion as discriminatedUnionField,
  arm as unionArm,
  when as unionWhen,
} from "./unions";

export const endian = {
  little: "little" satisfies EndianType,
  big: "big" satisfies EndianType,
} as const;

export function array<
  T extends StructFieldValue,
  const N extends number,
  const O extends IFieldOptions = {},
>(element: T, count: N, options?: O): CArray<T, N, O> {
  return new CArray(element, count, options);
}

export function String<L extends number, const O extends IFieldOptions = {}>(
  length: L,
  encoding: BufferEncoding = "utf8",
  options?: O
) {
  return new CString(length, encoding, options);
}

export function WString<L extends number, const O extends IFieldOptions = {}>(
  length: L,
  options?: O
) {
  return new CWString(length, options);
}

export function Time64<const O extends IFieldOptions = {}>(options?: O) {
  return time64Field(options);
}

export const bool = boolField;
export const bytes = bytesField;

export function MagicNumber<
  N extends number,
  PT extends CNumeric,
  const O extends IFieldOptions = {},
>(magic: N, type: PT, options?: O) {
  return new CMagicNumber(magic, type, options);
}

export function MagicString<
  S extends string,
  const O extends IFieldOptions = {},
>(magic: S, options?: O) {
  return new CMagicString(magic, options);
}

export function Bitfield<
  const K extends readonly string[],
  PT extends CNumeric,
  const O extends IFieldOptions = {},
>(keys: K, type: PT, options?: O) {
  return new CBitfield(keys, type, options);
}

export function Enum<
  const T extends readonly string[] | Record<string, number>,
  PT extends CNumeric,
  const O extends IFieldOptions = {},
>(keysOrMap: T, type: PT, options?: O) {
  return new CEnum(keysOrMap, type, options);
}

export function Union<
  S extends Record<string, Struct<any>>,
  const O extends IFieldOptions = {},
>(members: S, options?: O) {
  return new CUnion(members, options);
}

export function discriminatedUnion<
  const Arms extends readonly import("./unions").UnionArmInput[],
>(options: { size: number }, ...arms: Arms) {
  return discriminatedUnionField(options, ...arms);
}

export const arm = unionArm;
export const when = unionWhen;

export const u8 = numberU8;
export const u16 = numberU16;
export const u32 = numberU32;
export const u64 = bigintU64;
export const i8 = numberI8;
export const i16 = numberI16;
export const i32 = numberI32;
export const i64 = bigintI64;
export const f32 = numberF32;
export const f64 = numberF64;
export const pad = padField;
export const Pad = CPadding;
