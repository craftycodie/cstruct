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

**C equivalent** — a tag field plus a fixed-size `union` over the arm layouts. The union slot is always 4 bytes; only one arm is meaningful at a time:

```c
typedef struct {
    uint8_t value;
    uint8_t _pad[3]; /* c.pad(3) */
} ArmA;

typedef struct {
    uint8_t kind; /* discriminant — read this first */
    union {
        ArmA a;           /* active when kind == 1 */
        uint8_t raw[4];   /* same 4 bytes when no arm matches */
    } data;
} Host;
```

`c.union({ size: 4 }, …)` reserves those four bytes in the parent struct. When no arm predicate matches, cstruct leaves the bytes as padding and sets the property to `null` — in C you would ignore `data` or treat it as uninitialized for that tag value.

A layout with multiple arms and a larger slot (see [Example structures](./example-structures.md#content-metadata-nested-struct--unions--wide-strings)) matches the same idea: one discriminant elsewhere on the struct, then a `union { … }` sized to the largest arm (16 bytes in that example).

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
