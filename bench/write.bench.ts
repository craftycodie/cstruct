import { c } from "@craftycodie/cstruct";
import { bench, describe } from "vitest";
import { BlfChunkContentHeader } from "../tests/examples/chdr-schema";
import { writeFlat16, writeVec3Array } from "./handwritten";
import {
  chdrBytes,
  Flat16,
  flat16Value,
  makeHeader,
  Vec3Array,
  vec3ArrayValue,
} from "./schemas";

const chdrValue = c.read(BlfChunkContentHeader, chdrBytes, "big");
const header = makeHeader();

// Sanity: the hand-written baseline must encode the same bytes.
if (!writeFlat16(flat16Value).equals(c.write(Flat16, flat16Value))) {
  throw new Error("writeFlat16 baseline does not match cstruct layout");
}

// Results are sunk here so the work cannot be optimized away.
const sink = { value: undefined as unknown };

describe("write flat16", () => {
  bench("cstruct", () => {
    sink.value = c.write(Flat16, flat16Value);
  });
  bench("handwritten", () => {
    sink.value = writeFlat16(flat16Value);
  });
});

describe("write vec3 x1000", () => {
  bench("cstruct", () => {
    sink.value = c.write(Vec3Array, vec3ArrayValue);
  });
  bench("handwritten", () => {
    sink.value = writeVec3Array(vec3ArrayValue);
  });
});

describe("write chdr (big-endian)", () => {
  bench("cstruct", () => {
    sink.value = c.write(BlfChunkContentHeader, chdrValue, "big");
  });
});

describe("write @c.class", () => {
  bench("cstruct", () => {
    sink.value = c.write(header);
  });
});
