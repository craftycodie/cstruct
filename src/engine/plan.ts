import { withPath } from "../errors";
import type { Endian } from "../field-type";
import { isCPadding } from "../field-types/padding";
import type { Layout } from "../layout";
import {
  type Codec,
  compileType,
  describeValue,
  expectObject,
  type Parent,
} from "./codec";
import type { Ctx } from "./ctx";

/** Fixed-count array of one element codec. */
class ArrayCodec implements Codec<unknown[]> {
  readonly count: number;
  readonly element: Codec;
  readonly stride: number;

  constructor(element: Codec, count: number, stride: number) {
    this.element = element;
    this.count = count;
    this.stride = stride;
  }

  read(ctx: Ctx, at: number, parent: Parent): unknown[] {
    const { element, count, stride } = this;
    const out: unknown[] = [];
    let i = 0;
    try {
      for (; i < count; i++) {
        out.push(element.read(ctx, at + i * stride, parent));
      }
    } catch (error) {
      throw withPath(error, "read", i);
    }
    return out;
  }

  write(ctx: Ctx, at: number, value: unknown[], parent: Parent): void {
    const { element, count, stride } = this;
    if (!Array.isArray(value)) {
      throw new TypeError(
        `Expected array of ${count} elements, got ${describeValue(value)}`
      );
    }
    if (value.length < count) {
      throw new RangeError(
        `expected ${count} elements but got ${value.length}`
      );
    }
    let i = 0;
    try {
      for (; i < count; i++) {
        element.write(ctx, at + i * stride, value[i], parent);
      }
    } catch (error) {
      throw withPath(error, "write", i);
    }
  }
}

/** Compiled reader/writer for one struct layout at one endianness. */
export class StructPlan implements Codec<Parent> {
  readonly codecs: Codec[];
  readonly names: string[];
  readonly offsets: number[];

  constructor(names: string[], offsets: number[], codecs: Codec[]) {
    this.names = names;
    this.offsets = offsets;
    this.codecs = codecs;
  }

  read(ctx: Ctx, at: number): Parent {
    return this.readInto(ctx, at, {});
  }

  /** Read every field into `out` (a fresh record or a class instance). */
  readInto<T extends object>(ctx: Ctx, at: number, out: T): T {
    const { names, offsets, codecs } = this;
    const record = out as Parent;
    let i = 0;
    try {
      for (; i < names.length; i++) {
        record[names[i]] = codecs[i].read(ctx, at + offsets[i], record);
      }
    } catch (error) {
      throw withPath(error, "read", names[i]);
    }
    return out;
  }

  write(ctx: Ctx, at: number, value: Parent): void {
    const record = expectObject(value);
    const { names, offsets, codecs } = this;
    let i = 0;
    try {
      for (; i < names.length; i++) {
        codecs[i].write(ctx, at + offsets[i], record[names[i]], record);
      }
    } catch (error) {
      throw withPath(error, "write", names[i]);
    }
  }
}

/**
 * Build the plan for a layout. Padding is skipped entirely: writes target
 * zero-filled memory, and reads leave padding out of the result.
 */
export function compileStruct(layout: Layout, endian: Endian): StructPlan {
  const names: string[] = [];
  const offsets: number[] = [];
  const codecs: Codec[] = [];
  for (const field of layout.fields) {
    if (isCPadding(field.type)) {
      continue;
    }
    const element = compileType(field.type, endian);
    names.push(field.name);
    offsets.push(field.offset);
    codecs.push(
      field.count === undefined
        ? element
        : new ArrayCodec(element, field.count, field.elementSize)
    );
  }
  return new StructPlan(names, offsets, codecs);
}
