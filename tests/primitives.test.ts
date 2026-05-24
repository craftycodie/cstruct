import { describe, expect, it } from "vitest";
import { c } from "../src/index";

@c.struct()
class AllPrimitives {
  @c.field("u8")
  u8!: number;

  @c.field("u16")
  u16!: number;

  @c.field("u32")
  u32!: number;

  @c.field("u64")
  u64!: bigint;

  @c.field("i8")
  i8!: number;

  @c.field("i16")
  i16!: number;

  @c.field("i32")
  i32!: number;

  @c.field("i64")
  i64!: bigint;

  @c.field("f32")
  f32!: number;

  @c.field("f64")
  f64!: number;
}

describe("primitives", () => {
  const sample = {
    u8: 0xff,
    u16: 0xbe_ef,
    u32: 0xde_ad_be_ef,
    u64: 0x0123_4567_89ab_cdefn,
    i8: -1,
    i16: -32_000,
    i32: -2_000_000_000,
    i64: -9_223_372_036_854_775_808n,
    f32: 3.14,
    f64: 1.5,
  } satisfies AllPrimitives;

  it("reports packed size (42 bytes)", () => {
    expect(c.sizeof(AllPrimitives)).toBe(42);
  });

  it("reports primitive type sizes", () => {
    expect(c.sizeof("u8")).toBe(1);
    expect(c.sizeof("u16")).toBe(2);
    expect(c.sizeof("u32")).toBe(4);
    expect(c.sizeof("u64")).toBe(8);
    expect(c.sizeof("i8")).toBe(1);
    expect(c.sizeof("i16")).toBe(2);
    expect(c.sizeof("i32")).toBe(4);
    expect(c.sizeof("i64")).toBe(8);
    expect(c.sizeof("f32")).toBe(4);
    expect(c.sizeof("f64")).toBe(8);
  });

  for (const endian of ["little", "big"] as const) {
    it(`round-trips every primitive (${endian})`, () => {
      const written = c.write(AllPrimitives, sample, endian);
      expect(written.length).toBe(c.sizeof(AllPrimitives));

      const read = c.read(AllPrimitives, written, endian);
      expect(read.u8).toBe(sample.u8);
      expect(read.u16).toBe(sample.u16);
      expect(read.u32).toBe(sample.u32);
      expect(read.u64).toBe(sample.u64);
      expect(read.i8).toBe(sample.i8);
      expect(read.i16).toBe(sample.i16);
      expect(read.i32).toBe(sample.i32);
      expect(read.i64).toBe(sample.i64);
      expect(read.f32).toBeCloseTo(sample.f32, 5);
      expect(read.f64).toBeCloseTo(sample.f64, 10);
    });
  }

  it("reads at a non-zero offset inside a larger buffer", () => {
    const inner = c.write(AllPrimitives, sample, "big");
    const buf = new Uint8Array([0xaa, 0xbb, ...inner, 0xcc]);
    const read = c.read(
      AllPrimitives,
      buf.subarray(2, 2 + inner.length),
      "big"
    );
    expect(read.u32).toBe(sample.u32);
  });
});
