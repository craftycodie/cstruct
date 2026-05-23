# Primitives & padding

Supported wire types: `u8`, `u16`, `u32`, `u64`, `i8`, `i16`, `i32`, `i64`, `f32`, `f64`.

`u64` and `i64` use JavaScript `bigint` on read and write.

## Field padding

Insert zero bytes around a field with `pad_before` / `pad_after`:

```ts
@c.struct()
class Header {
  @c.field("u16")
  magic!: number;

  @c.field("u32", { pad_before: 2, pad_after: 4 })
  length!: number;
}
```

Reserve bytes inside the layout with `c.pad(n)`:

```ts
@c.struct()
class Slot {
  @c.field("u8")
  tag!: number;

  @c.field(c.pad(3))
  private _reserved!: never;
}
```

This matches common game formats — for example a 4-byte film metadata slot with `i32` + 12 reserved bytes (see [Example structures](/guide/example-structures)).
