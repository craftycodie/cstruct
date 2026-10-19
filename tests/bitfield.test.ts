import { describe, expect, it } from "vitest";
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
  const Difficulty = c.bitfield(
    { legendary: 3, easy: 0, heroic: 2, normal: 1 },
    c.u8()
  );
  const Sparse = c.bitfield({ iron: 0, mythic: 9 }, c.u16());

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
    const Schema = c.struct({ flags: c.bitfield(flags, c.u8()) });
    expect([...c.write(Schema, { flags: { a: true, b: false } })]).toEqual([1]);
  });

  it("validates bits", () => {
    expect(() => c.bitfield({ a: 8 }, c.u8())).toThrow(
      "Bitfield flag 'a' uses bit 8 but u8 storage holds 8 bits"
    );
    expect(() => c.bitfield({ a: 1, b: 1 }, c.u8())).toThrow(
      "Bitfield flags 'a' and 'b' share bit 1"
    );
    expect(() => c.bitfield({ a: -1 }, c.u8())).toThrow(
      "must use a non-negative integer bit"
    );
  });

  it("infers boolean flags", () => {
    const value: c.infer<typeof Sparse> = { iron: true, mythic: false };
    expect(value.iron).toBe(true);
  });
});
