# Nested structs

Pass a struct class as the field type, or omit the type and let it infer from the property:

```ts
@c.struct()
class Point {
  @c.field("i16")
  x!: number;

  @c.field("i16")
  y!: number;
}

@c.struct()
class Shape {
  @c.field(Point)
  origin!: Point;
}
```

Nested structs are read and written inline; `c.sizeof(Shape)` includes the full `Point` layout.

**C equivalent** — nested members with no extra indirection (same as embedding a sub-struct by value):

```c
typedef struct {
    int16_t x;
    int16_t y;
} Point;

typedef struct {
    Point origin; /* c.field(Point) — Point laid out inline, not a pointer */
} Shape;
```

`sizeof(Shape) == sizeof(Point)` when there are no other fields and the compiler uses the same alignment rules as your cstruct layout.
