# Primitives & padding

```ts
import { c } from "@craftycodie/cstruct";

const Layout = c.struct({
  magic: c.u16(),
  size: c.u32(),
  flags: c.u8().padAfter(3),
});
```

| Factory | Size | TypeScript type |
| --- | --- | --- |
| `c.u8()`, `c.i8()` | 1 | `number` |
| `c.u16()`, `c.i16()` | 2 | `number` |
| `c.u32()`, `c.i32()`, `c.f32()` | 4 | `number` |
| `c.f64()` | 8 | `number` |
| `c.u64()`, `c.i64()` | 8 | `bigint` |
| `c.bool()` | 1 | `boolean` |

## Checked writes

Integer writes are validated by default. A value must be an integer that fits the field's bit width **as either signed or unsigned**, so the common C idiom of writing `-1` to a `u32` (giving `0xffffffff`) still works:

```ts
c.write(Layout, { magic: 70000, size: 0, flags: 0 });
// CStructError: write failed at magic: 70000 is out of range for u16

c.write(Layout, { magic: 1, size: -1, flags: 0 }); // size = 0xffffffff
```

Pass `{ checked: false }` to wrap out-of-range values instead:

```ts
c.write(Layout, data, { checked: false });
```

A missing or wrongly typed value always throws (`expected number, got undefined`); it is never written as 0.

## Padding

`c.pad(n)` reserves `n` zero bytes. Padding fields are left out of read results and write inputs.

```ts
const Header = c.struct({
  magic: c.u16(),
  _reserved: c.pad(2),
  length: c.u32(),
});
```

Or attach padding to a field with `.padBefore(n)` / `.padAfter(n)` (or the `{ padBefore, padAfter }` options):

```ts
const Header = c.struct({
  magic: c.u16(),
  length: c.u32().padBefore(2).padAfter(4),
});
```

To let cstruct insert the padding a C compiler would, use [alignment](./layout.md#alignment).

## Endianness

Little-endian by default. Choose per call, per struct, or per field. See [Layout](./layout.md#endianness).

```ts
c.read(Layout, bytes, "big");
```
