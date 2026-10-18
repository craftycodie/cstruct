# Nested structs

Pass a `c.struct(...)` value as a field to embed it inline:

```ts
import { c } from "@craftycodie/cstruct";

const Point = c.struct({ x: c.i16(), y: c.i16() });

const Shape = c.struct({
  origin: Point,
  corners: c.array(Point, 4),
});
```

**C equivalent** — nested members by value, not pointers:

```c
typedef struct { int16_t x; int16_t y; } Point;
typedef struct { Point origin; Point corners[4]; } Shape;
```

To nest decorated classes, use `c.class(Ctor)`. They read as instances of the class. See [Class decorators](./class-decorators.md#mixing-schemas-and-classes).

## Composing structs

`extend` appends fields, which suits formats where every chunk starts with a common header. A field with an existing name replaces it in place. Options are inherited unless overridden.

```ts
const ChunkHeader = c.struct({ tag: c.string(4), size: c.u32() });

const ImageChunk = ChunkHeader.extend({ width: c.u16(), height: c.u16() });
const BigImageChunk = ImageChunk.extend({}, { endian: "big" });
```

`pick` and `omit` build packed copies with fewer fields:

```ts
const Size = ImageChunk.pick("width", "height");
const NoSize = ImageChunk.omit("size");
```

`schema.shape` holds the field definitions a struct was built from.

## Struct options

`c.struct(fields, options)` accepts:

| Option | Effect |
| --- | --- |
| `endian` | Byte order for this struct's fields ([Layout](./layout.md#endianness)) |
| `align` | Natural C alignment ([Layout](./layout.md#alignment)) |
| `pack` | Cap alignment at 1, 2, 4, 8 or 16 bytes |
