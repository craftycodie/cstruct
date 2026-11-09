import {
  COMPILE,
  type Codec,
  type CompileEnv,
  NO_PARENT,
  readWith,
  writeWith,
} from "../engine/codec";
import type { FieldOptions } from "../field";
import { CFieldType, type Endian } from "../field-type";
import { CBigint } from "./bigint";
import { type CNumeric, numericCodec } from "./numeric";

/** An object of named members: a TypeScript `enum` or an `as const` map. */
export type EnumLike = Readonly<Record<string, string | number>>;

/**
 * Decoded value: a name from a list, or a member value from an object (a
 * TypeScript numeric enum's reverse mapping is not a member).
 */
type EnumValue<T> = T extends readonly string[]
  ? T[number]
  : [T[keyof T]] extends [number]
    ? T[keyof T]
    : Extract<T[keyof T], number>;

/**
 * C enum backed by a numeric field type. Like zod 4's `z.enum`: a list of
 * names decodes to the names (stored as their index), and an object or
 * TypeScript enum decodes to its member values.
 */
export class CEnum<
  const T extends readonly string[] | EnumLike,
  PT extends CNumeric,
  const O extends FieldOptions = {},
> extends CFieldType<EnumValue<T>, O> {
  /** Stored number for each decoded value. */
  private readonly toStored: Map<string | number, number>;
  /** Decoded value for each stored number. */
  private readonly fromStored: Map<number, string | number>;
  private readonly type: PT;

  constructor(namesOrEnum: T, type: PT, options?: O) {
    super(options);
    this.type = type;
    this.toStored = new Map();
    this.fromStored = new Map();

    if (Array.isArray(namesOrEnum)) {
      for (const [index, name] of namesOrEnum.entries()) {
        this.toStored.set(name, index);
        this.fromStored.set(index, name);
      }
      return;
    }
    for (const [name, value] of Object.entries(namesOrEnum)) {
      if (typeof value === "number") {
        this.toStored.set(value, value);
        this.fromStored.set(value, value);
      } else if ((namesOrEnum as EnumLike)[value] !== Number(name)) {
        // Skip a TypeScript enum's reverse mapping (`E[0] === "A"`); any
        // other string member cannot be stored in an integer.
        throw new TypeError(
          `c.enum member '${name}' is not a number and cannot be stored`
        );
      }
    }
    if (this.toStored.size === 0) {
      throw new TypeError("c.enum needs at least one numeric member");
    }
  }

  getSize(): number {
    return this.type.getSize();
  }

  getAlign(): number {
    return this.type.getAlign();
  }

  read(buffer: Uint8Array, offset: number, endian: Endian): EnumValue<T> {
    return readWith(this, buffer, offset, endian);
  }

  write(
    buffer: Uint8Array,
    offset: number,
    value: EnumValue<T>,
    endian: Endian
  ): void {
    writeWith(this, buffer, offset, value, endian);
  }

  [COMPILE](env: CompileEnv): Codec<string | number> {
    const storage = numericCodec(this.type, env);
    const wide = this.type instanceof CBigint;
    const { fromStored, toStored } = this;
    return {
      read: (ctx, at) => {
        const stored = Number(storage.read(ctx, at, NO_PARENT));
        const value = fromStored.get(stored);
        if (value === undefined) {
          throw new Error(`${stored} is not a valid enum value`);
        }
        return value;
      },
      write: (ctx, at, value) => {
        const stored = toStored.get(value);
        if (stored === undefined) {
          throw new Error(`${String(value)} is not a valid enum value`);
        }
        storage.write(ctx, at, wide ? BigInt(stored) : stored, NO_PARENT);
      },
    };
  }
}
