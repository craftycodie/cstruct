# Boolean — `c.bool()`

One byte: `0` reads as false and any other value as true. Writes `0` or `1`.

```ts
import { c } from "@craftycodie/cstruct";

const AuthorFlags = c.struct({
  is_online: c.bool(),
});
```

**C equivalent:**

```c
typedef struct {
    uint8_t is_online; /* 0 = false, non-zero = true */
} AuthorFlags;
```

For combinable flag bits in one integer, use [Bitfield](./bitfield.md).
