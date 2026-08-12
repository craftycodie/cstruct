import { readFileSync } from "node:fs";
import { join } from "node:path";
import { c } from "@craftycodie/cstruct";
import { describe, expect, it } from "vitest";

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

const ContentItemHistory = c.struct({
  timestamp: c.Time64(),
  xuid: c.u64(),
  name: c.String(16),
  is_online: c.u8({ padAfter: 3 }),
});

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

const ContentItemDisplayMetadata = c.struct({
  megalo_category_index: c.i8({ padAfter: 7 }),
});

const ContentItemMetadata = c.struct({
  general: ContentItemGeneralMetadata,
  display: ContentItemDisplayMetadata,
  creation_history: ContentItemHistory,
  modification_history: ContentItemHistory,
  name: c.WString(0x80),
  description: c.WString(0x80),
  file_type_data: c.discriminatedUnion(
    { size: 16 },
    c.when(
      3,
      ContentItemFilmMetadata,
      (m) => (m as { general: { file_type: number } }).general.file_type
    ),
    c.when(
      4,
      ContentItemFilmMetadata,
      (m) => (m as { general: { file_type: number } }).general.file_type
    ),
    c.when(
      6,
      ContentItemGameVariantMetadata,
      (m) => (m as { general: { file_type: number } }).general.file_type
    )
  ),
  activity_data: c.discriminatedUnion(
    { size: 16 },
    c.arm(
      ContentItemMatchmakingMetadata,
      (m) => (m as { general: { activity: number } }).general.activity === 3
    )
  ),
});

const BlfChunkContentHeader = c.struct({
  signature: c.String(4),
  chunk_length: c.u32(),
  major: c.u16(),
  minor: c.u16(),
  build_number: c.u16(),
  build_sequence_number: c.u16(),
  metadata: ContentItemMetadata,
});

const CHDR_FIXTURE = join(import.meta.dirname, "./fixtures/chdr.bin");

describe("chdr.bin fixture", () => {
  const bytes = readFileSync(CHDR_FIXTURE);

  it("reads the Halo Reach CHDR chunk (big-endian)", () => {
    const chunk = c.read(BlfChunkContentHeader, bytes, "big");

    expect(chunk.signature).toBe("chdr");
    expect(chunk.chunk_length).toBe(bytes.length);
    expect(chunk.major).toBe(10);
    expect(chunk.minor).toBe(2);
    expect(chunk.build_number).toBe(11883);
    expect(chunk.build_sequence_number).toBe(0);

    const { general } = chunk.metadata;
    expect(general.file_type).toBe(6);
    expect(general.size_in_bytes).toBe(21289);
    expect(general.unique_id).toBe(0x7f7ff56dd903cc7dn);
    expect(general.parent_unique_id).toBe(0x7f7ff56dd903cc7dn);
    expect(general.root_unique_id).toBe(0x7f7ff56dd903cc7dn);
    expect(general.game_id).toBe(0n);
    expect(general.activity).toBe(3);
    expect(general.game_mode).toBe(3);
    expect(general.game_engine_type).toBe(2);
    expect(general.map_id).toBe(-1);

    expect(chunk.metadata.display.megalo_category_index).toBe(2);
    expect(chunk.metadata.name).toBe("Oddball");
    expect(chunk.metadata.description).toBe(
      "Hold the skull to earn points. It's like Hamlet with guns."
    );
    expect(chunk.metadata.file_type_data).toEqual({ icon_index: 2 });
    expect(chunk.metadata.activity_data).toEqual({ hopper_identifier: 0 });
  });
});
