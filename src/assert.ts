import { CStructError } from "./errors";

export function VALID_INDEX(index: number, length: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < length;
}

/** Expression text is injected by the SWC assert macro (`tools/swc-assert-macro.mjs`). */
export function assert(
  condition: boolean,
  expression?: string
): asserts condition {
  if (!condition) {
    throw new CStructError(`ASSERT: ${expression ?? "assertion failed"}`);
  }
}
