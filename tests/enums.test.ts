import { describe, expect, it } from "vitest";
import { CStructError, c } from "../src/index";

const Activity = {
  None: 0,
  Matchmaking: 3,
} as const;

const FileType = {
  Film: 3,
  GameVariant: 6,
} as const;

@c.struct()
class GeneralMetadata {
  @c.field(c.enum("i8", FileType), { pad_after: 3 })
  file_type!: number;

  @c.field("u32")
  size_in_bytes!: number;

  @c.field(c.enum("i8", Activity))
  activity!: number;
}

describe("enums", () => {
  it("round-trips allowed enum values", () => {
    const value = {
      file_type: FileType.Film,
      size_in_bytes: 4096,
      activity: Activity.Matchmaking,
    } satisfies GeneralMetadata;

    const written = c.write(GeneralMetadata, value, "little");
    const read = c.read(GeneralMetadata, written, "little");
    expect(read.file_type).toBe(FileType.Film);
    expect(read.activity).toBe(Activity.Matchmaking);
    expect(read.size_in_bytes).toBe(4096);
  });

  it("rejects undefined wire values on read", () => {
    const bytes = new Uint8Array(8);
    bytes[0] = 99;
    expect(() => c.read(GeneralMetadata, bytes, "little")).toThrow(
      CStructError
    );
  });

  it("rejects undefined values on write", () => {
    expect(() =>
      c.write(
        GeneralMetadata,
        {
          file_type: FileType.Film,
          size_in_bytes: 0,
          activity: 2,
        } as GeneralMetadata,
        "little"
      )
    ).toThrow(CStructError);
  });
});
