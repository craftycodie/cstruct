import { readFileSync } from "node:fs";
import { join } from "node:path";
import { c } from "@craftycodie/cstruct";
import { describe, expect, it } from "vitest";

/** Reach `s_content_item_film_metadata` (16-byte union arm). */
@c.struct()
class ContentItemFilmMetadata {
  @c.field("i32", { pad_after: 12 })
  seconds!: number;
}

/** Reach `s_content_item_game_variant_metadata` (16-byte union arm). */
@c.struct()
class ContentItemGameVariantMetadata {
  @c.field("i8", { pad_after: 15 })
  icon_index!: number;
}

/** Reach `s_content_item_matchmaking_metadata` (16-byte union arm). */
@c.struct()
class ContentItemMatchmakingMetadata {
  @c.field("u16", { pad_after: 14 })
  hopper_identifier!: number;
}

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

@c.struct()
class ContentItemDisplayMetadata {
  @c.field("i8", { pad_after: 7 })
  megalo_category_index!: number;
}

/** Reach `c_content_item_metadata` (packed; unions mirror binrw layout). */
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

  @c.union(
    { size: 16 },
    c.when(
      3,
      ContentItemFilmMetadata,
      (m: ContentItemMetadata) => m.general.file_type
    ),
    c.when(
      4,
      ContentItemFilmMetadata,
      (m: ContentItemMetadata) => m.general.file_type
    ),
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

  @c.union(
    { size: 16 },
    c.arm(
      ContentItemMatchmakingMetadata,
      (m: ContentItemMetadata) => m.general.activity === 3
    )
  )
  activity_data: ContentItemMatchmakingMetadata | null = null;
}

/** BLF chunk: 12-byte header + `s_blf_chunk_content_header` body (big-endian). */
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

const CHDR_FIXTURE = join(import.meta.dirname, "./fixtures/chdr.bin");

describe("chdr.bin fixture", () => {
  const bytes = new Uint8Array(readFileSync(CHDR_FIXTURE));

  it("reads the Halo Reach CHDR chunk (big-endian)", () => {
    const chunk = c.read(BlfChunkContentHeader, bytes, "big");

    expect(chunk.signature).toBe("chdr");
    expect(chunk.chunk_length).toBe(bytes.length);
    expect(chunk.major).toBe(10);
    expect(chunk.minor).toBe(2);
    expect(chunk.build_number).toBe(11883);
    expect(chunk.map_minor_version).toBe(0);

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
