# Field types

A field type occupies one slot in a struct. Pass a factory result (`c.string(16)`, `c.Time64()`, …) or a [custom `CFieldType`](./custom-types.md) instance as a field value.

| Factory | Decodes to | Guide |
| --- | --- | --- |
| `c.bool()` | `boolean` | [Boolean](./bool.md) |
| `c.string(n, encoding?)` | `string` | [String](./string.md) |
| `c.wstring(n)` | `string` | [Wide string](./wstring.md) |
| `c.bytes(n)` | `Buffer` | [Bytes](./bytes.md) |
| `c.Time64()` | `Date` | [Unix time](./time64.md) |
| `c.bitfield(keys, storage)` | `{ [key]: boolean }` | [Bitfield](./bitfield.md) |
| `c.bits(spec, storage)` | `{ [field]: number }` | [Bit-fields](./bits.md) |
| `c.MagicNumber(n, storage)` / `c.MagicString(s)` | the constant | [Magic fields](./magic.md) |
| `c.enum(map, storage)` | key names | [Enums](../enums.md) |

Each factory has a class exported from the package root (`CBool`, `CString`, `CWString`, `CBytes`, `time64_t`, `CBitfield`, `CBits`, `CMagicNumber`, `CMagicString`, `CEnum`) for `instanceof` checks.

## Full struct example

```ts
const ContentItemHistory = c.struct({
  timestamp: c.Time64(),
  xuid: c.u64(),
  name: c.string(16),
  is_online: c.u8().padAfter(3),
});
```

```c
#pragma pack(push, 4)
typedef struct {
    int64_t  timestamp;   /* c.Time64()   — offset 0 */
    uint64_t xuid;        /* c.u64()      — offset 8 */
    char     name[16];    /* c.string(16) — offset 16 */
    uint8_t  is_online;   /* c.u8()       — offset 32, then 3 bytes padding */
} ContentItemHistory;     /* 36 bytes */
#pragma pack(pop)
```

`padAfter(3)` spells out the three bytes the compiler adds. `c.struct(fields, { pack: 4 })` inserts them automatically; see [Layout](../layout.md#alignment).
