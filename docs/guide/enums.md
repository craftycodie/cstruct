# Enums

Map integer values to a fixed set with `c.enum(storage, map)`:

```ts
const Status = {
  Ok: 0,
  Error: 1,
} as const;

@c.struct()
class Packet {
  @c.field(c.enum("u8", Status))
  status!: number;
}
```

Values are validated on read and write. Use `pad_after` on the same field when the layout has trailing padding after a small enum storage type.

**C equivalent** — integer storage with a fixed set of named constants:

```c
typedef enum {
    Status_Ok = 0,
    Status_Error = 1,
} Status;

typedef struct {
    uint8_t status; /* c.enum("u8", Status) */
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

cstruct’s `c.enum()` is the typed version of that pattern: it checks the value is one of the allowed constants on read and write. The storage type (`u8`, `u16`, …) is the width of the integer field in the struct.

For combinable flag bits in one integer, see [Bitfield](./advanced-fields/bitfield.md).
