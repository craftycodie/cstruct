import { withPath } from "../errors";
import { isCPadding } from "../field-types/padding";
import type { Layout } from "../layout";
import { applyModifiers, defaultGetter } from "../modifiers";
import {
  type Codec,
  type CompileEnv,
  compileType,
  describeValue,
  envFor,
  expectObject,
  type Parent,
} from "./codec";
import type { Ctx } from "./ctx";

/** Fixed-count array of one element codec. */
export class ArrayCodec implements Codec<unknown[]> {
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
  /** Fields with a value to use when omitted on write. */
  readonly defaults: readonly (readonly [string, () => unknown])[];
  readonly names: string[];
  readonly offsets: number[];

  /** Creates the object a read fills: a class instance or a plain record. */
  readonly create: () => object;

  constructor(
    names: string[],
    offsets: number[],
    codecs: Codec[],
    defaults: readonly (readonly [string, () => unknown])[] = [],
    create: () => object = () => ({})
  ) {
    this.names = names;
    this.offsets = offsets;
    this.codecs = codecs;
    this.defaults = defaults;
    this.create = create;
  }

  /**
   * The record to write: `value` itself, or a shallow copy with omitted
   * defaults and magic constants filled in, so discriminants can see them.
   */
  private effective(value: Parent): Parent {
    let record = value;
    for (const [name, get] of this.defaults) {
      if (record[name] === undefined) {
        if (record === value) {
          record = { ...value };
        }
        record[name] = get();
      }
    }
    return record;
  }

  read(ctx: Ctx, at: number): Parent {
    return this.readInto(ctx, at, this.create());
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
    const record = this.effective(expectObject(value));
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
export function compileStruct(
  layout: Layout,
  env: CompileEnv,
  create?: () => object
): StructPlan {
  const names: string[] = [];
  const offsets: number[] = [];
  const codecs: Codec[] = [];
  const defaults: [string, () => unknown][] = [];
  for (const field of layout.fields) {
    if (isCPadding(field.type)) {
      continue;
    }
    const getDefault =
      field.count === undefined
        ? defaultGetter(field.type, field.wrapperOptions)
        : defaultGetter(undefined, field.wrapperOptions);
    if (getDefault) {
      defaults.push([field.name, getDefault]);
    }
    const fieldEnv = field.endian ? envFor(field.endian, env.checked) : env;
    const element = compileType(field.type, fieldEnv);
    names.push(field.name);
    offsets.push(field.offset);
    codecs.push(
      applyModifiers(
        field.count === undefined
          ? element
          : new ArrayCodec(element, field.count, field.elementSize),
        field.wrapperOptions
      )
    );
  }
  return new StructPlan(names, offsets, codecs, defaults, create);
}
