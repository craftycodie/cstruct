import { type CFieldType, type Endian, isCFieldType } from "../field-type";
import { type Ctx, checkRange, createCtx, ctxBuffer } from "./ctx";

/** The record being read or written around a field (used by discriminated unions). */
export type Parent = Record<string, any>;

/** Compiled reader/writer for one field type at one endianness. */
export interface Codec<T = any> {
  read(ctx: Ctx, at: number, parent: Parent): T;
  write(ctx: Ctx, at: number, value: T, parent: Parent): void;
}

/** Internal hook: built-in field types return a specialized codec. */
export const COMPILE: unique symbol = Symbol("cstruct.compile");

export interface Compilable {
  [COMPILE](endian: Endian): Codec;
}

export const NO_PARENT: Parent = Object.freeze({});

const OWN_CODECS = new WeakMap<
  object,
  [Codec | undefined, Codec | undefined]
>();

/** The type's own compiled codec, cached per endianness. */
export function ownCodec(type: Compilable, endian: Endian): Codec {
  let slots = OWN_CODECS.get(type);
  if (!slots) {
    slots = [undefined, undefined];
    OWN_CODECS.set(type, slots);
  }
  const index = endian === "big" ? 1 : 0;
  let codec = slots[index];
  if (!codec) {
    codec = type[COMPILE](endian);
    slots[index] = codec;
  }
  return codec;
}

/**
 * True when `type` has a compile hook that still matches its behaviour.
 * A user subclass that overrides `read` or `write` of a built-in loses the
 * fast path, so its overrides keep running.
 */
function hasTrustedHook(type: unknown): type is Compilable {
  if (
    typeof type !== "object" ||
    type === null ||
    typeof (type as Partial<Compilable>)[COMPILE] !== "function"
  ) {
    return false;
  }
  let owner: any = Object.getPrototypeOf(type);
  while (owner !== null && !Object.hasOwn(owner, COMPILE)) {
    owner = Object.getPrototypeOf(owner);
  }
  if (owner === null) {
    return true;
  }
  const candidate = type as { read?: unknown; write?: unknown };
  return candidate.read === owner.read && candidate.write === owner.write;
}

interface StructLikeType {
  getSize(): number;
  read(buffer: Buffer, offset: number, endian: Endian): unknown;
  write(data: unknown, endian: Endian): Uint8Array;
}

function isStructLike(value: unknown): value is StructLikeType {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as StructLikeType).read === "function" &&
    typeof (value as StructLikeType).write === "function" &&
    typeof (value as StructLikeType).getSize === "function"
  );
}

/** Codec for any field type: the fast path when available, else its public methods. */
export function compileType(type: unknown, endian: Endian): Codec {
  if (hasTrustedHook(type)) {
    return ownCodec(type, endian);
  }
  if (isCFieldType(type)) {
    const custom: CFieldType<unknown> = type;
    return {
      read: (ctx, at) => custom.read(ctxBuffer(ctx), at, endian),
      write: (ctx, at, value) =>
        custom.write(ctxBuffer(ctx), at, value, endian),
    };
  }
  if (isStructLike(type)) {
    const nested = type;
    return {
      read: (ctx, at) => nested.read(ctxBuffer(ctx), at, endian),
      write: (ctx, at, value) => {
        ctx.u8.set(nested.write(value, endian), at);
      },
    };
  }
  throw new TypeError("Unsupported field type");
}

/** Public `read(buffer, offset, endian)` for built-in types. */
export function readWith<T>(
  type: Compilable & { getSize(): number },
  buffer: Uint8Array,
  offset: number,
  endian: Endian,
  parent: Parent = NO_PARENT
): T {
  checkRange(buffer, offset, type.getSize());
  return ownCodec(type, endian).read(createCtx(buffer), offset, parent);
}

/** Public `write(buffer, offset, value, endian)` for built-in types. */
export function writeWith<T>(
  type: Compilable & { getSize(): number },
  buffer: Uint8Array,
  offset: number,
  value: T,
  endian: Endian,
  parent: Parent = NO_PARENT
): void {
  checkRange(buffer, offset, type.getSize());
  ownCodec(type, endian).write(createCtx(buffer), offset, value, parent);
}

export function describeValue(value: unknown): string {
  switch (typeof value) {
    case "string":
      return JSON.stringify(
        value.length > 32 ? `${value.slice(0, 32)}…` : value
      );
    case "bigint":
      return `${value}n`;
    case "number":
    case "boolean":
    case "undefined":
      return String(value);
    case "object":
      if (value === null) {
        return "null";
      }
      if (Array.isArray(value)) {
        return `array of ${value.length}`;
      }
      return value.constructor?.name ?? "object";
    default:
      return typeof value;
  }
}

/** Throw a TypeError naming the expected and actual value. */
export function expected(what: string, value: unknown): never {
  throw new TypeError(`expected ${what}, got ${describeValue(value)}`);
}

export function expectNumber(value: unknown): number {
  return typeof value === "number" ? value : expected("number", value);
}

export function expectBigint(value: unknown): bigint {
  return typeof value === "bigint" ? value : expected("bigint", value);
}

export function expectObject(value: unknown): Parent {
  return typeof value === "object" && value !== null
    ? (value as Parent)
    : expected("object", value);
}
