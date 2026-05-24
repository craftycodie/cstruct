# Example structures

These layouts are modeled on [blf_lib](https://github.com/craftycodie/blf) Reach TU1 definitions (`saved_game_files.rs`, `s_blf_chunk_content_header`). cstruct handles **packed struct I/O** — fixed layouts, padding, nested structs, unions, and advanced fields (`Time64`, `String`, `WString`). It does **not** handle bitstreams or fields whose size depends on runtime bit reads.

For union and advanced-field APIs, see [Unions](./unions.md) and [Advanced fields](./advanced-fields.md).

Runnable copies of these examples live in:

- `tests/blf-inspired.test.ts` — campaign metadata, history, general metadata, offset reads
- `tests/chdr.test.ts` — full `ContentItemMetadata`, BLF CHDR chunk (`tests/chdr.bin` fixture)

## Campaign metadata (16 bytes)

A small packed struct with mixed integer widths:

```ts
import { c } from "@craftycodie/cstruct";

@c.struct()
class ContentItemCampaignMetadata {
  @c.field("i32")
  campaign_id!: number;

  @c.field("i16")
  campaign_difficulty!: number;

  @c.field("i16")
  campaign_metagame_scoring!: number;

  @c.field("i32")
  campaign_insertion_point!: number;

  @c.field("i16")
  campaign_primary_skulls!: number;

  @c.field("i16")
  campaign_secondary_skulls!: number;
}

// c.size(ContentItemCampaignMetadata) === 16

const value = {
  campaign_id: 1,
  campaign_difficulty: 2,
  campaign_metagame_scoring: 0,
  campaign_insertion_point: 10,
  campaign_primary_skulls: 3,
  campaign_secondary_skulls: 0,
} satisfies ContentItemCampaignMetadata;

const bytes = c.write(ContentItemCampaignMetadata, value, "little");
const read = c.read(ContentItemCampaignMetadata, bytes, "little");
```

## Author / history slot (36 bytes)

Uses `c.Time64()` (wire `u64` seconds → `Date`) and a fixed Latin-1 name buffer. Padding after `is_online` aligns the struct to 36 bytes:

```ts
@c.struct()
class ContentItemHistory {
  @c.field(c.Time64())
  timestamp!: Date;

  @c.field("u64")
  xuid!: bigint;

  @c.field(c.String(16))
  name!: string;

  @c.field("u8", { pad_after: 3 })
  is_online!: number;
}

const when = new Date("2010-06-14T12:00:00.000Z");
const history = {
  timestamp: when,
  xuid: 0x0009_0003_1234_5678n,
  name: "Player1",
  is_online: 1,
} satisfies ContentItemHistory;

const bytes = c.write(ContentItemHistory, history, "little");
const read = c.read(ContentItemHistory, bytes, "little");
// read.timestamp is a Date; read.name is the NUL-terminated slot string
```

## General metadata (48 bytes)

`pad_after` on `file_type` inserts three zero bytes before `size_in_bytes` (mirrors Reach wire layout):

```ts
@c.struct()
class ContentItemGeneralMetadata {
  @c.field("i8", { pad_after: 3 })
  file_type!: number;

  @c.field("u32")
  size_in_bytes!: number;

  @c.field("u64")
  unique_id!: bigint;

  @c.field("u64")
  parent_unique_id!: bigint;

  @c.field("u64")
  root_unique_id!: bigint;

  @c.field("u64")
  game_id!: bigint;

  @c.field("i8")
  activity!: number;

  @c.field("u8")
  game_mode!: number;

  @c.field("u8", { pad_after: 1 })
  game_engine_type!: number;

  @c.field("i32")
  map_id!: number;
}

const general = {
  file_type: 6,
  size_in_bytes: 21_289,
  unique_id: 0x7f7f_f56d_d903_cc7dn,
  parent_unique_id: 0x7f7f_f56d_d903_cc7dn,
  root_unique_id: 0x7f7f_f56d_d903_cc7dn,
  game_id: 0n,
  activity: 3,
  game_mode: 3,
  game_engine_type: 2,
  map_id: -1,
} satisfies ContentItemGeneralMetadata;

const bytes = c.write(ContentItemGeneralMetadata, general, "little");
```

## Reading at an offset

`c.read` only needs a `Uint8Array` view — useful when a struct is embedded in a larger file:

```ts
const inner = c.write(ContentItemGeneralMetadata, general, "little");
const file = new Uint8Array([0xff, 0xff, ...inner]);

const atOffset = c.read(
  ContentItemGeneralMetadata,
  file.subarray(2, 2 + c.size(ContentItemGeneralMetadata)),
  "little"
);
```

## Content metadata (nested struct + unions + wide strings)

Reach `c_content_item_metadata` combines nested structs, two 16-byte union slots, and UTF-16 name/description buffers (`0x80` wchar slots each):

```ts
@c.struct()
class ContentItemFilmMetadata {
  @c.field("i32", { pad_after: 12 })
  seconds!: number;
}

@c.struct()
class ContentItemGameVariantMetadata {
  @c.field("i8", { pad_after: 15 })
  icon_index!: number;
}

@c.struct()
class ContentItemMatchmakingMetadata {
  @c.field("u16", { pad_after: 14 })
  hopper_identifier!: number;
}

@c.struct()
class ContentItemDisplayMetadata {
  @c.field("i8", { pad_after: 7 })
  megalo_category_index!: number;
}

@c.struct()
class ContentItemMetadata {
  @c.field(ContentItemGeneralMetadata)
  general!: ContentItemGeneralMetadata;

  @c.field(ContentItemDisplayMetadata)
  display!: ContentItemDisplayMetadata;

  @c.field(ContentItemHistory)
  creation_history!: ContentItemHistory;

  @c.field(ContentItemHistory)
  modification_history!: ContentItemHistory;

  @c.field(c.WString(0x80))
  name!: string;

  @c.field(c.WString(0x80))
  description!: string;

  /** Discriminated by `general.file_type` (film = 3/4, game variant = 6). */
  @c.union(
    { size: 16 },
    c.when(3, ContentItemFilmMetadata, (m: ContentItemMetadata) => m.general.file_type),
    c.when(4, ContentItemFilmMetadata, (m: ContentItemMetadata) => m.general.file_type),
    c.when(
      6,
      ContentItemGameVariantMetadata,
      (m: ContentItemMetadata) => m.general.file_type
    )
  )
  file_type_data:
    | ContentItemFilmMetadata
    | ContentItemGameVariantMetadata
    | null = null;

  /** Active when `general.activity === 3` (matchmaking). */
  @c.union(
    { size: 16 },
    c.arm(
      ContentItemMatchmakingMetadata,
      (m: ContentItemMetadata) => m.general.activity === 3
    )
  )
  activity_data: ContentItemMatchmakingMetadata | null = null;
}
```

For a game-variant file (`file_type === 6`), set `file_type_data: { icon_index: 2 }`. When `activity === 3`, set `activity_data: { hopper_identifier: 0 }`; otherwise leave it `null`.

## BLF CHDR chunk (big-endian)

Reach file-share **CHDR** chunks prepend a 12-byte BLF header, then the content-header body. Primitives in this chunk are **big-endian**:

```ts
@c.struct()
class BlfChunkContentHeader {
  @c.field(c.String(4))
  signature!: string;

  @c.field("u32")
  chunk_length!: number;

  @c.field("u16")
  major!: number;

  @c.field("u16")
  minor!: number;

  @c.field("u16")
  build_number!: number;

  @c.field("u16")
  map_minor_version!: number;

  @c.field(ContentItemMetadata)
  metadata!: ContentItemMetadata;
}
```

Reading a real chunk from disk (`tests/chdr.bin`):

```ts
import { readFileSync } from "node:fs";

const bytes = new Uint8Array(readFileSync("tests/chdr.bin"));
const chunk = c.read(BlfChunkContentHeader, bytes, "big");

chunk.signature; // "chdr"
chunk.major; // 10
chunk.minor; // 2
chunk.build_number; // 11883
chunk.metadata.name; // "Oddball"
chunk.metadata.description;
// "Hold the skull to earn points. It's like Hamlet with guns."
chunk.metadata.file_type_data; // { icon_index: 2 } when file_type is 6
chunk.metadata.activity_data; // { hopper_identifier: 0 } when activity is 3
```

`chunk_length` should equal the full buffer size. Set it before writing if you emit CHDR chunks yourself.
