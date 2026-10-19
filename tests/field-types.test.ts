import { describe, expect, expectTypeOf, it } from "vitest";
import { c } from "../src/index";

const SkullFlags = ["iron", "mythic"] as const;

const Point = c.struct({
  x: c.i16(),
  y: c.i16(),
});

const ArmA = c.struct({
  value: c.u8(),
});

const Host = c.struct({
  kind: c.u8(),
  data: c.discriminatedUnion(
    { size: 4 },
    c.arm(ArmA, (m) => m.kind === 1)
  ),
});

describe("c.infer", () => {
  it("maps schema fields to TypeScript types", () => {
    expectTypeOf<c.infer<ReturnType<typeof c.u32>>>().toEqualTypeOf<number>();
    expectTypeOf<c.infer<ReturnType<typeof c.u64>>>().toEqualTypeOf<bigint>();
    expectTypeOf<c.infer<ReturnType<typeof c.Time64>>>().toEqualTypeOf<Date>();
    const skullField = c.Bitfield(SkullFlags, c.u8());
    expectTypeOf<c.infer<typeof skullField>["iron"]>().toEqualTypeOf<boolean>();
    expectTypeOf<c.infer<typeof Point>>().toEqualTypeOf<{
      x: number;
      y: number;
    }>();
    expectTypeOf<c.infer<typeof Host>["data"]>().toEqualTypeOf<{
      value: number;
    } | null>();
  });

  it("accepts any struct where c.Struct is expected", () => {
    const schemas: c.Struct[] = [Point, Host];
    expect(schemas).toHaveLength(2);
  });

  it("uses tuples below 100 elements and arrays from 100 up", () => {
    const small = c.array(c.u8(), 3);
    const edge = c.array(c.u8(), 99);
    const large = c.array(Point, 1000);
    expectTypeOf<c.infer<typeof small>>().toEqualTypeOf<
      [number, number, number]
    >();
    expectTypeOf<c.infer<typeof edge>["length"]>().toEqualTypeOf<99>();
    expectTypeOf<c.infer<typeof large>>().toEqualTypeOf<
      { x: number; y: number }[]
    >();
  });
});

describe("@c.field property type enforcement", () => {
  it("accepts bigint for u64", () => {
    @c.class()
    class GoodU64 {
      @c.field(c.u64())
      test!: bigint;
    }

    expectTypeOf<GoodU64>().toMatchObjectType<{ test: bigint }>();
  });

  it("rejects properties that cannot hold the decoded value", () => {
    @c.class()
    class BadU64 {
      // @ts-expect-error u64 decodes to bigint, not string
      @c.field(c.u64())
      test!: string;

      // @ts-expect-error Time64 decodes to Date
      @c.field(c.Time64())
      when!: number;
    }

    expect(c.sizeof(BadU64)).toBe(16);
  });

  it("accepts wider property types than the decoded value", () => {
    @c.class()
    class Wide {
      @c.field(c.MagicNumber(0xbeef, c.u16()))
      magic!: number;

      @c.field(c.u8(), { count: 4 })
      rgba!: number[];

      @c.field(c.u16())
      maybe?: number;

      @c.field(c.u32())
      private hidden!: number;

      reveal(): number {
        return this.hidden;
      }
    }

    expect(c.sizeof(Wide)).toBe(12);
  });

  it("accepts matching property types on decorated classes", () => {
    @c.class()
    class Good {
      @c.field(c.u64())
      xuid!: bigint;

      @c.field(c.Time64())
      when!: Date;

      @c.field(Point)
      origin!: c.infer<typeof Point>;

      @c.field(c.array(c.u32(), 2))
      scores!: [number, number];
    }

    expectTypeOf<Good>().toMatchObjectType<{
      xuid: bigint;
      when: Date;
      origin: { x: number; y: number };
      scores: [number, number];
    }>();
  });
});
