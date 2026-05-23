import { describe, expect, it } from "vitest";
import { c } from "../src/index";

/**
 * Layouts modeled after `blf_lib` Reach TU1 structs (packed wire, not bitstreams).
 * See `blf_lib/src/blam/haloreach/.../saved_games/saved_game_files.rs`.
 */

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

  @c.field("u8", { pad_after: 1 })
  game_mode!: number;

  @c.field("u8")
  game_engine_type!: number;

  @c.field("i32")
  map_id!: number;
}

@c.struct()
class BlfChunkContentHeader {
  @c.field("u16")
  build_number!: number;

  @c.field("u16")
  map_minor_version!: number;

  @c.field(ContentItemGeneralMetadata)
  metadata!: ContentItemGeneralMetadata;
}

describe("example structures", () => {
  it("packs campaign metadata (16 bytes, little-endian)", () => {
    expect(c.size(ContentItemCampaignMetadata)).toBe(16);

    const value = {
      campaign_id: 1,
      campaign_difficulty: 2,
      campaign_metagame_scoring: 0,
      campaign_insertion_point: 10,
      campaign_primary_skulls: 3,
      campaign_secondary_skulls: 0,
    } satisfies ContentItemCampaignMetadata;

    const written = c.write(ContentItemCampaignMetadata, value, "little");
    const read = c.read(ContentItemCampaignMetadata, written, "little");
    expect(read).toEqual(value);
  });

  it("packs content history (author slot + time64 + xuid)", () => {
    expect(c.size(ContentItemHistory)).toBe(36);

    const when = new Date("2010-06-14T12:00:00.000Z");
    const value = {
      timestamp: when,
      xuid: 0x0009_0003_1234_5678n,
      name: "Player1",
      is_online: 1,
    } satisfies ContentItemHistory;

    const written = c.write(ContentItemHistory, value, "little");
    expect(written[24]).toBe(0);
    expect(written.subarray(25, 28)).toEqual(new Uint8Array(3));

    const read = c.read(ContentItemHistory, written, "little");
    expect(read.xuid).toBe(value.xuid);
    expect(read.name).toBe("Player1");
    expect(read.is_online).toBe(1);
    expect(read.timestamp.toISOString()).toBe(when.toISOString());
  });

  it("packs general metadata with inter-field padding", () => {
    expect(c.size(ContentItemGeneralMetadata)).toBe(48);

    const value = {
      file_type: 3,
      size_in_bytes: 1024,
      unique_id: 1n,
      parent_unique_id: 2n,
      root_unique_id: 3n,
      game_id: 4n,
      activity: 1,
      game_mode: 1,
      game_engine_type: 0,
      map_id: 100,
    } satisfies ContentItemGeneralMetadata;

    const written = c.write(ContentItemGeneralMetadata, value, "little");
    expect(written[1]).toBe(0);
    expect(written[2]).toBe(0);
    expect(written[3]).toBe(0);

    const read = c.read(ContentItemGeneralMetadata, written, "little");
    expect(read).toEqual(value);
  });

  it("reads content header chunk fields (big-endian)", () => {
    expect(c.size(BlfChunkContentHeader)).toBe(
      4 + c.size(ContentItemGeneralMetadata)
    );

    const header = {
      build_number: 12_065,
      map_minor_version: 0,
      metadata: {
        file_type: 6,
        size_in_bytes: 512,
        unique_id: 0x1111n,
        parent_unique_id: 0n,
        root_unique_id: 0n,
        game_id: 0x2222n,
        activity: 0,
        game_mode: 0,
        game_engine_type: 1,
        map_id: -1,
      },
    } satisfies BlfChunkContentHeader;

    const written = c.write(BlfChunkContentHeader, header, "big");
    const read = c.read(BlfChunkContentHeader, written, "big");
    expect(read.build_number).toBe(12_065);
    expect(read.map_minor_version).toBe(0);
    expect(read.metadata.unique_id).toBe(0x1111n);
    expect(read.metadata.map_id).toBe(-1);
  });

  it("reads at an offset via buffer slice", () => {
    const inner = c.write(
      ContentItemGeneralMetadata,
      {
        file_type: 0,
        size_in_bytes: 99,
        unique_id: 0n,
        parent_unique_id: 0n,
        root_unique_id: 0n,
        game_id: 0n,
        activity: 0,
        game_mode: 0,
        game_engine_type: 0,
        map_id: 0,
      } satisfies ContentItemGeneralMetadata,
      "little"
    );
    const buf = new Uint8Array([0xff, 0xff, ...inner]);
    const size = c.size(ContentItemGeneralMetadata);

    const read = c.read(
      ContentItemGeneralMetadata,
      buf.subarray(2, 2 + size),
      "little"
    );
    expect(read.size_in_bytes).toBe(99);
  });
});
