# Bitfield — `c.bitfield(keys, storage)`

Flag groups packed into an integer. Each flag is a **boolean** on read and write. Bits come from list position or from an explicit map, never from object key order.

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
  skulls: c.bitfield(SkullFlags, c.u32()),
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
    uint32_t skulls; /* c.bitfield(SkullFlags, c.u32()) */
} Challenge;

/* iron + tough_luck set: skulls == 0x5 */
```

## Explicit bits

Map each flag to its bit number when bits are sparse or not in order:

```ts
const Difficulty = c.bitfield(
  { easy: 0, normal: 1, heroic: 2, legendary: 3, mythic: 9 },
  c.u16()
);
```

```c
#define DIFF_EASY      (1u << 0)
#define DIFF_NORMAL    (1u << 1)
#define DIFF_HEROIC    (1u << 2)
#define DIFF_LEGENDARY (1u << 3)
#define DIFF_MYTHIC    (1u << 9)
```

The map's key order does not matter, so a definition loaded from JSON (where key order is not guaranteed) has the same layout. Two flags on the same bit, or a bit past the storage width, throw when the field type is created.

## Reserved bits

Unnamed bits read as `false` for each defined key. On write, only named flags are packed — reserved bits are cleared.

## vs `c.enum`

| | `c.enum` | `c.bitfield` |
| --- | --- | --- |
| Value | One of N discrete values | Bit mask (combinable flags) |
| TypeScript | string key | `{ flag: boolean, ... }` |
| Validation | Must match a single enum member | Any combination of named bits |

For a single true/false byte (not combinable flags), use [Boolean](./bool.md) instead.

Storage can be any integer type, including `c.u64()` for up to 64 flags. Creating a bitfield with more flags than its storage has bits throws.

## Multi-bit fields

For fields wider than one bit, use [`c.bits`](./bits.md). For sparse or unusual layouts, subclass `CFieldType` (see [Custom types](./custom-types.md)).

`c.Bitfield` is a deprecated alias of `c.bitfield`.
