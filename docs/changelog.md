# Changelog

All notable changes to [@craftycodie/cstruct](https://www.npmjs.com/package/@craftycodie/cstruct) are documented here.

## [2.0.0] — Unreleased

Major rewrite: a schema-first, zod-style API with optional class decorators.

### Added

- `c.struct({ field: c.u32() })` schemas, with `c.infer`, `c.input` and `c.output` types.
- Field types: `c.u8()` … `c.f64()`, `c.u64()`, `c.i64()`, `c.string`, `c.wstring`, `c.enum`, `c.bytes`, `c.bits`, `c.Bitfield`, `c.MagicNumber`, `c.MagicString`.
- Unions: `c.union`, `c.discriminatedUnion` and `c.match`.
- Field modifiers: `.array`, `.padBefore` / `.padAfter`, `.be` / `.le`, `.default`, `.nullable`, `.transform`, `.assert`.
- Struct helpers: `extend`, `pick`, `omit`, `zero`, `offsetOf`, `writeInto`, plus `c.offsetof` and `c.sizeof`.
- C layout options `endian`, `align` and `pack`, tested against clang.
- `@c.class()` / `@c.field()` decorators, for standard and `experimentalDecorators` builds.
- Compiled, code-generated readers and writers. See [Performance](./guide/performance.md).
- `CStructError` with the operation, field path and cause.

### Changed

- Reads and writes use plain `Uint8Array`; `Buffer` is not needed.
- `c.enum` follows zod 4: TypeScript enums and objects use member values, lists of names use names.
- `c.string` holds bytes only; use `c.wstring` for UTF-16 text.
- Reads check bounds, and writes validate values. Integers must fit their field (`{ checked: false }` wraps).
- Nested arrays keep their inner count: `c.array(c.array(c.u32(), 2), 3)` is 24 bytes.
- `c.String`, `c.WString`, `c.Enum`, `c.Union` and `c.Pad` are deprecated aliases.

### Removed

- `@c.struct()` (use `@c.class()`).
- String primitive syntax (`@c.field("u32")`), `c.json()`, `c.unionField` and `c.sizeof("u32")`.
- `c.AdvancedType` (use `CFieldType`).

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
