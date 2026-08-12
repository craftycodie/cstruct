// biome-ignore-all lint/performance/noNamespaceImport: cImpl wires struct and factory modules via export import
import type { CArray } from "./array";
import { setStructFactory } from "./class";
import * as fieldFactories from "./factories";
import type { FieldType, FieldOptions as IFieldOptions } from "./field";
import type { Endian as EndianType } from "./field-type";
import * as structCore from "./struct";

export namespace cImpl {
  export type FieldOptions = IFieldOptions;
  export type Endian = EndianType;

  export import Struct = structCore.Struct;
  export import struct = structCore.struct;
  export type StructFields = structCore.StructFields;
  export type StructSchemaToTS<F extends StructFields> =
    structCore.StructSchemaToTS<F>;
  export type infer<T> = structCore.infer<T>;
  export type UnionOf<
    Arms extends readonly import("./unions").UnionArmInput[],
  > = structCore.UnionOf<Arms>;
  export type StructField = structCore.StructField;

  export import endian = fieldFactories.endian;
  export import array = fieldFactories.array;
  export import String = fieldFactories.String;
  export import WString = fieldFactories.WString;
  export import Time64 = fieldFactories.Time64;
  export import bool = fieldFactories.bool;
  export import MagicNumber = fieldFactories.MagicNumber;
  export import MagicString = fieldFactories.MagicString;
  export import Bitfield = fieldFactories.Bitfield;
  export import Enum = fieldFactories.Enum;
  export import Union = fieldFactories.Union;
  export import discriminatedUnion = fieldFactories.discriminatedUnion;
  export import arm = fieldFactories.arm;
  export import when = fieldFactories.when;
  export import u8 = fieldFactories.u8;
  export import u16 = fieldFactories.u16;
  export import u32 = fieldFactories.u32;
  export import u64 = fieldFactories.u64;
  export import i8 = fieldFactories.i8;
  export import i16 = fieldFactories.i16;
  export import i32 = fieldFactories.i32;
  export import i64 = fieldFactories.i64;
  export import f32 = fieldFactories.f32;
  export import f64 = fieldFactories.f64;
  export import pad = fieldFactories.pad;
  export import Pad = fieldFactories.Pad;

  export type Array<
    T extends FieldType = FieldType,
    N extends number = number,
  > = CArray<T, N>;
}

setStructFactory((fields) => cImpl.struct(fields));
