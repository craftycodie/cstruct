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
