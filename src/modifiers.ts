import type { Codec } from "./engine/codec";

/** A `.assert(check, message)` registered on a field. */
export interface Assertion {
  check: (value: any) => boolean;
  message?: string;
}

/** Modifier state kept in a field's options by the chain methods. */
export interface ModifierOptions {
  asserts?: readonly Assertion[];
  /** Value (or factory) written when the field is undefined. */
  default?: unknown;
  hasDefault?: boolean;
}

/** Type-only marker: the field may be omitted when writing. */
declare const OPTIONAL_INPUT: unique symbol;
export interface OptionalInput {
  readonly [OPTIONAL_INPUT]: true;
}

/** Copy `target` (keeping its class) with `patch` merged into its options. */
export function withOptions<T extends object>(target: T, patch: object): T {
  const clone = Object.create(Object.getPrototypeOf(target)) as T;
  Object.assign(clone, target);
  const options = (target as { options?: object }).options ?? {};
  Object.defineProperty(clone, "options", {
    value: { ...options, ...patch },
    enumerable: true,
    configurable: true,
    writable: true,
  });
  return clone;
}

function runAsserts(asserts: readonly Assertion[], value: unknown): void {
  for (const assertion of asserts) {
    if (!assertion.check(value)) {
      throw new Error(assertion.message ?? "assertion failed");
    }
  }
}

/** Throw if `value` fails any assertion in `options`. */
export function checkAsserts(options: unknown, value: unknown): void {
  const asserts = (options as ModifierOptions | undefined)?.asserts;
  if (asserts?.length) {
    runAsserts(asserts, value);
  }
}

/**
 * Getter for the value a field takes when omitted on write: a `.default()`
 * on the field or its wrapper, or the constant of a magic field.
 */
export function defaultGetter(
  type: unknown,
  wrapperOptions: unknown
): (() => unknown) | undefined {
  for (const options of [
    wrapperOptions,
    (type as { options?: unknown })?.options,
  ]) {
    const mods = options as ModifierOptions | undefined;
    if (mods?.hasDefault) {
      return () => resolveDefault(mods);
    }
  }
  const magic = (type as { [MAGIC_VALUE]?: unknown } | null)?.[MAGIC_VALUE];
  return magic === undefined ? undefined : () => magic;
}

/** Field types whose value is a fixed constant expose it under this key. */
export const MAGIC_VALUE: unique symbol = Symbol("cstruct.magic");

function resolveDefault(options: ModifierOptions): unknown {
  const value = options.default;
  return typeof value === "function" ? (value as () => unknown)() : value;
}

/** Wrap `codec` with the defaults and assertions recorded in `options`. */
export function applyModifiers(codec: Codec, options: unknown): Codec {
  const mods = (options ?? {}) as ModifierOptions;
  const asserts = mods.asserts ?? [];
  const hasDefault = mods.hasDefault === true;
  if (!hasDefault && asserts.length === 0) {
    return codec;
  }
  return {
    usesParent: codec.usesParent,
    read: (ctx, at, parent) => {
      const value = codec.read(ctx, at, parent);
      runAsserts(asserts, value);
      return value;
    },
    write: (ctx, at, value, parent) => {
      const resolved =
        value === undefined && hasDefault ? resolveDefault(mods) : value;
      runAsserts(asserts, resolved);
      codec.write(ctx, at, resolved, parent);
    },
  };
}
