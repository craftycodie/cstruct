# @craftycodie/cstruct

[![npm](https://img.shields.io/npm/v/@craftycodie/cstruct)](https://www.npmjs.com/package/@craftycodie/cstruct) [![docs](https://img.shields.io/badge/docs-craftycodie.github.io-blue)](https://craftycodie.github.io/cstruct/)

Declarative packed binary readers and writers for TypeScript, inspired by [binrw](https://github.com/jam1garner/binrw).

## Features

- Schema-first layouts with `c.struct({ field: c.u32() })`
- Optional `@c.class()` / `@c.field()` decorators for class-based definitions
- `c.read`, `c.write`, and `c.sizeof` over Node `Buffer` with little or big endian
- Padding, nested structs, overlapping unions, discriminated unions, enums, bitfields
- Built-in `c.String`, `c.WString`, `c.Time64`, `c.MagicNumber`, `c.MagicString`, and more
- `c.infer<T>` and `c.UnionOf<Arms>` type helpers

## Usage

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
```

Class decorators work too:

```ts
@c.class()
class Dog {
  @c.field(c.u8())
  bone_pile_count!: number;

  @c.field(c.String(16))
  name!: string;
}

const dog = new Dog();
dog.bone_pile_count = 2;
dog.name = "Rudy";

const bytes = c.write(dog);
c.read(dog, bytes);
```

For guides, API reference, changelog, and more examples, see the [documentation](https://craftycodie.github.io/cstruct/).

## Install

```bash
npm install @craftycodie/cstruct
```

Requires TypeScript `experimentalDecorators: true` if you use `@c.class()` / `@c.field()`.

## License

MIT
