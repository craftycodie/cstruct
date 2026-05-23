import { describe, expect, it } from "vitest";
import { c } from "../index";

@c.struct()
class Tag {
  @c.field(c.String(8))
  name!: string;
}

@c.struct()
class Author {
  @c.field(c.String(16))
  name!: string;
}

describe("String", () => {
  it("reads and writes a NUL-terminated Latin-1 slot", () => {
    expect(c.size(Tag)).toBe(8);

    const written = c.write(Tag, { name: "foo" } as Tag, "big");
    expect(written).toEqual(
      new Uint8Array([0x66, 0x6f, 0x6f, 0x00, 0x00, 0x00, 0x00, 0x00])
    );

    const read = c.read(Tag, written, "big");
    expect(read.name).toBe("foo");
  });

  it("round-trips Latin-1 creator name (U+00A6) without UTF-8 expansion", () => {
    const onDisk = new Uint8Array(16);
    onDisk[0] = 0xa6;

    const read = c.read(Author, onDisk, "big");
    expect(read.name).toBe("\u00a6");

    const written = c.write(Author, { name: read.name } as Author, "big");
    expect(written.subarray(0, 4)).toEqual(new Uint8Array([0xa6, 0, 0, 0]));

    const roundtrip = c.read(Author, written, "big");
    expect(roundtrip.name).toBe("\u00a6");
    expect(written[0]).not.toBe(0xc3);
  });
});
