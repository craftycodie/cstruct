---
layout: home

hero:
  name: cstruct
  text: Packed binary layouts in TypeScript
  tagline: Stage 3 decorators inspired by binrw
  actions:
    - theme: brand
      text: Quick start
      link: /guide/quick-start
    - theme: alt
      text: GitHub
      link: https://github.com/craftycodie/cstruct

features:
  - title: Layouts as classes
    details: Annotate fields with `@c.struct` and `@c.field` — the library derives packed size and field order from your class definition.
  - title: From scalars to unions
    details: Fixed-width integers and floats, `bigint` u64/i64, nested structs, padding, enums, discriminated unions, and Latin-1 / UTF-16 strings.
  - title: Extensible field types
    details: Subclass `c.AdvancedType` to add custom encodings as a single `@c.field` slot — built-ins like `c.String` and `c.Time64` use the same hook. See [Advanced fields](/guide/advanced-fields#custom-types).
---

## Install

```bash
npm install @craftycodie/cstruct
```

Import `{ c }` from `@craftycodie/cstruct` **before** defining struct classes (the entry installs a `Symbol.metadata` polyfill).

See [Install & setup](/guide/install) for TypeScript, SWC, and Vitest configuration.
