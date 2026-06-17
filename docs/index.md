---
layout: doc
outline: false
---

<div class="cstruct-hero">

<h1 class="cstruct-title">
  <span class="cstruct-title-c">c</span><span class="cstruct-title-rest">struct</span>
</h1>

<p class="cstruct-lead">
  Packed binary layouts for TypeScript — describe structs with <code>c.struct</code> schemas or <code>@c.class()</code> decorators, then read and write <code>Buffer</code> data with explicit endianness. Inspired by <a href="https://github.com/jam1garner/binrw">binrw</a>.
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
| **Define** | `c.struct({ ... })` or `@c.class()` with `@c.field(c.u32())` |
| **Serialize** | `c.write(schema, data)` or `c.write(instance)` → `Buffer` |
| **Parse** | `c.read(schema, buffer)` or `c.read(instance, buffer)` |
| **Measure** | `c.sizeof(schema \| instance \| class)` |

Endianness is `"little"` (default) or `"big"`. Pass a byte offset when a struct does not start at zero.

## Example

```ts
import { c } from "@craftycodie/cstruct";

const Dog = c.struct({
  bone_pile_count: c.u8(),
  favorite_bone: c.u16({ padBefore: 1 }),
  name: c.String(16),
});

const bytes = c.write(Dog, {
  bone_pile_count: 2,
  favorite_bone: 0x12,
  name: "Rudy",
});

const parsed = c.read(Dog, bytes);
console.log(parsed.favorite_bone); // 18
console.log(parsed.name); // "Rudy"
console.log(c.sizeof(Dog)); // 19
```

[Quick start →](/guide/quick-start) · [Install & setup →](/guide/install)

## What you can model

**Scalars & layout** — Fixed-width integers and floats, `bigint` u64/i64, explicit padding, and nested structs.

**Unions** — Overlapping `c.Union` and discriminated `c.discriminatedUnion` with `c.arm` / `c.when`.

**Field types** — `c.String`, `c.WString`, `c.Time64`, `c.Enum`, `c.Bitfield`, `c.MagicNumber`, `c.MagicString`, and fixed arrays.

**Type helpers** — `c.infer<T>` and `c.UnionOf<Arms>` for decoded shapes.

## Get started

```bash
npm install @craftycodie/cstruct
```
