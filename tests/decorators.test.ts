import { describe, expect, it } from "vitest";
import { c } from "../src/index";

// Runs under both legacy (experimentalDecorators) and stage 3 decorators;
// see vitest.config.ts.

@c.class()
class Point {
  @c.field(c.i16())
  x = 0;

  @c.field(c.i16())
  y = 0;

  length(): number {
    return Math.hypot(this.x, this.y);
  }
}

@c.class()
class Shape {
  @c.field(Point)
  origin!: Point;

  @c.field(Point, { count: 2, padBefore: 1 })
  corners!: [Point, Point];
}

describe("nested decorated classes", () => {
  it("read as instances of their class", () => {
    const shape = new Shape();
    shape.origin = Object.assign(new Point(), { x: 3, y: 4 });
    shape.corners = [
      Object.assign(new Point(), { x: 1, y: 1 }),
      Object.assign(new Point(), { x: 2, y: 2 }),
    ];
    expect(c.sizeof(Shape)).toBe(4 + 1 + 8);

    const decoded = c.read(Shape, c.write(shape));
    expect(decoded).toBeInstanceOf(Shape);
    expect(decoded.origin).toBeInstanceOf(Point);
    expect(decoded.origin.length()).toBe(5);
    expect(decoded.corners[1]).toBeInstanceOf(Point);
    expect(decoded.corners[1].x).toBe(2);
  });

  it("read as instances inside c.struct schemas", () => {
    const Scene = c.struct({
      at: c.class(Point),
      many: c.array(c.class(Point), 2),
    });
    const bytes = c.write(Scene, {
      at: { x: 6, y: 8 },
      many: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ],
    });
    const scene = c.read(Scene, bytes);
    expect(scene.at).toBeInstanceOf(Point);
    expect(scene.at.length()).toBe(10);
    expect(scene.many[1]).toBeInstanceOf(Point);
  });
});

describe("c.read(Ctor, bytes)", () => {
  it("returns a new instance", () => {
    const bytes = Buffer.from([1, 0, 2, 0]);
    const point = c.read(Point, bytes);
    expect(point).toBeInstanceOf(Point);
    expect(point).toMatchObject({ x: 1, y: 2 });
  });
});

describe("inheritance", () => {
  @c.class()
  class Base {
    @c.field(c.u16())
    kind = 0;
  }

  @c.class()
  class Derived extends Base {
    @c.field(c.u32())
    size = 0;
  }

  @c.class()
  class Grandchild extends Derived {
    @c.field(c.u8())
    flags = 0;
  }

  class Undecorated extends Derived {}

  it("lays out base fields first", () => {
    expect(c.sizeof(Derived)).toBe(6);
    expect(c.offsetof(Derived, "size")).toBe(2);
    expect(c.sizeof(Grandchild)).toBe(7);
    expect(c.offsetof(Grandchild, "flags")).toBe(6);

    const value = Object.assign(new Grandchild(), {
      kind: 1,
      size: 2,
      flags: 3,
    });
    expect([...c.write(value)]).toEqual([1, 0, 2, 0, 0, 0, 3]);
    expect(c.read(Grandchild, c.write(value))).toMatchObject({
      kind: 1,
      size: 2,
      flags: 3,
    });
  });

  it("keeps the base layout intact", () => {
    expect(c.sizeof(Base)).toBe(2);
  });

  it("lets an undecorated subclass use its ancestor's layout", () => {
    const value = Object.assign(new Undecorated(), { kind: 7, size: 9 });
    expect(c.sizeof(value)).toBe(6);
    expect(c.read(new Undecorated(), c.write(value))).toMatchObject({
      kind: 7,
      size: 9,
    });
  });

  it("rejects a subclass that redeclares a base field", () => {
    expect(() => {
      @c.class()
      class Clash extends Base {
        @c.field(c.u8())
        kind2 = 0;

        @c.field(c.u8())
        override kind = 0;
      }
      return Clash;
    }).toThrow("Clash: field 'kind' is declared more than once");
  });
});

describe("@c.class options", () => {
  @c.class({ endian: "big", align: true })
  class Header {
    @c.field(c.u8())
    tag = 0;

    @c.field(c.u32())
    length = 0;
  }

  it("applies struct options to the class layout", () => {
    expect(c.sizeof(Header)).toBe(8);
    const bytes = c.write(Object.assign(new Header(), { tag: 1, length: 2 }));
    expect([...bytes]).toEqual([1, 0, 0, 0, 0, 0, 0, 2]);
  });
});

describe("field options", () => {
  @c.class()
  class Options {
    @c.field(c.u16(), { endian: "big" })
    pinned = 0;

    @c.field(c.u8().default(9))
    defaulted?: number;
  }

  it("honors endian and chain modifiers", () => {
    const value = Object.assign(new Options(), { pinned: 1 });
    expect([...c.write(value)]).toEqual([0, 1, 9]);
  });
});

describe("classes as union arms", () => {
  @c.class()
  class Film {
    @c.field(c.i32())
    seconds = 0;

    minutes(): number {
      return this.seconds / 60;
    }
  }

  @c.class()
  class Variant {
    @c.field(c.u8())
    icon = 0;
  }

  @c.class()
  class Header {
    @c.field(c.u8())
    kind = 0;
  }

  @c.class()
  class Item {
    @c.field(Header)
    header = new Header();

    @c.field(
      c.discriminatedUnion(
        { size: 8 },
        c.when(3, Film, (m: Item) => m.header.kind),
        c.arm(Variant, (m: Item) => m.header.kind === 6)
      )
    )
    data: Film | Variant | null = null;

    @c.field(c.match("header.kind", { 3: Film, 6: Variant }))
    again: Film | Variant | null = null;
  }

  it("reads arms as class instances, with typed predicates", () => {
    const bytes = c.write(Item, {
      header: { kind: 3 },
      data: { seconds: 120 },
      again: { seconds: 60 },
    });
    expect(c.sizeof(Item)).toBe(1 + 8 + 4);
    const item = c.read(Item, bytes);
    expect(item.data).toBeInstanceOf(Film);
    expect((item.data as Film).minutes()).toBe(2);
    expect(item.again).toBeInstanceOf(Film);
    expect(
      c.read(
        Item,
        c.write(Item, { header: { kind: 6 }, data: { icon: 4 }, again: null })
      ).data
    ).toEqual(Object.assign(new Variant(), { icon: 4 }));
  });
});

describe("c.write(Class, data)", () => {
  @c.class()
  class Pair {
    @c.field(c.u8())
    a = 0;

    @c.field(c.u8())
    b = 0;

    sum(): number {
      return this.a + this.b;
    }
  }

  it("writes plain data or an instance with the class layout", () => {
    expect([...c.write(Pair, { a: 1, b: 2 }, "big")]).toEqual([1, 2]);
    const pair = Object.assign(new Pair(), { a: 3, b: 4 });
    expect([...c.write(Pair, pair)]).toEqual([3, 4]);
    expect(c.read(Pair, c.write(Pair, { a: 5, b: 6 })).sum()).toBe(11);
  });
});

describe("c.Bitfield type", () => {
  it("names the decoded flags type", () => {
    const Flags = ["iron", "mythic"] as const;
    const value: c.Bitfield<typeof Flags> = { iron: true, mythic: false };
    const map: c.Bitfield<{ a: 0; b: 3 }> = { a: false, b: true };
    expect([value.iron, map.b]).toEqual([true, true]);
  });
});
