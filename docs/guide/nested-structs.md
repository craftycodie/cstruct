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
