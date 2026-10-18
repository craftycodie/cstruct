# Quick start

Everything public lives on the `c` object: schema factories, decorators, and I/O.

## Schema-first

```ts
import { c } from "@craftycodie/cstruct";

const Header = c.struct({
  magic: c.MagicString("HDR1"),
  version: c.u16().default(2),
  length: c.u32(),
});

const bytes = c.write(Header, { length: 42 }, "big"); // magic and version filled in
const header = c.read(Header, bytes, "big");

console.log(header.length); // 42
console.log(c.sizeof(Header)); // 10
```

Schemas also carry the same operations as methods: `Header.read(bytes)`, `Header.write(data)`, `Header.size`, `Header.offsetOf("length")`.

## Types

```ts
type Header = c.infer<typeof Header>;
// { magic: "HDR1"; version: number; length: number }

type HeaderInput = c.input<typeof Header>;
// { length: number; magic?: "HDR1"; version?: number }
```

See [Type helpers](./type-helpers.md).

## Class decorators

```ts
@c.class()
class Header {
  @c.field(c.u16())
  version = 0;

  @c.field(c.u32())
  length = 0;
}

const header = c.read(Header, bytes); // new Header instance
header.length += 1;
const out = c.write(header);
```

Mix schemas and decorated classes with `c.class(Ctor)`. See [Class decorators](./class-decorators.md).

## I/O

| Call | Result |
| --- | --- |
| `c.read(schema, bytes, offset?, endian?)` | Decoded object |
| `c.read(schema, bytes, { offset, endian })` | Same, with options |
| `c.read(Class, bytes, …)` | New class instance |
| `c.read(instance, bytes, …)` | Fills and returns `instance` |
| `c.write(schema, data, endian?)` | New `Buffer` |
| `c.write(schema, data, { endian, into, offset, checked })` | Writes into `into` when given |
| `c.write(instance, endianOrOptions?)` | New `Buffer` |
| `c.sizeof(schema \| class \| instance \| field)` | Size in bytes |
| `c.offsetof(schema \| class, "a.b[2].c")` | Byte offset of a field |

`bytes` can be a `Buffer`, `Uint8Array`, `ArrayBuffer` or `DataView`.

Read from an offset inside a larger buffer:

```ts
const file = Buffer.alloc(16);
const header = c.read(Header, file, { offset: 4, endian: "big" });
```

Next: [Primitives & padding](./primitives.md).
