# Modifiers

Every field type, struct, array and wrapper has zod-style modifiers. Each returns a new value; the original is unchanged.

| Modifier | Effect |
| --- | --- |
| `.array(n)` | Fixed array of this field: `c.u8().array(4)` is `uint8_t x[4]` |
| `.padBefore(n)` / `.padAfter(n)` | Zero bytes before / after the field |
| `.be()` / `.le()` | Pin the byte order |
| `.default(value)` | Written when the field is omitted; optional in `c.input` |
| `.transform(decode, encode)` | Expose the stored value as another type |
| `.assert(check, message?)` | Validate on read and write |

The options-object forms (`c.u16({ padBefore: 2, endian: "big" })`) still work. The chain is sugar over the same options.

## `.default(value)`

```ts
const Header = c.struct({
  version: c.u8().default(2),
  created: c.Time64().default(() => new Date()),
  length: c.u32(),
});

c.write(Header, { length: 10 }); // version 2, created now
```

The value can be a function, called on each write. Defaults are filled in before the struct is written, so a [`c.match`](./unions.md#key-based-union-c-match) discriminant can rely on them. Magic fields behave the same way without `.default()`.

## `.transform(decode, encode)`

Store one type, expose another. Size, alignment and padding come from the stored field.

```ts
/** 16.16 fixed-point. */
const fixed = c
  .i32()
  .transform(
    (raw) => raw / 65536,
    (value: number) => Math.round(value * 65536)
  );

const Flag = c.u8().transform(
  (raw) => raw !== 0,
  (value: boolean) => (value ? 1 : 0)
);

const Sprite = c.struct({ scale: fixed, visible: Flag });
type Sprite = c.infer<typeof Sprite>; // { scale: number; visible: boolean }
```

## `.assert(check, message?)`

Runs on every value read and written. A failing check throws with the field path:

```ts
const Header = c.struct({
  version: c.u8().assert((v) => v === 2, "unsupported version"),
});

c.read(Header, Buffer.from([3]));
// CStructError: read failed at version: unsupported version
```

On a struct, the check receives the whole decoded record:

```ts
const Range = c
  .struct({ lo: c.u16(), hi: c.u16() })
  .assert((r) => r.lo <= r.hi, "lo must not exceed hi");
```

Struct assertions run on every read and write of the struct, at the top level or nested.
