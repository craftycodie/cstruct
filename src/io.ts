import { type CArray, isCArray } from "./array";
import {
  type ClassCtor,
  getClassStruct,
  isClassCtor,
  isClassInstance,
} from "./class";
import { envFor, ownCodec } from "./engine/codec";
import type { BytesLike } from "./engine/ctx";
import { runRead, runWrite } from "./engine/run";
import { cImpl } from "./impl";
import {
  type ReadOptions,
  resolveRead,
  resolveWrite,
  type WriteOptions,
} from "./options";

export type Endian = cImpl.Endian;

type ReadArg = number | Endian | ReadOptions;
type WriteArg = Endian | WriteOptions;

export function isStructSchema(
  value: unknown
): value is cImpl.Struct<cImpl.StructFields> {
  return value instanceof cImpl.Struct;
}

function classStruct(instance: object): cImpl.Struct {
  return getClassStruct(instance.constructor as ClassCtor) as cImpl.Struct;
}

/**
 * Decode `buffer` with a schema, a top-level `c.array(...)`, or into a
 * `@c.class()` instance (which is mutated and returned).
 *
 * The third argument is an offset, an endianness, or `{ offset, endian }`.
 */
export function read<F extends cImpl.StructFields>(
  schema: cImpl.Struct<F>,
  buffer: BytesLike,
  offsetOrOptions?: ReadArg,
  endian?: Endian
): cImpl.StructSchemaToTS<F>;
export function read<A extends CArray<any, any, any>>(
  array: A,
  buffer: BytesLike,
  offsetOrOptions?: ReadArg,
  endian?: Endian
): cImpl.infer<A>;
export function read<T extends object>(
  instance: T,
  buffer: BytesLike,
  offsetOrOptions?: ReadArg,
  endian?: Endian
): T;
export function read(
  target: unknown,
  buffer: BytesLike,
  offsetOrOptions?: ReadArg,
  endian?: Endian
): unknown {
  const resolved = resolveRead(offsetOrOptions, endian);

  if (isStructSchema(target)) {
    return target.read(buffer, resolved);
  }
  if (isCArray(target)) {
    return runRead(
      ownCodec(target, envFor(resolved.endian)),
      target.getSize(),
      buffer,
      resolved.offset
    );
  }
  if (isClassInstance(target)) {
    return classStruct(target).readInto(
      buffer,
      resolved.offset,
      resolved.endian,
      target
    );
  }
  throw new Error(
    "c.read() expects a c.struct schema, c.array(...) or @c.class() instance"
  );
}

/**
 * Encode `data` with a schema or top-level `c.array(...)`, or encode a
 * `@c.class()` instance. The last argument is an endianness or
 * `{ endian, checked, into, offset }`.
 */
export function write<F extends cImpl.StructFields>(
  schema: cImpl.Struct<F>,
  data: cImpl.input<cImpl.Struct<F>>,
  endianOrOptions?: WriteArg
): Buffer;
export function write<A extends CArray<any, any, any>>(
  array: A,
  data: cImpl.input<A>,
  endianOrOptions?: WriteArg
): Buffer;
export function write<T extends object>(
  instance: T,
  endianOrOptions?: WriteArg
): Buffer;
export function write(
  target: unknown,
  arg2?: unknown,
  arg3?: WriteArg
): Buffer {
  if (isStructSchema(target) || isCArray(target)) {
    if (arg2 === undefined || arg2 === "little" || arg2 === "big") {
      throw new Error("c.write(schema, data) requires a data object");
    }
    if (isStructSchema(target)) {
      return (target as cImpl.Struct).write(
        arg2 as Record<string, any>,
        arg3 as WriteOptions
      );
    }
    const resolved = resolveWrite(arg3);
    return runWrite(
      ownCodec(target, envFor(resolved.endian, resolved.checked)),
      target.getSize(),
      arg2,
      resolved
    );
  }
  if (isClassInstance(target)) {
    return classStruct(target).write(
      target as Record<string, any>,
      arg2 as WriteOptions
    );
  }
  throw new Error(
    "c.write() expects a c.struct schema, c.array(...) or @c.class() instance"
  );
}

/**
 * Packed size in bytes of a schema, `@c.class()` (constructor or instance),
 * array or field type: `c.sizeof(c.u32())` is 4.
 */
export function sizeof<F extends cImpl.StructFields>(
  schema: cImpl.Struct<F>
): number;
export function sizeof(type: { getSize(): number }): number;
export function sizeof(classOrInstance: object): number;
export function sizeof(target: unknown): number {
  if (isClassCtor(target)) {
    return getClassStruct(target).getSize();
  }
  if (isClassInstance(target)) {
    return classStruct(target).getSize();
  }
  if (
    typeof target === "object" &&
    target !== null &&
    typeof (target as { getSize?: unknown }).getSize === "function"
  ) {
    return (target as { getSize(): number }).getSize();
  }
  throw new Error(
    "c.sizeof() expects a schema, field type or @c.class() class/instance"
  );
}

/**
 * Byte offset of a field, like C `offsetof`. Accepts nested paths and array
 * indexes: `c.offsetof(Header, "points[2].x")`.
 */
export function offsetof<F extends cImpl.StructFields>(
  schema: cImpl.Struct<F>,
  path: (keyof F & string) | (string & {})
): number;
export function offsetof(classOrInstance: object, path: string): number;
export function offsetof(target: unknown, path: string): number {
  if (isStructSchema(target)) {
    return target.offsetOf(path);
  }
  if (isClassCtor(target)) {
    return (getClassStruct(target) as cImpl.Struct).offsetOf(path);
  }
  if (isClassInstance(target)) {
    return classStruct(target).offsetOf(path);
  }
  throw new Error(
    "c.offsetof() expects a c.struct schema or @c.class() class/instance"
  );
}
