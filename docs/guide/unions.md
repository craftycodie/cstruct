# Unions

Discriminated unions pick an arm at read/write time from other fields on the parent struct.

```ts
@c.struct()
class ArmA {
  @c.field("u8")
  value!: number;

  @c.field(c.pad(3))
  private _pad!: never;
}

@c.struct()
class Host {
  @c.field("u8")
  kind!: number;

  @c.union({ size: 4 }, c.arm(ArmA, (m: Host) => m.kind === 1))
  data: ArmA | null = null;
}
```

Annotate the host type in arm predicates so TypeScript knows which fields exist (`m: Host`).

## Shorthand: `c.when`

Constant discriminant:

```ts
@c.union({ size: 4 }, c.when(1, ArmA, (m) => m.kind))
```

## `c.unionField`

Same layout inside `@c.field` when the union is not a standalone property:

```ts
@c.field(
  c.unionField({ size: 4 }, c.arm(ArmA, (m: Host) => m.kind === 1))
)
data: ArmA | null = null;
```

When no arm matches, the union slot is treated as padding and the property is `null`.
