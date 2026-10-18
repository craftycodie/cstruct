import { CArray } from "./array";
import type { Endian } from "./field-type";
import {
  type Assertion,
  type ModifierOptions,
  type OptionalInput,
  withOptions,
} from "./modifiers";
import type { input, output } from "./struct";
import { CTransform } from "./transform";

/**
 * zod-style modifiers available on every field type, struct, array and
 * wrapper. Each returns a new value; the original is unchanged.
 */
export interface Chainable {
  // Methods are generic over `this` (Self) rather than using `this` types
  // directly: a `this` type inside input<>/output<> makes every structural
  // check of a field type recurse into these signatures.

  /** Fixed-length array of this field: `c.u8().array(4)` is `uint8_t x[4]`. */
  array<Self, const N extends number>(this: Self, count: N): CArray<Self, N>;
  /**
   * Run `check` on every value read and written; failing values throw
   * `message` (with the field's path).
   */
  assert<Self>(
    this: Self,
    check: (value: output<Self>) => boolean,
    message?: string
  ): Self;
  /** Big-endian, regardless of the struct or call site. */
  be<Self>(this: Self): Self;
  /**
   * Value written when the field is missing (or a function returning it).
   * The field becomes optional in `c.input`.
   */
  default<Self>(
    this: Self,
    value: input<Self> | (() => input<Self>)
  ): Self & OptionalInput;
  /** Little-endian, regardless of the struct or call site. */
  le<Self>(this: Self): Self;
  /** Reserved zero bytes after this field. */
  padAfter<Self>(this: Self, bytes: number): Self;
  /** Reserved zero bytes before this field. */
  padBefore<Self>(this: Self, bytes: number): Self;
  /**
   * Expose the stored value as another type: `decode` runs after reading,
   * `encode` before writing.
   */
  transform<Self, Out>(
    this: Self,
    decode: (raw: output<Self>) => Out,
    encode: (value: Out) => input<Self>
  ): CTransform<Self, Out>;
}

function endianModifier(endian: Endian) {
  return function (this: object) {
    return withOptions(this, { endian });
  };
}

const CHAIN_METHODS: Record<keyof Chainable, (...args: any[]) => unknown> = {
  array(this: object, count: number) {
    return new CArray(this as never, count);
  },
  assert(this: object, check: Assertion["check"], message?: string) {
    const current = (this as { options?: ModifierOptions }).options?.asserts;
    return withOptions(this, {
      asserts: [...(current ?? []), { check, message }],
    });
  },
  be: endianModifier("big"),
  default(this: object, value: unknown) {
    return withOptions(this, { default: value, hasDefault: true });
  },
  le: endianModifier("little"),
  padAfter(this: object, bytes: number) {
    return withOptions(this, { padAfter: bytes });
  },
  padBefore(this: object, bytes: number) {
    return withOptions(this, { padBefore: bytes });
  },
  transform(
    this: object,
    decode: (raw: unknown) => unknown,
    encode: (value: unknown) => unknown
  ) {
    return new CTransform(this, decode, encode);
  },
};

/** Add the chain methods to each prototype (called once by the entry module). */
export function installChain(...prototypes: object[]): void {
  for (const prototype of prototypes) {
    for (const [name, method] of Object.entries(CHAIN_METHODS)) {
      Object.defineProperty(prototype, name, {
        value: method,
        writable: true,
        configurable: true,
      });
    }
  }
}
