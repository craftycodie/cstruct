# Type helpers

cstruct exposes TypeScript utilities for deriving decoded shapes from schemas.

## `c.infer<T>`

Extract the TypeScript type produced by a schema or field factory:

```ts
import { c } from "@craftycodie/cstruct";

const Point = c.struct({
  x: c.i16(),
  y: c.i16(),
});

type Point = c.infer<typeof Point>;
// { x: number; y: number }

type Seconds = c.infer<ReturnType<typeof c.u32>>; // number
type Id = c.infer<ReturnType<typeof c.u64>>; // bigint
type When = c.infer<ReturnType<typeof c.Time64>>; // Date
```

Use `c.infer` on decorated class property types when a field embeds another schema:

```ts
@c.class()
class Entity {
  @c.field(c.u32())
  id!: number;

  @c.field(Point)
  position!: c.infer<typeof Point>;
}
```

`c.infer` also works on individual field factories:

```ts
const skulls = c.Bitfield(["iron", "mythic"], c.u8());
type Skulls = c.infer<typeof skulls>;
// { iron: boolean; mythic: boolean }
```

## `c.UnionOf<Arms>`

Resolve the active payload type for a discriminated union arm list. Most callers get this automatically on the parent struct field; use `c.UnionOf` when building wrapper types:

```ts
const FilmArm = c.struct({ seconds: c.i32(), _pad: c.pad(12) });
const VariantArm = c.struct({ icon_index: c.u8(), _pad: c.pad(15) });

const arms = [
  c.when(3, FilmArm, (m) => m.file_type),
  c.when(6, VariantArm, (m) => m.file_type),
] as const;

type FileData = c.UnionOf<typeof arms>;
// { seconds: number; _pad: undefined } | { icon_index: number; _pad: undefined }

const Host = c.struct({
  file_type: c.u8(),
  data: c.discriminatedUnion({ size: 16 }, ...arms),
});

type HostData = c.infer<typeof Host>["data"];
// FileData | null
```

Inactive arms decode as `null`. See [Unions](./unions.md).

## Exported classes

For runtime checks or custom extensions, the package also exports:

| Export | Use |
| --- | --- |
| `CFieldType` | Base class for custom field types |
| `isCFieldType`, `isCArray`, `isCDiscriminatedUnion` | Type guards |
| `CStructField`, `CClassField` | Low-level field metadata |

See [Custom types](./field-types/custom-types.md).
