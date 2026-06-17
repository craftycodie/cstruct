# Primitives & padding

Use factory functions for numeric fields:

```ts
import { c } from "@craftycodie/cstruct";

const Layout = c.struct({
  magic: c.u16(),
  size: c.u32(),
  flags: c.u8({ padAfter: 3 }),
});
```

| Factory | Size | TypeScript type |
|---------|------|-----------------|
| `c.u8()`, `c.i16()`, `c.i32()`, `c.f32()` | 1, 2, 4, 4 | `number` |
| `c.u64()`, `c.i64()` | 8 | `bigint` |
| `c.f64()` | 8 | `number` |

## Padding

`c.pad(n)` reserves `n` zero bytes. Use field options for alignment:

```ts
const Header = c.struct({
  magic: c.u16(),
  length: c.u32({ padBefore: 2, padAfter: 4 }),
});
```

In decorators:

```ts
@c.class()
class Header {
  @c.field(c.u32(), { padBefore: 2 })
  length!: number;
}
```

Endian is selected per `c.read` / `c.write` call (`"little"` default, `"big"` supported).
