# Primitives & padding

Packed integers and IEEE floats. Multi-byte types honor the endian passed to `c.read` / `c.write` (`"little"` default, or `"big"`).

## Primitive types

| cstruct | C type (`<stdint.h>` / `<stddef.h>`) | Size | JavaScript |
| --- | --- | ---: | --- |
| `u8` | `uint8_t` | 1 | `number` |
| `u16` | `uint16_t` | 2 | `number` |
| `u32` | `uint32_t` | 4 | `number` |
| `u64` | `uint64_t` | 8 | `bigint` |
| `i8` | `int8_t` | 1 | `number` |
| `i16` | `int16_t` | 2 | `number` |
| `i32` | `int32_t` | 4 | `number` |
| `i64` | `int64_t` | 8 | `bigint` |
| `f32` | `float` | 4 | `number` |
| `f64` | `double` | 8 | `number` |

Use these names in `@c.field("u32")`, `c.enum("i8", …)`, `c.bitfield("u32", …)`, and anywhere else a storage primitive is required. `c.sizeof("u32")` returns the size column in bytes.

For a one-byte true/false slot (not a single-bit flag), see `c.Bool()` in [Boolean](./advanced-fields/bool.md) — typically `uint8_t` or `bool` in C, not a row in this table.

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
