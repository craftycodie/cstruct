# Example structures

These layouts are inspired by real game binary formats (see [blf_lib](https://github.com/craftycodie/blf) for Reach-style definitions). cstruct handles **packed struct I/O** — not bitstreams or conditional fields that depend on runtime bit reads.

Below is a simplified **content item history** slot (author name, timestamp, XUID) and **general metadata** header.

## Content history (36 bytes)

```ts
import { c } from "@craftycodie/cstruct";

@c.struct()
class ContentItemHistory {
  @c.field(c.Time64())
  timestamp!: Date;

  @c.field("u64")
  xuid!: bigint;

  @c.field(c.String(16), { pad_after: 3 })
  name!: string;

  @c.field("u8")
  is_online!: number;
}

const value = {
  timestamp: new Date("2010-06-14T12:00:00.000Z"),
  xuid: 0x0009_0003_1234_5678n,
  name: "Player1",
  is_online: 1,
} satisfies ContentItemHistory;

const bytes = c.write(ContentItemHistory, value, "little");
const read = c.read(ContentItemHistory, bytes, "little");
```

## Content header chunk (big-endian)

Some formats use **big-endian** primitives for chunk headers:

```ts
@c.struct()
class ContentItemGeneralMetadata {
  @c.field("i8", { pad_after: 3 })
  file_type!: number;

  @c.field("u32")
  size_in_bytes!: number;

  @c.field("u64")
  unique_id!: bigint;
  // … additional fields
}

@c.struct()
class ContentHeader {
  @c.field("u16")
  build_number!: number;

  @c.field("u16")
  map_minor_version!: number;

  @c.field(ContentItemGeneralMetadata)
  metadata!: ContentItemGeneralMetadata;
}

const header = c.write(
  ContentHeader,
  {
    build_number: 12_065,
    map_minor_version: 0,
    metadata: { /* … */ },
  } as ContentHeader,
  "big"
);
```

## Unions on `file_type`

Metadata often switches on `file_type` (film vs game variant). Model that with a fixed-size union:

```ts
@c.struct()
class FilmArm {
  @c.field("i32", { pad_after: 12 })
  seconds!: number;
}

@c.struct()
class Host {
  @c.field("i8")
  file_type!: number;

  @c.union(
    { size: 16 },
    c.arm(FilmArm, (m: Host) => m.file_type === 3)
  )
  typed_data: FilmArm | null = null;
}
```

More examples live in the repo under `tests/blf-inspired.test.ts`.
