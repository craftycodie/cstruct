import { classImpl, fieldImpl } from "./class";
import { setCodegen } from "./engine/codegen";
import { enumField } from "./factories";
import type { FieldType } from "./field";
import { cImpl } from "./impl";
import { offsetof, read, sizeof, write } from "./io";

export interface ConfigureOptions {
  /**
   * Generate specialized readers and writers with `new Function` (default
   * true). They fall back to closures automatically where code generation is
   * blocked (Content Security Policy, Cloudflare Workers). Applies to
   * schemas first read or written after the call.
   */
  codegen?: boolean;
}

function configure(options: ConfigureOptions): void {
  if (options.codegen !== undefined) {
    setCodegen(options.codegen);
  }
}

export const c = Object.assign(cImpl, {
  configure,
  /** C enum stored as a numeric type; decodes to the key names. */
  enum: enumField,
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
  /** Accepted write type: padding omitted; magic, unions and defaults optional. */
  export type input<T> = cImpl.input<T>;
  /** Decoded read type (same as `c.infer`). */
  export type output<T> = cImpl.output<T>;
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
