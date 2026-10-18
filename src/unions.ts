import {
  COMPILE,
  type Codec,
  type CompileEnv,
  compileType,
  envFor,
  NO_PARENT,
  readWith,
  writeWith,
} from "./engine/codec";
import { checkRange, createCtx } from "./engine/ctx";
import type { FieldOptions, StructFieldType } from "./field";
import { alignOf, CFieldType, type Endian } from "./field-type";
import type { cImpl as CTypes } from "./impl";

/** C-style union where multiple structs share the same memory location. */
export class CUnion<
  S extends Record<string, CTypes.Struct<CTypes.StructFields>>,
  const O extends FieldOptions = {},
> extends CFieldType<
  {
    [K in keyof S]?: CTypes.infer<S[K]>;
  },
  O
> {
  private readonly members: S;
  private readonly memberNames: string[];
  private readonly structs: CTypes.Struct<CTypes.StructFields>[];
  private readonly maxSize: number;

  constructor(members: S, options?: O) {
    super(options);
    this.members = members;
    this.memberNames = Object.keys(members);
    this.structs = Object.values(members);

    this.maxSize = 0;
    for (const struct of this.structs) {
      this.maxSize = Math.max(this.maxSize, struct.getSize());
    }
  }

  getSize(): number {
    return this.maxSize;
  }

  getAlign(): number {
    return Math.max(1, ...this.structs.map(alignOf));
  }

  read(
    buffer: Uint8Array,
    offset: number,
    endian: Endian
  ): {
    [K in keyof S]?: CTypes.infer<S[K]>;
  } {
    return readWith(this, buffer, offset, endian);
  }

  write(
    buffer: Uint8Array,
    offset: number,
    value: { [K in keyof S]?: CTypes.infer<S[K]> },
    endian: Endian
  ): void {
    writeWith(this, buffer, offset, value, endian);
  }

  readMember<K extends keyof S>(
    buffer: Uint8Array,
    offset: number,
    memberName: K,
    endian: Endian
  ): CTypes.infer<S[K]> {
    const struct = this.members[memberName];
    if (!struct) {
      throw new Error(`Union member '${String(memberName)}' not found`);
    }
    return struct.read(buffer, offset, endian) as CTypes.infer<S[K]>;
  }

  writeMember<K extends keyof S>(
    buffer: Uint8Array,
    offset: number,
    memberName: K,
    value: CTypes.infer<S[K]>,
    endian: Endian
  ): void {
    const struct = this.members[memberName];
    if (!struct) {
      throw new Error(`Union member '${String(memberName)}' not found`);
    }
    const ctx = createCtx(buffer);
    checkRange(ctx.u8, offset, struct.getSize());
    compileType(struct, envFor(endian)).write(ctx, offset, value, NO_PARENT);
  }

  [COMPILE](env: CompileEnv): Codec<Record<string, unknown>> {
    const names = this.memberNames;
    const codecs = this.structs.map((struct) => compileType(struct, env));
    return {
      read: (ctx, at) => {
        const out: Record<string, unknown> = {};
        for (let i = 0; i < names.length; i++) {
          try {
            out[names[i]] = codecs[i].read(ctx, at, out);
          } catch {
            out[names[i]] = undefined;
          }
        }
        return out;
      },
      write: (ctx, at, value) => {
        if (value !== null && value !== undefined) {
          for (let i = 0; i < names.length; i++) {
            const member = value[names[i]];
            if (member !== undefined) {
              codecs[i].write(ctx, at, member, value);
              return;
            }
          }
        }
        throw new Error("No union member provided for write operation");
      },
    };
  }
}

export type UnionWhen = (parent: Record<string, unknown>) => boolean;

export type UnionArmInput<S extends StructFieldType = StructFieldType> =
  readonly [S, UnionWhen];

export type UnionArmSchema<A extends UnionArmInput> = A extends readonly [
  infer S,
  UnionWhen,
]
  ? S extends CTypes.Struct<infer F>
    ? CTypes.StructSchemaToTS<F>
    : never
  : never;

export type UnionOfArms<Arms extends readonly UnionArmInput[]> = UnionArmSchema<
  Arms[number]
>;

export function arm<S extends StructFieldType>(
  struct: S,
  when: UnionWhen
): UnionArmInput<S> {
  return [struct, when];
}

export function when<
  S extends StructFieldType,
  const V extends number | string,
>(
  value: V,
  struct: S,
  discriminant: (parent: Record<string, unknown>) => number | string
): UnionArmInput<S> {
  return [struct, (parent) => discriminant(parent) === value];
}

function parseArms(arms: readonly UnionArmInput[]): {
  structs: StructFieldType[];
  whens: UnionWhen[];
} {
  if (arms.length === 0) {
    throw new Error("discriminatedUnion requires at least one arm");
  }

  const structs: StructFieldType[] = [];
  const whens: UnionWhen[] = [];

  for (const input of arms) {
    if (
      !Array.isArray(input) ||
      input.length !== 2 ||
      typeof input[1] !== "function"
    ) {
      throw new Error(
        "Union arm requires c.arm(Struct, (parent) => ...) or c.when(value, Struct, (parent) => ...)"
      );
    }
    structs.push(input[0]);
    whens.push(input[1]);
  }

  return { structs, whens };
}

function buildSelect(
  whens: UnionWhen[]
): (parent: Record<string, unknown>) => number | null {
  return (parent) => {
    const index = whens.findIndex((when) => when(parent));
    return index >= 0 ? index : null;
  };
}

/** Discriminated union slot: one active arm selected from parent fields, or null. */
export class CDiscriminatedUnion<
  const Arms extends readonly UnionArmInput[] = readonly UnionArmInput[],
  const O extends FieldOptions = {},
> {
  readonly __cdiscriminatedUnion = true as const;
  readonly arms: Arms;
  readonly inactiveSize: number;
  readonly size: number;
  readonly options: O;
  private readonly armStructs: StructFieldType[];
  private readonly select: (parent: Record<string, unknown>) => number | null;

  constructor(options: { size: number }, arms: Arms, fieldOptions?: O) {
    const { structs, whens } = parseArms(arms);
    this.arms = arms;
    this.armStructs = structs;
    this.select = buildSelect(whens);
    this.inactiveSize = options.size;
    this.options = (fieldOptions ?? {}) as O;

    let maxSize = options.size;
    for (const struct of structs) {
      maxSize = Math.max(maxSize, struct.getSize());
    }
    this.size = maxSize;

    for (const struct of structs) {
      if (struct.getSize() > this.size) {
        throw new Error(
          `discriminatedUnion arm size ${struct.getSize()} exceeds union slot size ${this.size}`
        );
      }
    }
  }

  getSize(): number {
    return this.size;
  }

  getAlign(): number {
    return Math.max(1, ...this.armStructs.map(alignOf));
  }

  read(
    buffer: Uint8Array,
    offset: number,
    endian: Endian,
    parent: Record<string, unknown>
  ): UnionOfArms<Arms> | null {
    return readWith(this, buffer, offset, endian, parent);
  }

  write(
    buffer: Uint8Array,
    offset: number,
    value: UnionOfArms<Arms> | null | undefined,
    endian: Endian,
    parent: Record<string, unknown>
  ): void {
    writeWith(this, buffer, offset, value, endian, parent);
  }

  [COMPILE](env: CompileEnv): Codec<UnionOfArms<Arms> | null | undefined> {
    const select = this.select;
    const size = this.size;
    const arms = this.armStructs.map((struct) => compileType(struct, env));
    const armSizes = this.armStructs.map((struct) => struct.getSize());
    return {
      read: (ctx, at, parent) => {
        const index = select(parent);
        return index === null ? null : arms[index].read(ctx, at, parent);
      },
      write: (ctx, at, value, parent) => {
        if (value === null || value === undefined) {
          ctx.u8.fill(0, at, at + size);
          return;
        }
        const index = select(parent);
        if (index === null) {
          throw new Error(
            "discriminatedUnion: no arm matches parent discriminant for write"
          );
        }
        arms[index].write(ctx, at, value, parent);
        ctx.u8.fill(0, at + armSizes[index], at + size);
      },
    };
  }
}

export function discriminatedUnion<const Arms extends readonly UnionArmInput[]>(
  options: { size: number },
  ...arms: Arms
): CDiscriminatedUnion<Arms> {
  return new CDiscriminatedUnion(options, arms);
}

export function isCDiscriminatedUnion(
  value: unknown
): value is CDiscriminatedUnion {
  return (
    typeof value === "object" &&
    value !== null &&
    "__cdiscriminatedUnion" in value &&
    (value as CDiscriminatedUnion).__cdiscriminatedUnion === true
  );
}
