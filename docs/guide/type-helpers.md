# Type helpers

## `c.infer<T>` / `c.output<T>`

The decoded type of a schema or field: what `c.read` returns. `c.output` is an alias.

```ts
import { c } from "@craftycodie/cstruct";

const Point = c.struct({ x: c.i16(), y: c.i16() });

type Point = c.infer<typeof Point>; // { x: number; y: number }

type Seconds = c.infer<ReturnType<typeof c.u32>>; // number
type Id = c.infer<ReturnType<typeof c.u64>>; // bigint
type When = c.infer<ReturnType<typeof c.Time64>>; // Date

const skulls = c.bitfield(["iron", "mythic"], c.u8());
type Skulls = c.infer<typeof skulls>; // { iron: boolean; mythic: boolean }
```

Padding fields are left out. Arrays below 100 elements infer as tuples. `c.class(Ctor)` fields infer as the class's instance type.

## `c.input<T>`

The accepted write type, which can be looser than the decoded type:

| Field | In `c.input` |
| --- | --- |
| `c.pad(n)` | omitted |
| `c.MagicNumber` / `c.MagicString` | optional (the constant is written) |
| `.default(value)` | optional |
| `c.match` / `c.discriminatedUnion` | optional; `null` or missing zero-fills |
| `c.bytes(n)` | any `Buffer`, `Uint8Array`, `ArrayBuffer` or `DataView` |
| `c.class(Ctor)` | the class's data properties (methods dropped) |
| arrays | readonly tuples or arrays |

```ts
const Header = c.struct({
  magic: c.MagicString("HDR1"),
  version: c.u8().default(1),
  _reserved: c.pad(3),
  hash: c.bytes(4),
});

type HeaderIn = c.input<typeof Header>;
// { hash: Buffer | Uint8Array | ArrayBuffer | DataView; magic?: "HDR1"; version?: number }

c.write(Header, { hash: new Uint8Array(4) });
```

`c.write(schema, data)` and `schema.write(data)` take `c.input`.

## `c.UnionOf<Arms>`

The payload type of a `c.discriminatedUnion` arm list, for wrapper types:

```ts
const FilmArm = c.struct({ seconds: c.i32(), _pad: c.pad(12) });
const VariantArm = c.struct({ icon_index: c.u8(), _pad: c.pad(15) });

const arms = [
  c.when(3, FilmArm, (m) => m.file_type as number),
  c.when(6, VariantArm, (m) => m.file_type as number),
] as const;

type FileData = c.UnionOf<typeof arms>;
// { seconds: number } | { icon_index: number }
```

## Generic code

Every struct is assignable to the wide `c.Struct` type:

```ts
function describe(schema: c.Struct) {
  return `${schema.size} bytes`;
}
```

## Exported classes

For `instanceof` checks and extensions, the package root exports the field type classes (`CFieldType`, `CNumber`, `CBigint`, `CBool`, `CString`, `CWString`, `CBytes`, `CEnum`, `CBitfield`, `CBits`, `CMagicNumber`, `CMagicString`, `CPadding`, `CMatch`, `time64_t`), `CStructField` / `CClassField`, the guards `isCFieldType`, `isCStructField`, `isCClassField` and `isClassCtor`, and `CStructError`.

See [Custom types](./field-types/custom-types.md).
