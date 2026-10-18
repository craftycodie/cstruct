import { describe, expect, it } from "vitest";
import { CFieldType, CNumber, CStructError, c } from "../src/index";

describe("64-bit storage", () => {
  const Flags = Array.from({ length: 40 }, (_, i) => `f${i}`);

  it("round-trips a bitfield over u64, including bits above 31", () => {
    const Schema = c.struct({ flags: c.Bitfield(Flags, c.u64()) });
    const flags = Object.fromEntries(
      Flags.map((key, i) => [key, i === 0 || i === 31 || i === 39])
    );
    for (const endian of ["little", "big"] as const) {
      const bytes = c.write(Schema, { flags }, endian);
      const raw =
        endian === "little"
          ? bytes.readBigUInt64LE(0)
          : bytes.readBigUInt64BE(0);
      expect(raw).toBe((1n << 0n) | (1n << 31n) | (1n << 39n));
      expect(c.read(Schema, bytes, endian).flags).toEqual(flags);
    }
  });

  it("rejects more flags than the storage holds", () => {
    expect(() =>
      c.Bitfield(["a", "b", "c", "d", "e", "f", "g", "h", "i"], c.u8())
    ).toThrow("Bitfield has 9 flags but u8 storage holds 8");
  });

  it("matches a u64 magic number", () => {
    const Schema = c.struct({ magic: c.MagicNumber(0xbeef, c.u64()) });
    const bytes = c.write(Schema, { magic: 0xbeef });
    expect(bytes.readBigUInt64LE(0)).toBe(0xbeefn);
    expect(c.read(Schema, bytes).magic).toBe(0xbeef);
  });

  it("writes enums backed by u64", () => {
    const Schema = c.struct({ kind: c.Enum({ A: 1, B: 2 }, c.u64()) });
    const bytes = c.write(Schema, { kind: "B" });
    expect(bytes.readBigUInt64LE(0)).toBe(2n);
    expect(c.read(Schema, bytes).kind).toBe("B");
  });
});

describe("magic values on write", () => {
  it("writes the magic constant and rejects a different value", () => {
    const Schema = c.struct({
      magic: c.MagicNumber(0x1234, c.u16()),
      tag: c.MagicString("RIFF"),
    });
    const bytes = c.write(Schema, { magic: 0x1234, tag: "RIFF" });
    expect(bytes.toString("latin1", 2)).toBe("RIFF");
    expect(() =>
      c.write(Schema, { magic: 0x9999 as 0x1234, tag: "RIFF" })
    ).toThrow("write failed at magic: Magic number mismatch");
  });
});

describe("errors", () => {
  const Inner = c.struct({ x: c.u8(), y: c.u16() });
  const Outer = c.struct({
    id: c.u32(),
    points: c.array(Inner, 2),
    name: c.String(4),
  });

  it("reports the field path of a missing value on write", () => {
    const error = (() => {
      try {
        c.write(Outer, {
          id: 1,
          points: [{ x: 1, y: 2 }, { x: 3 } as never],
          name: "a",
        });
      } catch (caught) {
        return caught;
      }
    })();
    expect(error).toBeInstanceOf(CStructError);
    expect((error as CStructError).path).toEqual(["points", 1, "y"]);
    expect((error as CStructError).message).toBe(
      "write failed at points[1].y: expected number, got undefined"
    );
  });

  it("rejects a wrongly typed value instead of writing zero", () => {
    expect(() =>
      c.write(Outer, {
        id: "1" as never,
        points: [
          { x: 1, y: 2 },
          { x: 3, y: 4 },
        ],
        name: "a",
      })
    ).toThrow('write failed at id: expected number, got "1"');
  });

  it("checks the buffer is large enough before reading", () => {
    expect(() => c.read(Outer, Buffer.alloc(4))).toThrow(
      `read failed: need ${c.sizeof(Outer)} bytes at offset 0, but the buffer has 4`
    );
    expect(() => c.read(Outer, Buffer.alloc(c.sizeof(Outer)), 1)).toThrow(
      "need"
    );
  });

  it("reports nested read failures with their path", () => {
    const Tagged = c.struct({
      header: c.struct({ magic: c.MagicNumber(7, c.u8()) }),
    });
    expect(() => c.read(Tagged, Buffer.from([9]))).toThrow(
      "read failed at header.magic: Magic number mismatch: expected 7, got 9"
    );
  });
});

describe("custom field types", () => {
  class Rgb24 extends CFieldType<[number, number, number]> {
    getSize(): number {
      return 3;
    }
    read(buffer: Buffer, offset: number): [number, number, number] {
      return [buffer[offset], buffer[offset + 1], buffer[offset + 2]];
    }
    write(buffer: Buffer, offset: number, value: [number, number, number]) {
      buffer[offset] = value[0];
      buffer[offset + 1] = value[1];
      buffer[offset + 2] = value[2];
    }
  }

  it("still runs public read/write with absolute offsets, nested", () => {
    const Pixel = c.struct({ alpha: c.u8(), color: new Rgb24() });
    const Image = c.struct({ id: c.u16(), pixels: c.array(Pixel, 2) });
    const data: c.infer<typeof Image> = {
      id: 7,
      pixels: [
        { alpha: 1, color: [2, 3, 4] },
        { alpha: 5, color: [6, 7, 8] },
      ],
    };
    const bytes = c.write(Image, data);
    expect([...bytes]).toEqual([7, 0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(c.read(Image, bytes)).toEqual(data);
  });

  it("keeps overrides on subclasses of built-in types", () => {
    class Halved extends CNumber<"u8"> {
      read(buffer: Buffer, offset: number): number {
        return buffer[offset] * 2;
      }
      write(buffer: Buffer, offset: number, value: number): void {
        buffer[offset] = value / 2;
      }
    }
    const Schema = c.struct({ value: new Halved("u8") });
    const bytes = c.write(Schema, { value: 10 });
    expect(bytes[0]).toBe(5);
    expect(c.read(Schema, bytes).value).toBe(10);
  });
});

describe("strings", () => {
  it("truncates without splitting a multi-byte character", () => {
    const Schema = c.struct({ name: c.String(4) });
    const bytes = c.write(Schema, { name: "abcé" });
    expect([...bytes]).toEqual([0x61, 0x62, 0x63, 0]);
  });

  it("round-trips big-endian wide strings", () => {
    const Schema = c.struct({ label: c.WString(6) });
    const bytes = c.write(Schema, { label: "Hé✓" }, "big");
    expect([...bytes.subarray(0, 6)]).toEqual([0, 0x48, 0, 0xe9, 0x27, 0x13]);
    expect(c.read(Schema, bytes, "big").label).toBe("Hé✓");
  });
});

describe("generated readers", () => {
  it("never fall back to the slow path for valid input", async () => {
    const { codegenStats } = await import("../src/engine/codegen");
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const { BlfChunkContentHeader } = await import("./examples/chdr-schema");
    const before = codegenStats.slowPaths;
    const bytes = readFileSync(
      join(import.meta.dirname, "examples/fixtures/chdr.bin")
    );
    for (let i = 0; i < 3; i++) {
      c.read(BlfChunkContentHeader, bytes, "big");
    }
    expect(codegenStats.slowPaths).toBe(before);
  });

  it("report errors with paths through the slow path", () => {
    const Inner = c.struct({ tag: c.MagicNumber(1, c.u8()) });
    const Outer = c.struct({ a: c.u8(), inner: Inner });
    expect(() => c.read(Outer, Buffer.from([0, 2]))).toThrow(
      "read failed at inner.tag: Magic number mismatch"
    );
  });
});

describe("code generation fallback", () => {
  const Inner = c.struct({ id: c.u16(), name: c.string(6) });
  const Kinds = c.struct({
    kind: c.u8(),
    items: c.array(Inner, 2),
    data: c.match("kind", { 1: c.struct({ v: c.u32() }) }),
    flags: c.u8().array(3),
  });
  const value: c.input<typeof Kinds> = {
    kind: 1,
    items: [
      { id: 1, name: "one" },
      { id: 2, name: "two" },
    ],
    data: { v: 7 },
    flags: [1, 2, 3],
  };

  function roundTrip() {
    const copy = Kinds.extend({});
    const bytes = c.write(copy, value);
    return { bytes: [...bytes], value: c.read(copy, bytes) };
  }

  it("gives identical results with closures only", () => {
    const generated = roundTrip();
    c.configure({ codegen: false });
    try {
      expect(roundTrip()).toEqual(generated);
    } finally {
      c.configure({ codegen: true });
    }
  });

  it("falls back to closures when new Function is blocked", () => {
    const original = globalThis.Function;
    const generated = roundTrip();
    (globalThis as { Function: unknown }).Function = function blocked() {
      throw new EvalError("Code generation from strings disallowed");
    };
    try {
      expect(roundTrip()).toEqual(generated);
    } finally {
      globalThis.Function = original;
    }
  });
});
