import { describe, expect, expectTypeOf, it } from "vitest";
import { c } from "../src/index";

const Activity = {
  None: 0,
  Matchmaking: 3,
} as const;

// biome-ignore lint/style/noEnum: c.enum must accept TypeScript enums
enum FileType {
  Film = 3,
  GameVariant = 6,
}

const GeneralMetadata = c.struct({
  file_type: c.enum(FileType, c.i8(), { padAfter: 3 }),
  size_in_bytes: c.u32(),
  activity: c.enum(Activity, c.i8()),
  stage: c.enum(["Lobby", "Playing"], c.u8()),
});

describe("enums", () => {
  it("decodes objects and TypeScript enums to member values", () => {
    const value = {
      file_type: FileType.Film,
      size_in_bytes: 4096,
      activity: Activity.Matchmaking,
      stage: "Playing" as const,
    };

    const written = c.write(GeneralMetadata, value, "little");
    expect([...written.subarray(0, 1)]).toEqual([3]);
    expect(written[8]).toBe(3);
    expect(written[9]).toBe(1);
    expect(c.read(GeneralMetadata, written, "little")).toEqual(value);
    type Metadata = c.infer<typeof GeneralMetadata>;
    expectTypeOf<Metadata["file_type"]>().toEqualTypeOf<FileType>();
    expectTypeOf<Metadata["activity"]>().toEqualTypeOf<0 | 3>();
    expectTypeOf<Metadata["stage"]>().toEqualTypeOf<"Lobby" | "Playing">();
  });

  it("rejects undefined values on read", () => {
    const bytes = new Uint8Array(c.sizeof(GeneralMetadata));
    bytes[0] = 99;
    expect(() => c.read(GeneralMetadata, bytes, "little")).toThrow(
      "99 is not a valid enum value"
    );
  });

  it("rejects undefined values on write", () => {
    expect(() =>
      c.write(
        GeneralMetadata,
        {
          file_type: FileType.Film,
          size_in_bytes: 0,
          activity: 5 as never,
          stage: "Lobby",
        },
        "little"
      )
    ).toThrow("5 is not a valid enum value");
  });

  it("ignores a TypeScript enum's reverse mapping", () => {
    // FileType[3] === "Film" is not a member: the name never decodes.
    const Only = c.struct({ kind: c.enum(FileType, c.u8()) });
    expect(() => c.write(Only, { kind: "Film" as never })).toThrow(
      "Film is not a valid enum value"
    );
  });

  it("rejects members that cannot be stored as numbers", () => {
    expect(() => c.enum({ A: "a" }, c.u8())).toThrow(
      "c.enum member 'A' is not a number and cannot be stored"
    );
  });
});
