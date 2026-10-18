# Bytes — `c.bytes(n)`

Raw fixed-length bytes for hashes, GUIDs and opaque blobs. Reads return a copy as a `Buffer` (a `Uint8Array` where `Buffer` does not exist), so changing it never touches the source.

```ts
import { c } from "@craftycodie/cstruct";

const Entry = c.struct({
  sha1: c.bytes(20),
  size: c.u32(),
});

const entry = c.read(Entry, bytes);
entry.sha1.toString("hex");

c.write(Entry, { sha1: new Uint8Array(20), size: 0 });
```

Writes accept any `Buffer`, `Uint8Array`, `ArrayBuffer` or `DataView`. Shorter input is zero-padded. Longer input throws (`24 bytes do not fit in bytes(20)`) unless the write uses `{ checked: false }`, which truncates.

**C equivalent:**

```c
typedef struct {
    uint8_t  sha1[20];
    uint32_t size;
} Entry;
```

Prefer `c.bytes(n)` to `c.u8().array(n)` for data you do not inspect element by element: it reads as one buffer instead of an array of numbers.
