# Custom types

Subclass `c.AdvancedType<TValue, TJson>` when you need a format that is not a primitive, nested struct, or built-in helper.

- `TValue` — JavaScript type on the struct instance (`read` / `write`)
- `TJson` — JSON shape for `toJson` / `c.fromJson` (primitive, array, or plain object). Required when `TValue` is not already JSON-serializable (e.g. `c.CTime64` is `AdvancedType<Date, string>`).

Implement:

- `byteSize` — fixed width of this slot in bytes
- `read(bytes, offset, endian, label)` — decode bytes to `TValue`
- `write(bytes, offset, value, endian, label)` — encode `TValue` into the buffer
- `toJson` / `fromJson` — required; used by `c.toJson` / `c.fromJson`

The codec calls `read` / `write` during `c.read` / `c.write`; `c.sizeof` includes `byteSize` in the struct total.

```ts
import { c } from "@craftycodie/cstruct";

/** Three-byte RGB, no padding. */
class Rgb24 extends c.AdvancedType<[number, number, number], number[]> {
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
    _label: string
  ): void {
    bytes[offset] = value[0];
    bytes[offset + 1] = value[1];
    bytes[offset + 2] = value[2];
  }

  toJson(value: [number, number, number]): number[] {
    return [...value];
  }

  fromJson(value: unknown, label: string): [number, number, number] {
    if (!Array.isArray(value) || value.length !== 3) {
      throw new c.CStructError(`${label}: expected [r, g, b]`);
    }
    return [value[0], value[1], value[2]];
  }
}

@c.struct()
class Pixel {
  @c.field(new Rgb24())
  color!: [number, number, number];
}
```

Built-in helpers (`CBool`, `CString`, `CWString`, `CTime64`) are implemented the same way and are available on `c` if you need `instanceof` checks. See the [overview](./index.md) for built-in field types and [JSON encoding](../json) for how struct JSON I/O uses these hooks.
