# Changelog

All notable changes to [@craftycodie/cstruct](https://www.npmjs.com/package/@craftycodie/cstruct) are documented here.

## 2.0.0 (Pre-Release)

This update promotes cstruct's JSON APIs to a first-class feature of the library. Being able to handle these structures in JSON helps with tasks like mapping structures between versions, passing data to other libraries etc. It is expected that all `AdvancedType`s support JSON.
In addition, we have tightened up the library's TypeScript checks. It is no longer possible to define a string decorated with the u64 field type for example.

### Added

- `c.fromJson(ctor, data)` — build `@c.struct()` class instances from JSON objects.
- `AdvancedType.toJson` / `AdvancedType.fromJson` — required JSON hooks on all advanced fields (implemented on built-in advanced helpers).
- `c.U64()` / `c.I64()` — 64-bit integer advanced fields (`bigint` in memory, decimal `string` in JSON).
- `c.InferJsonType<T>` — JSON object shape for `toJson` / `fromJson` (per-field types inferred from the struct instance type).

### Changed

- **Breaking:** `c.StructJson` renamed to `c.InferJsonType`.
- **Breaking:** `c.AdvancedType` always requires a JSON-serializable `TJson` and abstract `toJson` / `fromJson`. Binary-only advanced fields are no longer supported.

### Removed

- **Breaking:** `c.json` — use `c.toJson` instead.
- **Breaking:** primitive `"u64"` / `"i64"` are not supported in `c.toJson` / `c.fromJson`; use `c.U64()` / `c.I64()`.

## 1.1.0 — 2026-05-26

This update addresses inconsistencies in the API Bitfield API.

### Changed

- Bitfields are now `c.CBitfield` advanced fields (`c.AdvancedType`) instead of a separate field kind
  - Generally speaking, we intend to keep anything not native to C as an AdvancedType.

### Removed

- Removed "standalone" Bitfield functions for reading bitfield values outside of a cstruct.
  - Public `bitfield_from_raw` / `bitfield_to_raw` helpers (use `c.read` / `c.write` on a struct field)
  - `BitfieldField` type alias and `create_bitfield_field()` factory
  - Reading individual fields is currently outside of the scope of cstruct.

## 1.0.0 — 2026-05-25

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
