import { describe, expect, it } from "vitest";
import { CStructError, c } from "../index";

@c.struct()
class Flags {
  @c.field(c.Bool())
  is_online!: boolean;

  @c.field("u8", { pad_after: 3 })
  reserved!: number;
}

describe("Bool", () => {
  it("reads non-zero as true and zero as false", () => {
    const field = c.Bool();
    expect(field.read(new Uint8Array([0]), 0, "little", "x")).toBe(false);
    expect(field.read(new Uint8Array([1]), 0, "little", "x")).toBe(true);
    expect(field.read(new Uint8Array([2]), 0, "little", "x")).toBe(true);
  });

  it("writes 0 or 1", () => {
    const bytes = new Uint8Array(1);
    c.Bool().write(bytes, 0, true, "little", "x");
    expect(bytes[0]).toBe(1);
    c.Bool().write(bytes, 0, false, "little", "x");
    expect(bytes[0]).toBe(0);
  });

  it("rejects non-boolean values on write", () => {
    const bytes = new Uint8Array(1);
    expect(() =>
      c.Bool().write(bytes, 0, 1 as unknown as boolean, "little", "x")
    ).toThrow(CStructError);
  });

  it("round-trips through a struct", () => {
    const value = { is_online: true, reserved: 0 } satisfies Flags;
    const written = c.write(Flags, value, "little");
    expect(written).toEqual(new Uint8Array([1, 0, 0, 0, 0]));

    const read = c.read(Flags, written, "little");
    expect(read.is_online).toBe(true);
    expect(read.reserved).toBe(0);
  });
});
