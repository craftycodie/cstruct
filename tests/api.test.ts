import { describe, expect, expectTypeOf, it } from "vitest";
import { c } from "../src/index";

describe("naming", () => {
  it("offers lowercase C-native factories", () => {
    const Schema = c.struct({
      name: c.string(4),
      wide: c.wstring(2),
      kind: c.enum({ A: 1, B: 2 }, c.u8()),
      flags: c.bitfield(["x", "y"], c.u8()),
      either: c.union({ word: c.struct({ v: c.u16() }) }),
    });
    const bytes = c.write(Schema, {
      name: "ab",
      wide: "z",
      kind: "B",
      flags: { x: true, y: false },
      either: { word: { v: 7 } },
    });
    expect(c.read(Schema, bytes)).toMatchObject({
      name: "ab",
      wide: "z",
      kind: "B",
      flags: { x: true, y: false },
      either: { word: { v: 7 } },
    });
  });

  it("keeps the capitalized names working", () => {
    expect(c.String(4)).toBeInstanceOf(c.string(4).constructor);
    expect(c.sizeof(c.WString(3))).toBe(6);
    expect(c.sizeof(c.Enum(["a"], c.u16()))).toBe(2);
  });
});

describe("schema methods", () => {
  const Base = c.struct({ magic: c.u16(), length: c.u32() });

  it("reads, writes and sizes from the schema", () => {
    const bytes = Base.write({ magic: 1, length: 2 });
    expect(Base.size).toBe(6);
    expect(Base.read(bytes)).toEqual({ magic: 1, length: 2 });
    expect(Base.shape.magic).toBeDefined();
  });

  it("extends, picks and omits", () => {
    const Derived = Base.extend({ flags: c.u8() });
    expect(Derived.size).toBe(7);
    expect(Derived.offsetOf("flags")).toBe(6);
    expectTypeOf<c.infer<typeof Derived>>().toEqualTypeOf<{
      magic: number;
      length: number;
      flags: number;
    }>();

    const Replaced = Base.extend({ length: c.u8() });
    expect(Replaced.size).toBe(3);

    const OnlyLength = Base.pick("length");
    expect(OnlyLength.size).toBe(4);
    expectTypeOf<c.infer<typeof OnlyLength>>().toEqualTypeOf<{
      length: number;
    }>();

    const NoLength = Base.omit("length");
    expect(NoLength.read(Buffer.from([1, 0]))).toEqual({ magic: 1 });

    const BigBase = Base.extend({}, { endian: "big" });
    expect([...BigBase.write({ magic: 1, length: 0 })]).toEqual([
      0, 1, 0, 0, 0, 0,
    ]);
  });
});

describe("c.match", () => {
  const Film = c.struct({ seconds: c.i32() });
  const Variant = c.struct({ icon: c.u8() });
  const Other = c.struct({ raw: c.u16() });

  const Host = c.struct({
    header: c.struct({ kind: c.u8() }),
    data: c.match("header.kind", { 3: Film, 6: Variant }),
  });

  it("selects the arm from a nested discriminant", () => {
    const film = c.write(Host, { header: { kind: 3 }, data: { seconds: 9 } });
    expect(film.length).toBe(5);
    expect(c.read(Host, film).data).toEqual({ seconds: 9 });

    const variant = c.write(Host, { header: { kind: 6 }, data: { icon: 2 } });
    expect([...variant]).toEqual([6, 2, 0, 0, 0]);
    expect(c.read(Host, variant).data).toEqual({ icon: 2 });
  });

  it("decodes unknown discriminants as null and writes null as zeros", () => {
    const bytes = Buffer.from([1, 0xff, 0xff, 0xff, 0xff]);
    expect(c.read(Host, bytes).data).toBeNull();
    expect([...c.write(Host, { header: { kind: 1 }, data: null })]).toEqual([
      1, 0, 0, 0, 0,
    ]);
    expect([...c.write(Host, { header: { kind: 1 } })]).toEqual([
      1, 0, 0, 0, 0,
    ]);
  });

  it("explains a write with no matching arm", () => {
    expect(() =>
      c.write(Host, { header: { kind: 1 }, data: { seconds: 1 } })
    ).toThrow("write failed at data: c.match: no arm for header.kind = 1");
  });

  it("supports a fallback arm, an explicit size and enum keys", () => {
    const Kind = c.enum({ Film: 3, Variant: 6, Junk: 9 }, c.u8());
    const WithFallback = c.struct({
      kind: Kind,
      data: c.match("kind", { Film, Variant }, { fallback: Other, size: 8 }),
    });
    expect(WithFallback.size).toBe(9);
    const bytes = c.write(WithFallback, { kind: "Junk", data: { raw: 5 } });
    expect(c.read(WithFallback, bytes).data).toEqual({ raw: 5 });
    expect(
      c.read(
        WithFallback,
        c.write(WithFallback, { kind: "Film", data: { seconds: 1 } })
      ).data
    ).toEqual({ seconds: 1 });
    expectTypeOf<c.infer<typeof WithFallback>["data"]>().toEqualTypeOf<
      { seconds: number } | { icon: number } | { raw: number }
    >();
  });

  it("sees defaulted and magic discriminants that were omitted", () => {
    const Arm = c.struct({ x: c.u8() });
    const Defaulted = c.struct({
      kind: c.u8().default(7),
      data: c.match("kind", { 7: Arm }),
    });
    expect([...c.write(Defaulted, { data: { x: 5 } })]).toEqual([7, 5]);

    const Magic = c.struct({
      tag: c.MagicNumber(2, c.u8()),
      data: c.match("tag", { 2: Arm }),
    });
    const input = { data: { x: 9 } };
    expect([...c.write(Magic, input)]).toEqual([2, 9]);
    expect(input).toEqual({ data: { x: 9 } });
  });

  it("rejects a size smaller than the largest arm", () => {
    expect(() => c.match("k", { 1: Film }, { size: 2 })).toThrow(
      "c.match size 2 is smaller than its largest arm (4 bytes)"
    );
  });

  it("infers the arm union or null", () => {
    expectTypeOf<c.infer<typeof Host>["data"]>().toEqualTypeOf<
      { seconds: number } | { icon: number } | null
    >();
  });
});

describe("chain modifiers", () => {
  it("builds arrays and padding", () => {
    const Schema = c.struct({
      rgba: c.u8().array(4),
      word: c.u16().padBefore(2).padAfter(1),
    });
    expect(Schema.size).toBe(9);
    expect(Schema.offsetOf("word")).toBe(6);
    expectTypeOf<c.infer<typeof Schema>["rgba"]>().toEqualTypeOf<
      [number, number, number, number]
    >();
  });

  it("pins endianness per field", () => {
    const Schema = c.struct({ a: c.u16().be(), b: c.u16().le() });
    expect([...c.write(Schema, { a: 1, b: 1 }, "big")]).toEqual([0, 1, 1, 0]);
  });

  it("fills defaults and makes them optional to write", () => {
    let calls = 0;
    const Schema = c.struct({
      version: c.u8().default(2),
      stamp: c.u32().default(() => ++calls),
      id: c.u16(),
    });
    const bytes = c.write(Schema, { id: 5 });
    expect([...bytes]).toEqual([2, 1, 0, 0, 0, 5, 0]);
    expect(c.read(Schema, c.write(Schema, { id: 1, version: 9 })).version).toBe(
      9
    );
    expectTypeOf<c.input<typeof Schema>>().toEqualTypeOf<{
      id: number;
      version?: number;
      stamp?: number;
    }>();
  });

  it("transforms stored values", () => {
    const Fixed16 = c.i32().transform(
      (raw) => raw / 65536,
      (value: number) => Math.round(value * 65536)
    );
    const Schema = c.struct({ scale: Fixed16, flag: c.u8().padBefore(1) });
    const bytes = c.write(Schema, { scale: 1.5, flag: 1 });
    expect(bytes.readInt32LE(0)).toBe(98304);
    expect(Schema.size).toBe(6);
    expect(c.read(Schema, bytes)).toEqual({ scale: 1.5, flag: 1 });

    const Flag = c.struct({
      on: c.u8().transform(
        (raw) => raw !== 0,
        (value: boolean) => (value ? 1 : 0)
      ),
    });
    expectTypeOf<c.infer<typeof Flag>>().toEqualTypeOf<{ on: boolean }>();
    expect(c.read(Flag, c.write(Flag, { on: true })).on).toBe(true);
  });

  it("asserts on read and write with the field path", () => {
    const Header = c.struct({
      version: c.u8().assert((v) => v === 2, "version must be 2"),
    });
    const Outer = c.struct({ header: Header });
    expect(() => c.read(Outer, Buffer.from([3]))).toThrow(
      "read failed at header.version: version must be 2"
    );
    expect(() => c.write(Outer, { header: { version: 1 } })).toThrow(
      "write failed at header.version: version must be 2"
    );
    expect(c.read(Outer, Buffer.from([2]))).toEqual({ header: { version: 2 } });
  });

  it("applies struct-level assertions when nested", () => {
    const Range = c
      .struct({ lo: c.u8(), hi: c.u8() })
      .assert((r) => r.lo <= r.hi, "lo must not exceed hi");
    const Outer = c.struct({ range: Range });
    expect(() => c.read(Outer, Buffer.from([5, 1]))).toThrow(
      "read failed at range: lo must not exceed hi"
    );
  });

  it("applies struct and array assertions at the top level", () => {
    const Range = c
      .struct({ lo: c.u8(), hi: c.u8() })
      .assert((r) => r.lo <= r.hi, "lo must not exceed hi");
    expect(() => c.read(Range, Buffer.from([5, 1]))).toThrow(
      "read failed: lo must not exceed hi"
    );
    expect(() => c.write(Range, { lo: 5, hi: 1 })).toThrow(
      "write failed: lo must not exceed hi"
    );
    const Sorted = c
      .u8()
      .array(3)
      .assert((v) => v[0] <= v[1] && v[1] <= v[2], "must be sorted");
    expect(() => c.read(Sorted, Buffer.from([3, 2, 1]))).toThrow(
      "must be sorted"
    );
    expect(c.read(Sorted, Buffer.from([1, 2, 3]))).toEqual([1, 2, 3]);
  });

  it("leaves the original field untouched", () => {
    const base = c.u16();
    const padded = base.padBefore(2);
    expect(base.options).toEqual({});
    expect(padded.options).toEqual({ padBefore: 2 });
  });
});

describe("input and output types", () => {
  const Header = c.struct({
    magic: c.MagicNumber(0xbeef, c.u16()),
    tag: c.MagicString("HDR"),
    _pad: c.pad(2),
    hash: c.bytes(4),
    body: c.match("magic", { 48879: c.struct({ v: c.u8() }) }),
  });

  it("omits padding and makes magic values and unions optional", () => {
    type HeaderInput = c.input<typeof Header>;
    expectTypeOf<HeaderInput["magic"]>().toEqualTypeOf<0xbeef | undefined>();
    expectTypeOf<HeaderInput["tag"]>().toEqualTypeOf<"HDR" | undefined>();
    expectTypeOf<HeaderInput["body"]>().toEqualTypeOf<
      { v: number } | null | undefined
    >();
    expectTypeOf<keyof HeaderInput>().toEqualTypeOf<
      "hash" | "magic" | "tag" | "body"
    >();
    const fromArrayBuffer: HeaderInput = { hash: new ArrayBuffer(4) };
    // @ts-expect-error hash is required
    const missingHash: HeaderInput = {};
    expect([fromArrayBuffer, missingHash]).toHaveLength(2);
    const bytes = c.write(Header, { hash: new Uint8Array([1, 2, 3, 4]) });
    expect(c.read(Header, bytes)).toMatchObject({
      magic: 0xbeef,
      tag: "HDR",
    });
  });

  it("types c.class fields with the class's instance type", () => {
    @c.class()
    class Point {
      @c.field(c.i16())
      x!: number;

      @c.field(c.i16())
      y!: number;

      length(): number {
        return Math.hypot(this.x, this.y);
      }
    }
    const Shape = c.struct({ origin: c.class(Point) });
    expectTypeOf<c.output<typeof Shape>["origin"]>().toEqualTypeOf<Point>();
    expectTypeOf<c.input<typeof Shape>["origin"]>().toEqualTypeOf<{
      x: number;
      y: number;
    }>();
  });
});
