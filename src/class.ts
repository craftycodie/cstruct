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

const CCLASS_LAYOUT = Symbol.for("cstruct.class.layout");

export type ClassCtor<T = object> = new (...args: any[]) => T;

export interface ClassFieldMeta {
  count?: number;
  name: string;
  padAfter?: number;
  padBefore?: number;
  type: StructFieldValue | ClassCtor;
}

const PENDING_FIELDS = new WeakMap<Function, ClassFieldMeta[]>();
const CLASS_STRUCTS = new WeakMap<Function, StructLike>();
const CLASS_FIELD_NAMES = new WeakMap<Function, readonly string[]>();

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

type StructFactory = (fields: Record<string, StructFieldValue>) => StructLike;

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

export function getClassFieldNames(ctor: ClassCtor): readonly string[] {
  const names = CLASS_FIELD_NAMES.get(ctor);
  if (!names) {
    throw new Error(`${ctor.name}: not decorated with @c.class()`);
  }
  return names;
}

export function getClassStruct(ctor: ClassCtor): StructLike {
  const struct = CLASS_STRUCTS.get(ctor);
  if (!struct) {
    throw new Error(`${ctor.name}: not decorated with @c.class()`);
  }
  return struct;
}

function isStructInstance(value: unknown): value is StructLike {
  return (
    isStructFieldType(value) &&
    "field" in value &&
    typeof value.field === "function"
  );
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
    isCAnnotatedField(value)
  ) {
    return false;
  }
  if (isStructFieldType(value)) {
    return false;
  }
  if ("getSize" in value && "read" in value && "write" in value) {
    return false;
  }
  return "padBefore" in value || "padAfter" in value || "count" in value;
}

function normalizeFieldType(
  type: StructFieldValue | ClassCtor | StructLike,
  options?: FieldOptions & { count?: number }
): StructFieldValue | ClassCtor {
  if (isClassCtor(type)) {
    return type;
  }
  if (isStructInstance(type)) {
    return type.field(options) as StructFieldValue;
  }
  return type as StructFieldValue;
}

function metaToFieldValue(meta: ClassFieldMeta): StructFieldValue {
  if (isClassCtor(meta.type)) {
    return new CClassField(getClassStruct(meta.type));
  }

  if (meta.count !== undefined) {
    return new CArray(meta.type as StructFieldValue, meta.count, {
      padBefore: meta.padBefore,
      padAfter: meta.padAfter,
    });
  }

  let value = meta.type as StructFieldValue;
  if (meta.padBefore || meta.padAfter) {
    value = new CAnnotatedField(value, {
      padBefore: meta.padBefore,
      padAfter: meta.padAfter,
    });
  }
  return value;
}

export function finalizeClassDecorator(target: Function): void {
  if (!createStruct) {
    throw new Error("cstruct: struct factory not initialized");
  }

  const metas = PENDING_FIELDS.get(target) ?? [];
  if (metas.length === 0) {
    throw new Error(`${target.name}: no @c.field metadata`);
  }

  const fields: Record<string, StructFieldValue> = {};
  for (const meta of metas) {
    fields[meta.name] = metaToFieldValue(meta);
  }

  const struct = createStruct(fields);
  CLASS_STRUCTS.set(target, struct);
  CLASS_FIELD_NAMES.set(
    target,
    metas.map((meta) => meta.name)
  );
  Object.defineProperty(target, CCLASS_LAYOUT, {
    value: true,
    enumerable: false,
    configurable: false,
  });
  PENDING_FIELDS.delete(target);
}

type ClassDecorator = <T extends ClassCtor>(target: T) => T;

export function classImpl(): ClassDecorator;
export function classImpl<C extends ClassCtor>(
  ctor: C,
  options?: FieldOptions
): CClassField<StructLike, FieldOptions>;
export function classImpl(ctorOrVoid?: ClassCtor, options?: FieldOptions) {
  if (ctorOrVoid === undefined) {
    return ((target: Function) => {
      finalizeClassDecorator(target);
    }) as ClassDecorator;
  }
  return new CClassField(getClassStruct(ctorOrVoid), options);
}

export function fieldImpl(
  typeOrOptions:
    | StructFieldValue
    | ClassCtor
    | StructLike
    | (FieldOptions & { count?: number }),
  maybeOptions?: FieldOptions & { count?: number }
) {
  return (target: object, propertyKey: string | symbol): void => {
    const ctor = target.constructor as Function;
    const name = String(propertyKey);

    if (typeOrOptions === undefined) {
      throw new Error("@c.field() requires a field type");
    }

    if (isFieldOptions(typeOrOptions)) {
      throw new Error(
        "@c.field({ ... }) requires the field type as the first argument"
      );
    }

    const structOptions = isStructInstance(typeOrOptions)
      ? maybeOptions
      : undefined;
    const type = normalizeFieldType(typeOrOptions, structOptions);
    const options = isStructInstance(typeOrOptions) ? undefined : maybeOptions;

    if (
      isCPadding(type as StructFieldValue) &&
      name.startsWith("_") &&
      options?.count !== undefined
    ) {
      throw new Error("c.pad() cannot be used with { count }");
    }

    const list = PENDING_FIELDS.get(ctor) ?? [];
    list.push({
      name,
      type,
      padBefore: options?.padBefore,
      padAfter: options?.padAfter,
      count: options?.count,
    });
    PENDING_FIELDS.set(ctor, list);
  };
}
