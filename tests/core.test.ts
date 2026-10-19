import { describe, expect, it } from "vitest";
import { c } from "../src/index";

describe("endianness", () => {
  const Inner = c.struct({ value: c.u16() }, { endian: "big" });
  const Mixed = c.struct({
    defaulted: c.u16(),
    pinned: c.u16({ endian: "little" }),
    pinnedArray: c.array(c.u16(), 2, { endian: "big" }),
    elementPinned: c.array(c.u16({ endian: "big" }), 1),
    inner: Inner,
  });
  const sample = {
    defaulted: 0x0102,
    pinned: 0x0304,
    pinnedArray: [0x0506, 0x0708] as [number, number],
    elementPinned: [0x090a] as [number],
    inner: { value: 0x0b0c },
  };

  it("applies field over struct over call site over little-endian", () => {
    const big = c.write(Mixed, sample, "big");
    expect([...big]).toEqual([
      0x01, 0x02, 0x04, 0x03, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c,
    ]);
    const little = c.write(Mixed, sample);
    expect([...little.subarray(0, 2)]).toEqual([0x02, 0x01]);
    expect([...little.subarray(10)]).toEqual([0x0b, 0x0c]);
    expect(c.read(Mixed, big, "big")).toEqual(sample);
    expect(c.read(Mixed, little)).toEqual(sample);
  });

  it("keeps a struct's own endianness when nested or read directly", () => {
    expect([...c.write(Inner, { value: 1 }, "little")]).toEqual([0, 1]);
    expect(c.read(Inner, Buffer.from([0, 1]), "little").value).toBe(1);
  });
});

describe("write options", () => {
  const Pair = c.struct({ a: c.u8(), _gap: c.pad(1), b: c.u16() });

  it("writes into an existing buffer at an offset, zeroing padding", () => {
    const target = Buffer.alloc(8, 0xee);
    const returned = c.write(
      Pair,
      { a: 1, b: 0x0302 },
      { into: target, offset: 2 }
    );
    expect(returned).toBe(target);
    expect([...target]).toEqual([0xee, 0xee, 1, 0, 2, 3, 0xee, 0xee]);

    Pair.writeInto(target, { a: 9, b: 0 }, 4, "big");
    expect([...target.subarray(4)]).toEqual([9, 0, 0, 0]);
  });

  it("checks the target has room", () => {
    expect(() =>
      c.write(Pair, { a: 1, b: 2 }, { into: Buffer.alloc(4), offset: 1 })
    ).toThrow("need 4 bytes at offset 1, but the buffer has 4");
  });

  it("rejects an offset without a target", () => {
    expect(() => c.write(Pair, { a: 1, b: 2 }, { offset: 1 })).toThrow(
      "write option 'offset' requires 'into'"
    );
  });

  it("accepts read options objects", () => {
    const bytes = Buffer.from([0xff, 1, 0, 0, 2]);
    expect(c.read(Pair, bytes, { offset: 1, endian: "big" })).toEqual({
      a: 1,
      b: 2,
    });
    expect(Pair.read(bytes, { offset: 1, endian: "big" })).toEqual({
      a: 1,
      b: 2,
    });
  });
});

describe("checked integer writes", () => {
  const Ints = c.struct({ byte: c.u8(), word: c.u32(), small: c.i16() });

  it("rejects values that do not fit the field", () => {
    expect(() => c.write(Ints, { byte: 300, word: 0, small: 0 })).toThrow(
      "write failed at byte: 300 is out of range for u8"
    );
    expect(() => c.write(Ints, { byte: 0, word: 1.5, small: 0 })).toThrow(
      "1.5 is not an integer (u32)"
    );
    expect(() =>
      c.write(Ints, { byte: 0, word: 0, small: Number.NaN })
    ).toThrow("NaN is not an integer (i16)");
  });

  it("accepts values that fit the bit width as signed or unsigned", () => {
    const bytes = c.write(Ints, { byte: -1, word: -1, small: 0xffff });
    expect(bytes.readUInt8(0)).toBe(0xff);
    expect(bytes.readUInt32LE(1)).toBe(0xffffffff);
    expect(bytes.readInt16LE(5)).toBe(-1);
  });

  it("wraps instead with checked: false", () => {
    const bytes = c.write(
      Ints,
      { byte: 300, word: 2 ** 32 + 5, small: 0 },
      { checked: false }
    );
    expect(bytes.readUInt8(0)).toBe(44);
    expect(bytes.readUInt32LE(1)).toBe(5);
  });

  it("checks 64-bit ranges", () => {
    const Wide = c.struct({ value: c.u64() });
    expect(() => c.write(Wide, { value: 2n ** 64n })).toThrow(
      "18446744073709551616 is out of range for u64"
    );
    expect(c.write(Wide, { value: -1n }).readBigUInt64LE(0)).toBe(
      2n ** 64n - 1n
    );
  });

  it("rejects enum values that do not fit their storage", () => {
    const Kind = c.struct({ kind: c.Enum({ Big: 300 }, c.u8()) });
    expect(() => c.write(Kind, { kind: "Big" })).toThrow(
      "300 is out of range for u8"
    );
  });
});

describe("c.offsetof", () => {
  const Point = c.struct({ x: c.i16(), y: c.i16() });
  const Shape = c.struct({
    id: c.u8({ padAfter: 1 }),
    origin: Point,
    points: c.array(Point, 3),
    grid: c.array(c.array(c.u8(), 4), 2),
    tail: c.u32(),
  });

  it("returns byte offsets for nested paths and indexes", () => {
    expect(c.offsetof(Shape, "id")).toBe(0);
    expect(c.offsetof(Shape, "origin")).toBe(2);
    expect(c.offsetof(Shape, "origin.y")).toBe(4);
    expect(c.offsetof(Shape, "points")).toBe(6);
    expect(c.offsetof(Shape, "points[2].y")).toBe(6 + 8 + 2);
    expect(c.offsetof(Shape, "points.1.x")).toBe(10);
    expect(c.offsetof(Shape, "grid[1][3]")).toBe(18 + 4 + 3);
    expect(c.offsetof(Shape, "tail")).toBe(26);
    expect(Shape.offsetOf("tail")).toBe(26);
  });

  it("explains bad paths", () => {
    expect(() => c.offsetof(Shape, "nope")).toThrow(
      "no field 'nope' in 'nope'"
    );
    expect(() => c.offsetof(Shape, "points[3]")).toThrow(
      "'3' is not an index into an array of 3"
    );
    expect(() => c.offsetof(Shape, "tail.x")).toThrow(
      "'x' does not name a struct field or array element"
    );
    expect(() => c.offsetof(Shape, "__pad_after_id")).toThrow("no field");
  });

  it("works on decorated classes", () => {
    @c.class()
    class Header {
      @c.field(c.u16())
      magic!: number;

      @c.field(c.u32(), { padBefore: 2 })
      length!: number;
    }
    expect(c.offsetof(Header, "length")).toBe(4);
    expect(c.offsetof(new Header(), "magic")).toBe(0);
  });
});

describe("top-level arrays and sizeof", () => {
  const Point = c.struct({ x: c.i16(), y: c.i16() });
  const Points = c.array(Point, 2);

  it("reads and writes arrays without a wrapping struct", () => {
    const data: c.infer<typeof Points> = [
      { x: 1, y: 2 },
      { x: -3, y: 4 },
    ];
    const bytes = c.write(Points, data, "big");
    expect(bytes.length).toBe(8);
    expect(c.read(Points, bytes, "big")).toEqual(data);
    expect(c.read(c.array(c.u16(), 4), bytes, { endian: "big" })).toEqual([
      1, 2, 0xfffd, 4,
    ]);
  });

  it("reports sizes of field types", () => {
    expect(c.sizeof(c.u32())).toBe(4);
    expect(c.sizeof(Points)).toBe(8);
    expect(c.sizeof(c.array(c.array(c.u16(), 3), 2))).toBe(12);
    expect(Point.size).toBe(4);
  });
});

describe("c.bytes", () => {
  const Blob = c.struct({ hash: c.bytes(4), tail: c.u8() });

  it("round-trips raw bytes as a copy", () => {
    const source = Buffer.from([1, 2, 3, 4, 5]);
    const read = c.read(Blob, source);
    expect([...read.hash]).toEqual([1, 2, 3, 4]);
    read.hash[0] = 99;
    expect(source[0]).toBe(1);
    expect([...c.write(Blob, read)]).toEqual([99, 2, 3, 4, 5]);
  });

  it("zero-pads short input and accepts any byte source", () => {
    expect([...c.write(Blob, { hash: Buffer.from([7]), tail: 1 })]).toEqual([
      7, 0, 0, 0, 1,
    ]);
    const view = new DataView(new Uint8Array([1, 2]).buffer);
    expect([...c.write(Blob, { hash: view as never, tail: 0 })]).toEqual([
      1, 2, 0, 0, 0,
    ]);
  });

  it("rejects long input unless unchecked, and non-bytes always", () => {
    const long = Buffer.from([1, 2, 3, 4, 5, 6]);
    expect(() => c.write(Blob, { hash: long, tail: 0 })).toThrow(
      "6 bytes do not fit in bytes(4)"
    );
    expect([
      ...c.write(Blob, { hash: long, tail: 0 }, { checked: false }),
    ]).toEqual([1, 2, 3, 4, 0]);
    expect(() => c.write(Blob, { hash: [1, 2] as never, tail: 0 })).toThrow(
      "expected bytes (Uint8Array, ArrayBuffer or DataView), got array of 2"
    );
  });
});
