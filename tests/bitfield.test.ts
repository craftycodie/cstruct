import { describe, expect, expectTypeOf, it } from "vitest";
import { c } from "../src/index";

const DifficultyFlags = ["easy", "normal", "heroic", "legendary"] as const;
const SkullFlags = ["iron", "black_eye", "tough_luck", "catch"] as const;

const ChallengeFlags = c.struct({
  difficulty: c.Bitfield(DifficultyFlags, c.u8()),
  skulls: c.Bitfield(SkullFlags, c.u32()),
});

const DifficultyOnly = c.struct({
  difficulty: c.Bitfield(DifficultyFlags, c.u8()),
});

describe("bitfield", () => {
  it("round-trips sequential bit layouts", () => {
    const value = {
      difficulty: {
        easy: false,
        normal: true,
        heroic: true,
        legendary: false,
      },
      skulls: {
        iron: true,
        black_eye: false,
        tough_luck: true,
        catch: false,
      },
    };

    const written = c.write(ChallengeFlags, value, "big");
    expect(written).toEqual(Buffer.from([0b0000_0110, 0x00, 0x00, 0x00, 0x05]));

    const read = c.read(ChallengeFlags, written, "big");
    expect(read).toEqual(value);
  });

  it("reads reserved bits as false when keys do not cover them", () => {
    const read = c.read(DifficultyOnly, Buffer.from([0xf0]), "little");
    expect(read.difficulty).toEqual({
      easy: false,
      normal: false,
      heroic: false,
      legendary: false,
    });
  });

  it("rejects unknown flag keys on write", () => {
    const written = c.write(DifficultyOnly, {
      difficulty: { easy: true, unknown: true },
    } as never);
    expect(written[0] & 0b0000_0001).toBe(1);
  });
});

describe("bitfield with explicit bits", () => {
  const Difficulty = c.Bitfield(
    { legendary: 3, easy: 0, heroic: 2, normal: 1 },
    c.u8()
  );
  const Sparse = c.Bitfield({ iron: 0, mythic: 9 }, c.u16());

  it("uses each flag's bit regardless of key order (issue #1)", () => {
    const Schema = c.struct({ difficulty: Difficulty, skulls: Sparse });
    const bytes = c.write(Schema, {
      difficulty: { easy: true, normal: false, heroic: true, legendary: false },
      skulls: { iron: false, mythic: true },
    });
    expect([...bytes]).toEqual([0b0101, 0x00, 0x02]);
    expect(c.read(Schema, bytes)).toEqual({
      difficulty: { easy: true, normal: false, heroic: true, legendary: false },
      skulls: { iron: false, mythic: true },
    });
  });

  it("keeps its layout when the definition goes through JSON", () => {
    const flags = JSON.parse('{"b": 1, "a": 0}') as Record<string, number>;
    const Schema = c.struct({ flags: c.Bitfield(flags, c.u8()) });
    expect([...c.write(Schema, { flags: { a: true, b: false } })]).toEqual([1]);
  });

  it("validates bits", () => {
    expect(() => c.Bitfield({ a: 8 }, c.u8())).toThrow(
      "Bitfield flag 'a' uses bit 8 but u8 storage holds 8 bits"
    );
    expect(() => c.Bitfield({ a: 1, b: 1 }, c.u8())).toThrow(
      "Bitfield flags 'a' and 'b' share bit 1"
    );
    expect(() => c.Bitfield({ a: -1 }, c.u8())).toThrow(
      "must use a non-negative integer bit"
    );
  });

  it("infers boolean flags", () => {
    const value: c.infer<typeof Sparse> = { iron: true, mythic: false };
    expect(value.iron).toBe(true);
  });
});

describe("c.Bitfield raw conversions", () => {
  const Flags = c.Bitfield(["a", "b", "c"], c.u8());
  const Signed = c.Bitfield({ top: 7, low: 0 }, c.i8());
  const Wide = c.Bitfield({ low: 0, high: 63 }, c.u64());

  it("maps flag objects to and from the storage integer", () => {
    expect(Flags.toRaw({ a: true, b: false, c: true })).toBe(5);
    expect(Flags.fromRaw(6)).toEqual({ a: false, b: true, c: true });
    expect(Signed.toRaw({ top: true, low: true })).toBe(-127);
    expect(Signed.fromRaw(-127)).toEqual({ top: true, low: true });
    expect(Wide.toRaw({ low: true, high: true })).toBe((1n << 63n) | 1n);
    expect(Wide.fromRaw((1n << 63n) | 1n)).toEqual({ low: true, high: true });
    expectTypeOf(
      Wide.toRaw({ low: true, high: false })
    ).toEqualTypeOf<bigint>();
    expectTypeOf(
      Flags.toRaw({ a: true, b: true, c: true })
    ).toEqualTypeOf<number>();
  });

  it("accepts a raw integer on write, keeping unnamed bits", () => {
    const Schema = c.struct({ flags: Flags, wide: Wide });
    const bytes = c.write(Schema, { flags: 0xf5, wide: 1n });
    expect(bytes[0]).toBe(0xf5);
    expect(bytes.readBigUInt64LE(1)).toBe(1n);
    expect(c.read(Schema, bytes).flags).toEqual({ a: true, b: false, c: true });
    expect(() => c.write(Schema, { flags: 0x100, wide: 0n })).toThrow(
      "256 is out of range for u8"
    );
  });
});
