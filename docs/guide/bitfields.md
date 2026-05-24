# Bitfield enums

Flag groups packed into an integer primitive use `c.bitfield(storage, flags)`. Each flag is a **boolean** on read/write; the codec packs them into sequential or explicit bit indices.

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
// wire u32 = 0b101 (bits 0 and 2 set: iron + tough_luck)
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

## Reserved bits

By default, **unknown wire bits are preserved logically** on read (each named flag still decodes correctly). They are cleared on write because only named flags are packed.

To reject wire values with bits outside your definition:

```ts
@c.field(c.bitfield("u8", DifficultyFlags, { strict: true }))
difficulty!: c.Bitfield<typeof DifficultyFlags>;
```

## Standalone pack/unpack

Outside a struct field:

```ts
import { bitfield_from_raw, bitfield_to_raw, create_bitfield_field } from "@craftycodie/cstruct";

const field = create_bitfield_field("u32", SkullFlags);
const raw = bitfield_to_raw({ iron: true, tough_luck: false }, field, "skulls");
const flags = bitfield_from_raw(raw, field);
```

## vs `c.enum`

| | `c.enum` | `c.bitfield` |
| --- | --- | --- |
| Wire value | One of N discrete values | Bit mask (combinable flags) |
| TypeScript | `number` | `{ flag: boolean, ... }` |
| Validation | Must match a single enum member | Any combination of named bits |
