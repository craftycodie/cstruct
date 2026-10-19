# Bitfield — `c.Bitfield(flags, storage)`

Boolean flags packed into an integer, read as an object with one boolean per flag. This is a cstruct extension: in C, flags are a plain integer with `#define` masks, which is just `c.u32()` (or another integer type) here.

`flags` is a list of names (bit = position in the list) or a map of name to bit number. Bits never come from object key order, so a definition loaded from JSON has the same layout ([#1](https://github.com/craftycodie/cstruct/issues/1)).

```ts
import { c } from "@craftycodie/cstruct";

const SkullFlags = ["iron", "black_eye", "tough_luck", "catch"] as const; // bits 0–3
const Skulls = c.Bitfield(SkullFlags, c.u32());

const Challenge = c.struct({ skulls: Skulls });

c.write(Challenge, {
  skulls: { iron: true, black_eye: false, tough_luck: true, catch: false },
}); // u32 = 0b101

c.read(Challenge, bytes).skulls; // { iron: true, black_eye: false, tough_luck: true, catch: false }
```

Explicit bits, for sparse or out-of-order flags:

```ts
const Difficulty = c.Bitfield(
  { easy: 0, normal: 1, heroic: 2, legendary: 3, mythic: 9 },
  c.u16()
);
```

**C equivalent:**

```c
#define SKULL_IRON        (1u << 0)
#define SKULL_BLACK_EYE   (1u << 1)
#define SKULL_TOUGH_LUCK  (1u << 2)
#define SKULL_CATCH       (1u << 3)

typedef struct {
    uint32_t skulls; /* iron + tough_luck set: skulls == 0x5 */
} Challenge;
```

Two flags on the same bit, or a bit past the storage width, throw when the field type is created.

## Converting to and from the integer

To exchange values with code that uses the integer (another library, a network protocol, a database column), map between the two:

```ts
Skulls.toRaw({ iron: true, black_eye: false, tough_luck: true, catch: false }); // 5
Skulls.fromRaw(5); // { iron: true, black_eye: false, tough_luck: true, catch: false }
```

Writes also accept the raw integer directly: `c.write(Challenge, { skulls: 5 })`. Raw writes are range-checked like the storage type.

Unnamed bits read as nothing. A flags object writes them as 0; a raw integer is written as given.

## Choosing

| | `c.enum` | `c.Bitfield` | `c.bits` | integer (`c.u32()`) |
| --- | --- | --- | --- | --- |
| Value | One of N values | Combinable 1-bit flags | Several multi-bit numbers | Raw flags |
| TypeScript | key name | `{ flag: boolean }` | `{ field: number }` | `number` |

Storage can be any integer type, including `c.u64()` for up to 64 flags (`toRaw` then returns a `bigint`). For multi-bit fields, use [`c.bits`](./bits.md).
