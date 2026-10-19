import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { c } from "../src/index";

interface CLayout {
  align: number;
  offsets: Record<string, number>;
  size: number;
}

/** Layouts printed by clang from tests/fixtures/c-layouts.c. */
const C_LAYOUTS: Record<string, CLayout> = JSON.parse(
  readFileSync(join(import.meta.dirname, "fixtures/c-layouts.json"), "utf8")
).structs;

const mixedFields = {
  a: c.u8(),
  b: c.u32(),
  c: c.u16(),
  d: c.u64(),
  e: c.u8(),
};

const Mixed = c.struct(mixedFields, { align: true });
const Packed1 = c.struct({ a: c.u8(), b: c.u32() }, { pack: 1 });

const SCHEMAS: Record<string, c.Struct> = {
  Mixed,
  Nested: c.struct(
    { tag: c.u8(), inner: Mixed, tail: c.array(c.u16(), 3) },
    { align: true }
  ),
  Pack2: c.struct(mixedFields, { pack: 2 }),
  Pack4: c.struct(mixedFields, { pack: 4 }),
  Misc: c.struct(
    {
      flag: c.bool(),
      f: c.f64(),
      name: c.String(5),
      g: c.f32(),
      wide: c.WString(3),
      s: c.i8(),
    },
    { align: true }
  ),
  HoldsPacked: c.struct({ x: c.u8(), p: Packed1, y: c.u32() }, { align: true }),
  Arrays: c.struct(
    {
      a: c.u8(),
      grid: c.array(c.array(c.u8(), 3), 2),
      b: c.u32(),
      pts: c.array(c.array(c.i16(), 2), 2),
    },
    { align: true }
  ),
};

describe("C struct layout", () => {
  it.each(Object.keys(C_LAYOUTS))("matches clang for %s", (name) => {
    const expected = C_LAYOUTS[name];
    const schema = SCHEMAS[name];
    expect(c.sizeof(schema)).toBe(expected.size);
    expect(schema.getAlign()).toBe(expected.align);
    for (const [field, offset] of Object.entries(expected.offsets)) {
      expect(c.offsetof(schema, field), field).toBe(offset);
    }
  });

  it("round-trips aligned structs with zeroed gaps", () => {
    const value = { a: 1, b: 2, c: 3, d: 4n, e: 5 };
    const bytes = c.write(Mixed, value);
    expect(bytes.length).toBe(32);
    expect([...bytes.subarray(1, 4)]).toEqual([0, 0, 0]);
    expect(c.read(Mixed, bytes)).toEqual(value);
  });

  it("stays packed by default", () => {
    expect(c.sizeof(c.struct(mixedFields))).toBe(16);
    expect(c.struct(mixedFields).getAlign()).toBe(1);
  });

  it("rejects unsupported pack values", () => {
    expect(() => c.struct(mixedFields, { pack: 3 as never })).toThrow(
      "pack must be 1, 2, 4, 8 or 16, got 3"
    );
  });
});

describe("c.bits", () => {
  const Flags32 = c.struct({
    bits: c.bits(
      [
        ["mode", 3],
        ["flags", 5],
        ["rest", 24],
      ],
      c.u32()
    ),
  });
  const Flags64 = c.struct({
    bits: c.bits(
      [
        ["a", 30],
        ["b", 10],
        ["c", 24],
      ],
      c.u64()
    ),
  });

  // Byte images from clang (see the bit-field structs in c-layouts.c).
  it("packs from the least significant bit like C compilers", () => {
    const bytes = c.write(Flags32, { bits: { mode: 5, flags: 17, rest: 3 } });
    expect([...bytes]).toEqual([0x8d, 0x03, 0, 0]);
    expect(c.read(Flags32, bytes).bits).toEqual({
      mode: 5,
      flags: 17,
      rest: 3,
    });
  });

  it("handles fields that cross bit 32 in 64-bit storage", () => {
    const value = { a: 0x3fffffff, b: 0x2ab, c: 0x123456 };
    const bytes = c.write(Flags64, { bits: value });
    expect([...bytes]).toEqual([
      0xff, 0xff, 0xff, 0xff, 0xaa, 0x56, 0x34, 0x12,
    ]);
    expect(c.read(Flags64, bytes).bits).toEqual(value);
    expect(
      c.read(Flags64, c.write(Flags64, { bits: value }, "big"), "big").bits
    ).toEqual(value);
  });

  it("places fields at explicit bits regardless of key order (issue #1)", () => {
    const explicit = c.struct({
      bits: c.bits(
        {
          rest: { bit: 8, width: 24 },
          mode: { bit: 0, width: 3 },
          flags: { bit: 3, width: 5 },
        },
        c.u32()
      ),
    });
    const value = { bits: { flags: 17, rest: 3, mode: 5 } };
    expect([...c.write(explicit, value)]).toEqual([0x8d, 0x03, 0, 0]);
    expect([...c.write(explicit, value)]).toEqual([...c.write(Flags32, value)]);
  });

  it("keeps its layout when the definition goes through JSON", () => {
    // Integer-like keys are always enumerated first, and JSON stores such as
    // Postgres jsonb sort keys, so definitions must not rely on key order.
    const spec = JSON.parse(
      '{"2": {"bit": 0, "width": 4}, "1": {"bit": 4, "width": 4}}'
    ) as Record<string, { bit: number; width: number }>;
    expect(Object.keys(spec)).toEqual(["1", "2"]);
    const Reordered = c.struct({ bits: c.bits(spec, c.u8()) });
    expect([...c.write(Reordered, { bits: { 1: 0xa, 2: 0x5 } })]).toEqual([
      0xa5,
    ]);

    const list = JSON.parse('[["low", 4], ["high", 4]]');
    const FromList = c.struct({ bits: c.bits(list, c.u8()) });
    expect([...c.write(FromList, { bits: { high: 0xa, low: 0x5 } })]).toEqual([
      0xa5,
    ]);
  });

  it("allows gaps between explicit fields", () => {
    const Sparse = c.struct({
      bits: c.bits({ top: { bit: 6, width: 2 } }, c.u8()),
    });
    expect([...c.write(Sparse, { bits: { top: 3 } })]).toEqual([0xc0]);
  });

  it("reads full-width fields as unsigned", () => {
    const Wide = c.struct({ bits: c.bits([["all", 32]], c.u32()) });
    const bytes = c.write(Wide, { bits: { all: 0xffffffff } });
    expect(c.read(Wide, bytes).bits.all).toBe(0xffffffff);
  });

  it("works over signed storage", () => {
    const Signed = c.struct({
      bits: c.bits(
        [
          ["low", 4],
          ["high", 4],
        ],
        c.i8()
      ),
    });
    const bytes = c.write(Signed, { bits: { low: 1, high: 15 } });
    expect(bytes[0]).toBe(0xf1);
    expect(c.read(Signed, bytes).bits).toEqual({ low: 1, high: 15 });
  });

  it("checks values against their width unless unchecked", () => {
    expect(() =>
      c.write(Flags32, { bits: { mode: 8, flags: 0, rest: 0 } })
    ).toThrow("8 does not fit in 3-bit field 'mode'");
    const bytes = c.write(
      Flags32,
      { bits: { mode: 9, flags: 0, rest: 0 } },
      { checked: false }
    );
    expect(c.read(Flags32, bytes).bits.mode).toBe(1);
  });

  it("validates the spec", () => {
    expect(() => c.bits([["a", 0]], c.u8())).toThrow(
      "bit-field 'a' width must be an integer from 1 to 32, got 0"
    );
    expect(() =>
      c.bits(
        [
          ["a", 5],
          ["b", 4],
        ],
        c.u8()
      )
    ).toThrow("bit-field 'b' needs bits 5..8 but u8 storage holds 8");
    expect(() =>
      c.bits({ a: { bit: 0, width: 4 }, b: { bit: 3, width: 2 } }, c.u8())
    ).toThrow("bit-fields 'a' and 'b' overlap");
    expect(() =>
      c.bits(
        [
          ["a", 1],
          ["a", 1],
        ],
        c.u8()
      )
    ).toThrow("bit-field 'a' is declared more than once");
    expect(() => c.bits({ a: 3 } as never, c.u8())).toThrow(
      "bit-field 'a' must be { bit, width }; use a [name, width] list for sequential fields"
    );
  });

  it("infers number fields from either form", () => {
    const value: c.infer<typeof Flags32> = {
      bits: { mode: 1, flags: 2, rest: 3 },
    };
    expect(value.bits.mode).toBe(1);
    const explicit = c.bits({ x: { bit: 1, width: 2 } }, c.u8());
    const decoded: c.infer<typeof explicit> = { x: 1 };
    expect(decoded.x).toBe(1);
  });
});
