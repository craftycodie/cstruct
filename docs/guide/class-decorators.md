# Class decorators

`@c.class()` / `@c.field()` mirror the schema-first API for code that prefers class instances to plain objects. They work with both TypeScript decorator modes (standard, or `experimentalDecorators`) with no extra setup.

## Basic usage

```ts
import { c } from "@craftycodie/cstruct";

@c.class()
class Header {
  @c.field(c.u16())
  magic = 0;

  @c.field(c.u32(), { padBefore: 2 })
  length = 0;
}

const header = c.read(Header, bytes); // a new Header
header.length = 42;
const out = c.write(header);

c.read(header, bytes); // fills an existing instance instead
c.sizeof(Header); // 8
```

::: warning esbuild, Vite, Vitest and tsx with standard decorators
esbuild rejects `@c.class()` in standard-decorator mode because `class` is a reserved word. With those tools, enable `experimentalDecorators` or write `@(c.class())`. TypeScript's own compiler accepts both.
:::

## Type checking

`@c.field` checks that the property can hold the decoded value:

```ts
@c.class()
class Player {
  @c.field(c.u64())
  xuid!: number; // error: u64 decodes to bigint

  @c.field(c.Time64())
  joined!: Date; // ok
}
```

The error names the expected type: `Property '"cstruct: property type must accept decoded value"' is missing … PropertyTypeMismatch<bigint>`.

The check only runs one way (decoded value into property), so wider property types are fine: `number[]` for a 4-element array, `number` for a magic number, optional properties. With `experimentalDecorators`, TypeScript hides `private` and `protected` members from the check, so those properties are not checked. Standard decorators check them too.

## Field options

`@c.field(type, options)` accepts:

| Option | Effect |
| --- | --- |
| `count` | Array of `count` elements, like `c.array(type, count)` |
| `padBefore` / `padAfter` | Reserved bytes before / after the field |
| `endian` | Byte order for this field |

[Modifiers](./modifiers.md) work as well: `@c.field(c.u8().default(1))`.

## Class options

`@c.class(options)` takes the same options as `c.struct`:

```ts
@c.class({ endian: "big", align: true })
class NetworkHeader {
  @c.field(c.u8())
  kind = 0;

  @c.field(c.u32())
  length = 0; // offset 4 with natural alignment
}
```

## Nested classes

A decorated class can be a field type. Nested values read as instances of their class, so methods work:

```ts
@c.class()
class Point {
  @c.field(c.i16())
  x = 0;

  @c.field(c.i16())
  y = 0;

  length() {
    return Math.hypot(this.x, this.y);
  }
}

@c.class()
class Shape {
  @c.field(Point)
  origin!: Point;

  @c.field(Point, { count: 4 })
  corners!: Point[];
}

c.read(Shape, bytes).origin.length();
```

Reads construct instances with `new Point()`, so decorated classes should have a constructor that takes no arguments.

## Inheritance

A subclass inherits its base class's fields, which come first:

```ts
@c.class()
class Chunk {
  @c.field(c.string(4))
  tag = "";

  @c.field(c.u32())
  size = 0;
}

@c.class()
class ImageChunk extends Chunk {
  @c.field(c.u16())
  width = 0;
}

c.offsetof(ImageChunk, "width"); // 8
```

Redeclaring a base field throws. A subclass without `@c.class()` uses its nearest decorated ancestor's layout.

## Mixing schemas and classes

Embed a decorated class in a `c.struct` schema with `c.class(Ctor)`. The field infers as the class's instance type; as write input it takes the class's data properties.

```ts
const Scene = c.struct({
  origin: c.class(Point),
  rgba: c.u8().array(4),
});

const scene = c.read(Scene, bytes);
scene.origin instanceof Point; // true
c.write(Scene, { origin: { x: 1, y: 2 }, rgba: [255, 128, 0, 255] });
```

The reverse also works: a `c.struct` schema as a field type on a decorated class:

```ts
const Vec3 = c.struct({ x: c.f32(), y: c.f32(), z: c.f32() });

@c.class()
class Entity {
  @c.field(Vec3)
  position!: c.infer<typeof Vec3>;
}
```

## Limits

- Standard decorators cannot decorate `static` or `#private` fields; `@c.field` throws for them. TypeScript `private` fields are fine.
- Fields are laid out in declaration order.

## When to use which

| Approach | Best for |
| --- | --- |
| `c.struct({ ... })` | Shared layouts, fixtures, tree-shakeable definitions |
| `@c.class()` | Mutable instances with methods, OOP-style domain models |
| Mixed | Reusing decorated classes inside larger schema-first files |

Both share the same wire format and the same `c.read` / `c.write` / `c.sizeof` entry points.
