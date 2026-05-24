# Arrays

Fixed-length arrays use the `count` option on `@c.field`, or `c.array` when the element type is itself an array or another field descriptor.

```ts
import { c } from "@craftycodie/cstruct";

@c.struct()
class Header {
  @c.field("u32", { count: 4 })
  values!: number[];
}
```

## `c.array`

Use `c.array(element, count)` for nested arrays and non-primitive element types:

```ts
@c.field(c.array(c.array("u32", 4), 3))
matrix!: number[][];

@c.field(c.array(c.bitfield("u8", ["a", "b"]), 2))
flags!: c.Bitfield<["a", "b"]>[];
```

`@c.field(type, { count: n })` is equivalent to `@c.field(c.array(type, n))` for a single level.

## Supported elements

Primitives, structs, `c.enum()`, `c.bitfield()`, `c.unionField()`, advanced fields (`c.String`, etc.), and nested arrays. Use a single `c.pad(n)` field (not `{ count }`) for reserved bytes.

## Union arrays

Each slot is `union.size` bytes. **Read** uses the parent struct’s union `select` (same arm for every index). **Write** picks the arm from each element’s instance type (`instanceof`), then falls back to `select(parent)` for plain objects.

## Wire layout

Elements are packed contiguously. Struct size is `count × element size`. Use `pad_before` / `pad_after` on the field for outer gaps.

## Validation

On write, the value must be a JS array with exactly `count` entries.
