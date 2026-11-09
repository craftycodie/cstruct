# Enums

`c.enum(values, storage)` stores an enum in an integer field. Like zod 4's `z.enum`, it takes a TypeScript `enum`, an object of named numbers, or a list of names:

```ts
import { c } from "@craftycodie/cstruct";

enum FileType {
  Film = 3,
  GameVariant = 6,
}

const Status = { Ok: 0, Error: 1 } as const;

const Packet = c.struct({
  file_type: c.enum(FileType, c.i8()),
  status: c.enum(Status, c.u8()),
  stage: c.enum(["Lobby", "Playing", "Postgame"], c.u8()), // stored as 0, 1, 2
});

type Packet = c.infer<typeof Packet>;
// { file_type: FileType; status: 0 | 1; stage: "Lobby" | "Playing" | "Postgame" }

c.write(Packet, { file_type: FileType.Film, status: Status.Error, stage: "Playing" });
```

- A TypeScript enum or an object reads and writes its **member values** (`FileType.Film`, which is `3`). A TypeScript enum's reverse mapping (`FileType[3] === "Film"`) is not a member.
- A list reads and writes the **names**, stored as their index.
- Any other value throws on read (`99 is not a valid enum value`) and on write.
- Every member must be a number: string members cannot be stored in an integer, and `c.enum` throws when created. Storage can be any integer type, including `c.u64()`.

**C equivalent:**

```c
typedef enum { FileType_Film = 3, FileType_GameVariant = 6 } FileType;

typedef struct {
    int8_t file_type; /* c.enum(FileType, c.i8()) */
    uint8_t status;
    uint8_t stage;
} Packet;
```

An enum field can select a union arm: `c.match("file_type", { [FileType.Film]: Film, [FileType.GameVariant]: Variant })`. See [Unions](./unions.md#key-based-union-c-match).

For combinable flags in one integer, see [Bitfield](./field-types/bitfield.md). For multi-bit fields, see [`c.bits`](./field-types/bits.md).

::: info
`c.Enum` is a deprecated alias of `c.enum`. Lowercase factories are C-native types; capitalized ones (`c.Time64`, `c.MagicNumber`, `c.MagicString`) are cstruct extensions.
:::
