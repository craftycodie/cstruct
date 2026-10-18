import type { CArray } from "./array";
import type { CFieldType, Endian } from "./field-type";
import type { CDiscriminatedUnion } from "./unions";

export interface FieldOptions {
  /** Byte order for this field, overriding the struct and the call site. */
  endian?: Endian;
  padAfter?: number;
  padBefore?: number;
}

/** Runtime shape shared by nested struct field types. */
export interface StructFieldType {
  getSize(): number;
  read(buffer: Uint8Array, offset?: number, endian?: Endian): unknown;
  write(data: Record<string, unknown>, endian?: Endian): Buffer;
}

export type { UnionArmInput, UnionOfArms } from "./unions";

export type FieldType =
  | CFieldType<any, any>
  | StructFieldType
  | CDiscriminatedUnion;

export class CStructField<S, const O extends FieldOptions = {}> {
  readonly __cstructField = true as const;
  readonly struct: S;
  readonly options: O;

  constructor(struct: S, options?: O) {
    this.struct = struct;
    this.options = (options ?? {}) as O;
  }
}

export function isCStructField(
  value: unknown
): value is CStructField<any, any> {
  return (
    typeof value === "object" &&
    value !== null &&
    "__cstructField" in value &&
    (value as CStructField<any>).__cstructField === true
  );
}

export class CClassField<S, const O extends FieldOptions = {}> {
  readonly __cclassField = true as const;
  readonly struct: S;
  readonly options: O;

  constructor(struct: S, options?: O) {
    this.struct = struct;
    this.options = (options ?? {}) as O;
  }
}

export function isCClassField(value: unknown): value is CClassField<any, any> {
  return (
    typeof value === "object" &&
    value !== null &&
    "__cclassField" in value &&
    (value as CClassField<any>).__cclassField === true
  );
}

export class CAnnotatedField<
  T extends StructFieldValue = StructFieldValue,
  const O extends FieldOptions = {},
> {
  readonly __cstructAnnotatedField = true as const;
  readonly field: T;
  readonly options: O;

  constructor(field: T, options?: O) {
    this.field = field;
    this.options = (options ?? {}) as O;
  }
}

export function isCAnnotatedField(
  value: unknown
): value is CAnnotatedField<any, any> {
  return (
    typeof value === "object" &&
    value !== null &&
    "__cstructAnnotatedField" in value &&
    (value as CAnnotatedField<any>).__cstructAnnotatedField === true
  );
}

export type StructFieldValue =
  | CFieldType<any, any>
  | StructFieldType
  | CArray<any, any, any>
  | CDiscriminatedUnion<any, any>
  | CStructField<any, any>
  | CClassField<any, any>
  | CAnnotatedField<any, any>;

export function getFieldOptions(value: StructFieldValue): FieldOptions {
  if (
    isCStructField(value) ||
    isCClassField(value) ||
    isCAnnotatedField(value)
  ) {
    return value.options;
  }
  if ("options" in value && value.options) {
    return value.options as FieldOptions;
  }
  return {};
}

export function unwrapFieldType(value: StructFieldValue): FieldType {
  if (isCStructField(value) || isCClassField(value)) {
    return value.struct as FieldType;
  }
  if (isCAnnotatedField(value)) {
    return unwrapFieldType(value.field);
  }
  if (
    typeof value === "object" &&
    value !== null &&
    "__cdiscriminatedUnion" in value &&
    (value as CDiscriminatedUnion).__cdiscriminatedUnion === true
  ) {
    return value as FieldType;
  }
  // Arrays are field types in their own right, so nested arrays keep their count.
  return value as FieldType;
}
