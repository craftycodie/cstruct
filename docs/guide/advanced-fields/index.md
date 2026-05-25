# Advanced fields

Advanced fields occupy one packed slot in a struct. Pass a factory (`c.Bool`, `c.String`, `c.Time64`, …) or an instance to `@c.field`. Multi-field layouts should use `@c.struct` instead.

## Built-in types

| Type | Guide |
| --- | --- |
| Custom `c.AdvancedType` | [Custom types](./custom-types.md) |
| `c.Bool()` | [Boolean](./bool.md) |
| `c.String(n)` | [Latin-1 string](./string.md) |
| `c.WString(n)` | [Wide string](./wstring.md) |
| `c.Time64()` | [Unix time](./time64.md) |
| `c.bitfield(storage, flags)` | [Bitfield](./bitfield.md) |

Factories: `c.Bool`, `c.String`, `c.WString`, `c.Time64`, and `c.bitfield`. Classes: `c.CBool`, `c.CString`, `c.CWString`, `c.CTime64`, and `c.CBitfield` (same wire format; use for `instanceof` checks).

## Full struct example

TypeScript layout from [Example structures](../example-structures.md#author--history-slot-36-bytes) and the matching C mental model:

```ts
@c.struct()
class ContentItemHistory {
  @c.field(c.Time64())
  timestamp!: Date;

  @c.field("u64")
  xuid!: bigint;

  @c.field(c.String(16))
  name!: string;

  @c.field("u8", { pad_after: 3 })
  is_online!: number; /* pad_after mirrors C trailing padding for 4-byte alignment */
}
```

```c
#pragma pack(push, 4)

typedef struct {
    uint64_t timestamp;   /* c.Time64() — offset 0 */
    uint64_t xuid;        /* c.field("u64") — offset 8 */
    char     name[16];    /* c.String(16) — offset 16 */
    uint8_t  is_online;   /* c.field("u8") — offset 32 */
    /* 3 bytes implicit padding (offsets 33–35); compiler inserts this
       so sizeof(ContentItemHistory) is a multiple of 4 (36 bytes total) */
} ContentItemHistory;

#pragma pack(pop)
```

The explicit `pad_after: 3` in TypeScript matches those three alignment bytes — you are not reserving a separate named `_pad` field in the on-disk layout.
