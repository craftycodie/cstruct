# Changelog

All notable changes to [@craftycodie/cstruct](https://www.npmjs.com/package/@craftycodie/cstruct) are documented here.

## [Unreleased] — 2.0.0-alpha.4

Performance, a zod-style API, C layout support and decorator fixes.

### Performance

- Structs compile into cached plans with static offsets, and readers and writers are code-generated on first use, with an automatic fallback where `new Function` is blocked. Against alpha.3: reading a 16-field struct ~9–11× faster, 1000 × Vec3 53×, the Halo Reach CHDR fixture 6.9×; writing 4.3×, 44× and 5.1×. See [Performance](./guide/performance.md).
- `c.configure({ codegen: false })` turns code generation off.
- `npm run bench` / `bench:save` / `bench:compare` benchmark against hand-written `DataView` code.

### Added

- Lowercase C-native factories: `c.string`, `c.wstring`, `c.enum`, `c.bitfield`, `c.union`.
- `c.bits(spec, storage)` for multi-bit C bit-fields, and `c.bytes(n)` for raw bytes.
- `c.match(path, arms, { size, fallback })`: tagged unions keyed by a field path, no casts needed.
- Modifiers on every field type, struct and array: `.array(n)`, `.padBefore(n)`, `.padAfter(n)`, `.be()`, `.le()`, `.default(v)`, `.transform(decode, encode)`, `.assert(check, message)`.
- `c.input<T>` (write type: padding omitted; magic, unions and defaults optional) and `c.output<T>`.
- Struct options `endian`, `align` and `pack`; per-field `endian`. Layouts are tested against clang.
- `c.offsetof(schema, "a.b[2].c")`, `Struct#offsetOf`, `Struct#size`, `Struct#getAlign`.
- `Struct#extend`, `#pick`, `#omit`, `#shape`, `#writeInto`.
- `c.write(schema, data, { into, offset, checked })` and `c.read(schema, bytes, { offset, endian })`.
- `c.read(Class, bytes)` returns a new instance; `@c.class({ endian, align, pack })`.
- Top-level `c.read` / `c.write` of `c.array(...)`; `c.sizeof` of any field type.
- Reads accept `Uint8Array`, `ArrayBuffer` and `DataView`; cstruct runs without `Buffer`.
- `CStructError` with `operation`, `path` and `cause`; built-in field classes are exported from the package root.
- Decorators work with standard (stage 3) decorators as well as `experimentalDecorators`. `@c.field` checks the property type against the decoded type.
- Decorated classes inherit their base class's fields.

### Changed

Most of these turn silent data corruption into errors. Check them when upgrading:

- **Reads check bounds first.** A buffer shorter than the layout throws `read failed: need N bytes at offset O, …`. Before, fields that ran past the end could read partially.
- **Writes validate values.** A missing or wrongly typed value throws (`expected number, got undefined`) instead of being written as 0. Integers must fit their field as signed or unsigned (`-1` into a `u32` is still allowed); pass `{ checked: false }` to wrap.
- **Error messages** are prefixed with the operation and field path: `write failed at header.length: …`. The original message is kept as the suffix and as `error.cause`.
- **Nested arrays** keep their inner count: `c.array(c.array(c.u32(), 2), 3)` is 24 bytes (`uint32_t m[3][2]`). It was wrongly sized 12.
- **Nested decorated classes** read as instances of their class, not plain objects. `c.class(Ctor)` fields are typed as the instance type; they were previously dropped from inferred types.
- **`@c.field` property checks** may report new compile errors where a property cannot hold the decoded value (for example `number` for `c.u64()`).
- **Magic fields** always write their constant and are optional in write data; a different value throws.
- **Custom `CFieldType.write`** now receives the whole output buffer with absolute offsets, also inside nested structs, matching `read`.
- `c.Bitfield` with more flags than its storage holds throws when created; `c.MagicString` is sized by its UTF-8 byte length.
- `@c.field(type, { count })` now applies to struct and class field types (it was ignored for them).
- Array types with 100 or more elements infer as `T[]` instead of a tuple, avoiding "type instantiation is excessively deep".
- `c.String`, `c.WString`, `c.Enum`, `c.Bitfield`, `c.Union` and `c.Pad` are deprecated aliases.

### Fixed

- Bitfields and magic numbers over `c.u64()`; enums over `c.u64()` can be written.
- `c.string` no longer splits a multi-byte character when truncating.
- Big-endian `c.wstring` writes without an extra copy.

### Removed

- Unused `tools/` assert-macro scripts and the `@swc/core` / `unplugin-swc` dev dependencies.

## [2.0.0] — 2026-06-17

Major rewrite: schema-first API with optional class decorators.

### Added

- `c.struct({ field: c.u32() })` schema factory
- Primitive factories: `c.u8()` … `c.f64()`, `c.u64()`, `c.i64()`
- `@c.class()` / `@c.field()` decorators (replaces `@c.struct()`)
- Overlapping `c.Union({ ... })` for C-style unions
- `c.discriminatedUnion`, `c.MagicNumber`, `c.MagicString`
- `c.infer<T>` type helper and `c.UnionOf<Arms>`
- `c.read(instance, buffer)` / `c.write(instance)` for decorated classes

### Changed

- I/O uses Node `Buffer` instead of `Uint8Array`
- Enums return string keys (`c.Enum(map, type)`)
- Bitfields use sequential keys: `c.Bitfield(keys, type)`
- Padding options are camelCase: `padBefore`, `padAfter`
- `c.read(schema, buffer, endian?)` accepts endian as the third argument

### Removed

- `@c.struct()` decorator (use `@c.class()`)
- String primitive syntax (`@c.field("u32")`)
- `c.json()`, `c.sizeof("u32")`, `c.unionField`, `CStructError`
- Stage 3 decorators / `Symbol.metadata` polyfill requirement
- `c.AdvancedType` extension base (use `CFieldType` subclasses internally)

## [1.1.1] — 2026-05-31

This update fixes an issue where `c.field` decorated fields were not type-checked correctly.

## [1.1.0] — 2026-05-26

This update addresses inconsistencies in the API Bitfield API.

### Changed

- Bitfields are now `c.CBitfield` advanced fields (`c.AdvancedType`) instead of a separate field kind
  - Generally speaking, we intend to keep anything not native to C as an AdvancedType.

### Removed

- Removed "standalone" Bitfield functions for reading bitfield values outside of a cstruct.
  - Public `bitfield_from_raw` / `bitfield_to_raw` helpers (use `c.read` / `c.write` on a struct field)
  - `BitfieldField` type alias and `create_bitfield_field()` factory
  - Reading individual fields is currently outside of the scope of cstruct.

## [1.0.0] — 2026-05-25

Initial release.

### Layouts

- Struct — `@c.struct()` / `@c.field()` with `c.read`, `c.write`, and `c.sizeof`
- Union — discriminated unions with `@c.union`, `c.arm`, and `c.when`
- Enum — `c.enum()` integer slots with validated values
- Bitfield — `c.bitfield()` flag words packed into a primitive
- Array — fixed-length `@c.field(..., { count })` and `c.array()`

### Advanced fields

- `c.Time64()` — Unix timestamp as `Date`
- `c.String(n)` — fixed-size Latin-1 string
- `c.WString(n)` — fixed-size UTF-16LE wide string
- `c.Bool()` — one-byte boolean

Custom encodings via `c.AdvancedType` are also supported.
