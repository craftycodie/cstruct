# 64-bit integers — `c.U64()` / `c.I64()`

8-byte unsigned (`u64`) or signed (`i64`) integers, exposed as `bigint` in TypeScript. JSON uses decimal strings (JavaScript `bigint` is not JSON-native).

```ts
@c.struct()
class Record {
  @c.field(c.U64())
  xuid!: bigint;

  @c.field(c.I64())
  offset!: bigint;
}
```

**C equivalent:**

```c
typedef struct {
    uint64_t xuid;
    int64_t  offset;
} Record;
```

Use primitive `"u64"` / `"i64"` only when the layout is binary-only (no `c.toJson` / `c.fromJson`). For JSON I/O, use `c.U64()` / `c.I64()`.

See [JSON encoding](/guide/json) for string round-trip.
