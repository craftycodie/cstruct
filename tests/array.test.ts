import { describe, expect, it } from "vitest";
import { CStructError, c } from "../src/index";

const Status = { Ok: 0, Error: 1 } as const;

@c.struct()
class Point {
  @c.field("i16")
  x!: number;
  @c.field("i16")
  y!: number;
}

@c.struct()
class WithPrimitiveArray {
  @c.field("u32", { count: 3 })
  values!: number[];
}

@c.struct()
class WithFieldCount {
  @c.field("u16", { count: 2 })
  tags!: number[];
}

@c.struct()
class WithEnumArray {
  @c.field(c.enum("u8", Status), { count: 2 })
  statuses!: number[];
}

@c.struct()
class WithStructArray {
  @c.field(Point, { count: 2 })
  points!: Point[];
}

@c.struct()
class WithStringArray {
  @c.field(c.String(4), { count: 2 })
  names!: string[];
}

const SkullFlags = ["iron", "mythic"] as const;

@c.struct()
class WithBitfieldArray {
  @c.field(c.array(c.bitfield("u8", SkullFlags), 2))
  skulls!: c.Bitfield<typeof SkullFlags>[];
}

@c.struct()
class WithNestedArray {
  @c.field(c.array(c.array("u32", 2), 3))
  matrix!: number[][];
}

@c.struct()
class UnionArm {
  @c.field("u8")
  value!: number;
  @c.field(c.pad(3))
  private _pad!: never;
}

@c.struct()
class WithUnionArray {
  @c.field("u8")
  kind!: number;

  @c.field(
    c.array(
      c.unionField(
        { size: 4 },
        c.arm(UnionArm, (m: WithUnionArray) => m.kind === 1)
      ) as c.FieldType,
      2
    )
  )
  slots!: (UnionArm | null)[];
}

describe("arrays", () => {
  it("reports packed size for primitive arrays", () => {
    expect(c.size(WithPrimitiveArray)).toBe(12);
    expect(c.size(WithFieldCount)).toBe(4);
  });

  it("round-trips primitive arrays", () => {
    const sample = { values: [1, 2, 3] } satisfies WithPrimitiveArray;
    const bytes = c.write(WithPrimitiveArray, sample, "little");
    expect(bytes).toEqual(new Uint8Array([1, 0, 0, 0, 2, 0, 0, 0, 3, 0, 0, 0]));
    expect(c.read(WithPrimitiveArray, bytes, "little")).toEqual(sample);
  });

  it("round-trips u16 arrays (big-endian)", () => {
    const sample = { tags: [0xab, 0xcd] } satisfies WithFieldCount;
    const bytes = c.write(WithFieldCount, sample, "big");
    expect([...bytes]).toEqual([0x00, 0xab, 0x00, 0xcd]);
    expect(c.read(WithFieldCount, bytes, "big")).toEqual(sample);
  });

  it("round-trips enum arrays", () => {
    const sample = { statuses: [0, 1] } satisfies WithEnumArray;
    const written = c.write(WithEnumArray, sample, "little");
    expect(c.read(WithEnumArray, written, "little")).toEqual(sample);
  });

  it("round-trips struct arrays", () => {
    const sample = {
      points: [
        { x: 1, y: 2 },
        { x: -3, y: 4 },
      ],
    } satisfies WithStructArray;
    const written = c.write(WithStructArray, sample, "little");
    expect(c.size(WithStructArray)).toBe(8);
    expect(c.read(WithStructArray, written, "little")).toEqual(sample);
  });

  it("round-trips advanced-type arrays", () => {
    const sample = { names: ["ab", "cd"] } satisfies WithStringArray;
    const written = c.write(WithStringArray, sample, "little");
    expect(c.read(WithStringArray, written, "little")).toEqual(sample);
  });

  it("rejects wrong array length on write", () => {
    expect(() =>
      c.write(
        WithPrimitiveArray,
        { values: [1, 2] } as WithPrimitiveArray,
        "little"
      )
    ).toThrow(CStructError);
  });

  it("round-trips bitfield arrays", () => {
    const sample = {
      skulls: [
        { iron: true, mythic: false },
        { iron: false, mythic: true },
      ],
    } satisfies WithBitfieldArray;
    const written = c.write(WithBitfieldArray, sample, "little");
    expect(c.read(WithBitfieldArray, written, "little")).toEqual(sample);
  });

  it("round-trips nested arrays via c.array", () => {
    const sample = {
      matrix: [
        [1, 2],
        [3, 4],
        [5, 6],
      ],
    } satisfies WithNestedArray;
    expect(c.size(WithNestedArray)).toBe(24);
    const written = c.write(WithNestedArray, sample, "little");
    expect(c.read(WithNestedArray, written, "little")).toEqual(sample);
  });

  it("rejects pad as an array element", () => {
    expect(() => c.array(c.pad(4), 3)).toThrow(CStructError);
    expect(() => {
      @c.struct()
      class Bad {
        @c.field(c.pad(2), { count: 3 })
        private _reserved!: never;
      }
      return Bad;
    }).toThrow(CStructError);
  });

  it("round-trips union arrays (read uses parent select)", () => {
    const bytes = new Uint8Array(9);
    bytes[0] = 1;
    bytes[1] = 10;
    bytes[5] = 20;

    const read = c.read(WithUnionArray, bytes, "little");
    expect(read.slots).toEqual([{ value: 10 }, { value: 20 }]);
  });

  it("writes union arrays from each element type", () => {
    const host = {
      kind: 1,
      slots: [{ value: 7 }, { value: 8 }],
    } as WithUnionArray;
    const bytes = c.write(WithUnionArray, host, "little");
    expect(bytes[1]).toBe(7);
    expect(bytes[5]).toBe(8);
  });

  it("rejects invalid enum value in array element", () => {
    expect(() =>
      c.write(
        WithEnumArray,
        { statuses: [0, 9] } as WithEnumArray,
        "little"
      )
    ).toThrow(CStructError);
  });
});
