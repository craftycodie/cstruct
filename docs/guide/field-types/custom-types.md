# Custom types

Subclass `CFieldType` when you need a format that is not a primitive, nested struct, or built-in helper. Implement:

- `getSize()` — fixed width of this slot in bytes
- `read(buffer, offset, endian)` — decode bytes to `T`
- `write(buffer, offset, value, endian)` — encode `T` into the buffer
- optionally `getAlign()` — natural alignment for structs declared with `align` or `pack` (default 1)

`c.sizeof` includes `getSize()` in the struct total.

`buffer` is the whole input or output (a `Buffer`, or a `Uint8Array` where `Buffer` does not exist), and `offset` is the field's absolute position in it. The struct checks bounds before calling you, so `offset + getSize()` always fits. Modifiers (`.array()`, `.transform()`, `.default()`, …) work on custom types too.

```ts
import { CFieldType, c } from "@craftycodie/cstruct";

/** Three-byte RGB, no padding. */
class Rgb24 extends CFieldType<[number, number, number]> {
  getSize(): number {
    return 3;
  }

  read(buffer: Buffer, offset: number): [number, number, number] {
    return [buffer[offset]!, buffer[offset + 1]!, buffer[offset + 2]!];
  }

  write(
    buffer: Buffer,
    offset: number,
    value: [number, number, number]
  ): void {
    if (value.some((channel) => channel < 0 || channel > 255)) {
      throw new Error("channel out of range");
    }
    buffer[offset] = value[0];
    buffer[offset + 1] = value[1];
    buffer[offset + 2] = value[2];
  }
}

const Pixel = c.struct({
  color: new Rgb24(),
});

const pixel = c.read(Pixel, c.write(Pixel, { color: [255, 128, 0] }));
```

**C equivalent** — three packed bytes, no terminator:

```c
typedef struct {
    uint8_t color[3]; /* or: uint8_t r, g, b; */
} Pixel;
```

Built-in helpers (`CBool`, `CString`, `CWString`, `CBitfield`) extend `CFieldType` the same way and are exported if you need `instanceof` checks. See the [overview](./index.md) for built-in field types.

## Subclassing built-in types

Subclasses of built-in classes such as `CNumber` keep their overridden `read` / `write`: cstruct only uses its compiled fast path while those methods are the built-in ones.
