# Struct I/O API

Pass a `@c.struct()` class as the first argument:

| Function | Description |
|----------|-------------|
| `c.read(ctor, bytes, endian?)` | Parse bytes into an instance (slice `bytes` if the layout does not start at 0) |
| `c.write(ctor, instance, endian?)` | Serialize to a new `Uint8Array` |
| `c.size(ctor)` | Total packed size in bytes |

`endian` is `"little"` (default) or `"big"`.

```ts
const payload = c.read(MyStruct, file.subarray(headerSize), "little");
const out = c.write(MyStruct, { value: 1 } as MyStruct);
```

## Advanced field types

Built-in helpers (`c.String`, `c.WString`, `c.Time64`) and custom encodings share the same extension point: subclass `c.AdvancedType` and pass an instance to `@c.field`. See [Advanced fields](/guide/advanced-fields#custom-types).

## Types on `c`

The `c` namespace also exports layout types (`StructLayoutCtor`, `FieldType`, `UnionField`, …) and helpers (`pad`, `arm`, `when`, `enum`, advanced field factories).

## Errors

Layout and validation failures throw `CStructError` (also `c.CStructError`).

## `c` namespace overview

| Symbol | Role |
|--------|------|
| `read`, `write`, `size` | Struct serialization |
| `struct`, `field` | Define layouts |
| `union`, `unionField`, `arm`, `when` | Discriminated unions |
| `enum` | Integer enum slots |
| `pad` | Reserved zero bytes |
| `AdvancedType` | Base class for custom single-slot encodings |
| `String`, `WString`, `Time64` | Advanced field factories |
| `CString`, `CWString`, `CTime64` | Advanced field classes |
