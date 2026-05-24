import { describe, expect, it } from "vitest";
import { c } from "../index";

@c.struct()
class Label {
  @c.field(c.WString(4))
  text!: string;
}

describe("WString", () => {
  it("reads and writes UTF-16LE with NUL termination", () => {
    expect(c.sizeof(Label)).toBe(8);

    const written = c.write(Label, { text: "ab" } as Label, "little");
    expect(written).toEqual(
      new Uint8Array([0x61, 0x00, 0x62, 0x00, 0x00, 0x00, 0x00, 0x00])
    );

    const read = c.read(Label, written, "little");
    expect(read.text).toBe("ab");
  });

  it("round-trips non-ASCII without a leading mojibake character", () => {
    for (const text of ["café", "Ñoño", "日本語"]) {
      const written = c.write(Label, { text } as Label, "little");
      const read = c.read(Label, written, "little");
      expect(read.text).toBe(text);
      expect(read.text.charCodeAt(0)).not.toBe(0xc3);
    }
  });

  it("strips BOM on write and does not prepend U+FEFF", () => {
    const written = c.write(Label, { text: "\uFEFFab" } as Label, "little");
    expect(written[0]).toBe(0x61);
    expect(written[1]).toBe(0x00);
    expect(c.read(Label, written, "little").text).toBe("ab");
  });

  it("reads UTF-8 bytes mis-stored in a wchar slot as UTF-8", () => {
    const utf8_cafe = new Uint8Array([
      0x63, 0x61, 0x66, 0xc3, 0xa9, 0x00, 0x00, 0x00,
    ]);

    expect(c.read(Label, utf8_cafe, "little").text).toBe("café");
  });
});
