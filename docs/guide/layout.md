# Layout

## Packed by default

Fields follow each other with no gaps unless you add padding, like a C struct under `#pragma pack(1)`:

```ts
const Mixed = c.struct({ a: c.u8(), b: c.u32(), c: c.u16() });
c.sizeof(Mixed); // 7
```

## Alignment

`{ align: true }` lays fields out as a C compiler does: each field starts at a multiple of its alignment, and the size rounds up to the struct's alignment.

```ts
const Mixed = c.struct(
  { a: c.u8(), b: c.u32(), c: c.u16(), d: c.u64(), e: c.u8() },
  { align: true }
);
c.offsetof(Mixed, "b"); // 4
c.offsetof(Mixed, "d"); // 16
c.sizeof(Mixed); // 32
```

```c
typedef struct { uint8_t a; uint32_t b; uint16_t c; uint64_t d; uint8_t e; } Mixed;
// sizeof(Mixed) == 32 on x86-64 and arm64
```

`{ pack: n }` (1, 2, 4, 8 or 16) caps alignment at `n` bytes, like `#pragma pack(n)`.

| Type | Natural alignment |
| --- | --- |
| integers, floats, `c.bool` | their size |
| `c.u64`, `c.i64`, `c.f64`, `c.Time64` | 8 |
| `c.wstring` | 2 |
| `c.string`, `c.bytes` | 1 |
| enums, bitfields, `c.bits`, magic numbers | their storage type |
| arrays | their element |
| structs | 1 when packed, else their largest field |
| unions, `c.match` | their largest arm |
| custom `CFieldType` | `getAlign()`, default 1 |

A packed struct nested inside an aligned one has alignment 1, as in C. Layouts are tested against clang output for x86-64, so they match GCC, Clang and MSVC on 64-bit targets.

::: tip 32-bit x86 Linux
The i386 System V ABI aligns 8-byte types to 4. Use `{ pack: 4 }` to match it.
:::

Bit-field packing is covered by [`c.bits`](./field-types/bits.md).

## Offsets

`c.offsetof` works like C `offsetof`, including nested paths and array indexes:

```ts
const Shape = c.struct({
  id: c.u8().padAfter(1),
  points: c.array(c.struct({ x: c.i16(), y: c.i16() }), 3),
});
c.offsetof(Shape, "points[2].y"); // 12
Shape.offsetOf("points.1.x"); // 6
```

## Endianness

Little-endian unless something says otherwise. The most specific setting wins:

1. the field: `c.u32().be()`, `c.u32({ endian: "big" })`, or the same on `c.array(...)`
2. the struct: `c.struct(fields, { endian: "big" })` or `@c.class({ endian: "big" })`
3. the call: `c.read(Schema, bytes, "big")`
4. `"little"`

```ts
const NetworkHeader = c.struct(
  { length: c.u16(), checksum: c.u32().le() },
  { endian: "big" }
);
c.read(NetworkHeader, bytes); // length big-endian, checksum little-endian
```

A struct with its own `endian` ignores the call-site byte order, even when nested.

## Writing into an existing buffer

```ts
const file = Buffer.alloc(1024);
c.write(Header, header, { into: file, offset: 16 });
Header.writeInto(file, header, 16); // same
```

The struct's byte range is zeroed first, so padding and alignment gaps end up zero. `into` must have room for the whole struct.

## Top-level arrays

`c.read`, `c.write` and `c.sizeof` accept `c.array(...)` directly:

```ts
const Points = c.array(Point, 100);
const points = c.read(Points, bytes, { offset: 64 });
```
