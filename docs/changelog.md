# Changelog

All notable changes to [@craftycodie/cstruct](https://www.npmjs.com/package/@craftycodie/cstruct) are documented here.

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
