import { describe, expect, it } from "vitest";
import { c } from "../index";

@c.struct()
class U64Slot {
  @c.field(c.U64())
  value!: bigint;
}

@c.struct()
class I64Slot {
  @c.field(c.I64())
  value!: bigint;
}

describe("c.U64 / c.I64", () => {
  it("reads and writes u64 through a struct", () => {
    const value = 0x0009_0003_1234_5678n;
    expect(c.sizeof(U64Slot)).toBe(8);

    const written = c.write(U64Slot, { value } as U64Slot, "little");
    const read = c.read(U64Slot, written, "little");
    expect(read.value).toBe(value);
  });

  it("reads and writes i64 including negative values", () => {
    const value = -1n;
    const written = c.write(I64Slot, { value } as I64Slot, "little");
    const read = c.read(I64Slot, written, "little");
    expect(read.value).toBe(-1n);
  });

  it("round-trips u64 through JSON", () => {
    const field = c.U64();
    expect(field.toJson(42n, "x")).toBe("42");
    expect(field.fromJson("2533287980717688", "x")).toBe(2533287980717688n);
  });
});
