import { describe, expect, it } from "vitest";
import { c } from "../src/index";

const FilmArm = c.struct({
  seconds: c.i32(),
  _pad: c.pad(12),
});

const GameVariantArm = c.struct({
  icon_index: c.u8(),
  _pad: c.pad(15),
});

const ContentMetadataHost = c.struct({
  file_type: c.u8(),
  typed_data: c.discriminatedUnion(
    { size: 16 },
    c.arm(FilmArm, (m) => m.file_type === 3),
    c.arm(GameVariantArm, (m) => m.file_type === 6)
  ),
});

describe("discriminated unions", () => {
  it("reads the film arm when file_type is 3", () => {
    const bytes = Buffer.alloc(17);
    bytes[0] = 3;
    bytes.writeInt32LE(120, 1);

    const read = c.read(ContentMetadataHost, bytes, "little");
    expect(read.file_type).toBe(3);
    expect(read.typed_data).toEqual({ seconds: 120 });
  });

  it("reads the game-variant arm when file_type is 6", () => {
    const bytes = Buffer.alloc(17);
    bytes[0] = 6;
    bytes[1] = 7;

    const read = c.read(ContentMetadataHost, bytes, "little");
    expect(read.typed_data).toEqual({ icon_index: 7 });
  });

  it("round-trips the selected arm on write", () => {
    const film = c.write(
      ContentMetadataHost,
      {
        file_type: 3,
        typed_data: { seconds: 42 },
      },
      "little"
    );
    expect(c.read(ContentMetadataHost, film, "little").typed_data).toEqual({
      seconds: 42,
    });

    const variant = c.write(
      ContentMetadataHost,
      {
        file_type: 6,
        typed_data: { icon_index: 2 },
      },
      "little"
    );
    expect(c.read(ContentMetadataHost, variant, "little").typed_data).toEqual({
      icon_index: 2,
    });
  });

  it("leaves the union null when no arm matches", () => {
    const bytes = Buffer.alloc(17);
    bytes[0] = 0;
    const read = c.read(ContentMetadataHost, bytes, "little");
    expect(read.typed_data).toBeNull();
  });
});
