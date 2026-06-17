# Class decorators

Optional `@c.class()` / `@c.field()` decorators mirror the schema-first API. Use them when you prefer class instances over plain objects.

## Basic usage

```ts
import { c } from "@craftycodie/cstruct";

@c.class()
class Header {
  @c.field(c.u16())
  magic!: number;

  @c.field(c.u32(), { padBefore: 2 })
  length!: number;
}

const header = new Header();
header.magic = 0xbeef;
header.length = 42;

const bytes = c.write(header);
c.read(header, bytes); // mutates header in place
console.log(c.sizeof(header)); // packed size
```

Requires `experimentalDecorators: true` in TypeScript. See [Vitest](./vitest.md).

## Mixing schemas and classes

Embed a decorated class inside a `c.struct` schema with `c.class(Ctor)`:

```ts
@c.class()
class Point {
  @c.field(c.i16())
  x!: number;

  @c.field(c.i16())
  y!: number;
}

const Shape = c.struct({
  origin: c.class(Point),
  rgba: c.array(c.u8(), 4),
});

const data = {
  origin: { x: 1, y: 2 },
  rgba: [255, 128, 0, 255],
};

c.read(Shape, c.write(Shape, data));
```

The reverse also works — nest a `c.struct` schema as a field type on a decorated class:

```ts
const Vec3 = c.struct({ x: c.f32(), y: c.f32(), z: c.f32() });

@c.class()
class Entity {
  @c.field(c.u32())
  id!: number;

  @c.field(Vec3)
  position!: c.infer<typeof Vec3>;
}
```

## Field options

`@c.field` accepts the same options as schema fields:

| Option | Description |
| --- | --- |
| `padBefore` / `padAfter` | Reserved bytes before or after the field |
| `count` | Shorthand for `c.array(type, count)` |

```ts
@c.class()
class Layout {
  @c.field(c.u32(), { padAfter: 4 })
  value!: number;

  @c.field(c.u8(), { count: 4 })
  rgba!: number[];
}
```

## When to use which

| Approach | Best for |
| --- | --- |
| `c.struct({ ... })` | Shared layouts, fixtures, tree-shakeable definitions |
| `@c.class()` | Mutable instances, OOP-style domain models |
| Mixed | Reuse decorated classes inside larger schema-first files |

Both paths share the same wire format and `c.read` / `c.write` / `c.sizeof` entry points.
