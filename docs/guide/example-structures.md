# Example structures

These layouts are modeled on [blf_lib](https://github.com/craftycodie/blf) Reach TU1 definitions (`saved_game_files.rs`, `s_blf_chunk_content_header`). cstruct handles **packed struct I/O** — fixed layouts, padding, nested structs, unions, and field types (`c.Time64`, `c.string`, `c.wstring`). It does **not** handle bitstreams or fields whose size depends on runtime bit reads.

For unions and field-type APIs, see [Unions](./unions.md) and [Field types](./field-types/).

Runnable copies of these examples live in:

- `tests/examples/halo-reach-content-header.test.ts` — full `ContentItemMetadata`, BLF CHDR chunk (`tests/examples/fixtures/chdr.bin` fixture)

## Campaign metadata (16 bytes)

A small packed struct with mixed integer widths:

```ts
import { c } from "@craftycodie/cstruct";

const ContentItemCampaignMetadata = c.struct({
  campaign_id: c.i32(),
  campaign_difficulty: c.i16(),
  campaign_metagame_scoring: c.i16(),
  campaign_insertion_point: c.i32(),
  campaign_primary_skulls: c.i16(),
  campaign_secondary_skulls: c.i16(),
});

// c.sizeof(ContentItemCampaignMetadata) === 16

const value = {
  campaign_id: 1,
  campaign_difficulty: 2,
  campaign_metagame_scoring: 0,
  campaign_insertion_point: 10,
  campaign_primary_skulls: 3,
  campaign_secondary_skulls: 0,
};

const bytes = c.write(ContentItemCampaignMetadata, value, "little");
const read = c.read(ContentItemCampaignMetadata, bytes, "little");
```

## Author / history slot (36 bytes)

Uses `c.Time64()` (`u64` seconds → `Date`) and a fixed Latin-1 name buffer. Padding after `is_online` aligns the struct to 36 bytes:

```ts
const ContentItemHistory = c.struct({
  timestamp: c.Time64(),
  xuid: c.u64(),
  name: c.string(16, "latin1"),
  is_online: c.u8({ padAfter: 3 }),
});

const when = new Date("2010-06-14T12:00:00.000Z");
const history = {
  timestamp: when,
  xuid: 0x0009_0003_1234_5678n,
  name: "Player1",
  is_online: 1,
};

const bytes = c.write(ContentItemHistory, history, "little");
const read = c.read(ContentItemHistory, bytes, "little");
// read.timestamp is a Date; read.name is the NUL-terminated slot string
```

## General metadata (48 bytes)

`padAfter` on `file_type` inserts three zero bytes before `size_in_bytes` (mirrors Reach layout):

```ts
const ContentItemGeneralMetadata = c.struct({
  file_type: c.i8({ padAfter: 3 }),
  size_in_bytes: c.u32(),
  unique_id: c.u64(),
  parent_unique_id: c.u64(),
  root_unique_id: c.u64(),
  game_id: c.u64(),
  activity: c.i8(),
  game_mode: c.u8(),
  game_engine_type: c.u8({ padAfter: 1 }),
  map_id: c.i32(),
});

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
};

const bytes = c.write(ContentItemGeneralMetadata, general, "little");
```

## Reading at an offset

`c.read` accepts an offset into a larger `Buffer` — useful when a struct is embedded in a file:

```ts
const inner = c.write(ContentItemGeneralMetadata, general, "little");
const file = Buffer.concat([Buffer.from([0xff, 0xff]), inner]);

const atOffset = c.read(
  ContentItemGeneralMetadata,
  file,
  2,
  "little"
);
```

## Content metadata (nested struct + unions + wide strings)

Reach `c_content_item_metadata` combines nested structs, two 16-byte union slots, and UTF-16 name/description buffers (`0x80` wchar slots each):

```ts
const ContentItemFilmMetadata = c.struct({
  seconds: c.i32(),
  _pad: c.pad(12),
});

const ContentItemGameVariantMetadata = c.struct({
  icon_index: c.u8(),
  _pad: c.pad(15),
});

const ContentItemMatchmakingMetadata = c.struct({
  hopper_identifier: c.u16(),
  _pad: c.pad(14),
});

const ContentItemDisplayMetadata = c.struct({
  megalo_category_index: c.i8(),
  _pad: c.pad(7),
});

const ContentItemMetadata = c.struct({
  general: ContentItemGeneralMetadata,
  display: ContentItemDisplayMetadata,
  creation_history: ContentItemHistory,
  modification_history: ContentItemHistory,
  name: c.wstring(0x80),
  description: c.wstring(0x80),
  file_type_data: c.match("general.file_type", {
    3: ContentItemFilmMetadata,
    4: ContentItemFilmMetadata,
    6: ContentItemGameVariantMetadata,
  }),
  activity_data: c.match("general.activity", {
    3: ContentItemMatchmakingMetadata,
  }),
});
```

For a game-variant file (`file_type === 6`), set `file_type_data: { icon_index: 2 }`. When `activity === 3`, set `activity_data: { hopper_identifier: 0 }`; otherwise leave it out or `null`. Both slots are 16 bytes, the size of their largest arm.

## BLF CHDR chunk (big-endian)

Reach file-share **CHDR** chunks prepend a 12-byte BLF header, then the content-header body. Primitives in this chunk are **big-endian**:

```ts
const BlfChunkContentHeader = c.struct({
  signature: c.string(4),
  chunk_length: c.u32(),
  major: c.u16(),
  minor: c.u16(),
  build_number: c.u16(),
  build_sequence_number: c.u16(),
  metadata: ContentItemMetadata,
});
```

Reading a real chunk from disk:

```ts
import { readFileSync } from "node:fs";

const bytes = readFileSync("tests/examples/fixtures/chdr.bin");
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
