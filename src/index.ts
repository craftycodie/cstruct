export * from "./api";
export type { CArray } from "./array";
export { type ClassCtor, isClassCtor } from "./class";
export {
  CStructError,
  type CStructOperation,
  type CStructPathSegment,
} from "./errors";
export {
  type CAnnotatedField,
  CClassField,
  CStructField,
  type FieldOptions,
  type FieldType,
  isCClassField,
  isCStructField,
  type StructFieldType,
  type StructFieldValue,
} from "./field";
export {
  CBigint,
  CBitfield,
  CBits,
  CBool,
  CBytes,
  CEnum,
  CFieldType,
  CMagicNumber,
  CMagicString,
  CNumber,
  CPadding,
  CString,
  CWString,
  type EnumLike,
  isCFieldType,
  type StringEncoding,
} from "./field-types";
export { time64_t } from "./field-types/time";
export {
  CMatch,
  type MatchArm,
  type MatchArms,
  type MatchOptions,
} from "./match";
export type { OptionalInput } from "./modifiers";
export type { CNullable } from "./nullable";
export type {
  Struct,
  StructFields,
  StructInput,
} from "./struct";
export type { CTransform } from "./transform";
export type {
  CDiscriminatedUnion,
  CUnion,
  UnionArmInput,
  UnionArmSchema,
  UnionArmType,
  UnionWhen,
} from "./unions";
export { FlattenIntersection, Tuple, UnionToIntersection } from "./utils";
