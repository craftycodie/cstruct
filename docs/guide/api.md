# Struct I/O API

Pass a `@c.struct()` class as the first argument:

| Function | Description |
|----------|-------------|
| `c.read(ctor, bytes, endian?)` | Parse bytes into an instance (slice `bytes` if the layout does not start at 0) |
| `c.write(ctor, instance, endian?)` | Serialize to a new `Uint8Array` |
| `c.sizeof(ctor)` | Total packed size in bytes |
| `c.sizeof("u32")` | Size of a primitive type in bytes |
| `c.toJson(ctor, instance)` | Struct fields as a JSON-friendly object |
| `c.fromJson(ctor, data)` | Build a class instance from `c.InferJsonType<T>` |

See [JSON encoding](/guide/json) for field mapping, `InferJsonType`, and custom advanced types.

`endian` is `"little"` (default) or `"big"`.

```ts
const payload = c.read(MyStruct, file.subarray(headerSize), "little");
const out = c.write(MyStruct, { value: 1 } as MyStruct);
```

## Advanced field types

Built-in helpers (`c.Bool`, `c.String`, `c.WString`, `c.U64`, `c.I64`, `c.Time64`, `c.bitfield`) and custom encodings share the same extension point: subclass `c.AdvancedType` and pass an instance to `@c.field`. See [Advanced fields](/guide/advanced-fields/).

## Types on `c`

The `c` namespace also exports layout types (`StructLayoutCtor`, `FieldType`, `UnionField`, …) and helpers (`pad`, `arm`, `when`, `enum`, advanced field factories).

`@c.field` and `@c.union` check that each property’s TypeScript type matches the field encoder (for example `c.U64()` requires `bigint`, not `Date`).

## Errors

Layout and validation failures throw `CStructError` (also `c.CStructError`).

## `c` namespace overview

| Symbol | Role |
|--------|------|
| `read`, `write`, `sizeof`, `toJson`, `fromJson` | Struct serialization |
| `struct`, `field` | Define layouts |
| `union`, `unionField`, `arm`, `when` | Discriminated unions |
| `enum` | Integer enum slots |
| `pad` | Reserved zero bytes |
| `AdvancedType` | Base class for custom single-slot encodings |
| `Bool`, `String`, `WString`, `U64`, `I64`, `Time64`, `bitfield` | Advanced field factories |
| `CBool`, `CString`, `CWString`, `CU64`, `CI64`, `CTime64`, `CBitfield` | Advanced field classes |
