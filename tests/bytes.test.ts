import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setBufferImplForTesting } from "../src/engine/ctx";
import { CFieldType, c } from "../src/index";

const Record = c.struct({
  id: c.u16(),
  value: c.f32(),
  big: c.u64(),
  name: c.String(8),
});

const sample = { id: 513, value: 1.5, big: 2n ** 40n, name: "abc" };

describe("byte sources", () => {
  const bytes = c.write(Record, sample);

  it("reads from a plain Uint8Array", () => {
    expect(c.read(Record, new Uint8Array(bytes))).toEqual(sample);
  });

  it("reads from an ArrayBuffer", () => {
    const copy = new Uint8Array(bytes).buffer;
    expect(c.read(Record, copy)).toEqual(sample);
  });

  it("reads from a DataView or Uint8Array window with its own byteOffset", () => {
    const backing = new Uint8Array(bytes.length + 5);
    backing.set(bytes, 3);
    const view = new DataView(backing.buffer, 3, bytes.length);
    expect(c.read(Record, view)).toEqual(sample);
    expect(c.read(Record, backing.subarray(3))).toEqual(sample);
    expect(c.read(Record, backing, 3)).toEqual(sample);
  });

  it("rejects values that are not bytes", () => {
    expect(() => c.read(Record, "nope" as never)).toThrow(
      "expected a Buffer, Uint8Array, ArrayBuffer or DataView"
    );
  });
});

describe("runtime without Buffer", () => {
  beforeAll(() => setBufferImplForTesting(undefined));
  afterAll(() => setBufferImplForTesting(Buffer));

  it("writes a plain Uint8Array and reads it back", () => {
    const bytes = c.write(Record, sample);
    expect(Buffer.isBuffer(bytes)).toBe(false);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(c.read(Record, bytes)).toEqual(sample);
  });

  it.each([
    ["utf8", "héllo✓"],
    ["latin1", "héllo"],
    ["ascii", "hello"],
  ] as const)("matches Buffer for %s strings", (encoding, text) => {
    const Schema = c.struct({ text: c.String(12, encoding) });
    const withoutBuffer = c.write(Schema, { text });
    setBufferImplForTesting(Buffer);
    const withBuffer = c.write(Schema, { text });
    setBufferImplForTesting(undefined);
    expect([...withoutBuffer]).toEqual([...withBuffer]);
    expect(c.read(Schema, withoutBuffer).text).toBe(text);
  });

  it("decodes high latin1 bytes like Buffer", () => {
    const raw = new Uint8Array([0x41, 0xa6, 0xff, 0]);
    const Latin = c.struct({ text: c.String(4, "latin1") });
    expect(c.read(Latin, raw).text).toBe(
      Buffer.from(raw).toString("latin1", 0, 3)
    );
  });

  it("truncates utf8 without splitting a character", () => {
    const Schema = c.struct({ text: c.String(4) });
    expect([...c.write(Schema, { text: "abcé" })]).toEqual([
      0x61, 0x62, 0x63, 0,
    ]);
  });

  it("explains encodings that need Buffer", () => {
    const Schema = c.struct({ text: c.String(4, "hex") });
    expect(() => c.write(Schema, { text: "ab" })).toThrow(
      "c.String encoding 'hex' needs Buffer"
    );
  });

  it("hands custom types the raw Uint8Array", () => {
    let seen: unknown;
    class Probe extends CFieldType<number> {
      getSize(): number {
        return 1;
      }
      read(buffer: Buffer, offset: number): number {
        seen = buffer;
        return buffer[offset];
      }
      write(buffer: Buffer, offset: number, value: number): void {
        buffer[offset] = value;
      }
    }
    const Schema = c.struct({ probe: new Probe() });
    expect(c.read(Schema, c.write(Schema, { probe: 9 })).probe).toBe(9);
    expect(Buffer.isBuffer(seen)).toBe(false);
  });
});
