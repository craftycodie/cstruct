import { describe, expect, it } from "vitest";
import { c } from "../src/index";

const SkullFlags = ["iron", "mythic"] as const;

@c.struct()
class Point {
  @c.field("i16")
  x!: number;
  @c.field("i16")
  y!: number;
}

@c.struct()
class ArmA {
  @c.field("u8")
  value!: number;
}

@c.struct()
class Host {
  @c.field("u8")
  kind!: number;

  @c.union(
    { size: 4 },
    c.arm(ArmA, (m: Host) => m.kind === 1)
  )
  data: ArmA | null = null;
}

@c.struct()
class Profile {
  @c.field("u32")
  id!: number;

  @c.field("u64")
  xuid!: bigint;

  @c.field(c.Time64())
  when!: Date;

  @c.field(c.String(8))
  name!: string;

  @c.field(c.Bool())
  online!: boolean;

  @c.field(c.bitfield("u8", SkullFlags))
  skulls!: c.Bitfield<typeof SkullFlags>;

  @c.field(Point)
  origin!: Point;

  @c.field("u32", { count: 2 })
  scores!: number[];
}

@c.struct()
class WithPad {
  @c.field("u8")
  tag!: number;

  @c.field(c.pad(2))
  _reserved!: never;
}

describe("c.json", () => {
  it("serializes struct fields to a JSON-friendly object", () => {
    const when = new Date("2010-06-14T12:00:00.000Z");
    const instance = {
      id: 7,
      xuid: 0x0009_0003_1234_5678n,
      when,
      name: "Player1",
      online: true,
      skulls: { iron: true, mythic: false },
      origin: { x: 10, y: -3 },
      scores: [100, 200],
    } as Profile;

    expect(c.json(Profile, instance)).toEqual({
      id: 7,
      xuid: "2533287980717688",
      when: "2010-06-14T12:00:00.000Z",
      name: "Player1",
      online: true,
      skulls: { iron: true, mythic: false },
      origin: { x: 10, y: -3 },
      scores: [100, 200],
    });
  });

  it("omits pad fields", () => {
    expect(c.json(WithPad, { tag: 1 } as WithPad)).toEqual({ tag: 1 });
  });

  it("serializes union arms and null", () => {
    const active = c.read(Host, new Uint8Array([1, 42, 0, 0, 0]), "big");
    expect(c.json(Host, active)).toEqual({
      kind: 1,
      data: { value: 42 },
    });

    const inactive = c.read(Host, new Uint8Array([9, 1, 2, 3, 4]), "big");
    expect(c.json(Host, inactive)).toEqual({
      kind: 9,
      data: null,
    });
  });

  it("round-trips through JSON.stringify", () => {
    const sample = c.read(
      Profile,
      c.write(
        Profile,
        {
          id: 1,
          xuid: 42n,
          when: new Date("2020-01-01T00:00:00.000Z"),
          name: "A",
          online: false,
          skulls: { iron: false, mythic: true },
          origin: { x: 1, y: 2 },
          scores: [3, 4],
        } as Profile,
        "little"
      ),
      "little"
    );

    expect(JSON.parse(JSON.stringify(c.json(Profile, sample)))).toEqual(
      c.json(Profile, sample)
    );
  });
});
