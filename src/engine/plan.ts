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
import {
  generateReader,
  generateWriter,
  type StructReader,
  type StructWriter,
} from "./codegen";
import type { Ctx } from "./ctx";

/** Fixed-count array of one element codec. */
export class ArrayCodec implements Codec<unknown[]> {
  readonly count: number;
  readonly element: Codec;
  readonly stride: number;
  readonly usesParent: boolean | undefined;

  constructor(element: Codec, count: number, stride: number) {
    this.element = element;
    this.count = count;
    this.stride = stride;
    this.usesParent = element.usesParent;
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
  /** Class constructor wrapper, or undefined for plain records. */
  private readonly classCreate: (() => object) | undefined;
  /** Generated reader, built on first read (undefined: use closures). */
  private fastRead: StructReader | undefined | null = null;
  /** Generated writer, built on first write (undefined: use closures). */
  private fastWrite: StructWriter | undefined | null = null;

  constructor(
    names: string[],
    offsets: number[],
    codecs: Codec[],
    defaults: readonly (readonly [string, () => unknown])[] = [],
    create?: () => object
  ) {
    this.names = names;
    this.offsets = offsets;
    this.codecs = codecs;
    this.defaults = defaults;
    this.classCreate = create;
    this.create = create ?? (() => ({}));
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

  /** Reads into a new object with the closures (precise error paths). */
  private readonly slowRead: StructReader = (ctx, at) =>
    this.readInto(ctx, at, this.create());

  /** The fastest available reader for a new object. */
  getReader(): StructReader {
    if (this.fastRead === null) {
      this.fastRead = generateReader({
        names: this.names,
        offsets: this.offsets,
        codecs: this.codecs,
        create: this.classCreate,
        slow: this.slowRead,
      });
    }
    return this.fastRead ?? this.slowRead;
  }

  read(ctx: Ctx, at: number): Parent {
    return this.getReader()(ctx, at);
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

  /** Writes a prepared record with the closures (precise error paths). */
  private readonly slowWrite: StructWriter = (ctx, at, record) => {
    const { names, offsets, codecs } = this;
    let i = 0;
    try {
      for (; i < names.length; i++) {
        codecs[i].write(ctx, at + offsets[i], record[names[i]], record);
      }
    } catch (error) {
      throw withPath(error, "write", names[i]);
    }
  };

  /** Validate a value and fill its defaults, giving the record to write. */
  prepare(value: unknown): Parent {
    return this.effective(expectObject(value));
  }

  /** The fastest available writer for a prepared record. */
  getRecordWriter(): StructWriter {
    if (this.fastWrite === null) {
      this.fastWrite = generateWriter({
        names: this.names,
        offsets: this.offsets,
        codecs: this.codecs,
        slow: this.slowWrite,
      });
    }
    return this.fastWrite ?? this.slowWrite;
  }

  write(ctx: Ctx, at: number, value: Parent): void {
    this.getRecordWriter()(ctx, at, this.prepare(value));
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
