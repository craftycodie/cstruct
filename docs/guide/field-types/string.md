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

The encoding can be `utf8` (the default), `latin1`, `ascii`, `hex`, `base64` or `base64url`, or an alias Node accepts (`utf-8`, `binary`). Use `"latin1"` for 8-bit text or data that may not be valid UTF-8: utf8 decoding replaces invalid bytes with U+FFFD, so they would not survive a round trip. Without `Buffer` (browsers, Deno), `utf8`, `latin1` and `ascii` are supported.

`c.string` is a byte array (`char[n]`), so `n` is in bytes. UTF-16 text is a `wchar_t` array: use [`c.wstring(n)`](./wstring.md), whose `n` is in characters and whose code units follow the field's byte order. `c.string(n, "utf16le")` throws.

`c.String` is a deprecated alias.
