# Bit-fields — `c.bits(spec, storage)`

C bit-fields: named fields of 1 to 32 bits packed into one integer. Values are unsigned numbers.

```ts
import { c } from "@craftycodie/cstruct";

const Packet = c.struct({
  header: c.bits({ version: 3, type: 5, length: 24 }, c.u32()),
});

const packet = c.read(Packet, bytes);
packet.header.length; // number
```

**C equivalent:**

```c
typedef struct {
    uint32_t version : 3;
    uint32_t type    : 5;
    uint32_t length  : 24;
} PacketHeader;
```

Fields are assigned from the least significant bit up, as GCC, Clang and MSVC do on little-endian targets; the layout is tested against clang. The storage type's byte order decides how the integer is stored.

- Storage can be any integer type up to `c.u64()`. A field may cross bit 32 of 64-bit storage.
- All fields share **one** storage unit, so cstruct never splits fields across units the way compilers sometimes do.
- Checked writes reject values wider than their field (`8 does not fit in 3-bit field 'version'`); `{ checked: false }` masks them.

For single-bit boolean flags, see [Bitfield](./bitfield.md).
