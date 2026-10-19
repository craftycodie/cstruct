# Arrays

Fixed-length arrays use `c.array(element, count)` or `.array(count)`:

```ts
import { c } from "@craftycodie/cstruct";

const Header = c.struct({
  values: c.array(c.u32(), 4),
  rgba: c.u8().array(4),
});
```

**C equivalent** — elements back-to-back with no gaps:

```c
typedef struct {
    uint32_t values[4]; /* 16 bytes */
    uint8_t  rgba[4];
} Header;
```

Arrays below 100 elements infer as tuples (`[number, number, number, number]`); from 100 up they infer as `number[]` to keep types fast.

## Nested arrays

```ts
const Layout = c.struct({
  matrix: c.array(c.array(c.u32(), 4), 3),
  flags: c.Bitfield(["a", "b"], c.u8()).array(2),
});
```

```c
typedef struct {
    uint32_t matrix[3][4]; /* row-major, 48 bytes */
    uint8_t  flags[2];
} Layout;
```

`matrix[1][2]` is at byte offset `(1 * 4 + 2) * 4`: `c.offsetof(Layout, "matrix[1][2]")` is 24.

## Raw bytes

For opaque data (hashes, GUIDs, blobs) use [`c.bytes(n)`](./field-types/bytes.md) instead of `c.u8().array(n)`. It reads as a `Buffer`, not a number array.

## Elements

Any field type can be an element: primitives, structs, `c.class(...)`, enums, bitfields, strings, unions and other arrays. Use a `c.pad(n)` field (not an array) for reserved bytes.

On decorated classes, `@c.field(c.u32(), { count: 4 })` equals `@c.field(c.array(c.u32(), 4))`.

## Top-level arrays

`c.read`, `c.write` and `c.sizeof` accept an array without a wrapping struct:

```ts
const Points = c.array(c.struct({ x: c.f32(), y: c.f32() }), 100);
const points = c.read(Points, bytes);
```

## Validation

On write, the value must be an array with at least `count` elements. Extra elements are ignored.
