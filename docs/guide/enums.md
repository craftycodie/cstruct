# Enums

Map integer wire values to string keys with `c.Enum(map, storage)` or a sequential string array:

```ts
import { c } from "@craftycodie/cstruct";

const Status = {
  Ok: 0,
  Error: 1,
} as const;

const Packet = c.struct({
  status: c.Enum(Status, c.u8()),
});

// Sequential indices 0, 1, 2, …
const Phase = c.struct({
  stage: c.Enum(["Lobby", "Playing", "Postgame"], c.u8()),
});
```

Read and write use the **string key** (`"Ok"`, `"Error"`). Values are validated on read and write. Use `padAfter` on the same field when the layout has trailing padding after a small enum storage type.

**C equivalent** — integer storage with a fixed set of named constants:

```c
typedef enum {
    Status_Ok = 0,
    Status_Error = 1,
} Status;

typedef struct {
    uint8_t status; /* c.Enum(Status, c.u8()) */
} Packet;
```

You can also write the slot as a plain integer and compare against macros:

```c
#define STATUS_OK    0
#define STATUS_ERROR 1

typedef struct {
    uint8_t status;
} Packet;
```

cstruct's `c.Enum()` is the typed version of that pattern: it checks the value is one of the allowed constants on read and write. The storage factory (`c.u8()`, `c.u16()`, …) is the width of the integer field in the struct.

For combinable flag bits in one integer, see [Bitfield](./field-types/bitfield.md).
