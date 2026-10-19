# Bitfields — `c.bitfield` / `c.Bitfield`

Flags packed into an integer, in two forms:

| Factory | Decodes to | Like C |
| --- | --- | --- |
| `c.bitfield(flags, storage)` | the storage integer (`number`, or `bigint` for 64-bit) | `uint32_t skulls` with `#define` masks |
| `c.Bitfield(flags, storage)` | `{ flag: boolean, ... }` | a cstruct extension |

`flags` is a list of names (bit = position in the list) or a map of name to bit number. Bits never come from object key order, so a definition loaded from JSON has the same layout ([#1](https://github.com/craftycodie/cstruct/issues/1)).

```ts
import { c } from "@craftycodie/cstruct";

const SkullFlags = ["iron", "black_eye", "tough_luck", "catch"] as const; // bits 0–3
const DifficultyFlags = { easy: 0, normal: 1, heroic: 2, mythic: 9 } as const; // explicit bits
```

```c
#define SKULL_IRON        (1u << 0)
#define SKULL_BLACK_EYE   (1u << 1)
#define SKULL_TOUGH_LUCK  (1u << 2)
#define SKULL_CATCH       (1u << 3)
```

Two flags on the same bit, or a bit past the storage width, throw when the field type is created.

## Integer flags — `c.bitfield`

The field reads and writes the storage integer, as C code holds it. `.mask` gives each flag's bit:

```ts
const Skulls = c.bitfield(SkullFlags, c.u32());
const Challenge = c.struct({ skulls: Skulls });

const { skulls } = c.read(Challenge, bytes); // number
if (skulls & Skulls.mask.iron) {
  // iron is set
}

c.write(Challenge, { skulls: Skulls.mask.iron | Skulls.mask.tough_luck }); // 0b101
```

`Skulls.toFlags(raw)` and `Skulls.fromFlags({ iron: true, ... })` convert to and from a flags object. Writes are range-checked like the storage type.

## Flag objects — `c.Bitfield`

The field reads an object with one boolean per flag:

```ts
const Skulls = c.Bitfield(SkullFlags, c.u32());
const Challenge = c.struct({ skulls: Skulls });

c.write(Challenge, {
  skulls: { iron: true, black_eye: false, tough_luck: true, catch: false },
}); // u32 = 0b101

c.read(Challenge, bytes).skulls; // { iron: true, black_eye: false, ... }
```

To exchange values with code that uses the integer (another library, a network protocol, a database column), map between the two:

```ts
Skulls.toRaw({ iron: true, black_eye: false, tough_luck: true, catch: false }); // 5
Skulls.fromRaw(5); // { iron: true, black_eye: false, tough_luck: true, catch: false }
```

Writes also accept the raw integer directly: `c.write(Challenge, { skulls: 5 })`.

Unnamed bits read as nothing. A flags object writes them as 0; a raw integer is written as given.

## Choosing

| | `c.enum` | `c.bitfield` / `c.Bitfield` | `c.bits` |
| --- | --- | --- | --- |
| Value | One of N values | Combinable 1-bit flags | Several multi-bit numbers |
| TypeScript | key name | integer / `{ flag: boolean }` | `{ field: number }` |

Storage can be any integer type, including `c.u64()` for up to 64 flags (values are then `bigint`). For multi-bit fields, use [`c.bits`](./bits.md).
