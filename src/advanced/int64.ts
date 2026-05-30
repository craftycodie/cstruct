import { CStructError } from "../errors";
import type { Endian, PrimitiveType } from "../primitive";
import { read_primitive, write_primitive } from "../primitive";
import { AdvancedType, need_bytes } from "./advanced-type";

function bigint_from_json(value: unknown, label: string): bigint {
  if (typeof value === "string") {
    try {
      return BigInt(value);
    } catch {
      throw new CStructError(`${label}: invalid bigint string`);
    }
  }
  if (typeof value === "bigint") {
    return value;
  }
  if (typeof value === "number" && Number.isInteger(value)) {
    return BigInt(value);
  }
  throw new CStructError(
    `${label}: expected string, integer number, or bigint`
  );
}

abstract class CInt64 extends AdvancedType<bigint, string> {
  readonly byteSize = 8;

  abstract readonly primitive: Extract<PrimitiveType, "u64" | "i64">;

  read(
    bytes: Uint8Array,
    offset: number,
    endian: Endian,
    _label: string
  ): bigint {
    need_bytes(bytes, offset, this.byteSize, this.primitive);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return read_primitive(view, offset, this.primitive, endian) as bigint;
  }

  write(
    bytes: Uint8Array,
    offset: number,
    value: bigint,
    endian: Endian,
    label: string
  ): void {
    if (typeof value !== "bigint") {
      throw new CStructError(`${label}: expected bigint, got ${typeof value}`);
    }
    need_bytes(bytes, offset, this.byteSize, this.primitive);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    write_primitive(view, offset, this.primitive, value, endian);
  }

  toJson(value: bigint, label: string): string {
    if (typeof value !== "bigint") {
      throw new CStructError(`${label}: expected bigint`);
    }
    return value.toString();
  }

  fromJson(value: unknown, label: string): bigint {
    return bigint_from_json(value, label);
  }
}

/** 8-byte unsigned integer (`u64`) as `bigint` in TypeScript. */
export class CU64 extends CInt64 {
  readonly primitive = "u64" as const;
}

/** 8-byte signed integer (`i64`) as `bigint` in TypeScript. */
export class CI64 extends CInt64 {
  readonly primitive = "i64" as const;
}

const U64_FIELD = new CU64();
const I64_FIELD = new CI64();

/**
 * `u64` field as `bigint` in TypeScript. Use for JSON I/O; primitive `"u64"` is binary-only.
 *
 * @example
 * ```ts
 * import { c } from "@craftycodie/cstruct";
 *
 * @c.struct()
 * class Record {
 *   @c.field(c.U64())
 *   xuid!: bigint;
 * }
 * ```
 */
export function U64(): CU64 {
  return U64_FIELD;
}

/**
 * `i64` field as `bigint` in TypeScript. Use for JSON I/O; primitive `"i64"` is binary-only.
 */
export function I64(): CI64 {
  return I64_FIELD;
}
