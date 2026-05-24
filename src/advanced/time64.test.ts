import { describe, expect, it } from "vitest";
import { c } from "../index";
import { date_to_time64_seconds, time64_seconds_to_date } from "./time64";

@c.struct()
class Event {
  @c.field(c.Time64())
  when!: Date;
}

describe("Time64", () => {
  it("converts seconds since Unix epoch", () => {
    expect(time64_seconds_to_date(0n).toISOString()).toBe(
      "1970-01-01T00:00:00.000Z"
    );
    expect(date_to_time64_seconds(new Date("2020-01-01T00:00:00.000Z"))).toBe(
      1577836800n
    );
  });

  it("reads and writes through a struct", () => {
    const when = new Date(1_577_836_800_000);
    expect(c.sizeof(Event)).toBe(8);

    const written = c.write(Event, { when } as Event, "big");
    expect(written).toEqual(
      new Uint8Array([0, 0, 0, 0, 0x5e, 0x0b, 0xe1, 0x00])
    );

    const read = c.read(Event, written, "big");
    expect(read.when.getTime()).toBe(when.getTime());
  });
});
