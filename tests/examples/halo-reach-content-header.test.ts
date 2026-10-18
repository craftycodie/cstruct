import { readFileSync } from "node:fs";
import { join } from "node:path";
import { c } from "@craftycodie/cstruct";
import { describe, expect, it } from "vitest";
import { BlfChunkContentHeader } from "./chdr-schema";

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
