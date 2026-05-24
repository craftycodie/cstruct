import { describe, expect, it } from "vitest";
import {
  bitfield_from_raw,
  bitfield_to_raw,
  CStructError,
  c,
  create_bitfield_field,
} from "../src/index";

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

  it("ignores reserved bits by default", () => {
    const field = create_bitfield_field("u8", DifficultyFlags);
    const decoded = bitfield_from_raw(0b1111_1111, field);
    expect(decoded).toEqual({
      easy: true,
      normal: true,
      heroic: true,
      legendary: true,
    });
  });

  it("strict mode rejects reserved bits", () => {
    const field = create_bitfield_field("u8", DifficultyFlags, {
      strict: true,
    });
    expect(() => bitfield_from_raw(0b0001_0000, field)).toThrow(CStructError);
  });

  it("packs and unpacks via helpers", () => {
    const field = create_bitfield_field("u32", SkullFlags);
    const raw = bitfield_to_raw(
      { iron: true, black_eye: false, tough_luck: false, catch: true },
      field,
      "skulls"
    );
    expect(raw).toBe(0b1001); // bits 0 and 3
    expect(bitfield_from_raw(raw, field)).toEqual({
      iron: true,
      black_eye: false,
      tough_luck: false,
      catch: true,
    });
  });

  it("rejects unknown flag keys on write", () => {
    const field = create_bitfield_field("u8", DifficultyFlags);
    expect(() =>
      bitfield_to_raw({ easy: true, unknown: true }, field, "difficulty")
    ).toThrow(CStructError);
  });

  it("rejects duplicate bit indices in the definition", () => {
    expect(() => create_bitfield_field("u8", { a: 0, b: 0 })).toThrow(
      CStructError
    );
  });
});
