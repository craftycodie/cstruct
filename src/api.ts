import { classImpl, fieldImpl } from "./class";
import type { FieldType } from "./field";
import { cImpl } from "./impl";
import { offsetof, read, sizeof, write } from "./io";

export const c = Object.assign(cImpl, {
  field: fieldImpl,
  class: classImpl,
  read,
  write,
  sizeof,
  offsetof,
});
export namespace c {
  export type FieldOptions = cImpl.FieldOptions;
  export type Endian = cImpl.Endian;
  export type StructOptions = import("./options").StructOptions;
  export type ReadOptions = import("./options").ReadOptions;
  export type WriteOptions = import("./options").WriteOptions;
  export type StructFields = cImpl.StructFields;
  export type StructSchemaToTS<F extends StructFields> =
    cImpl.StructSchemaToTS<F>;
  export type infer<T> = cImpl.infer<T>;
  export type Array<
    T extends FieldType = FieldType,
    N extends number = number,
  > = cImpl.Array<T, N>;
  export type Struct<F extends StructFields = StructFields> = cImpl.Struct<F>;
  export type StructField = cImpl.StructField;
  export type UnionOf<
    Arms extends readonly import("./unions").UnionArmInput[],
  > = cImpl.UnionOf<Arms>;
}
