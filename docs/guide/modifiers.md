# Modifiers

Every field type, struct, array and wrapper has zod-style modifiers. Each returns a new value; the original is unchanged.

| Modifier | Effect |
| --- | --- |
| `.array(n)` | Fixed array of this field: `c.u8().array(4)` is `uint8_t x[4]` |
| `.padBefore(n)` / `.padAfter(n)` | Zero bytes before / after the field |
| `.be()` / `.le()` | Pin the byte order |
| `.default(value)` | Written when the field is omitted; optional in `c.input` |
| `.nullable(sentinel)` | `null` stored as a sentinel value, such as `-1` |
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

The value can be a function, called on each write. [`schema.zero()`](#starting-values-schema-zero) also uses defaults as starting values. Defaults are filled in before the struct is written, so a [`c.match`](./unions.md#key-based-union-c-match) discriminant can rely on them. Magic fields behave the same way without `.default()`.


### Starting values: `schema.zero()`

`zero()` builds a new value of a struct, ready to fill in and write:

```ts
const Header = c.struct({
  magic: c.MagicString("HDR1"),
  version: c.u8().default(2),
  kind: c.enum({ Film: 3, Variant: 6 }, c.u8()).default(3),
  size: c.u32(),
});

Header.zero(); // { magic: "HDR1", version: 2, kind: 3, size: 0 }
```

Each field takes its `.default()` or magic constant. A `c.match` or `c.discriminatedUnion` is `null`. Every other field is what zero bytes decode to (`0`, `0n`, `""`, `false`, `new Date(0)`, arrays of those), and nested structs are zeroed the same way. A field whose zero bytes do not decode, such as an enum with no `0` member, needs a `.default()`, or `zero()` throws naming the field. Class layouts start from `new Ctor()` and keep the fields its initializers set.

## `.nullable(sentinel)`

Many formats mark "no value" with a sentinel such as `-1` (Blam's `NONE`). `.nullable(sentinel)` reads that value as `null` and writes `null` as it:

```ts
const Challenge = c.struct({
  cookie_reward: c.i16().nullable(-1), // number | null
  skull_flags: c.Bitfield(["iron", "black_eye"], c.u32()).nullable(0xffff_ffff),
});

c.write(Challenge, { cookie_reward: null, skull_flags: null }); // ff ff ff ff ff ff
```

The sentinel is compared with the stored bytes, so for an enum or bitfield it is the raw storage integer. Combine it with `.default(null)` to make "no value" the default and the starting value from `schema.zero()`. As in zod, `.nullable` adds `null` to the field's type; unlike zod, it needs the sentinel because `null` must be stored as bytes.

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
