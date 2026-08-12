import { describe, expect, it } from "vitest";
import { c } from "../src/index";

const Activity = {
  None: 0,
  Matchmaking: 3,
} as const;

const FileType = {
  Film: 3,
  GameVariant: 6,
} as const;

const GeneralMetadata = c.struct({
  file_type: c.Enum(FileType, c.i8(), { padAfter: 3 }),
  size_in_bytes: c.u32(),
  activity: c.Enum(Activity, c.i8()),
});

describe("enums", () => {
  it("round-trips allowed enum values as keys", () => {
    const value = {
      file_type: "Film" as const,
      size_in_bytes: 4096,
      activity: "Matchmaking" as const,
    };

    const written = c.write(GeneralMetadata, value, "little");
    const read = c.read(GeneralMetadata, written, "little");
    expect(read.file_type).toBe("Film");
    expect(read.activity).toBe("Matchmaking");
    expect(read.size_in_bytes).toBe(4096);
  });

  it("rejects undefined values on read", () => {
    const bytes = Buffer.alloc(8);
    bytes[0] = 99;
    expect(() => c.read(GeneralMetadata, bytes, "little")).toThrow(
      "Enum value 99 is not a valid enum value"
    );
  });

  it("rejects undefined values on write", () => {
    expect(() =>
      c.write(
        GeneralMetadata,
        {
          file_type: "Film",
          size_in_bytes: 0,
          activity: "bogus" as never,
        },
        "little"
      )
    ).toThrow("Invalid enum key");
  });
});
