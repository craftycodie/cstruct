# @craftycodie/cstruct

[![npm](https://img.shields.io/npm/v/@craftycodie/cstruct)](https://www.npmjs.com/package/@craftycodie/cstruct) [![docs](https://img.shields.io/badge/docs-craftycodie.github.io-blue)](https://craftycodie.github.io/cstruct/)

Declarative packed binary readers and writers for TypeScript, inspired by [binrw](https://github.com/jam1garner/binrw).

## Features

- Struct layouts with Stage 3 decorators (`@c.struct`, `@c.field`)
- `c.read`, `c.write`, and `c.size` over `Uint8Array` with little or big endian
- Padding, nested structs, discriminated unions, and validated enums
- Built-in `c.String`, `c.WString`, and `c.Time64`; extend with `c.AdvancedType`

## Usage

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
```

For guides, API reference, and more examples, see the [documentation](https://craftycodie.github.io/cstruct/).

## Install

```bash
npm install @craftycodie/cstruct
```

Requires [Stage 3 decorators](https://github.com/tc39/proposal-decorators) (`experimentalDecorators: false`, `decoratorVersion: "2022-03"` with SWC/Vitest). Import `@craftycodie/cstruct` before defining struct classes.

## License

MIT
