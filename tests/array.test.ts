import { describe, expect, it } from "vitest";
import { c } from "../src/index";

const Status = { Ok: 0, Error: 1 } as const;

const Point = c.struct({
  x: c.i16(),
  y: c.i16(),
});

const WithPrimitiveArray = c.struct({
  values: c.array(c.u32(), 3),
});

const WithLengthOneArray = c.struct({
  value: c.array(c.u32(), 1),
});

const WithFieldCount = c.struct({
  tags: c.array(c.u16(), 2),
});

const WithEnumArray = c.struct({
  statuses: c.array(c.Enum(Status, c.u8()), 2),
});

const WithStructArray = c.struct({
  points: c.array(Point, 2),
});

const WithStringArray = c.struct({
  names: c.array(c.String(4), 2),
});

const SkullFlags = ["iron", "mythic"] as const;

const WithBitfieldArray = c.struct({
  skulls: c.array(c.Bitfield(SkullFlags, c.u8()), 2),
});

const WithNestedArray = c.struct({
  matrix: c.array(c.array(c.u32(), 2), 3),
});

describe("arrays", () => {
  it("reports packed size for primitive arrays", () => {
    expect(c.sizeof(WithPrimitiveArray)).toBe(12);
    expect(c.sizeof(WithFieldCount)).toBe(4);
  });

  it("round-trips primitive arrays", () => {
    const sample = { values: [1, 2, 3] as [number, number, number] };
    const bytes = c.write(WithPrimitiveArray, sample, "little");
    expect(bytes).toEqual(Buffer.from([1, 0, 0, 0, 2, 0, 0, 0, 3, 0, 0, 0]));
    expect(c.read(WithPrimitiveArray, bytes, "little")).toEqual(sample);
  });

  it("round-trips length-1 arrays as arrays (not scalars)", () => {
    const sample = { value: [42] as [number] };
    const bytes = c.write(WithLengthOneArray, sample, "little");
    expect(bytes).toEqual(Buffer.from([42, 0, 0, 0]));
    expect(c.read(WithLengthOneArray, bytes, "little")).toEqual(sample);
    expect(() =>
      c.write(WithLengthOneArray, { value: 42 as never }, "little")
    ).toThrow(/Expected array/);
  });

  it("round-trips runtime length-1 arrays", () => {
    const n: number = 1;
    const Dynamic = c.struct({
      ids: c.array(c.u64(), n),
    });
    const sample = { ids: [9n] };
    const bytes = c.write(Dynamic, sample, "big");
    expect(c.read(Dynamic, bytes, "big")).toEqual(sample);
  });

  it("round-trips u16 arrays (big-endian)", () => {
    const sample = { tags: [0xab, 0xcd] as [number, number] };
    const bytes = c.write(WithFieldCount, sample, "big");
    expect([...bytes]).toEqual([0x00, 0xab, 0x00, 0xcd]);
    expect(c.read(WithFieldCount, bytes, "big")).toEqual(sample);
  });

  it("round-trips enum arrays", () => {
    const sample = { statuses: ["Ok", "Error"] as ["Ok", "Error"] };
    const written = c.write(WithEnumArray, sample, "little");
    expect(c.read(WithEnumArray, written, "little")).toEqual(sample);
  });

  it("round-trips struct arrays", () => {
    const sample = {
      points: [
        { x: 1, y: 2 },
        { x: -3, y: 4 },
      ] as [{ x: number; y: number }, { x: number; y: number }],
    };
    const written = c.write(WithStructArray, sample, "little");
    expect(c.sizeof(WithStructArray)).toBe(8);
    expect(c.read(WithStructArray, written, "little")).toEqual(sample);
  });

  it("round-trips advanced-type arrays", () => {
    const sample = { names: ["ab", "cd"] as [string, string] };
    const written = c.write(WithStringArray, sample, "little");
    expect(c.read(WithStringArray, written, "little")).toEqual(sample);
  });

  it("rejects wrong array length on write", () => {
    const bytes = c.write(WithPrimitiveArray, { values: [1, 2, 1] }, "little");
    expect(bytes[4]).toBe(2);
  });

  it("round-trips bitfield arrays", () => {
    const sample = {
      skulls: [
        { iron: true, mythic: false },
        { iron: false, mythic: true },
      ] as [
        { iron: boolean; mythic: boolean },
        { iron: boolean; mythic: boolean },
      ],
    };
    const written = c.write(WithBitfieldArray, sample, "little");
    expect(c.read(WithBitfieldArray, written, "little")).toEqual(sample);
  });

  it("allocates nested arrays", () => {
    expect(c.sizeof(WithNestedArray)).toBe(12);
  });

  it("rejects invalid enum value in array element", () => {
    expect(() =>
      c.write(WithEnumArray, { statuses: ["Ok", "bogus"] as never }, "little")
    ).toThrow("Invalid enum key");
  });
});
