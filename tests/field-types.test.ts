import { describe, expectTypeOf, it } from "vitest";
import type { FieldValue } from "../src/field-value";
import { c } from "../src/index";

const SkullFlags = ["iron", "mythic"] as const;

@c.struct()
class Point {
  @c.field("i16")
  x!: number;
  @c.field("i16")
  y!: number;
}

@c.struct()
class ArmA {
  @c.field("u8")
  value!: number;
}

@c.struct()
class Host {
  @c.field("u8")
  kind!: number;

  @c.union(
    { size: 4 },
    c.arm(ArmA, (m: Host) => m.kind === 1)
  )
  data: ArmA | null = null;
}

describe("FieldValue", () => {
  it("maps field descriptors to in-memory types", () => {
    expectTypeOf<FieldValue<"u32">>().toEqualTypeOf<number>();
    expectTypeOf<FieldValue<"u64">>().toEqualTypeOf<bigint>();
    expectTypeOf<
      FieldValue<ReturnType<typeof c.Time64>>
    >().toEqualTypeOf<Date>();
    const skullField = c.bitfield("u8", SkullFlags);
    expectTypeOf<
      FieldValue<typeof skullField>["iron"]
    >().toEqualTypeOf<boolean>();
    expectTypeOf<FieldValue<typeof Point>>().toEqualTypeOf<Point>();
  });
});

describe("@c.field property type enforcement", () => {
  describe("primitives", () => {
    it("accepts bigint for u64", () => {
      @c.struct()
      class GoodU64 {
        @c.field("u64")
        test!: bigint;
      }

      expectTypeOf<GoodU64>().toMatchObjectType<{ test: bigint }>();
    });

    it("rejects string for u64", () => {
      @c.struct()
      class BadU64 {
        // @ts-expect-error -- u64 field must be bigint
        @c.field("u64")
        test!: string;
      }

      expectTypeOf<BadU64>().toEqualTypeOf<BadU64>();
    });

    it("accepts number for u32", () => {
      @c.struct()
      class GoodU32 {
        @c.field("u32")
        test!: number;
      }

      expectTypeOf<GoodU32>().toMatchObjectType<{ test: number }>();
    });

    it("rejects string for u32", () => {
      @c.struct()
      class BadU32 {
        // @ts-expect-error -- u32 field must be number
        @c.field("u32")
        test!: string;
      }

      expectTypeOf<BadU32>().toEqualTypeOf<BadU32>();
    });

    it("accepts bigint for i64", () => {
      @c.struct()
      class GoodI64 {
        @c.field("i64")
        test!: bigint;
      }

      expectTypeOf<GoodI64>().toMatchObjectType<{ test: bigint }>();
    });

    it("rejects number for i64", () => {
      @c.struct()
      class BadI64 {
        // @ts-expect-error -- i64 field must be bigint
        @c.field("i64")
        test!: number;
      }

      expectTypeOf<BadI64>().toEqualTypeOf<BadI64>();
    });
  });

  it("accepts matching property types", () => {
    @c.struct()
    class Good {
      @c.field("u64")
      xuid!: bigint;

      @c.field(c.Time64())
      when!: Date;

      @c.field(Point)
      origin!: Point;

      @c.field("u32", { count: 2 })
      scores!: number[];
    }

    expectTypeOf<Good>().toMatchObjectType<{
      xuid: bigint;
      when: Date;
      origin: Point;
      scores: number[];
    }>();
  });

  it("rejects mismatched property types at compile time", () => {
    @c.struct()
    class BadU64Date {
      // @ts-expect-error -- u64 field must be bigint
      @c.field("u64")
      xuid!: Date;
    }

    @c.struct()
    class BadTime64 {
      // @ts-expect-error -- Time64 field must be Date
      @c.field(c.Time64())
      when!: bigint;
    }

    @c.struct()
    class BadNested {
      // @ts-expect-error -- nested struct field must be Point
      @c.field(Point)
      origin!: number;
    }

    expectTypeOf<BadU64Date>().toEqualTypeOf<BadU64Date>();
    expectTypeOf<BadTime64>().toEqualTypeOf<BadTime64>();
    expectTypeOf<BadNested>().toEqualTypeOf<BadNested>();
  });
});
