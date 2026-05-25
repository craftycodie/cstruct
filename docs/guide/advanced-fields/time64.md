# Unix time — `c.Time64()`

8-byte unsigned seconds since epoch, exposed as `Date` in TypeScript (`bigint` on the wire as `u64`):

```ts
@c.struct()
class Event {
  @c.field(c.Time64())
  when!: Date;
}
```

**C equivalent:**

```c
typedef struct {
    uint64_t when; /* seconds since 1970-01-01 UTC */
} Event;
```

Use the same endianness as the surrounding struct (`"little"` / `"big"` in `c.read` / `c.write`).
