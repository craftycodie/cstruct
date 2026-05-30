import { CStructError } from "../errors";
import type { Endian } from "../primitive";
import { read_primitive, write_primitive } from "../primitive";
import { AdvancedType, need_bytes } from "./advanced-type";

/** Seconds since Unix epoch (stored as u64). */
export function time64_seconds_to_date(seconds: bigint): Date {
  const ms = Number(seconds) * 1000;
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) {
    throw new CStructError(`Invalid time64 value: ${seconds}`);
  }
  return date;
}

export function date_to_time64_seconds(date: Date): bigint {
  if (Number.isNaN(date.getTime())) {
    throw new CStructError("Cannot encode invalid Date as time64");
  }
  return BigInt(Math.floor(date.getTime() / 1000));
}

/** `u64` Unix timestamp field typed as {@link Date} in TypeScript. */
export class CTime64 extends AdvancedType<Date, string> {
  readonly byteSize = 8;

  read(
    bytes: Uint8Array,
    offset: number,
    endian: Endian,
    _label: string
  ): Date {
    need_bytes(bytes, offset, this.byteSize, "time64");
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const seconds = read_primitive(view, offset, "u64", endian) as bigint;
    return time64_seconds_to_date(seconds);
  }

  write(
    bytes: Uint8Array,
    offset: number,
    value: Date,
    endian: Endian,
    label: string
  ): void {
    if (!(value instanceof Date)) {
      throw new CStructError(`${label}: expected Date, got ${typeof value}`);
    }
    need_bytes(bytes, offset, this.byteSize, "time64");
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    write_primitive(view, offset, "u64", date_to_time64_seconds(value), endian);
  }

  toJson(value: Date): string {
    return value.toISOString();
  }

  fromJson(value: unknown, label: string): Date {
    if (typeof value !== "string") {
      throw new CStructError(`${label}: expected ISO date string`);
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new CStructError(`${label}: invalid date string`);
    }
    return date;
  }
}

/**
 * `u64` Unix timestamp field exposed as {@link Date} in TypeScript.
 *
 * @example
 * ```ts
 * import { c } from "@craftycodie/cstruct";
 *
 * @c.struct()
 * class Event {
 *   @c.field(c.Time64())
 *   when!: Date;
 * }
 *
 * const bytes = c.write(Event, { when: new Date("2020-01-01T00:00:00.000Z") } as Event);
 * ```
 */
export function Time64(): CTime64 {
  return new CTime64();
}
