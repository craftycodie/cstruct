import { describe, expect, it } from "vitest";
import { c } from "./index";

// --- overlapping union (c.Union) ---

const AsU32 = c.struct({ value: c.u32() });
const AsU16Pair = c.struct({ a: c.u16(), b: c.u16() });

const OverlapUnion = c.Union({
  asU32: AsU32,
  asU16Pair: AsU16Pair,
});

const OverlapHostSchema = c.struct({
  tag: c.u8(),
  payload: OverlapUnion,
});

// --- discriminated union (c.discriminatedUnion) ---

const ArmA = c.struct({
  value: c.u8(),
  _pad: c.pad(3),
});

const ArmB = c.struct({
  flags: c.u16(),
  _pad: c.pad(2),
});

const DiscriminatedHostSchema = c.struct({
  kind: c.u8(),
  data: c.discriminatedUnion(
    { size: 4 },
    c.arm(ArmA, (m) => m.kind === 1),
    c.when(2, ArmB, (m) => m.kind as number)
  ),
});

describe("c.Union (overlapping)", () => {
  it("has size equal to the largest member", () => {
    expect(OverlapUnion.getSize()).toBe(4);
    expect(c.sizeof(OverlapHostSchema)).toBe(5);
  });

  it("reads all members from the same memory offset", () => {
    const buffer = Buffer.alloc(4);
    buffer.writeUInt32LE(0x0001_0002, 0);

    const decoded = OverlapUnion.read(buffer, 0, "little");
    expect(decoded).toEqual({
      asU32: { value: 0x0001_0002 },
      asU16Pair: { a: 2, b: 1 },
    });
  });

  it("writes the first provided member and shares memory", () => {
    const buffer = Buffer.alloc(4);
    OverlapUnion.write(buffer, 0, { asU32: { value: 0xdeadbeef } }, "little");

    expect(buffer.readUInt32LE(0)).toBe(0xdeadbeef);
    expect(OverlapUnion.read(buffer, 0, "little").asU16Pair).toEqual({
      a: 0xbeef,
      b: 0xdead,
    });
  });

  it("throws when write has no member set", () => {
    const buffer = Buffer.alloc(4);
    expect(() => OverlapUnion.write(buffer, 0, {}, "little")).toThrow(
      "No union member provided for write operation"
    );
  });

  it("round-trips when embedded in a struct", () => {
    const data = {
      tag: 7,
      payload: { asU32: { value: 42 } },
    };
    const buffer = c.write(OverlapHostSchema, data);
    expect(c.read(OverlapHostSchema, buffer)).toMatchObject(data);
  });

  it("supports readMember and writeMember", () => {
    const buffer = Buffer.alloc(4);
    OverlapUnion.writeMember(
      buffer,
      0,
      "asU32",
      { value: 0x12345678 },
      "little"
    );
    expect(OverlapUnion.readMember(buffer, 0, "asU32", "little")).toEqual({
      value: 0x12345678,
    });
    expect(OverlapUnion.readMember(buffer, 0, "asU16Pair", "little")).toEqual({
      a: 0x5678,
      b: 0x1234,
    });
  });
});

describe("c.discriminatedUnion", () => {
  it("has a fixed slot size", () => {
    expect(DiscriminatedHostSchema.getSize()).toBe(5);
  });

  it("reads the matching arm", () => {
    const buffer = c.write(DiscriminatedHostSchema, {
      kind: 1,
      data: { value: 42 },
    });
    expect(c.read(DiscriminatedHostSchema, buffer)).toEqual({
      kind: 1,
      data: { value: 42 },
    });
  });

  it("reads null when no arm matches", () => {
    const buffer = c.write(DiscriminatedHostSchema, {
      kind: 99,
      data: null,
    });
    expect(c.read(DiscriminatedHostSchema, buffer)).toEqual({
      kind: 99,
      data: null,
    });
  });

  it("round-trips the second arm via c.when", () => {
    const data = {
      kind: 2,
      data: { flags: 0xbeef },
    };
    const buffer = c.write(DiscriminatedHostSchema, data);
    expect(c.read(DiscriminatedHostSchema, buffer)).toEqual(data);
  });

  it("zero-fills inactive union slots on write", () => {
    const buffer = c.write(DiscriminatedHostSchema, { kind: 0, data: null });
    expect(buffer.subarray(1, 5).equals(Buffer.alloc(4))).toBe(true);
  });

  it("throws when writing non-null data with no matching arm", () => {
    expect(() =>
      c.write(DiscriminatedHostSchema, {
        kind: 99,
        data: { value: 1 },
      })
    ).toThrow("no arm matches parent discriminant");
  });

  it("only serializes the active arm, not all arms", () => {
    const buffer = c.write(DiscriminatedHostSchema, {
      kind: 1,
      data: { value: 0xff },
    });
    const armBView = c.read(DiscriminatedHostSchema, buffer);
    expect(armBView.data).toEqual({ value: 0xff });
    expect(armBView.data).not.toEqual({ flags: expect.anything() });
  });
});
