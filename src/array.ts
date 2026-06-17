import {
  type FieldOptions,
  type StructFieldValue,
  unwrapFieldType,
} from "./field";

export class CArray<
  T extends StructFieldValue = StructFieldValue,
  const N extends number = number,
  const O extends FieldOptions = {},
> {
  readonly __carray = true as const;
  readonly element: T;
  readonly count: N;
  readonly options: O;

  constructor(element: T, count: N, options?: O) {
    this.element = element;
    this.count = count;
    this.options = (options ?? {}) as O;
  }
}

export function isCArray(value: unknown): value is CArray {
  return (
    typeof value === "object" &&
    value !== null &&
    "__carray" in value &&
    (value as CArray).__carray === true
  );
}

export function unwrapArrayElement<T extends StructFieldValue>(
  element: T
): ReturnType<typeof unwrapFieldType> {
  return unwrapFieldType(element);
}
