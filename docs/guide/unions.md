# Unions

## Overlapping union (`c.Union`)

C-style unions share one memory slot. All members decode from the same offset:

```ts
const AsU32 = c.struct({ value: c.u32() });
const AsU16Pair = c.struct({ a: c.u16(), b: c.u16() });

const overlap = c.Union({ asU32: AsU32, asU16Pair: AsU16Pair });

const decoded = overlap.read(buffer, 0, "little");
// { asU32: { value: ... }, asU16Pair: { a: ..., b: ... } }
```

Write the first member you provide:

```ts
overlap.write(buffer, 0, { asU32: { value: 42 } }, "little");
```

## Discriminated union (`c.discriminatedUnion`)

A fixed-size slot holds one active arm, chosen from parent fields:

```ts
const FilmArm = c.struct({ seconds: c.i32(), _pad: c.pad(12) });
const VariantArm = c.struct({ icon_index: c.u8(), _pad: c.pad(15) });

const Host = c.struct({
  file_type: c.u8(),
  data: c.discriminatedUnion(
    { size: 16 },
    c.arm(FilmArm, (m) => m.file_type === 3),
    c.when(6, VariantArm, (m) => m.file_type),
  ),
});
```

- `c.arm(schema, when)` — predicate on the parent record
- `c.when(value, schema, discriminant)` — shorthand when discriminant equals `value`
- Inactive arms serialize as `null`; slots are zero-filled on write
- Use `c.UnionOf<typeof arms>` or `c.infer<typeof Host>["data"]` for the decoded arm type — see [Type helpers](./type-helpers.md)

On decorated classes, use `@c.field(c.discriminatedUnion(...))` the same way as any other field type.
