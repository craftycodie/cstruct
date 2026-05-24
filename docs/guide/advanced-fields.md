# Advanced fields

Advanced fields occupy one packed slot in a struct. Pass a factory (`c.Bool`, `c.String`, `c.Time64`, …) or an instance to `@c.field`. Multi-field layouts should use `@c.struct` instead.

## Custom types

Subclass `c.AdvancedType<T>` when you need a wire format that is not a primitive, nested struct, or built-in helper. Implement:

- `byteSize` — fixed width of this slot in bytes
- `read(bytes, offset, endian, label)` — decode wire bytes to `T`
- `write(bytes, offset, value, endian, label)` — encode `T` into the buffer

The codec calls these hooks during `c.read` / `c.write`; `c.size` includes `byteSize` in the struct total.

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

Built-in helpers (`CBool`, `CString`, `CWString`, `CTime64`) are implemented the same way and are available on `c` if you need `instanceof` checks.

## Boolean — `c.Bool()`

One wire byte: `0` is false, any non-zero byte reads as true; writes `0` or `1` (matches blf_lib `Bool`):

```ts
@c.struct()
class AuthorFlags {
  @c.field(c.Bool())
  is_online!: boolean;
}
```

## Latin-1 string — `c.String(n)`

Fixed-size, NUL-terminated Latin-1 (one byte per character, not UTF-8):

```ts
@c.struct()
class Tag {
  @c.field(c.String(16))
  name!: string;
}
```

## Wide string — `c.WString(n)`

Fixed-size UTF-16LE wchar slot (`n` is character count, byte size is `n * 2`):

```ts
@c.struct()
class Label {
  @c.field(c.WString(32))
  text!: string;
}
```

## Unix time — `c.Time64()`

8-byte unsigned seconds since epoch, exposed as `Date`:

```ts
@c.struct()
class Event {
  @c.field(c.Time64())
  when!: Date;
}
```

Factories: `c.Bool`, `c.String`, `c.WString`, and `c.Time64`. Classes: `c.CBool`, `c.CString`, `c.CWString`, and `c.CTime64`.
