/** See polyfill-decorator-metadata.ts — inlined here so ESM entry has no extra import path. */
const symbolRef = Symbol as typeof Symbol & { metadata?: symbol };
if (typeof symbolRef.metadata === "undefined") {
  Object.defineProperty(Symbol, "metadata", {
    value: Symbol.for("cstruct.decorator.metadata"),
    enumerable: false,
    configurable: true,
    writable: false,
  });
}

import {
  AdvancedType,
  Bool as boolField,
  CBool,
  CString,
  CTime64,
  CWString,
  String as stringField,
  Time64 as time64Field,
  WString as wstringField,
} from "./advanced";
import { json, read, sizeof, write } from "./codec";
import {
  arm,
  arrayType,
  bitfieldType,
  enumType,
  field,
  pad,
  struct,
  union,
  unionField,
} from "./decorators";

export type {
  Bitfield,
  BitfieldField,
  BitfieldFlagDefinition,
} from "./bitfield";
export {
  bitfield_from_raw,
  bitfield_to_raw,
  create_bitfield_field,
} from "./bitfield";

import { CStructError } from "./errors";
import { CSTRUCT_LAYOUT } from "./struct";
import { when } from "./union";

export { CStructError };

/**
 * @craftycodie/cstruct — import `{ c }` for decorators, types, and struct I/O.
 *
 * @example
 * import { c } from "@craftycodie/cstruct";
 *
 * @c.struct()
 * class Example {
 *   @c.field("u32")
 *   value!: number;
 * }
 *
 * const x = c.read(Example, bytes);
 */

/** Runtime API (decorators, struct I/O, helpers). */
export const c = {
  CSTRUCT_LAYOUT,
  CStructError,

  read,
  write,
  sizeof,
  json,

  AdvancedType,
  CBool,
  CString,
  CWString,
  CTime64,

  field,
  struct,
  union,
  unionField,
  when,
  arm,
  Bool: boolField,
  String: stringField,
  WString: wstringField,
  Time64: time64Field,
  pad,
  enum: enumType,
  bitfield: bitfieldType,
  array: arrayType,
} as const;

/** Types for {@link c}. */
export namespace c {
  export type PrimitiveType = import("./primitive").PrimitiveType;
  export type Endian = import("./primitive").Endian;
  export type FieldOptions = import("./decorators").FieldOptions;
  export type PadField = import("./pad").PadField;
  export type EnumField = import("./enum").EnumField;
  export type BitfieldField = import("./bitfield").BitfieldField;
  export type ArrayField = import("./array").ArrayField;
  export type BitfieldFlagDefinition =
    import("./bitfield").BitfieldFlagDefinition;
  export type Bitfield<T extends BitfieldFlagDefinition> =
    import("./bitfield").Bitfield<T>;
  export type StructClass = import("./union").StructClass;
  export type UnionSelect<T extends object = object> =
    import("./union").UnionSelect<T>;
  export type UnionArmWhen<T extends object = object> =
    import("./union").UnionArmWhen<T>;
  export type UnionArmInput<T extends object = object> =
    import("./union").UnionArmInput<T>;
  export type UnionField<T extends object = object> =
    import("./union").UnionField<T>;
  export type UnionOptions = import("./union").UnionOptions;
  export type FieldType = import("./struct").FieldType;
  export type StructLayoutBrand = import("./struct").StructLayoutBrand;
  export type StructLayoutCtor<T extends object = object> =
    import("./struct").StructLayoutCtor<T>;
  export type UnionOf<T extends readonly import("./union").StructClass[]> =
    import("./union").UnionOf<T>;
  export type StructMeta = import("./struct").StructMeta;
  export type StructFieldMeta = import("./struct").StructFieldMeta;
}
