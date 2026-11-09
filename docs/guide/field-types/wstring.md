# Wide string — `c.wstring(n)`

Fixed-size UTF-16 array. `n` is the **character capacity**; the slot is `n * 2` bytes. Code units follow the field's byte order, so a big-endian struct stores UTF-16BE. Reads stop at the first NUL code unit.

```ts
import { c } from "@craftycodie/cstruct";

const Label = c.struct({
  text: c.wstring(32), // 64 bytes
});
```

**C equivalent:**

```c
typedef struct {
    uint16_t text[32]; /* wchar_t where it is 16-bit */
} Label;
```

`c.WString` is a deprecated alias.
