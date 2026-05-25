---
layout: doc
outline: false
---

<div class="cstruct-hero">

<h1 class="cstruct-title">
  <span class="cstruct-title-c">c</span><span class="cstruct-title-rest">struct</span>
</h1>

<p class="cstruct-lead">
  Packed binary layouts for TypeScript — describe structs with Stage 3 decorators, then read and write <code>Uint8Array</code> data with explicit endianness. Inspired by <a href="https://github.com/jam1garner/binrw">binrw</a>.
</p>

<p class="cstruct-meta">
  <a href="https://www.npmjs.com/package/@craftycodie/cstruct">npm</a>
  <span class="cstruct-meta-sep">·</span>
  <a href="https://github.com/craftycodie/cstruct">GitHub</a>
  <span class="cstruct-meta-sep">·</span>
  <span>MIT</span>
</p>

</div>

## At a glance

| Step | Description |
| --- | --- |
| **Define** | `@c.struct()` classes with `@c.field(...)` on each member |
| **Serialize** | `c.write(ctor, instance, endian?)` → `Uint8Array` |
| **Parse** | `c.read(ctor, bytes, endian?)` → instance |
| **Measure** | `c.sizeof(ctor)` — packed size in bytes |

Endianness is `"little"` (default) or `"big"`. Slice buffers when a struct does not start at offset zero.

## Example

```ts
import { c } from "@craftycodie/cstruct";

@c.struct()
class Dog {
  @c.field("u8")
  bone_pile_count!: number;

  @c.field("u16", { pad_before: 1 })
  favorite_bone!: number;

  @c.field(c.String(16))
  name!: string;
}

const dog = new Dog();
dog.bone_pile_count = 2;
dog.favorite_bone = 0x12;
dog.name = "Rudy";

const bytes = c.write(Dog, dog, "little");
const parsed = c.read(Dog, bytes, "little");

console.log(parsed.favorite_bone); // 18
console.log(parsed.name); // "Rudy"
console.log(c.sizeof(Dog)); // 19
```

[Quick start →](/guide/quick-start) · [Install & setup →](/guide/install)

## What you can model

**Scalars & layout** — Fixed-width integers and floats, `bigint` u64/i64, explicit padding, and nested structs. Field order and size come from the class definition, not hand-maintained offsets.

**Discriminated data** — Validated enums, discriminated unions (`@c.union`, `c.arm`, `c.when`), fixed-length arrays, and bitfield enums for flag words.

**Custom encodings** — Built-in `c.String`, `c.WString`, and `c.Time64`, or subclass `c.AdvancedType` for your own wire format in a single field slot.

## Get started

```bash
npm install @craftycodie/cstruct
```

Import `{ c }` from `@craftycodie/cstruct` **before** any `@c.struct()` class so the `Symbol.metadata` polyfill is installed. Stage 3 decorators are required (`experimentalDecorators: false`, `decoratorVersion: "2022-03"` with SWC or Vitest). See [Install & setup](/guide/install) for compiler and test runner configuration.

## Guide map

| Topic | Page |
| --- | --- |
| First read/write | [Quick start](/guide/quick-start) |
| Types, padding, alignment | [Primitives & padding](/guide/primitives) |
| Structs inside structs | [Nested structs](/guide/nested-structs) |
| Variant layouts | [Unions](/guide/unions) |
| Stored enum values | [Enums](/guide/enums) |
| Repeated fields | [Arrays](/guide/arrays) |
| Flag words | [Bitfield enums](/guide/bitfields) |
| Strings, time, custom types | [Advanced fields](/guide/advanced-fields) |
| Real-world layouts | [Example structures](/guide/example-structures) |
| Testing with decorators | [Vitest & SWC](/guide/vitest) |
| `read` / `write` / `sizeof` | [Struct I/O API](/guide/api) |
