# Nested structs

Embed another schema inline by passing a `c.struct(...)` value as a field:

```ts
import { c } from "@craftycodie/cstruct";

const Point = c.struct({
  x: c.i16(),
  y: c.i16(),
});

const Shape = c.struct({
  origin: Point,
});
```

Nested structs are read and written inline; `c.sizeof(Shape)` includes the full `Point` layout.

To nest decorated classes, pass the class constructor as a field type — see [Class decorators](./class-decorators.md#mixing-schemas-and-classes).

**C equivalent** — nested members with no extra indirection (same as embedding a sub-struct by value):

```c
typedef struct {
    int16_t x;
    int16_t y;
} Point;

typedef struct {
    Point origin; /* laid out inline, not a pointer */
} Shape;
```

`sizeof(Shape) == sizeof(Point)` when there are no other fields and the compiler uses the same alignment rules as your cstruct layout.
