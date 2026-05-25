# Latin-1 string — `c.String(n)`

Fixed-size, NUL-terminated Latin-1 (one byte per character, not UTF-8). The argument `n` is the **byte size** of the whole slot (same as `sizeof` the C array).

```ts
@c.struct()
class Tag {
  @c.field(c.String(16))
  name!: string;
}
```

**C equivalent:**

```c
typedef struct {
    char name[16]; /* Latin-1 bytes, NUL-terminated within the 16-byte slot */
} Tag;
```

A value like `"Player1"` occupies the first 7 bytes (`'P' 'l' 'a' 'y' 'e' 'r' '1' '\0'`); the rest of the array is unused padding inside the field.
