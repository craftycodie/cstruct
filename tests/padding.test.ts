import { describe, expect, it } from "vitest";
import { c } from "../src/index";

/** Mirrors `s_content_item_film_metadata` (i32 + 12 reserved bytes). */
@c.struct()
class FilmMetadata {
  @c.field("i32", { pad_after: 12 })
  seconds!: number;
}

@c.struct()
class PaddedHeader {
  @c.field("u16")
  magic!: number;

  @c.field("u32", { pad_before: 2, pad_after: 4 })
  length!: number;
}

describe("padding", () => {
  it("skips pad_after bytes (16-byte film metadata slot)", () => {
    expect(c.sizeof(FilmMetadata)).toBe(16);

    const bytes = new Uint8Array(16);
    const view = new DataView(bytes.buffer);
    view.setInt32(0, 90, true);
    bytes.fill(0xee, 4);

    const read = c.read(FilmMetadata, bytes, "little");
    expect(read.seconds).toBe(90);

    const written = c.write(
      FilmMetadata,
      { seconds: 42 } as FilmMetadata,
      "little"
    );
    expect(written.subarray(4)).toEqual(new Uint8Array(12));
  });

  it("honors pad_before and pad_after on fields", () => {
    expect(c.sizeof(PaddedHeader)).toBe(12);

    const bytes = new Uint8Array([0xab, 0xcd, 0, 0, 0, 0, 0, 0x10, 0, 0, 0, 0]);
    const read = c.read(PaddedHeader, bytes, "big");
    expect(read.magic).toBe(0xab_cd);
    expect(read.length).toBe(16);
  });
});
