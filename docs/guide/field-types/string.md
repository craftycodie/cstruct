# String — `c.string(n, encoding?)`

Fixed-size character array. `n` is the **byte size** of the slot (`sizeof` of the C array). Reads stop at the first NUL byte. Writes truncate to `n` bytes without splitting a character and zero-fill the rest.

```ts
import { c } from "@craftycodie/cstruct";

const Tag = c.struct({
  name: c.string(16), // utf8
  gamertag: c.string(16, "latin1"), // one byte per character
});
```

**C equivalent:**

```c
typedef struct {
    char name[16];
    char gamertag[16];
} Tag;
```

The encoding can be any Node `BufferEncoding`; utf8 is the default. Use `"latin1"` for 8-bit text or data that may not be valid UTF-8: utf8 decoding replaces invalid bytes with U+FFFD, so they would not survive a round trip. Without `Buffer` (browsers, Deno), `utf8`, `latin1`, `ascii` and `utf16le` are supported.

`c.String` is a deprecated alias.
