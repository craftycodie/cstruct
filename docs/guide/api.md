# API reference

## I/O

### `c.read`

```ts
c.read(schema, bytes, offset?, endian?)
c.read(schema, bytes, endian)
c.read(schema, bytes, { offset, endian })
c.read(array, bytes, …)       // top-level c.array(...)
c.read(Class, bytes, …)       // returns a new instance
c.read(instance, bytes, …)    // fills and returns the instance
```

`bytes` is a `Buffer`, `Uint8Array`, `ArrayBuffer` or `DataView`. The whole layout must fit at `offset`, or the read throws before decoding anything.

### `c.write`

```ts
c.write(schema, data, endian?)
c.write(schema, data, { endian, checked, into, offset })
c.write(array, data, …)
c.write(instance, endianOrOptions?)
```

Returns a new `Buffer` (a `Uint8Array` where `Buffer` does not exist), or `into` when given. `data` is typed as [`c.input`](./type-helpers.md#c-input-t).

| Option | Default | Effect |
| --- | --- | --- |
| `endian` | `"little"` | Byte order for structs and fields that do not pin one |
| `checked` | `true` | Validate integer ranges; `false` wraps |
| `into` | none | Write into this buffer; the struct's range is zeroed first |
| `offset` | 0 | Byte offset in `into` (requires `into`) |

### `c.sizeof` / `c.offsetof`

```ts
c.sizeof(schema | Class | instance | array | fieldType) // c.sizeof(c.u32()) === 4
c.offsetof(schema | Class | instance, "header.points[2].x")
```

### Schema methods

| Method | Same as |
| --- | --- |
| `schema.read(bytes, …)` | `c.read(schema, bytes, …)` |
| `schema.write(data, …)` | `c.write(schema, data, …)` |
| `schema.writeInto(target, data, offset?, endian?)` | `c.write(schema, data, { into: target, offset, endian })` |
| `schema.size` / `schema.getSize()` | `c.sizeof(schema)` |
| `schema.getAlign()` | Struct alignment (1 when packed) |
| `schema.offsetOf(path)` | `c.offsetof(schema, path)` |
| `schema.extend(fields, options?)` | New struct with fields appended |
| `schema.pick(...keys)` / `schema.omit(...keys)` | New struct with fewer fields |
| `schema.shape` | The field definitions |

### `c.configure`

```ts
c.configure({ codegen: false });
```

Turns off generated readers and writers for schemas first used afterwards. See [Performance](./performance.md).

## Schema factories

Lowercase factories are C-native types; capitalized ones are cstruct extensions with semantics C lacks.

| Factory | Description |
| --- | --- |
| `c.struct(fields, options?)` | Struct layout; options `endian`, `align`, `pack` |
| `c.u8()` … `c.u32()`, `c.i8()` … `c.i32()`, `c.f32()`, `c.f64()` | Numbers |
| `c.u64()`, `c.i64()` | 64-bit integers as `bigint` |
| `c.bool()` | 1-byte boolean |
| `c.string(n, encoding?)` | `char[n]`, NUL-terminated; utf8 by default |
| `c.wstring(n)` | `wchar_t[n]` (UTF-16, `2n` bytes) |
| `c.bytes(n)` | Raw bytes as a `Buffer` |
| `c.pad(n)` | Reserved zero bytes |
| `c.array(element, count)` | Fixed-length array |
| `c.enum(map \| keys, storage)` | Enum decoded to key names |
| `c.bitfield(flags, storage)` | Flags as the storage integer, with `.mask` |
| `c.Bitfield(flags, storage)` | Flags as `{ flag: boolean }`, with `toRaw` / `fromRaw` |
| `c.bits(spec, storage)` | Multi-bit C bit-fields |
| `c.union({ ... })` | Overlapping C union |
| `c.match(path, arms, options?)` | Union whose arm is chosen by a discriminant field |
| `c.discriminatedUnion({ size }, ...arms)` | Union whose arm is chosen by predicates |
| `c.arm(schema, when)` / `c.when(value, schema, discriminant)` | `discriminatedUnion` arms |
| `c.Time64()` | Signed 64-bit seconds as `Date` |
| `c.MagicNumber(value, storage)` | Numeric constant, checked on read |
| `c.MagicString(value)` | String constant, checked on read |
| `c.class(Ctor, options?)` | Embed a `@c.class()` type in a schema |

Deprecated aliases: `c.String`, `c.WString`, `c.Enum`, `c.Union`, `c.Pad`.

## Modifiers

Available on every field type, struct and array. See [Modifiers](./modifiers.md).

`.array(n)`, `.padBefore(n)`, `.padAfter(n)`, `.be()`, `.le()`, `.default(value)`, `.transform(decode, encode)`, `.assert(check, message?)`

## Decorators

| Decorator | Description |
| --- | --- |
| `@c.class(options?)` | Mark a class as a struct layout |
| `@c.field(type, options?)` | Declare a field; options `count`, `padBefore`, `padAfter`, `endian` |

See [Class decorators](./class-decorators.md).

## Types

| Type | Description |
| --- | --- |
| `c.infer<T>` / `c.output<T>` | Decoded type |
| `c.input<T>` | Accepted write type |
| `c.UnionOf<Arms>` | Payload of `discriminatedUnion` arms |
| `c.Struct<F>` | Struct type; `c.Struct` accepts any struct |
| `c.StructOptions`, `c.ReadOptions`, `c.WriteOptions` | Option objects |
| `c.Endian` | `"little" \| "big"` |

See [Type helpers](./type-helpers.md).

## Errors

Reads and writes throw `CStructError`:

```ts
import { CStructError } from "@craftycodie/cstruct";

try {
  c.write(Scene, scene);
} catch (error) {
  if (error instanceof CStructError) {
    error.operation; // "write"
    error.path; // ["points", 2, "x"]
    error.message; // "write failed at points[2].x: 300 is out of range for u8"
    error.cause; // the original error
  }
}
```
