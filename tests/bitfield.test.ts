import { describe, expect, it } from "vitest";
import { CStructError, c } from "../src/index";

/** Reach `e_challenge_difficulty_flags` (sequential bits in u8). */
const DifficultyFlags = {
  easy: 0,
  normal: 1,
  heroic: 2,
  legendary: 3,
} as const;

/** Reach `e_challenge_skull_flags` (first four bits of u32). */
const SkullFlags = ["iron", "black_eye", "tough_luck", "catch"] as const;

@c.struct()
class ChallengeFlags {
  @c.field(c.bitfield("u8", DifficultyFlags))
  difficulty!: c.Bitfield<typeof DifficultyFlags>;

  @c.field(c.bitfield("u32", SkullFlags))
  skulls!: c.Bitfield<typeof SkullFlags>;
}

@c.struct()
class DifficultyOnly {
  @c.field(c.bitfield("u8", DifficultyFlags))
  difficulty!: c.Bitfield<typeof DifficultyFlags>;
}

@c.struct()
class StrictDifficulty {
  @c.field(c.bitfield("u8", DifficultyFlags, { strict: true }))
  difficulty!: c.Bitfield<typeof DifficultyFlags>;
}

describe("bitfield", () => {
  it("round-trips sequential and explicit bit layouts", () => {
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
    } satisfies ChallengeFlags;

    const written = c.write(ChallengeFlags, value, "big");
    expect(written).toEqual(
      new Uint8Array([
        0b0000_0110, // normal + heroic
        0x00,
        0x00,
        0x00,
        0x05, // iron + tough_luck (big-endian u32)
      ])
    );

    const read = c.read(ChallengeFlags, written, "big");
    expect(read).toEqual(value);
  });

  it("ignores reserved bits by default on read", () => {
    const read = c.read(DifficultyOnly, new Uint8Array([0xff]), "little");
    expect(read.difficulty).toEqual({
      easy: true,
      normal: true,
      heroic: true,
      legendary: true,
    });
  });

  it("strict mode rejects reserved bits on read", () => {
    expect(() =>
      c.read(StrictDifficulty, new Uint8Array([0x10]), "little")
    ).toThrow(CStructError);
  });

  it("rejects unknown flag keys on write", () => {
    expect(() =>
      c.write(DifficultyOnly, {
        difficulty: { easy: true, unknown: true },
      } as unknown as DifficultyOnly)
    ).toThrow(CStructError);
  });

  it("rejects duplicate bit indices in the definition", () => {
    expect(() => c.bitfield("u8", { a: 0, b: 0 })).toThrow(CStructError);
  });
});
