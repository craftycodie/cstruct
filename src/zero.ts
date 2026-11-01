import { isCArray } from "./array";
import { compileType, envFor, NO_PARENT } from "./engine/codec";
import { createCtx } from "./engine/ctx";
import type { FieldType } from "./field";
import { isCPadding } from "./field-types/padding";
import type { Layout } from "./layout";
import { CMatch } from "./match";
import { defaultGetter } from "./modifiers";
import { isCDiscriminatedUnion } from "./unions";

function hasZero(type: unknown): type is { zero(): unknown } {
  return typeof (type as { zero?: unknown }).zero === "function";
}

/**
 * A new value for `type`: its `.default()` or magic constant, `null` for
 * tagged unions, else what zero bytes decode to.
 */
function zeroValue(type: FieldType, wrapperOptions?: object): unknown {
  const getDefault = defaultGetter(type, wrapperOptions);
  if (getDefault) {
    return getDefault();
  }
  if (hasZero(type)) {
    return type.zero();
  }
  if (isCArray(type)) {
    const element = type.elementType;
    return Array.from({ length: type.count }, () => zeroValue(element));
  }
  if (type instanceof CMatch || isCDiscriminatedUnion(type)) {
    return null;
  }
  const ctx = createCtx(new Uint8Array(type.getSize()));
  return compileType(type, envFor("little")).read(ctx, 0, NO_PARENT);
}

/** Fill the fields of `out` that are still undefined with their zero values. */
export function zeroFields<T extends Record<string, unknown>>(
  layout: Layout,
  out: T
): T {
  const record = out as Record<string, unknown>;
  for (const field of layout.fields) {
    if (isCPadding(field.type) || record[field.name] !== undefined) {
      continue;
    }
    try {
      if (field.count === undefined) {
        record[field.name] = zeroValue(field.type, field.wrapperOptions);
        continue;
      }
      const getDefault = defaultGetter(undefined, field.wrapperOptions);
      record[field.name] = getDefault
        ? getDefault()
        : Array.from({ length: field.count }, () => zeroValue(field.type));
    } catch (error) {
      throw new Error(
        `zero(): field '${field.name}' has no .default() and zero bytes do not decode: ${(error as Error).message}`,
        { cause: error }
      );
    }
  }
  return out;
}
