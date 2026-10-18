# Unions

## Key-based union (`c.match`)

A slot whose type depends on a value elsewhere in the record, the common tagged-union pattern:

```ts
const Film = c.struct({ seconds: c.i32() });
const Variant = c.struct({ icon_index: c.u8() });

const Metadata = c.struct({
  general: c.struct({ file_type: c.u8() }),
  file_type_data: c.match("general.file_type", { 3: Film, 4: Film, 6: Variant }),
});

type Data = c.infer<typeof Metadata>["file_type_data"];
// { seconds: number } | { icon_index: number } | null
```

- The first argument is a dot path into the record being read or written. Only fields **before** the union are available on read.
- Keys are compared as strings, so numeric codes, enum keys (`{ Film: ..., Variant: ... }` with a `c.enum` discriminant) and bigints all work.
- An unknown discriminant reads as `null`. Writing `null` (or leaving the field out) zero-fills the slot.
- The slot is as large as the largest arm. Unused bytes are zero on write.

Options:

```ts
c.match("kind", { 1: A, 2: B }, {
  size: 16, // fixed slot size (must fit the largest arm)
  fallback: Unknown, // arm for any other discriminant, instead of null
});
```

**C equivalent:**

```c
typedef struct {
    struct { uint8_t file_type; } general;
    union {
        struct { int32_t seconds; } film;      /* file_type 3 or 4 */
        struct { uint8_t icon_index; } variant; /* file_type 6 */
    } file_type_data;
} Metadata;
```

## Predicate union (`c.discriminatedUnion`)

When the arm depends on more than one value, select it with predicates:

```ts
const Host = c.struct({
  file_type: c.u8(),
  activity: c.u8(),
  data: c.discriminatedUnion(
    { size: 16 },
    c.arm(FilmArm, (m) => m.file_type === 3 && m.activity !== 0),
    c.when(6, VariantArm, (m) => m.file_type as number)
  ),
});
```

- `c.arm(schema, when)`: predicate on the parent record
- `c.when(value, schema, discriminant)`: shorthand for `discriminant(parent) === value`

Prefer `c.match` where a single field decides: its discriminant needs no casts.

## Overlapping union (`c.union`)

A C union where every member decodes from the same bytes:

```ts
const AsU32 = c.struct({ value: c.u32() });
const AsU16Pair = c.struct({ a: c.u16(), b: c.u16() });

const Overlap = c.struct({ word: c.union({ asU32: AsU32, asU16Pair: AsU16Pair }) });

c.read(Overlap, bytes).word;
// { asU32: { value: ... }, asU16Pair: { a: ..., b: ... } }
```

On write, the first member present in the value is written. A member that fails to decode (for example a magic mismatch) reads as `undefined`.

`c.Union` is a deprecated alias of `c.union`.
