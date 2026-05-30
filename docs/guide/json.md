# JSON encoding

cstruct supports JSON encoding of annotated structures to simplify usage of these structures in JavaScript. That can help when you need to map fields between different versions of a layout, inspect or edit data in tooling, or integrate packed structs with other libraries that expect plain objects rather than raw bytes.

JSON I/O is separate from binary I/O: use `c.toJson` / `c.fromJson` for JavaScript-friendly objects, and `c.read` / `c.write` for on-the-wire packed layouts. A common pattern is to round-trip through JSON for debugging or migration, then serialize again with `c.write` when you need bytes.

## API

| Symbol | Description |
|--------|-------------|
| `c.toJson(ctor, instance)` | Serialize a struct instance to a plain object |
| `c.fromJson(ctor, data)` | Build a new class instance from that object |
| `c.InferJsonType<T>` | JSON object shape for struct `T`: output of `toJson`, input of `fromJson` (per-field types from the instance type; pad `never` fields omitted) |

### `c.InferJsonType<T>`

Use this type when you store or pass JSON for a struct outside `toJson` / `fromJson` — for example an API payload or a `const` fixture:

```ts
import { c } from "@craftycodie/cstruct";

@c.struct()
class Profile {
  @c.field("u32")
  id!: number;
  @c.field("u64")
  xuid!: bigint;
}

const payload: c.InferJsonType<Profile> = {
  id: 1,
  xuid: "42",
};

const instance = c.fromJson(Profile, payload);
const again: c.InferJsonType<Profile> = c.toJson(Profile, instance);
```

Field types follow the instance property types (`bigint` → decimal `string`, `Date` → ISO string, and so on). See the [field encoding](#field-encoding) table.

## Example

```ts
import { c } from "@craftycodie/cstruct";

const Skulls = ["iron", "mythic"] as const;

@c.struct()
class Profile {
  @c.field("u32")
  id!: number;

  @c.field(c.U64())
  xuid!: bigint;

  @c.field(c.Time64())
  when!: Date;

  @c.field(c.String(8))
  name!: string;

  @c.field(c.bitfield("u8", Skulls))
  skulls!: c.Bitfield<typeof Skulls>;
}

const instance = c.fromJson(Profile, {
  id: 7,
  xuid: "2533287980717688",
  when: "2010-06-14T12:00:00.000Z",
  name: "Player1",
  skulls: { iron: true, mythic: false },
});

const json = c.toJson(Profile, instance);
// → { id: 7, xuid: "2533287980717688", when: "2010-06-14T12:00:00.000Z", ... }

const bytes = c.write(Profile, instance, "little");
const again = c.read(Profile, bytes, "little");
```

`JSON.stringify(c.toJson(Profile, instance))` is safe: output uses only JSON-native values.

## Field encoding

| Layout | In-memory (`read` / `write`) | In JSON (`toJson` / `fromJson`) |
|--------|------------------------------|----------------------------------|
| Integer / float primitives | `number` | `number` |
| `c.U64()` / `c.I64()` | `bigint` | decimal `string` |
| `c.Time64()` | `Date` | ISO 8601 `string` |
| `c.String` / `c.WString` | `string` | `string` |
| `c.Bool()` | `boolean` | `boolean` |
| `c.bitfield(...)` | flag object | same object (`{ flag: true, ... }`) |
| Nested `@c.struct` | class instance | nested plain object |
| `@c.union` | active arm instance or `null` | nested object or `null` |
| Fixed arrays (`{ count: n }`) | `T[]` | array of encoded elements (e.g. `number[]`, `(ArmA \| null)[]`) |
| `@c.pad` | `never` (not on instance) | omitted from JSON |

`@c.field("u64")` / `@c.field("i64")` use the same JSON encoding as `c.U64()` / `c.I64()`.

Enum fields serialize as their integer value. Union arms are chosen on deserialize using the same discriminant logic as binary read (layout order matters when building from JSON).

## Custom advanced fields

Built-in advanced helpers (`c.String`, `c.Time64`, `c.bitfield`, …) already implement JSON. Custom encodings must subclass `c.AdvancedType<TValue, TJson>` and implement required `toJson` / `fromJson` alongside `read` / `write`. See [Custom types](/guide/advanced-fields/custom-types).

```ts
class Rgb24 extends c.AdvancedType<[number, number, number], number[]> {
  readonly byteSize = 3;
  // read, write, toJson, fromJson ...
}
```

`TJson` must be JSON-serializable (primitive, array, or plain object). Use a distinct `TJson` when the wire type differs from the in-memory type, e.g. `c.CTime64` is `AdvancedType<Date, string>`.

## Errors

`c.CStructError` is thrown at runtime for invalid JSON (wrong types, missing keys), union/arm mismatches, and other layout validation failures — the same class of problems as `c.read`.

`c.AdvancedType` requires `toJson` / `fromJson`; TypeScript reports a subclass that omits them at compile time. JSON I/O does not check for “missing hooks” separately — it calls the methods on the field instance registered by `@c.field`.

## See also

- [Struct I/O API](/guide/api) — binary `read` / `write` / `sizeof`
- [Quick start](/guide/quick-start)
- [Advanced fields](/guide/advanced-fields/)
