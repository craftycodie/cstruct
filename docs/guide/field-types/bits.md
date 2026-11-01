# Bit-fields — `c.bits(spec, storage)`

C bit-fields: named fields of 1 to 32 bits packed into one integer. Values are unsigned numbers.

Define fields as a list of `[name, width]` pairs, packed from bit 0 up in list order:

```ts
import { c } from "@craftycodie/cstruct";

const Packet = c.struct({
  header: c.bits(
    [
      ["version", 3],
      ["type", 5],
      ["length", 24],
    ],
    c.u32()
  ),
});

const packet = c.read(Packet, bytes);
packet.header.length; // number
```

Or give each field an explicit position. Gaps between fields are allowed:

```ts
c.bits(
  {
    version: { bit: 0, width: 3 },
    type: { bit: 3, width: 5 },
    length: { bit: 8, width: 24 },
  },
  c.u32()
);
```

**C equivalent:**

```c
typedef struct {
    uint32_t version : 3;
    uint32_t type    : 5;
    uint32_t length  : 24;
} PacketHeader;
```

::: info Why not `{ version: 3, type: 5 }`?
Bit positions never come from object key order. JSON does not guarantee key order, stores such as Postgres `jsonb` reorder keys, and JavaScript lists integer-like keys (`"1"`, `"2"`) before all others. A list or explicit bits gives the same layout wherever the definition comes from.
:::

Bit 0 is the least significant bit, as GCC, Clang and MSVC assign bit-fields on little-endian targets; the layout is tested against clang. The storage type's byte order decides how the integer is stored.

- Storage can be any integer type up to `c.u64()`. A field may cross bit 32 of 64-bit storage.
- All fields share **one** storage unit, so cstruct never splits fields across units the way compilers sometimes do.
- Overlapping fields, duplicate names and fields past the storage width throw when the field type is created.
- Checked writes reject values wider than their field (`8 does not fit in 3-bit field 'version'`); `{ checked: false }` masks them.

For single-bit boolean flags, see [Bitfield](./bitfield.md).
