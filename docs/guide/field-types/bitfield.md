# Bitfield — `c.Bitfield(keys, storage)`

Flag groups packed into an integer primitive. Each flag is a **boolean** on read/write; cstruct packs them into **sequential** bit indices inside the storage width (`c.u8()`, `c.u32()`, …).

## Sequential flags

Bit index equals array position (first name → bit 0, second → bit 1, and so on):

```ts
import { c } from "@craftycodie/cstruct";

const SkullFlags = [
  "iron",
  "black_eye",
  "tough_luck",
  "catch",
] as const;

const Challenge = c.struct({
  skulls: c.Bitfield(SkullFlags, c.u32()),
});

const chunk = {
  skulls: {
    iron: true,
    black_eye: false,
    tough_luck: true,
    catch: false,
  },
};

const bytes = c.write(Challenge, chunk, "big");
// u32 = 0b101 (bits 0 and 2 set: iron + tough_luck)
```

**C equivalent** — sequential bit indices (array position → bit number):

```c
#define SKULL_IRON        (1u << 0)
#define SKULL_BLACK_EYE   (1u << 1)
#define SKULL_TOUGH_LUCK  (1u << 2)
#define SKULL_CATCH       (1u << 3)

typedef struct {
    uint32_t skulls; /* c.Bitfield(SkullFlags, c.u32()) */
} Challenge;

/* iron + tough_luck set: skulls == 0x5 */
```

## Reserved bits

Unnamed bits read as `false` for each defined key. On write, only named flags are packed — reserved bits are cleared.

## vs `c.Enum`

| | `c.Enum` | `c.Bitfield` |
| --- | --- | --- |
| Value | One of N discrete values | Bit mask (combinable flags) |
| TypeScript | string key | `{ flag: boolean, ... }` |
| Validation | Must match a single enum member | Any combination of named bits |

For a single true/false byte (not combinable flags), use [Boolean](./bool.md) instead.

## Custom bit layouts

v2 only supports sequential bit indices. For sparse or non-sequential layouts, subclass `CFieldType` (see [Custom types](./custom-types.md)) and implement your own packing rules.
