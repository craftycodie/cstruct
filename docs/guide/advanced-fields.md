# Advanced fields

Advanced fields occupy one packed slot in a struct. Pass a factory (`c.Bool`, `c.String`, `c.Time64`, …) or an instance to `@c.field`. Multi-field layouts should use `@c.struct` instead.

## Custom types

Subclass `c.AdvancedType<T>` when you need a format that is not a primitive, nested struct, or built-in helper. Implement:

- `byteSize` — fixed width of this slot in bytes
- `read(bytes, offset, endian, label)` — decode bytes to `T`
- `write(bytes, offset, value, endian, label)` — encode `T` into the buffer

The codec calls these hooks during `c.read` / `c.write`; `c.sizeof` includes `byteSize` in the struct total.

```ts
import { c } from "@craftycodie/cstruct";

/** Three-byte RGB, no padding. */
class Rgb24 extends c.AdvancedType<[number, number, number]> {
  readonly byteSize = 3;

  read(
    bytes: Uint8Array,
    offset: number,
    _endian: c.Endian,
    _label: string
  ): [number, number, number] {
    return [bytes[offset]!, bytes[offset + 1]!, bytes[offset + 2]!];
  }

  write(
    bytes: Uint8Array,
    offset: number,
    value: [number, number, number],
    _endian: c.Endian,
    label: string
  ): void {
    if (value.some((channel) => channel < 0 || channel > 255)) {
      throw new c.CStructError(`${label}: channel out of range`);
    }
    bytes[offset] = value[0];
    bytes[offset + 1] = value[1];
    bytes[offset + 2] = value[2];
  }
}

@c.struct()
class Pixel {
  @c.field(new Rgb24())
  color!: [number, number, number];
}

const pixel = c.read(Pixel, c.write(Pixel, { color: [255, 128, 0] } as Pixel));
```

**C equivalent** — three packed bytes, no terminator:

```c
typedef struct {
    uint8_t color[3]; /* or: uint8_t r, g, b; */
} Pixel;
```

Built-in helpers (`CBool`, `CString`, `CWString`, `CTime64`) are implemented the same way and are available on `c` if you need `instanceof` checks.

## Boolean — `c.Bool()`

One byte: `0` is false, any non-zero byte reads as true; writes `0` or `1` (matches blf_lib `Bool`):

```ts
@c.struct()
class AuthorFlags {
  @c.field(c.Bool())
  is_online!: boolean;
}
```

**C equivalent:**

```c
typedef struct {
    uint8_t is_online; /* 0 = false, non-zero = true */
} AuthorFlags;
```

(`bool is_online` is also one byte on most ABIs, but game formats usually use an explicit integer type.)

## String — `c.String(n)`

Fixed-size, NUL-terminated String (one byte per character, not UTF-8). The argument `n` is the **byte size** of the whole slot (same as `sizeof` the C array).

```ts
@c.struct()
class Tag {
  @c.field(c.String(16))
  name!: string;
}
```

**C equivalent:**

```c
typedef struct {
    char name[16]; /* Latin-1 bytes, NUL-terminated within the 16-byte slot */
} Tag;
```

A value like `"Player1"` occupies the first 7 bytes (`'P' 'l' 'a' 'y' 'e' 'r' '1' '\0'`); the rest of the array is unused padding inside the field.

## Wide string — `c.WString(n)`

Fixed-size UTF-16LE wchar slot. The argument `n` is the **character capacity** (byte size is `n * 2`). Reads and writes little-endian UTF-16 unless the buffer looks like mis-encoded UTF-8 (see implementation notes in source).

```ts
@c.struct()
class Label {
  @c.field(c.WString(32))
  text!: string;
}
```

**C equivalent** (64 bytes on disk):

```c
typedef struct {
    wchar_t text[32]; /* UTF-16 code units, NUL-terminated; 32 × 2 = 64 bytes */
} Label;
```

On platforms where `wchar_t` is not 16-bit, the same layout is `uint16_t text[32];`.

## Unix time — `c.Time64()`

8-byte unsigned seconds since epoch, exposed as `Date` in TypeScript:

```ts
@c.struct()
class Event {
  @c.field(c.Time64())
  when!: Date;
}
```

**C equivalent:**

```c
typedef struct {
    uint64_t when; /* seconds since 1970-01-01 UTC */
} Event;
```

Use the same endianness as the surrounding struct (`"little"` / `"big"` in `c.read` / `c.write`).

## Full struct example

TypeScript layout from [Example structures](./example-structures.md#author--history-slot-36-bytes) and the matching C mental model:

```ts
@c.struct()
class ContentItemHistory {
  @c.field(c.Time64())
  timestamp!: Date;

  @c.field("u64")
  xuid!: bigint;

  @c.field(c.String(16))
  name!: string;

  @c.field("u8", { pad_after: 3 })
  is_online!: number; /* pad_after mirrors C trailing padding for 4-byte alignment */
}
```

```c
#pragma pack(push, 4)

typedef struct {
    uint64_t timestamp;   /* c.Time64() — offset 0 */
    uint64_t xuid;        /* c.field("u64") — offset 8 */
    char     name[16];    /* c.String(16) — offset 16 */
    uint8_t  is_online;   /* c.field("u8") — offset 32 */
    /* 3 bytes implicit padding (offsets 33–35); compiler inserts this
       so sizeof(ContentItemHistory) is a multiple of 4 (36 bytes total) */
} ContentItemHistory;

#pragma pack(pop)
```

The explicit `pad_after: 3` in TypeScript matches those three alignment bytes — you are not reserving a separate named `_pad` field in the on-disk layout.

Factories: `c.Bool`, `c.String`, `c.WString`, and `c.Time64`. Classes: `c.CBool`, `c.CString`, `c.CWString`, and `c.CTime64`.
