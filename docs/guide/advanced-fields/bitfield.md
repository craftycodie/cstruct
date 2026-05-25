# Bitfield — `c.bitfield(storage, flags)`

Flag groups packed into an integer primitive are an [advanced field](./index.md): `c.bitfield()` returns a `c.CBitfield` instance (subclass of `c.AdvancedType`). Each flag is a **boolean** on read/write; the codec packs them into sequential or explicit bit indices inside the storage width (`u8`, `u32`, …).

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

@c.struct()
class Challenge {
  @c.field(c.bitfield("u32", SkullFlags))
  skulls!: c.Bitfield<typeof SkullFlags>;
}

const chunk = {
  skulls: {
    iron: true,
    black_eye: false,
    tough_luck: true,
    catch: false,
  },
} satisfies Challenge;

const bytes = c.write(Challenge, chunk, "big");
// u32 = 0b101 (bits 0 and 2 set: iron + tough_luck)
```

**C equivalent** — sequential bit indices (array position → bit number). A single storage integer plus named masks is the usual portable pattern:

```c
#define SKULL_IRON        (1u << 0)
#define SKULL_BLACK_EYE   (1u << 1)
#define SKULL_TOUGH_LUCK  (1u << 2)
#define SKULL_CATCH       (1u << 3)

typedef struct {
    uint32_t skulls; /* c.bitfield("u32", SkullFlags) */
} Challenge;

/* iron + tough_luck set: skulls == 0x5 */
```

## Explicit bit indices

Use a `as const` map when bits are sparse or non-sequential:

```ts
const DifficultyFlags = {
  easy: 0,
  normal: 1,
  heroic: 2,
  legendary: 3,
} as const;

@c.struct()
class Challenge {
  @c.field(c.bitfield("u8", DifficultyFlags))
  difficulty!: c.Bitfield<typeof DifficultyFlags>;
}
```

**C equivalent** — sparse indices from the `as const` map:

```c
#define DIFF_EASY       (1u << 0)
#define DIFF_NORMAL     (1u << 1)
#define DIFF_HEROIC     (1u << 2)
#define DIFF_LEGENDARY  (1u << 3)

typedef struct {
    uint8_t difficulty; /* c.bitfield("u8", DifficultyFlags) */
} Challenge;

/* Test flags:  difficulty & DIFF_HEROIC */
/* Set flags:     difficulty |= DIFF_EASY | DIFF_NORMAL */
/* Clear flags:   difficulty &= ~DIFF_LEGENDARY */
```

cstruct exposes each name as a `boolean` on read/write; in C you combine flags with `|`, `&`, and `~` on the integer.

## Reserved bits

By default, **unknown bits are preserved logically** on read (each named flag still decodes correctly). They are cleared on write because only named flags are packed.

To reject values with bits outside your definition:

```ts
@c.field(c.bitfield("u8", DifficultyFlags, { strict: true }))
difficulty!: c.Bitfield<typeof DifficultyFlags>;
```

## vs `c.enum`

| | `c.enum` | `c.bitfield` |
| --- | --- | --- |
| Value | One of N discrete values | Bit mask (combinable flags) |
| TypeScript | `number` | `{ flag: boolean, ... }` |
| Validation | Must match a single enum member | Any combination of named bits |
| Implementation | Integer slot + enum map | `c.CBitfield` (`c.AdvancedType`) |

For a single true/false byte (not combinable flags), use [Boolean](./bool.md) instead.

## Looking for Feedback

This Bitfield Advanced Type is quite opinionated and in practice it doesn't comfortably suit all applications. In particular, we've found it cumbersome when integrating with other binary serialization libraries for multi-format structures. 

If you have any better ideas we suggest that you extend the AdvancedType class and implement your own take on this.
If it goes well, consider contributing back here!
