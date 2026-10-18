import { CArray, isCArray } from "./array";
import {
  CAnnotatedField,
  CClassField,
  type CStructField,
  type FieldOptions,
  isCAnnotatedField,
  isCClassField,
  isCStructField,
  type StructFieldValue,
} from "./field";
import { isCPadding } from "./field-types";
import type { StructOptions } from "./options";
import type { output } from "./struct";
import type { Tuple } from "./utils";

const CCLASS_LAYOUT = Symbol.for("cstruct.class.layout");

/** Key under which stage 3 decorator metadata holds a class's own fields. */
const METADATA_FIELDS = Symbol("cstruct.fields");

// Stage 3 decorators only receive `context.metadata` when Symbol.metadata
// exists; TypeScript and esbuild look it up when a class is defined, which
// is after this module has loaded.
(Symbol as { metadata?: symbol }).metadata ??= Symbol.for("Symbol.metadata");

export type ClassCtor<T = object> = new (...args: any[]) => T;

export interface ClassFieldMeta {
  count?: number;
  endian?: FieldOptions["endian"];
  name: string;
  padAfter?: number;
  padBefore?: number;
  type: StructFieldValue | ClassCtor;
}

/** Legacy decorators: own fields per class, until @c.class() runs. */
const PENDING_FIELDS = new WeakMap<Function, ClassFieldMeta[]>();
/** Stage 3 decorators without Symbol.metadata: fields of the class being defined. */
const PENDING_STAGE3_FIELDS: ClassFieldMeta[] = [];
const CLASS_STRUCTS = new WeakMap<Function, StructLike>();
/** Every field of a decorated class, inherited ones first. */
const CLASS_FIELDS = new WeakMap<Function, readonly ClassFieldMeta[]>();

interface StructLike {
  field(options?: FieldOptions): CStructField<StructLike, FieldOptions>;
  getSize(): number;
  read(
    buffer: Uint8Array,
    offset?: number,
    endian?: "little" | "big"
  ): Record<string, unknown>;
  write(data: Record<string, unknown>, endian?: "little" | "big"): Buffer;
}

type StructFactory = (
  fields: Record<string, StructFieldValue>,
  options: StructOptions | undefined,
  ctor: ClassCtor
) => StructLike;

let createStruct: StructFactory | undefined;

export function setStructFactory(factory: StructFactory): void {
  createStruct = factory;
}

export function isClassCtor(value: unknown): value is ClassCtor {
  return (
    typeof value === "function" &&
    (value as unknown as { [key: symbol]: unknown })[CCLASS_LAYOUT] === true
  );
}

export function isClassInstance(value: unknown): value is object {
  return (
    typeof value === "object" &&
    value !== null &&
    isClassCtor((value as object).constructor)
  );
}

/** Nearest decorated class in `ctor`'s prototype chain (itself included). */
function decoratedAncestor<T>(
  ctor: Function,
  table: WeakMap<Function, T>
): T | undefined {
  let current: unknown = ctor;
  while (typeof current === "function") {
    const found = table.get(current);
    if (found !== undefined) {
      return found;
    }
    current = Object.getPrototypeOf(current);
  }
  return;
}

/**
 * The struct of a decorated class. An undecorated subclass of a decorated
 * class uses its ancestor's layout.
 */
export function getClassStruct(ctor: ClassCtor): StructLike {
  const struct = decoratedAncestor(ctor, CLASS_STRUCTS);
  if (!struct) {
    throw new Error(`${ctor.name}: not decorated with @c.class()`);
  }
  return struct;
}

function isStructFieldType(value: unknown): value is StructLike {
  return (
    typeof value === "object" &&
    value !== null &&
    "read" in value &&
    "write" in value &&
    "getSize" in value
  );
}

function isFieldOptions(
  value: unknown
): value is FieldOptions & { count?: number } {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  if (
    isClassCtor(value) ||
    isCArray(value) ||
    isCStructField(value) ||
    isCClassField(value) ||
    isCAnnotatedField(value) ||
    isStructFieldType(value)
  ) {
    return false;
  }
  return "padBefore" in value || "padAfter" in value || "count" in value;
}

function metaToFieldValue(meta: ClassFieldMeta): StructFieldValue {
  const base = isClassCtor(meta.type)
    ? new CClassField(getClassStruct(meta.type))
    : (meta.type as StructFieldValue);
  const options: FieldOptions = {};
  if (meta.padBefore) {
    options.padBefore = meta.padBefore;
  }
  if (meta.padAfter) {
    options.padAfter = meta.padAfter;
  }
  if (meta.endian) {
    options.endian = meta.endian;
  }
  if (meta.count !== undefined) {
    return new CArray(base, meta.count, options);
  }
  return Object.keys(options).length > 0
    ? new CAnnotatedField(base, options)
    : base;
}

function finalizeClass(
  target: Function,
  own: readonly ClassFieldMeta[],
  options: StructOptions | undefined
): void {
  if (!createStruct) {
    throw new Error("cstruct: struct factory not initialized");
  }
  const parent = Object.getPrototypeOf(target) as Function | null;
  const inherited =
    (parent && decoratedAncestor(parent, CLASS_FIELDS)) ?? ([] as const);
  const all = [...inherited, ...own];
  if (all.length === 0) {
    throw new Error(`${target.name}: no @c.field metadata`);
  }

  const fields: Record<string, StructFieldValue> = {};
  for (const meta of all) {
    if (Object.hasOwn(fields, meta.name)) {
      throw new Error(
        `${target.name}: field '${meta.name}' is declared more than once (check base classes)`
      );
    }
    fields[meta.name] = metaToFieldValue(meta);
  }

  CLASS_STRUCTS.set(target, createStruct(fields, options, target as ClassCtor));
  CLASS_FIELDS.set(target, all);
  Object.defineProperty(target, CCLASS_LAYOUT, {
    value: true,
    enumerable: false,
    configurable: false,
  });
}

/** True for the context object a stage 3 decorator receives. */
function isStage3Context(
  value: unknown
): value is { kind: string; metadata?: Record<PropertyKey, unknown> } {
  return typeof value === "object" && value !== null && "kind" in value;
}

/** Own fields recorded in stage 3 metadata (not inherited ones). */
function ownMetadataFields(
  metadata: Record<PropertyKey, unknown>
): ClassFieldMeta[] {
  if (!Object.hasOwn(metadata, METADATA_FIELDS)) {
    metadata[METADATA_FIELDS] = [];
  }
  return metadata[METADATA_FIELDS] as ClassFieldMeta[];
}

/** Works as a legacy (experimentalDecorators) and a stage 3 class decorator. */
export interface ClassDecorator {
  <C extends ClassCtor>(target: C, context: ClassDecoratorContext<C>): void;
  <C extends ClassCtor>(target: C): void;
}

/**
 * `@c.class(options?)` marks a class as a struct layout; `options` are the
 * same as `c.struct`'s (`endian`, `align`, `pack`).
 *
 * `c.class(Ctor, fieldOptions?)` embeds a decorated class in a schema.
 */
export function classImpl(options?: StructOptions): ClassDecorator;
export function classImpl<C extends ClassCtor>(
  ctor: C,
  options?: FieldOptions
): CClassField<StructLike, FieldOptions, InstanceType<C>>;
export function classImpl(
  ctorOrOptions?: ClassCtor | StructOptions,
  fieldOptions?: FieldOptions
) {
  if (typeof ctorOrOptions === "function") {
    return new CClassField(getClassStruct(ctorOrOptions), fieldOptions);
  }
  const structOptions = ctorOrOptions;
  return ((target: Function, context?: unknown) => {
    let own: ClassFieldMeta[];
    if (isStage3Context(context)) {
      own = context.metadata
        ? ownMetadataFields(context.metadata)
        : PENDING_STAGE3_FIELDS.splice(0);
    } else {
      own = PENDING_FIELDS.get(target) ?? [];
      PENDING_FIELDS.delete(target);
    }
    finalizeClass(target, own, structOptions);
  }) as ClassDecorator;
}

/** Decoded value of a `@c.field` type (with `{ count }` applied). */
type DecoratedValue<T, O> = O extends { count: infer N extends number }
  ? Tuple<DecodedValue<T>, N>
  : DecodedValue<T>;

type DecodedValue<T> = T extends ClassCtor<infer I> ? I : output<T>;

/** Shown in the compile error when a property cannot hold the decoded value. */
export interface PropertyTypeMismatch<V> {
  "cstruct: property type must accept decoded value": V;
}

type Stage3Check<V, P> = [V] extends [P] ? unknown : PropertyTypeMismatch<V>;

type LegacyCheck<V, T, K> = K extends keyof T
  ? [V] extends [T[K]]
    ? unknown
    : PropertyTypeMismatch<V>
  : unknown; // private/protected members are not visible to the check

/**
 * A field decorator for both decorator modes. The property's type must be
 * able to hold `V`, the decoded value; legacy mode cannot see private or
 * protected properties and skips the check for them.
 */
export interface FieldDecorator<V> {
  <This, P>(
    target: undefined,
    context: ClassFieldDecoratorContext<This, P> & Stage3Check<V, P>
  ): void;
  <T, K extends string | symbol>(
    target: T & LegacyCheck<V, T, K>,
    key: K
  ): void;
}

export type FieldDecoratorOptions = FieldOptions & { count?: number };

export function fieldImpl<
  const T extends StructFieldValue | ClassCtor,
  const O extends FieldDecoratorOptions = {},
>(type: T, options?: O): FieldDecorator<DecoratedValue<T, O>>;
export function fieldImpl(
  type: StructFieldValue | ClassCtor,
  options?: FieldDecoratorOptions
) {
  if (type === undefined) {
    throw new Error("@c.field() requires a field type");
  }
  if (isFieldOptions(type)) {
    throw new Error(
      "@c.field({ ... }) requires the field type as the first argument"
    );
  }
  if (isCPadding(type as StructFieldValue) && options?.count !== undefined) {
    throw new Error("c.pad() cannot be used with { count }");
  }

  const metaFor = (name: string): ClassFieldMeta => ({
    name,
    type,
    padBefore: options?.padBefore,
    padAfter: options?.padAfter,
    endian: options?.endian,
    count: options?.count,
  });

  return (target: unknown, keyOrContext: unknown): void => {
    if (isStage3Context(keyOrContext)) {
      const context = keyOrContext as ClassFieldDecoratorContext;
      const name = String(context.name);
      if (context.kind !== "field") {
        throw new Error(`@c.field() can only decorate fields, not '${name}'`);
      }
      if (context.static || context.private) {
        throw new Error(
          `@c.field() cannot decorate static or #private fields ('${name}')`
        );
      }
      const metadata = context.metadata as Record<PropertyKey, unknown>;
      (metadata ? ownMetadataFields(metadata) : PENDING_STAGE3_FIELDS).push(
        metaFor(name)
      );
      return;
    }

    const ctor = (target as object).constructor;
    const list = PENDING_FIELDS.get(ctor) ?? [];
    list.push(metaFor(String(keyOrContext)));
    PENDING_FIELDS.set(ctor, list);
  };
}
