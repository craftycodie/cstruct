# @craftycodie/cstruct

[![npm](https://img.shields.io/npm/v/@craftycodie/cstruct)](https://www.npmjs.com/package/@craftycodie/cstruct) [![docs](https://img.shields.io/badge/docs-craftycodie.github.io-blue)](https://craftycodie.github.io/cstruct/)

Declarative binary readers and writers for TypeScript, inspired by [binrw](https://github.com/jam1garner/binrw) and [zod](https://zod.dev).

## Features

- Schema-first layouts with `c.struct({ field: c.u32() })`, or `@c.class()` / `@c.field()` decorators (standard or `experimentalDecorators`)
- `c.read`, `c.write`, `c.sizeof` and `c.offsetof` over `Buffer`, `Uint8Array`, `ArrayBuffer` or `DataView`
- Packed by default, or C alignment with `{ align: true }` / `{ pack: n }`
- Byte order per call, per struct or per field
- Padding, nested structs, arrays, unions, `c.match` tagged unions, enums, bitfields and multi-bit `c.bits`
- zod-style modifiers: `.array(n)`, `.default(v)`, `.transform(decode, encode)`, `.assert(check)`, `.be()`, …
- Inferred types: `c.infer` / `c.output` for reads, `c.input` for writes
- Errors that name the field: `write failed at header.points[2].x: 300 is out of range for u8`
- Fast: struct readers and writers are code-generated on first use

## Usage

```ts
import { c } from "@craftycodie/cstruct";

const Dog = c.struct({
  bone_pile_count: c.u8(),
  favorite_bone: c.u16().padBefore(1),
  name: c.string(16),
});

const bytes = Dog.write({
  bone_pile_count: 2,
  favorite_bone: 0x12,
  name: "Rudy",
});

const parsed = Dog.read(bytes);
console.log(parsed.favorite_bone); // 18
console.log(parsed.name); // "Rudy"

type Dog = c.infer<typeof Dog>; // { bone_pile_count: number; favorite_bone: number; name: string }
```

Class decorators work too:

```ts
@c.class()
class Dog {
  @c.field(c.u8())
  bone_pile_count = 0;

  @c.field(c.string(16))
  name = "";
}

const dog = c.read(Dog, bytes); // a Dog instance
const out = c.write(dog);
```

`@c.field` checks the property type against the field: `@c.field(c.u64()) id!: number` is a compile error, because u64 decodes to `bigint`.

For guides, the API reference, the changelog and more examples, see the [documentation](https://craftycodie.github.io/cstruct/).

## Install

```bash
npm install @craftycodie/cstruct
```

Decorators work with TypeScript's standard decorators or with `experimentalDecorators: true`; no other setup is needed. Schema-only usage needs neither.

## License

MIT
