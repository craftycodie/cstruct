import type { FieldOptions } from "./field";

export type Endian = "little" | "big";

export abstract class CFieldType<T, const O extends FieldOptions = {}> {
  readonly options: O;

  constructor(options?: O) {
    this.options = (options ?? {}) as O;
  }

  abstract getSize(): number;

  /**
   * Natural alignment in bytes, used by structs declared with `align` or
   * `pack`. Defaults to 1; override for custom types that C would align.
   */
  getAlign(): number {
    return 1;
  }

  abstract read(buffer: Buffer, offset: number, endian: Endian): T;
  abstract write(
    buffer: Buffer,
    offset: number,
    value: T,
    endian: Endian
  ): void;
}

/** Natural alignment of any field type; 1 when it does not declare one. */
export function alignOf(type: unknown): number {
  const getAlign = (type as { getAlign?: () => number } | null)?.getAlign;
  return typeof getAlign === "function" ? getAlign.call(type) : 1;
}

export function isCFieldType(value: unknown): value is CFieldType<any, any> {
  return value instanceof CFieldType;
}
