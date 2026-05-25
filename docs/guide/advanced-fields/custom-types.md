# Custom types

Subclass `c.AdvancedType<T>` when you need a format that is not a primitive, nested struct, or built-in helper. Implement:

- `byteSize` — fixed width of this slot in bytes
- `read(bytes, offset, endian, label)` — decode bytes to `T`
- `write(bytes, offset, value, endian, label)` — encode `T` into the buffer

The codec calls these hooks during `c.read` / `c.write`; `c.sizeof` includes `byteSize` in the struct total.

```ts
import { c } from "@craftycodie/cstruct";

/** Three-byte RGB, no padding. */
class Rgb24 extends c.AdvancedType<[number, number, number]> {
  readonly byteSize = 3;

  read(
    bytes: Uint8Array,
    offset: number,
    _endian: c.Endian,
    _label: string
  ): [number, number, number] {
    return [bytes[offset]!, bytes[offset + 1]!, bytes[offset + 2]!];
  }

  write(
    bytes: Uint8Array,
    offset: number,
    value: [number, number, number],
    _endian: c.Endian,
    label: string
  ): void {
    if (value.some((channel) => channel < 0 || channel > 255)) {
      throw new c.CStructError(`${label}: channel out of range`);
    }
    bytes[offset] = value[0];
    bytes[offset + 1] = value[1];
    bytes[offset + 2] = value[2];
  }
}

@c.struct()
class Pixel {
  @c.field(new Rgb24())
  color!: [number, number, number];
}

const pixel = c.read(Pixel, c.write(Pixel, { color: [255, 128, 0] } as Pixel));
```

**C equivalent** — three packed bytes, no terminator:

```c
typedef struct {
    uint8_t color[3]; /* or: uint8_t r, g, b; */
} Pixel;
```

Built-in helpers (`CBool`, `CString`, `CWString`, `CTime64`) are implemented the same way and are available on `c` if you need `instanceof` checks. See the [overview](./index.md) for built-in field types.
