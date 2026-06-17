# Arrays

Fixed-length arrays use `c.array(element, count)`:

```ts
import { c } from "@craftycodie/cstruct";

const Header = c.struct({
  values: c.array(c.u32(), 4),
});
```

**C equivalent** — a fixed-size member array; elements are laid out back-to-back with no gaps:

```c
typedef struct {
    uint32_t values[4]; /* c.array(c.u32(), 4) — 16 bytes total */
} Header;
```

## Nested arrays

```ts
const Layout = c.struct({
  matrix: c.array(c.array(c.u32(), 4), 3),
  flags: c.array(c.Bitfield(["a", "b"], c.u8()), 2),
});
```

**C equivalent** — nested arrays and repeated non-primitive slots use the same contiguous packing:

```c
typedef struct {
    uint32_t matrix[3][4]; /* c.array(c.array(c.u32(), 4), 3) — row-major, 48 bytes */
    uint8_t flags[2];      /* c.array(c.Bitfield(["a","b"], c.u8()), 2) */
} Layout;
```

Each `flags[i]` is a single byte with bits 0 (`a`) and 1 (`b`), same as [Bitfield](./field-types/bitfield.md). cstruct decodes every slot to `{ a: boolean, b: boolean }` on read.

On decorated classes, `@c.field(c.u32(), { count: 4 })` is equivalent to `@c.field(c.array(c.u32(), 4))`.

## Supported elements

Primitives, structs, `c.Enum()`, `c.Bitfield()`, discriminated unions, field types (`c.String`, etc.), and nested arrays. Use a single `c.pad(n)` field (not `{ count }`) for reserved bytes.

## Layout

Elements are packed contiguously. Struct size is `count × element size`. Use `padBefore` / `padAfter` on the field for outer gaps.

## Validation

On write, the value must be a JS array with exactly `count` entries.
