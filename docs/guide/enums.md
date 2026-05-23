# Enums

Map integer wire values to a fixed set with `c.enum(storage, map)`:

```ts
const Status = {
  Ok: 0,
  Error: 1,
} as const;

@c.struct()
class Packet {
  @c.field(c.enum("u8", Status))
  status!: number;
}
```

Values are validated on read and write. Use `pad_after` on the same field when the wire layout has trailing padding after a small enum storage type.
