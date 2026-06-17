# Unix time — `c.Time64()`

8-byte unsigned seconds since epoch, exposed as `Date` in TypeScript:

```ts
import { c } from "@craftycodie/cstruct";

const Event = c.struct({
  when: c.Time64(),
});
```

**C equivalent:**

```c
typedef struct {
    uint64_t when; /* seconds since 1970-01-01 UTC */
} Event;
```

Use the same endianness as the surrounding struct (`"little"` / `"big"` in `c.read` / `c.write`).
