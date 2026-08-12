import { describe, expect, it } from "vitest";
import { c } from "../src/index";

const FilmMetadata = c.struct({
  seconds: c.i32(),
  _pad: c.pad(12),
});

const PaddedHeader = c.struct({
  magic: c.u16(),
  length: c.u32({ padBefore: 2, padAfter: 4 }),
});

describe("padding", () => {
  it("skips pad_after bytes (16-byte film metadata slot)", () => {
    expect(c.sizeof(FilmMetadata)).toBe(16);

    const bytes = Buffer.alloc(16);
    bytes.writeInt32LE(90, 0);
    bytes.fill(0xee, 4);

    const read = c.read(FilmMetadata, bytes, "little");
    expect(read.seconds).toBe(90);

    const written = c.write(FilmMetadata, { seconds: 42 }, "little");
    expect(written.subarray(4)).toEqual(Buffer.alloc(12));
  });

  it("honors padBefore and padAfter on fields", () => {
    expect(c.sizeof(PaddedHeader)).toBe(12);

    const bytes = Buffer.from([0xab, 0xcd, 0, 0, 0, 0, 0, 0x10, 0, 0, 0, 0]);
    const read = c.read(PaddedHeader, bytes, "big");
    expect(read.magic).toBe(0xab_cd);
    expect(read.length).toBe(16);
  });
});
