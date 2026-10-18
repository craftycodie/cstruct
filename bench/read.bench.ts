import { c } from "@craftycodie/cstruct";
import { bench, describe } from "vitest";
import { setCodegen } from "../src/engine/codegen";
import { BlfChunkContentHeader } from "../tests/examples/chdr-schema";
import { readFlat16, readVec3Array } from "./handwritten";
import {
  chdrBytes,
  Flat16,
  flat16Value,
  Header,
  makeHeader,
  VEC3_COUNT,
  Vec3,
  Vec3Array,
  vec3ArrayValue,
} from "./schemas";

const flat16Bytes = c.write(Flat16, flat16Value);
const vec3Bytes = c.write(Vec3Array, vec3ArrayValue);
const headerBytes = c.write(makeHeader());

// Sanity: the hand-written baseline must decode the same bytes identically.
if (JSON.stringify(readFlat16(flat16Bytes)) !== JSON.stringify(flat16Value)) {
  throw new Error("readFlat16 baseline does not match cstruct layout");
}

// Copies of the schemas whose plans are built with code generation off, to
// compare generated readers against the closure engine.
const Flat16Closures = Flat16.extend({});
const Vec3ArrayClosures = c.struct({
  points: c.array(Vec3.extend({}), VEC3_COUNT),
});
setCodegen(false);
c.read(Flat16Closures, flat16Bytes);
c.read(Vec3ArrayClosures, vec3Bytes);
setCodegen(true);

// Results are sunk here so the work cannot be optimized away.
const sink = { value: undefined as unknown };

describe("read flat16", () => {
  bench("cstruct", () => {
    sink.value = c.read(Flat16, flat16Bytes);
  });
  bench("cstruct (closures)", () => {
    sink.value = c.read(Flat16Closures, flat16Bytes);
  });
  bench("handwritten", () => {
    sink.value = readFlat16(flat16Bytes);
  });
});

describe("read vec3 x1000", () => {
  bench("cstruct", () => {
    sink.value = c.read(Vec3Array, vec3Bytes);
  });
  bench("cstruct (closures)", () => {
    sink.value = c.read(Vec3ArrayClosures, vec3Bytes);
  });
  bench("handwritten", () => {
    sink.value = readVec3Array(vec3Bytes);
  });
});

describe("read chdr (big-endian)", () => {
  bench("cstruct", () => {
    sink.value = c.read(BlfChunkContentHeader, chdrBytes, "big");
  });
});

describe("read @c.class", () => {
  const target = new Header();
  bench("cstruct", () => {
    sink.value = c.read(target, headerBytes);
  });
});
