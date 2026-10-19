# Enums

Map integer wire values to string keys with `c.enum(map, storage)`, or a list of names for sequential values:

```ts
import { c } from "@craftycodie/cstruct";

const Status = { Ok: 0, Error: 1 } as const;

const Packet = c.struct({
  status: c.enum(Status, c.u8()),
  stage: c.enum(["Lobby", "Playing", "Postgame"], c.u8()), // 0, 1, 2
});

type Packet = c.infer<typeof Packet>;
// { status: "Ok" | "Error"; stage: "Lobby" | "Playing" | "Postgame" }
```

Reads and writes use the **key** (`"Ok"`). Unknown values throw on read (`Enum value 7 is not a valid enum value`) and unknown keys throw on write. Storage can be any integer type, including `c.u64()`.

**C equivalent:**

```c
typedef enum { Status_Ok = 0, Status_Error = 1 } Status;

typedef struct {
    uint8_t status; /* c.enum(Status, c.u8()) */
    uint8_t stage;
} Packet;
```

An enum key can select a union arm: `c.match("status", { Ok: OkBody, Error: ErrorBody })`. See [Unions](./unions.md#key-based-union-c-match).

For combinable flags in one integer, see [Bitfield](./field-types/bitfield.md). For multi-bit fields, see [`c.bits`](./field-types/bits.md).

::: info
`c.Enum` is a deprecated alias of `c.enum`. Lowercase factories are C-native types; capitalized ones (`c.Time64`, `c.MagicNumber`, `c.MagicString`) are cstruct extensions.
:::
