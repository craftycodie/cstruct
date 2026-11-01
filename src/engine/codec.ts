import { type CFieldType, type Endian, isCFieldType } from "../field-type";
import { applyModifiers } from "../modifiers";
import { type BytesLike, type Ctx, checkRange, createCtx } from "./ctx";

/** The record being read or written around a field (used by discriminated unions). */
export type Parent = Record<string, any>;

/** Compiled reader/writer for one field type in one environment. */
export interface Codec<T = any> {
  read(ctx: Ctx, at: number, parent: Parent): T;
  /**
   * JavaScript expression reading the value at byte offset expression `at`,
   * using locals `dv` (DataView) and `u8` (Uint8Array). Lets generated
   * struct readers inline primitive reads.
   */
  readSource?: (at: string) => string;
  /** True when reading depends on the parent record (union selectors). */
  usesParent?: boolean;
  write(ctx: Ctx, at: number, value: T, parent: Parent): void;
}

/** What a codec is compiled for. Instances are canonical: compare by identity. */
export interface CompileEnv {
  /** Validate integer ranges on write. */
  readonly checked: boolean;
  readonly endian: Endian;
}

const ENVS: readonly CompileEnv[] = [
  Object.freeze({ endian: "little", checked: false }),
  Object.freeze({ endian: "big", checked: false }),
  Object.freeze({ endian: "little", checked: true }),
  Object.freeze({ endian: "big", checked: true }),
];

function envIndex(endian: Endian, checked: boolean): number {
  return (endian === "big" ? 1 : 0) | (checked ? 2 : 0);
}

export function envFor(endian: Endian, checked = true): CompileEnv {
  return ENVS[envIndex(endian, checked)];
}

/** Apply an endianness the type pins through its own options. */
export function resolveEnv(type: unknown, env: CompileEnv): CompileEnv {
  const pinned = (type as { options?: { endian?: Endian } } | null)?.options
    ?.endian;
  return pinned && pinned !== env.endian ? envFor(pinned, env.checked) : env;
}

/** Internal hook: built-in field types return a specialized codec. */
export const COMPILE: unique symbol = Symbol("cstruct.compile");

export interface Compilable {
  [COMPILE](env: CompileEnv): Codec;
}

export const NO_PARENT: Parent = Object.freeze({});

const OWN_CODECS = new WeakMap<object, (Codec | undefined)[]>();

/** The type's own compiled codec, cached per environment. */
export function ownCodec(type: Compilable, env: CompileEnv): Codec {
  const resolved = resolveEnv(type, env);
  let slots = OWN_CODECS.get(type);
  if (!slots) {
    slots = [undefined, undefined, undefined, undefined];
    OWN_CODECS.set(type, slots);
  }
  const index = envIndex(resolved.endian, resolved.checked);
  let codec = slots[index];
  if (!codec) {
    codec = type[COMPILE](resolved);
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
  read(buffer: Uint8Array, offset: number, endian: Endian): unknown;
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

/**
 * Codec for any field type: the fast path when available, else its public
 * methods. Defaults and assertions from the type's options wrap the result.
 */
export function compileType(type: unknown, env: CompileEnv): Codec {
  return applyModifiers(
    baseCodec(type, env),
    (type as { options?: unknown } | null)?.options
  );
}

function baseCodec(type: unknown, env: CompileEnv): Codec {
  if (hasTrustedHook(type)) {
    return ownCodec(type, env);
  }
  const { endian } = resolveEnv(type, env);
  if (isCFieldType(type)) {
    const custom: CFieldType<unknown> = type;
    return {
      read: (ctx, at) => custom.read(ctx.u8, at, endian),
      write: (ctx, at, value) => custom.write(ctx.u8, at, value, endian),
    };
  }
  if (isStructLike(type)) {
    const nested = type;
    return {
      read: (ctx, at) => nested.read(ctx.u8, at, endian),
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
  buffer: BytesLike,
  offset: number,
  endian: Endian,
  parent: Parent = NO_PARENT
): T {
  const ctx = createCtx(buffer);
  checkRange(ctx.u8, offset, type.getSize());
  return ownCodec(type, envFor(endian)).read(ctx, offset, parent);
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
  const ctx = createCtx(buffer);
  checkRange(ctx.u8, offset, type.getSize());
  ownCodec(type, envFor(endian)).write(ctx, offset, value, parent);
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
