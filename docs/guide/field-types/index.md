# Field types

Field types occupy one packed slot in a struct. Pass a factory (`c.Bool()`, `c.String()`, `c.Time64()`, …) or a `CFieldType` instance as a field value.

## Built-in types

| Type | Guide |
| --- | --- |
| Custom `CFieldType` | [Custom types](./custom-types.md) |
| `c.Bool()` | [Boolean](./bool.md) |
| `c.String(n)` | [Latin-1 string](./string.md) |
| `c.WString(n)` | [Wide string](./wstring.md) |
| `c.Time64()` | [Unix time](./time64.md) |
| `c.Bitfield(keys, storage)` | [Bitfield](./bitfield.md) |
| `c.MagicNumber(n, type)` / `c.MagicString(s)` | [Magic fields](./magic.md) |

Factories: `c.Bool`, `c.String`, `c.WString`, `c.Time64`, `c.Bitfield`, `c.MagicNumber`, and `c.MagicString`. Classes: `CBool`, `CString`, `CWString`, `CBitfield`, `CMagicNumber`, and `CMagicString` (same wire format; use for `instanceof` checks).

## Full struct example

TypeScript layout from [Example structures](../example-structures.md#author--history-slot-36-bytes) and the matching C mental model:

```ts
const ContentItemHistory = c.struct({
  timestamp: c.Time64(),
  xuid: c.u64(),
  name: c.String(16),
  is_online: c.u8({ padAfter: 3 }),
});
```

```c
#pragma pack(push, 4)

typedef struct {
    uint64_t timestamp;   /* c.Time64() — offset 0 */
    uint64_t xuid;        /* c.u64() — offset 8 */
    char     name[16];    /* c.String(16) — offset 16 */
    uint8_t  is_online;   /* c.u8() — offset 32 */
    /* 3 bytes implicit padding (offsets 33–35); compiler inserts this
       so sizeof(ContentItemHistory) is a multiple of 4 (36 bytes total) */
} ContentItemHistory;

#pragma pack(pop)
```

The explicit `padAfter: 3` in TypeScript matches those three alignment bytes — you are not reserving a separate named `_pad` field in the on-disk layout.
