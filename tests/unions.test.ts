import { describe, expect, it } from "vitest";
import { c } from "../src/index";

/** Simplified Reach-style metadata arms (fixed 16-byte union). */
@c.struct()
class FilmArm {
  @c.field("i32", { pad_after: 12 })
  seconds!: number;
}

@c.struct()
class GameVariantArm {
  @c.field("i8", { pad_after: 15 })
  icon_index!: number;
}

@c.struct()
class ContentMetadataHost {
  @c.field("i8")
  file_type!: number;

  @c.union(
    { size: 16 },
    c.arm(FilmArm, (m: ContentMetadataHost) => m.file_type === 3),
    c.arm(GameVariantArm, (m: ContentMetadataHost) => m.file_type === 6)
  )
  typed_data: FilmArm | GameVariantArm | null = null;
}

describe("unions", () => {
  it("reads the film arm when file_type is 3", () => {
    const bytes = new Uint8Array(17);
    bytes[0] = 3;
    const view = new DataView(bytes.buffer);
    view.setInt32(1, 120, true);

    const read = c.read(ContentMetadataHost, bytes, "little");
    expect(read.file_type).toBe(3);
    expect(read.typed_data).toEqual({ seconds: 120 });
  });

  it("reads the game-variant arm when file_type is 6", () => {
    const bytes = new Uint8Array(17);
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
        typed_data: { seconds: 42 } as FilmArm,
      } as ContentMetadataHost,
      "little"
    );
    expect(c.read(ContentMetadataHost, film, "little").typed_data).toEqual({
      seconds: 42,
    });

    const variant = c.write(
      ContentMetadataHost,
      {
        file_type: 6,
        typed_data: { icon_index: 2 } as GameVariantArm,
      } as ContentMetadataHost,
      "little"
    );
    expect(c.read(ContentMetadataHost, variant, "little").typed_data).toEqual({
      icon_index: 2,
    });
  });

  it("leaves the union null when no arm matches", () => {
    const bytes = new Uint8Array(17);
    bytes[0] = 0;
    const read = c.read(ContentMetadataHost, bytes, "little");
    expect(read.typed_data).toBeNull();
  });
});
