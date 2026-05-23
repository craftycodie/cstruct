# Quick start

Everything public lives on the `c` namespace: decorators, field helpers, and struct I/O.

```ts
import { c } from "@craftycodie/cstruct";

@c.struct()
class Example {
  @c.field("u32")
  value!: number;
}

const bytes = c.write(Example, { value: 42 } as Example, "big");
const instance = c.read(Example, bytes, "big");

console.log(instance.value); // 42
console.log(c.size(Example)); // 4
```

- `c.read(ctor, bytes, endian?)` — parse into a new instance (`endian`: `"little"` default or `"big"`). Slice the buffer first if the struct does not start at index 0.
- `c.write(ctor, instance, endian?)` — serialize to a new `Uint8Array`.
- `c.size(ctor)` — total packed size in bytes.

Read from an offset inside a larger buffer (file header + payload, chunk tables, etc.):

```ts
const file = new Uint8Array([0, 0, 0, 0, 0, 0, 0, 42]);
const atEnd = c.read(Example, file.subarray(4), "big");
```

Next: [Primitives & padding](/guide/primitives).
