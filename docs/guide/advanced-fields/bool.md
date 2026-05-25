# Boolean — `c.Bool()`

One byte: `0` is false, any non-zero byte reads as true; writes `0` or `1` (matches blf_lib `Bool`):

```ts
@c.struct()
class AuthorFlags {
  @c.field(c.Bool())
  is_online!: boolean;
}
```

**C equivalent:**

```c
typedef struct {
    uint8_t is_online; /* 0 = false, non-zero = true */
} AuthorFlags;
```

(`bool is_online` is also one byte on most ABIs, but game formats usually use an explicit integer type.)

For combinable flag bits in one integer, use [Bitfield](./bitfield.md) instead.
