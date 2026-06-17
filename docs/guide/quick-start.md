# Quick start

Everything public lives on the `c` object: schema factories, optional decorators, and struct I/O.

## Schema-first

```ts
import { c } from "@craftycodie/cstruct";

const Example = c.struct({
  value: c.u32(),
});

const bytes = c.write(Example, { value: 42 }, "big");
const data = c.read(Example, bytes, "big");

console.log(data.value); // 42
console.log(c.sizeof(Example)); // 4
```

## Class decorators

```ts
import { c } from "@craftycodie/cstruct";

@c.class()
class Example {
  @c.field(c.u32())
  value!: number;
}

const instance = new Example();
instance.value = 42;

const bytes = c.write(instance);
c.read(instance, bytes);
console.log(c.sizeof(instance)); // 4
```

Mix schemas and decorated classes with `c.class(Ctor)` — see [Class decorators](/guide/class-decorators).

Derive TypeScript types from layouts with `c.infer<typeof Schema>` — see [Type helpers](/guide/type-helpers).

## I/O

- `c.read(schema, buffer, endian?)` or `c.read(schema, buffer, offset, endian?)`
- `c.read(instance, buffer, endian?)` — mutates the instance in place
- `c.write(schema, data, endian?)` or `c.write(instance, endian?)`
- `c.sizeof(schema | instance | class)`

Read from an offset inside a larger buffer:

```ts
const file = Buffer.alloc(8);
file.writeUInt32BE(42, 4);
const atEnd = c.read(Example, file, 4, "big");
```

Next: [Primitives & padding](/guide/primitives).
