import { describe, expect, it } from "vitest";
import { c } from "../src/index";

describe("advanced field types", () => {
  it("round-trips c.bool()", () => {
    const Schema = c.struct({ flag: c.bool() });
    const written = c.write(Schema, { flag: true });
    expect(c.read(Schema, written)).toEqual({ flag: true });
  });

  it("round-trips c.String(n)", () => {
    const Schema = c.struct({ name: c.String(8) });
    const written = c.write(Schema, { name: "Rudy" });
    expect(c.read(Schema, written)).toEqual({ name: "Rudy" });
  });

  it("round-trips c.WString(n)", () => {
    const Schema = c.struct({ label: c.WString(8) });
    const written = c.write(Schema, { label: "Oddball" });
    expect(c.read(Schema, written)).toEqual({ label: "Oddball" });
  });

  it("round-trips c.Time64()", () => {
    const Schema = c.struct({ when: c.Time64() });
    const date = new Date("2010-09-14T12:00:00Z");
    const written = c.write(Schema, { when: date });
    const decoded = c.read(Schema, written) as { when: Date };
    expect(decoded.when.getTime()).toBe(date.getTime());
  });
});
