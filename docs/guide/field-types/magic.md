# Magic fields — `c.MagicNumber` / `c.MagicString`

Magic fields assert expected values on read and always write the canonical value. Use them for file signatures, chunk tags, and format version guards.

## `c.MagicNumber(value, type)`

The numeric value is stored using the given primitive width (`c.u8()`, `c.u16()`, …). On read, a mismatch throws:

```ts
import { c } from "@craftycodie/cstruct";

const ChunkHeader = c.struct({
  magic: c.MagicNumber(0xbeef, c.u16()),
  size: c.u32(),
});

const bytes = c.write(ChunkHeader, { magic: 0xbeef, size: 128 }, "little");
const read = c.read(ChunkHeader, bytes, "little");
// read.magic === 0xbeef

// Wrong magic on disk throws:
// Magic number mismatch: expected 48879, got 0 at offset 0
```

**C equivalent** — a fixed constant checked after read:

```c
#define CHUNK_MAGIC 0xbeef

typedef struct {
    uint16_t magic; /* must equal CHUNK_MAGIC */
    uint32_t size;
} ChunkHeader;
```

Endianness follows the surrounding `c.read` / `c.write` call.

## `c.MagicString(value)`

The string occupies exactly `value.length` bytes (no NUL terminator). On read, bytes must match exactly:

```ts
const BlfHeader = c.struct({
  signature: c.MagicString("chdr"),
  chunk_length: c.u32(),
});

c.write(BlfHeader, { signature: "chdr", chunk_length: 4096 }, "big");
```

Reach BLF chunks use this pattern — see [Example structures](../example-structures.md#blf-chdr-chunk-big-endian).

**C equivalent:**

```c
typedef struct {
    char signature[4]; /* "chdr" — no terminator */
    uint32_t chunk_length;
} BlfHeader;
```

On write you still pass the magic value in the data object; the field always encodes the canonical string.

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
