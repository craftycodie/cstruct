import { describe, expect, it } from "vitest";
import { assert, VALID_INDEX } from "./assert";
import { CStructError } from "./errors";

describe("assert", () => {
  it("throws with ASSERT: and the expression text from the compile-time macro", () => {
    const index = 99;
    const length = 2;

    try {
      assert(VALID_INDEX(index, length));
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(CStructError);
      expect((err as CStructError).message).toBe(
        "ASSERT: VALID_INDEX(index, length)"
      );
    }
  });
});
