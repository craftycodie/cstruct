import { describe, expect, it } from "vitest";
import { c } from "./index";

@c.class()
class Header {
  @c.field(c.u16())
  magic!: number;

  @c.field(c.u32(), { padBefore: 2 })
  length!: number;
}

@c.class()
class Point {
  @c.field(c.i16())
  x!: number;

  @c.field(c.i16())
  y!: number;
}

@c.class()
class Shape {
  @c.field(Point)
  origin!: Point;

  @c.field(c.array(c.u8(), 4))
  rgba!: number[];
}

const Outer = c.struct({
  header: c.class(Header),
  shape: c.class(Shape),
});

@c.class()
class ChunkHeader {
  @c.field(c.MagicNumber(0xbeef, c.u16()))
  magic!: number;

  @c.field(c.u32())
  size!: number;
}

const BlfChunkSchema = c.struct({
  header: c.class(ChunkHeader),
  payload: c.array(c.u8(), 4),
});

const Vec3Schema = c.struct({
  x: c.f32(),
  y: c.f32(),
  z: c.f32(),
});

@c.class()
class Entity {
  @c.field(c.u32())
  id!: number;

  @c.field(Vec3Schema)
  position!: c.infer<typeof Vec3Schema>;
}

const WorldSchema = c.struct({
  chunk: c.class(ChunkHeader),
  player: c.class(Entity),
});

describe("c.read / c.write", () => {
  it("round-trips a c.struct schema", () => {
    const data = {
      header: { magic: 0x1234, length: 99 },
      shape: { origin: { x: 1, y: 2 }, rgba: [0, 0, 0, 0] },
    };
    const buffer = c.write(Outer, data);
    expect(c.read(Outer, buffer)).toEqual(data);
    expect(buffer.length).toBe(c.sizeof(Outer));
  });

  it("round-trips a @c.class() instance", () => {
    const header = new Header();
    header.magic = 0xbeef;
    header.length = 42;

    const buffer = c.write(header);
    expect(buffer.length).toBe(c.sizeof(header));

    const decoded = new Header();
    c.read(decoded, buffer);
    expect(decoded.magic).toBe(0xbeef);
    expect(decoded.length).toBe(42);
  });

  it("reads into an existing class instance", () => {
    const source = new Header();
    source.magic = 0xabcd;
    source.length = 7;

    const buffer = c.write(source);
    const header = new Header();
    c.read(header, buffer);
    expect(header).toMatchObject({ magic: 0xabcd, length: 7 });
  });
});

describe("c.class decorators", () => {
  it("reads and writes a decorated class", () => {
    const source = new Header();
    source.magic = 0xbeef;
    source.length = 42;

    const buffer = c.write(source);
    expect(buffer.length).toBe(c.sizeof(Header));

    const header = new Header();
    c.read(header, buffer);
    expect(header).toMatchObject({ magic: 0xbeef, length: 42 });
  });

  it("supports nested decorated classes", () => {
    const origin = new Point();
    origin.x = 10;
    origin.y = -3;

    const shape = new Shape();
    shape.origin = origin;
    shape.rgba = [255, 128, 0, 255];

    const buffer = c.write(shape);

    const decoded = new Shape();
    c.read(decoded, buffer);
    expect(decoded).toMatchObject({
      origin: { x: 10, y: -3 },
      rgba: [255, 128, 0, 255],
    });
  });

  it("embeds decorated classes in c.struct via c.class()", () => {
    const data = {
      header: { magic: 0x1234, length: 99 },
      shape: { origin: { x: 1, y: 2 }, rgba: [0, 0, 0, 0] },
    };
    const buffer = c.write(Outer, data);
    expect(c.read(Outer, buffer)).toEqual(data);
  });

  it("supports field padding options", () => {
    expect(c.sizeof(Header)).toBe(8);
  });
});

describe("struct/class composition", () => {
  describe("struct containing class", () => {
    it("round-trips a decorated class embedded via c.class()", () => {
      const data = {
        header: { magic: 0xbeef, size: 128 },
        payload: [1, 2, 3, 4] satisfies c.infer<
          typeof BlfChunkSchema
        >["payload"],
      };

      const buffer = c.write(BlfChunkSchema, data);
      expect(c.read(BlfChunkSchema, buffer)).toEqual(data);
      expect(buffer.length).toBe(c.sizeof(BlfChunkSchema));
    });
  });

  describe("class containing struct", () => {
    it("infers nested struct field types from the schema", () => {
      type Position = c.infer<typeof Vec3Schema>;
      const _typeCheck: Position = { x: 0, y: 0, z: 0 };
      expect(_typeCheck).toEqual({ x: 0, y: 0, z: 0 });

      type Id = c.infer<ReturnType<typeof c.u32>>;
      const _idCheck: Id = 1;
      expect(_idCheck).toBe(1);

      const rgbaField = c.array(c.u8(), 4);
      type Rgba = c.infer<typeof rgbaField>;
      const _rgbaCheck: Rgba = [0, 0, 0, 255];
      expect(_rgbaCheck).toEqual([0, 0, 0, 255]);
    });

    it("round-trips a nested c.struct via @c.field(Struct)", () => {
      const source = new Entity();
      source.id = 42;
      source.position = { x: 1.5, y: -2.25, z: 0 };

      const buffer = c.write(source);

      const entity = new Entity();
      c.read(entity, buffer);
      expect(entity).toMatchObject({
        id: 42,
        position: { x: 1.5, y: -2.25, z: 0 },
      });
      expect(c.sizeof(Entity)).toBe(16);
    });
  });

  describe("struct containing class containing struct", () => {
    it("round-trips when a struct embeds a class that embeds another struct", () => {
      const data = {
        chunk: { magic: 0xbeef, size: 128 },
        player: { id: 7, position: { x: 1, y: 2, z: 3 } },
      };

      const buffer = c.write(WorldSchema, data);
      expect(c.read(WorldSchema, buffer)).toEqual(data);
      expect(buffer.length).toBe(c.sizeof(WorldSchema));
    });
  });
});
