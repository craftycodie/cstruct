import { describe, expect, it } from "vitest";
import { c } from "../src/index";

const AllPrimitives = c.struct({
  u8: c.u8(),
  u16: c.u16(),
  u32: c.u32(),
  u64: c.u64(),
  i8: c.i8(),
  i16: c.i16(),
  i32: c.i32(),
  i64: c.i64(),
  f32: c.f32(),
  f64: c.f64(),
});

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
  };

  it("reports packed size (42 bytes)", () => {
    expect(c.sizeof(AllPrimitives)).toBe(42);
  });

  it("reports primitive field sizes via schema members", () => {
    expect(c.u8().getSize()).toBe(1);
    expect(c.u16().getSize()).toBe(2);
    expect(c.u32().getSize()).toBe(4);
    expect(c.u64().getSize()).toBe(8);
    expect(c.i8().getSize()).toBe(1);
    expect(c.i16().getSize()).toBe(2);
    expect(c.i32().getSize()).toBe(4);
    expect(c.i64().getSize()).toBe(8);
    expect(c.f32().getSize()).toBe(4);
    expect(c.f64().getSize()).toBe(8);
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
      expect(read.f64).toBe(sample.f64);
    });
  }
});
