import { describe, expect, it } from "vitest";
import { c } from "../src/index";

// Syntax only standard (stage 3) decorators accept; runs in the
// stage3-decorators project only (see vitest.config.ts).

describe("stage 3 decorators", () => {
  it("rejects #private and static fields", () => {
    expect(() => {
      class Hidden {
        @c.field(c.u8())
        #secret = 0;

        peek() {
          return this.#secret;
        }
      }
      return Hidden;
    }).toThrow(
      "@c.field() cannot decorate static or #private fields ('#secret')"
    );

    expect(() => {
      class Static {
        @c.field(c.u8())
        static count = 0;

        id = 0;
      }
      return Static;
    }).toThrow("cannot decorate static or #private fields ('count')");
  });

  it("rejects decorating methods", () => {
    expect(() => {
      class Method {
        // @ts-expect-error @c.field is a field decorator
        @c.field(c.u8())
        run() {
          return 1;
        }
      }
      return Method;
    }).toThrow("@c.field() can only decorate fields, not 'run'");
  });

  it("type-checks private TypeScript fields too", () => {
    @c.class()
    class Checked {
      @c.field(c.u32())
      private value = 0;

      get() {
        return this.value;
      }
    }
    expect(c.read(Checked, Buffer.from([5, 0, 0, 0])).get()).toBe(5);
  });
});
