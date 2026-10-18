# Magic fields — `c.MagicNumber` / `c.MagicString`

Magic fields assert the expected value on read and always write the canonical value. They are optional in write data ([`c.input`](../type-helpers.md#c-input-t)). Use them for file signatures, chunk tags and format version guards.

## `c.MagicNumber(value, type)`

The numeric value is stored using the given primitive width (`c.u8()`, `c.u16()`, …). On read, a mismatch throws:

```ts
import { c } from "@craftycodie/cstruct";

const ChunkHeader = c.struct({
  magic: c.MagicNumber(0xbeef, c.u16()),
  size: c.u32(),
});

const bytes = c.write(ChunkHeader, { size: 128 }, "little"); // magic written for you
const read = c.read(ChunkHeader, bytes, "little");
// read.magic === 0xbeef

// Wrong magic on disk throws:
// read failed at magic: Magic number mismatch: expected 48879, got 0 at offset 0
```

**C equivalent** — a fixed constant checked after read:

```c
#define CHUNK_MAGIC 0xbeef

typedef struct {
    uint16_t magic; /* must equal CHUNK_MAGIC */
    uint32_t size;
} ChunkHeader;
```

Byte order follows the field, struct or call. Storage can be any integer type, including `c.u64()`.

## `c.MagicString(value)`

The string occupies its UTF-8 byte length (no NUL terminator). On read, the bytes must match exactly:

```ts
const BlfHeader = c.struct({
  signature: c.MagicString("chdr"),
  chunk_length: c.u32(),
});

c.write(BlfHeader, { chunk_length: 4096 }, "big");
```

Reach BLF chunks use this pattern — see [Example structures](../example-structures.md#blf-chdr-chunk-big-endian).

**C equivalent:**

```c
typedef struct {
    char signature[4]; /* "chdr" — no terminator */
    uint32_t chunk_length;
} BlfHeader;
```

If write data includes a magic value, it must equal the constant; anything else throws.

## Decorators

```ts
@c.class()
class ChunkHeader {
  @c.field(c.MagicNumber(0xbeef, c.u16()))
  magic!: number;

  @c.field(c.u32())
  size!: number;
}
```

Embed decorated classes in schemas with `c.class(ChunkHeader)` — see [Class decorators](../class-decorators.md).
