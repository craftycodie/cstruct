import {
  COMPILE,
  type Codec,
  type CompileEnv,
  compileType,
} from "./engine/codec";
import { ArrayCodec } from "./engine/plan";
import {
  type FieldOptions,
  type FieldType,
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
    if (!Number.isInteger(count) || count < 0) {
      throw new RangeError(
        `c.array count must be a non-negative integer, got ${count}`
      );
    }
    this.element = element;
    this.count = count;
    this.options = (options ?? {}) as O;
  }

  /** The element's field type, with wrappers such as `c.class(...)` removed. */
  get elementType(): FieldType {
    return unwrapFieldType(this.element);
  }

  getSize(): number {
    return this.elementType.getSize() * this.count;
  }

  [COMPILE](env: CompileEnv): Codec<unknown[]> {
    const elementType = this.elementType;
    return new ArrayCodec(
      compileType(elementType, env),
      this.count,
      elementType.getSize()
    );
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
