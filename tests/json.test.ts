import { describe, expect, expectTypeOf, it } from "vitest";
import { CStructError, c } from "../src/index";

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

  @c.field(c.U64())
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

class Rgb24 extends c.AdvancedType<[number, number, number], number[]> {
  readonly byteSize = 3;

  read(bytes: Uint8Array, offset: number): [number, number, number] {
    const r = bytes[offset];
    const g = bytes[offset + 1];
    const b = bytes[offset + 2];
    if (r === undefined || g === undefined || b === undefined) {
      throw new CStructError("Rgb24: read past end of buffer");
    }
    return [r, g, b];
  }

  write(
    bytes: Uint8Array,
    offset: number,
    value: [number, number, number]
  ): void {
    bytes[offset] = value[0];
    bytes[offset + 1] = value[1];
    bytes[offset + 2] = value[2];
  }

  toJson(value: [number, number, number]): number[] {
    return [...value];
  }

  fromJson(value: unknown, label: string): [number, number, number] {
    if (!Array.isArray(value) || value.length !== 3) {
      throw new CStructError(`${label}: expected [r, g, b]`);
    }
    const r = value[0];
    const g = value[1];
    const b = value[2];
    if (
      typeof r !== "number" ||
      typeof g !== "number" ||
      typeof b !== "number"
    ) {
      throw new CStructError(`${label}: expected [r, g, b]`);
    }
    return [r, g, b];
  }
}

@c.struct()
class Pixel {
  @c.field(new Rgb24())
  color!: [number, number, number];
}

describe("c.InferJsonType types", () => {
  it("infers primitive and nested field JSON types from the instance type", () => {
    expectTypeOf<c.InferJsonType<ArmA>>().toEqualTypeOf<{ value: number }>();

    expectTypeOf<c.InferJsonType<Point>>().toEqualTypeOf<{
      x: number;
      y: number;
    }>();

    type ProfileJson = c.InferJsonType<Profile>;
    expectTypeOf<ProfileJson["id"]>().toEqualTypeOf<number>();
    expectTypeOf<ProfileJson["xuid"]>().toEqualTypeOf<string>();
    expectTypeOf<ProfileJson["when"]>().toEqualTypeOf<string>();
    expectTypeOf<ProfileJson["name"]>().toEqualTypeOf<string>();
    expectTypeOf<ProfileJson["online"]>().toEqualTypeOf<boolean>();
    expectTypeOf<ProfileJson["skulls"]>().toEqualTypeOf<{
      iron: boolean;
      mythic: boolean;
    }>();
    expectTypeOf<ProfileJson["origin"]>().toEqualTypeOf<{
      x: number;
      y: number;
    }>();
    expectTypeOf<ProfileJson["scores"]>().toEqualTypeOf<number[]>();

    expectTypeOf<c.InferJsonType<Host>>().toEqualTypeOf<{
      kind: number;
      data: { value: number } | null;
    }>();

    expectTypeOf<c.InferJsonType<Pixel>["color"]>().toEqualTypeOf<
      [number, number, number]
    >();
  });
});

describe("c.toJson / c.fromJson", () => {
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

    expect(c.toJson(Profile, instance)).toEqual({
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
    expect(c.toJson(WithPad, { tag: 1 } as WithPad)).toEqual({ tag: 1 });
  });

  it("serializes union arms and null", () => {
    const active = c.read(Host, new Uint8Array([1, 42, 0, 0, 0]), "big");
    expect(c.toJson(Host, active)).toEqual({
      kind: 1,
      data: { value: 42 },
    });

    const inactive = c.read(Host, new Uint8Array([9, 1, 2, 3, 4]), "big");
    expect(c.toJson(Host, inactive)).toEqual({
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

    expect(JSON.parse(JSON.stringify(c.toJson(Profile, sample)))).toEqual(
      c.toJson(Profile, sample)
    );
  });

  it("builds class instances from JSON objects", () => {
    const when = new Date("2010-06-14T12:00:00.000Z");
    const instance = c.fromJson(Profile, {
      id: 7,
      xuid: "2533287980717688",
      when: "2010-06-14T12:00:00.000Z",
      name: "Player1",
      online: true,
      skulls: { iron: true, mythic: false },
      origin: { x: 10, y: -3 },
      scores: [100, 200],
    });

    expect(instance).toBeInstanceOf(Profile);
    expect(instance.origin).toBeInstanceOf(Point);
    expect(instance.xuid).toBe(0x0009_0003_1234_5678n);
    expect(instance.when).toEqual(when);
    expect(instance.skulls).toEqual({ iron: true, mythic: false });
  });

  it("round-trips json → fromJson → write", () => {
    const original = c.read(
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

    const parsed = JSON.parse(JSON.stringify(c.toJson(Profile, original)));
    const restored = c.fromJson(Profile, parsed);
    expect(c.write(Profile, restored, "little")).toEqual(
      c.write(Profile, original, "little")
    );
  });

  it("deserializes union arms using layout order for the discriminant", () => {
    const active = c.fromJson(Host, {
      kind: 1,
      data: { value: 42 },
    });
    expect(active).toBeInstanceOf(Host);
    expect(active.data).toBeInstanceOf(ArmA);
    expect(active.data).toEqual({ value: 42 });

    const inactive = c.fromJson(Host, {
      kind: 9,
      data: { value: 1 },
    });
    expect(inactive.data).toBeNull();
  });

  it("throws when a required field is missing", () => {
    expect(() => c.fromJson(Point, { x: 1 } as c.InferJsonType<Point>)).toThrow(
      CStructError
    );
  });

  it("uses AdvancedType toJson/fromJson for custom fields", () => {
    const instance = c.fromJson(Pixel, { color: [255, 128, 0] });
    expect(instance.color).toEqual([255, 128, 0]);
    expect(c.toJson(Pixel, instance)).toEqual({ color: [255, 128, 0] });
    expect(c.write(Pixel, instance)).toEqual(new Uint8Array([255, 128, 0]));
  });
});
