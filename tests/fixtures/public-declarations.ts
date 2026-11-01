/**
 * Exports a schema built from every public factory and modifier.
 * `declarations.test.ts` emits its `.d.ts` against the installed package: a
 * factory whose type names something the package root does not export fails.
 */
import { c } from "@craftycodie/cstruct";

@c.class()
export class Point {
  @c.field(c.i16())
  x = 0;

  @c.field(c.i16())
  y = 0;
}

const ArmA = c.struct({ a: c.u16() });

export const Everything = c.struct({
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
  bool: c.bool(),
  string: c.string(8, "latin1"),
  wstring: c.wstring(4),
  bytes: c.bytes(4),
  pad: c.pad(2),
  array: c.array(c.u8(), 3),
  enum: c.enum({ A: 1, B: 2 }, c.u8()),
  flags: c.Bitfield(["x", "y"], c.u8()),
  bits: c.bits(
    [
      ["low", 4],
      ["high", 4],
    ],
    c.u8()
  ),
  union: c.union({ word: c.struct({ v: c.u16() }) }),
  time: c.Time64(),
  magic: c.MagicNumber(0xbe_ef, c.u16()),
  tag: c.MagicString("HDR"),
  point: c.class(Point),
  points: c.class(Point).array(2).padBefore(1),
  kind: c.u8(),
  none: c.i32().nullable(-1).default(null),
  matched: c.match("kind", { 1: ArmA, 2: c.class(Point) }),
  predicated: c.discriminatedUnion(
    { size: 4 },
    c.arm(ArmA, (parent) => parent.kind === 1),
    c.when(2, c.class(Point), (parent) => parent.kind as number)
  ),
  modified: c
    .u32()
    .be()
    .default(1)
    .assert((value) => value > 0)
    .transform(
      (raw) => String(raw),
      (value: string) => Number(value)
    )
    .padAfter(1),
});

export const Extended = Everything.pick("u8", "point").extend({
  more: c.u8().le(),
});
