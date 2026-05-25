# Wide string — `c.WString(n)`

Fixed-size UTF-16LE wchar slot. The argument `n` is the **character capacity** (byte size is `n * 2`). Reads and writes little-endian UTF-16 unless the buffer looks like mis-encoded UTF-8 (see implementation notes in source).

```ts
@c.struct()
class Label {
  @c.field(c.WString(32))
  text!: string;
}
```

**C equivalent** (64 bytes on disk):

```c
typedef struct {
    wchar_t text[32]; /* UTF-16 code units, NUL-terminated; 32 × 2 = 64 bytes */
} Label;
```

On platforms where `wchar_t` is not 16-bit, the same layout is `uint16_t text[32];`.
