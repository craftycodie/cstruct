# Unix time — `c.Time64()`

8-byte signed seconds since the Unix epoch, exposed as a `Date`. Writes truncate to whole seconds.

```ts
import { c } from "@craftycodie/cstruct";

const Event = c.struct({
  when: c.Time64(),
});
```

**C equivalent:**

```c
typedef struct {
    int64_t when; /* time_t: seconds since 1970-01-01 UTC */
} Event;
```

Byte order follows the field, struct or call like any other field.
