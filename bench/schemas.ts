import { readFileSync } from "node:fs";
import { join } from "node:path";
import { c } from "@craftycodie/cstruct";

export const chdrBytes = readFileSync(
  join(import.meta.dirname, "../tests/examples/fixtures/chdr.bin")
);

/** 16 numeric fields, 46 bytes: primitive throughput. */
export const Flat16 = c.struct({
  a: c.u8(),
  b: c.i8(),
  c: c.u16(),
  d: c.i16(),
  e: c.u32(),
  f: c.i32(),
  g: c.f32(),
  h: c.f64(),
  i: c.u8(),
  j: c.u8(),
  k: c.u16(),
  l: c.u32(),
  m: c.i32(),
  n: c.f32(),
  o: c.u16(),
  p: c.u16(),
});

export const flat16Value: c.infer<typeof Flat16> = {
  a: 1,
  b: -2,
  c: 3000,
  d: -4000,
  e: 5_000_000,
  f: -6_000_000,
  g: 7.5,
  h: 8.25,
  i: 9,
  j: 10,
  k: 11,
  l: 12,
  m: -13,
  n: 14.5,
  o: 15,
  p: 16,
};

export const Vec3 = c.struct({ x: c.f32(), y: c.f32(), z: c.f32() });

export const VEC3_COUNT = 1000;

export const Vec3Array = c.struct({
  points: c.array(Vec3, VEC3_COUNT),
});

export const vec3ArrayValue = {
  points: Array.from({ length: VEC3_COUNT }, (_, i) => ({
    x: i,
    y: i * 0.5,
    z: -i,
  })),
};

@c.class()
export class Header {
  @c.field(c.u16())
  magic!: number;

  @c.field(c.u32(), { padBefore: 2 })
  length!: number;

  @c.field(c.f32())
  scale!: number;

  @c.field(c.String(16))
  name!: string;
}

export function makeHeader(): Header {
  const header = new Header();
  header.magic = 0xbeef;
  header.length = 42;
  header.scale = 1.5;
  header.name = "bench";
  return header;
}
