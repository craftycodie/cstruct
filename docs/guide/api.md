# API reference

## `c.read`

```ts
c.read(schema, buffer, endian?)
c.read(schema, buffer, offset, endian?)
c.read(instance, buffer, endian?)
c.read(instance, buffer, offset, endian?)
```

Deserialize a `Buffer` using a `c.struct` schema or hydrate a `@c.class()` instance in place.

When the third argument is `"little"` or `"big"`, it is treated as endianness (not an offset). This keeps call sites like `c.read(schema, bytes, "big")` ergonomic.

## `c.write`

```ts
c.write(schema, data, endian?)
c.write(instance, endian?)
```

Serialize to a new `Buffer`.

## `c.sizeof`

```ts
c.sizeof(schema)
c.sizeof(instance)
c.sizeof(DecoratedClass)
```

Return the packed byte size of a layout.

## Schema factories

| Factory | Description |
|---------|-------------|
| `c.struct(fields)` | Object-keyed struct layout |
| `c.u8()` … `c.f64()`, `c.u64()`, `c.i64()` | Numeric primitives |
| `c.bool()` | 1-byte boolean |
| `c.String(n)` / `c.WString(n)` | Fixed strings |
| `c.Time64()` | 8-byte epoch seconds as `Date` |
| `c.pad(n)` | Reserved bytes |
| `c.array(element, count)` | Fixed-length array |
| `c.Enum(map \| keys, type)` | Validated enum (string keys) |
| `c.Bitfield(keys, type)` | Sequential bit flags |
| `c.MagicNumber(n, type)` | Assert-on-read numeric magic |
| `c.MagicString(s)` | Assert-on-read fixed string |
| `c.Union({ ... })` | Overlapping C union |
| `c.discriminatedUnion({ size }, …arms)` | Tagged union slot |
| `c.class(Ctor)` | Embed a `@c.class()` type in a schema |

## Union helpers

| Helper | Description |
|--------|-------------|
| `c.arm(schema, when)` | Discriminated union arm with predicate |
| `c.when(value, schema, discriminant)` | Shorthand when discriminant equals `value` |

## Decorators

| Decorator | Description |
|-----------|-------------|
| `@c.class()` | Mark a class as a struct layout |
| `@c.field(type, options?)` | Declare a field (`padBefore`, `padAfter`, `count`) |

See [Class decorators](./class-decorators.md).

## Types

| Helper | Description |
|--------|-------------|
| `c.infer<T>` | Decoded TypeScript type for a schema or field |
| `c.UnionOf<Arms>` | Active payload type for discriminated union arms |
| `c.Endian` | `"little"` \| `"big"` |

See [Type helpers](./type-helpers.md).

## Package exports

`CFieldType`, `CString`, `CEnum`, `CBitfield`, `CMagicNumber`, `CMagicString`, `time64_t`, and utility types `FlattenIntersection`, `Tuple`, `UnionToIntersection` are exported from the package entry for extensions and advanced use.
