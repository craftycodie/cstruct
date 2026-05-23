import { describe, expect, it } from "vitest";
import { c } from "./index";

@c.struct()
class ExampleStruct {
  @c.field("i32")
  field1!: number;

  @c.field("i32", { pad_before: 2 })
  field2!: number;
}

@c.struct()
class ArmA {
  @c.field("u8")
  value!: number;
}

@c.struct()
class Nested {
  @c.field("u16")
  value!: number;
}

@c.struct()
class NestedHost {
  @c.field(Nested)
  nested!: Nested;
}

@c.struct()
class UnionHost {
  @c.field("u8")
  kind!: number;

  @c.union(
    { size: 4 },
    c.arm(ArmA, (m: UnionHost) => m.kind === 1)
  )
  data: ArmA | null = null;
}

describe("@c.struct", () => {
  it("infers nested struct fields from the property type", () => {
    const bytes = new Uint8Array([0, 42]);
    const value = c.read(NestedHost, bytes, "big");
    expect(value.nested).toEqual({ value: 42 });
    expect(c.size(NestedHost)).toBe(2);
  });

  it("reads primitives with pad_before", () => {
    const bytes = new Uint8Array([0, 0, 0, 1, 0, 0, 0, 0, 0, 2]);

    const value = c.read(ExampleStruct, bytes, "big");
    expect(value.field1).toBe(1);
    expect(value.field2).toBe(2);
    expect(c.size(ExampleStruct)).toBe(10);
  });
});

describe("@c.union", () => {
  it("reads the selected arm", () => {
    const bytes = new Uint8Array([1, 42, 0, 0, 0]);

    const value = c.read(UnionHost, bytes, "big");
    expect(value.kind).toBe(1);
    expect(value.data).toEqual({ value: 42 });
    expect(c.size(UnionHost)).toBe(5);
  });

  it("leaves the field null when the selector returns null", () => {
    const bytes = new Uint8Array([9, 1, 2, 3, 4]);

    const value = c.read(UnionHost, bytes, "big");
    expect(value.kind).toBe(9);
    expect(value.data).toBeNull();
  });
});
