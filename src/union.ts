import { CStructError } from "./errors";
import type { PadField } from "./pad";
import { is_struct_constructor, struct_byte_size } from "./struct";

export type StructClass = new () => object;

export type UnionSelect<T extends object = object> = (
  instance: T
) => number | null;

export type UnionArmWhen<T extends object = object> = (instance: T) => boolean;

export type UnionArmInput<T extends object = object> = readonly [
  StructClass,
  UnionArmWhen<T>,
];

/**
 * Discriminated union slot: one active arm, or `null` when no predicate matches.
 *
 * @example See {@link arm}, {@link when}, and {@link create_union}.
 */
export interface UnionField<
  T extends object = object,
  TArms extends readonly StructClass[] = readonly StructClass[],
> {
  readonly arms: TArms;
  /** Reserved bytes when no arm matches. */
  readonly inactive: PadField;
  readonly kind: "union";
  readonly name: string;
  readonly select: UnionSelect<T>;
  readonly size: number;
}

export function is_union_field(type: unknown): type is UnionField {
  return (
    typeof type === "object" &&
    type !== null &&
    "kind" in type &&
    type.kind === "union"
  );
}

/**
 * Fixed byte size of a discriminated union slot in the parent struct.
 *
 * @example
 * ```ts
 * // 4-byte union: largest arm wins; inactive arms read as null
 * { size: 4 }
 * ```
 */
export interface UnionOptions {
  /** Fixed byte size of this union slot in the parent struct. */
  size: number;
}

/**
 * Union of arm instance types, or `null` when no arm is active.
 *
 * @example
 * ```ts
 * type HostData = c.UnionOf<[typeof ArmA, typeof ArmB]>;
 * // ArmA | ArmB | null
 * ```
 */
export type UnionOf<T extends readonly StructClass[]> =
  T[number] extends StructClass ? InstanceType<T[number]> | null : null;

function inactive_pad(size: number): PadField {
  return { kind: "pad", count: size };
}

function union_size(
  arms: readonly StructClass[],
  inactive_size: number
): number {
  let size = inactive_size;
  for (const arm of arms) {
    size = Math.max(size, struct_byte_size(arm));
  }
  return size;
}

function is_union_arm_tuple(
  value: unknown
): value is readonly [StructClass, UnionArmWhen<object>] {
  return (
    Array.isArray(value) && value.length === 2 && typeof value[0] === "function"
  );
}

/**
 * `[Struct, (instance) => boolean]` arm for {@link decorators.union} / {@link decorators.unionField}.
 *
 * @example
 * ```ts
 * import { c } from "@craftycodie/cstruct";
 *
 * @c.struct()
 * class ArmA {
 *   @c.field("u8")
 *   value!: number;
 *   @c.field(c.pad(3))
 *   private _pad!: never;
 * }
 *
 * @c.struct()
 * class Host {
 *   @c.field("u8")
 *   kind!: number;
 *
 *   @c.union({ size: 4 }, c.arm(ArmA, (m) => m.kind === 1))
 *   data: ArmA | null = null;
 * }
 * ```
 */
export function arm<T extends object>(
  struct: StructClass,
  when: UnionArmWhen<T>
): readonly [StructClass, UnionArmWhen<T>] {
  return [struct, when];
}

/**
 * Arm selected when `discriminant(instance) === value`.
 * Shorthand for `c.arm(Struct, (m) => discriminant(m) === value)`.
 *
 * @example
 * ```ts
 * import { c } from "@craftycodie/cstruct";
 *
 * @c.struct()
 * class ArmA {
 *   @c.field("u8")
 *   value!: number;
 *   @c.field(c.pad(3))
 *   private _pad!: never;
 * }
 *
 * @c.struct()
 * class Host {
 *   @c.field("u8")
 *   kind!: number;
 *
 *   @c.union({ size: 4 }, c.when(1, ArmA, (m) => m.kind))
 *   data: ArmA | null = null;
 * }
 * ```
 */
export function when<T extends object, const V extends number | string>(
  value: V,
  struct: StructClass,
  discriminant: (instance: T) => number | string
): readonly [StructClass, UnionArmWhen<T>] {
  return [struct, (instance) => discriminant(instance) === value];
}

export function build_union_select<T extends object>(
  entries: readonly { struct: StructClass; when: UnionArmWhen<T> }[]
): UnionSelect<T> {
  return (instance) => {
    const index = entries.findIndex((entry) => entry.when(instance));
    return index >= 0 ? index : null;
  };
}

export function parse_union_definition<
  T extends object,
  const A extends readonly (readonly [StructClass, ...unknown[]])[],
>(
  options: UnionOptions,
  arms: A
): {
  arms: StructClass[];
  select: UnionSelect<T>;
  inactive: PadField;
} {
  const entries: { struct: StructClass; when: UnionArmWhen<T> }[] = [];

  for (const input of arms) {
    if (is_union_arm_tuple(input)) {
      entries.push({
        struct: input[0],
        when: input[1] as UnionArmWhen<T>,
      });
      continue;
    }

    if (is_struct_constructor(input)) {
      throw new CStructError(
        "Union arm requires a when predicate — use c.arm(Struct, (m) => ...), c.when(value, Struct, (m) => ...), or [Struct, (m) => ...]"
      );
    }

    throw new CStructError("Invalid union arm");
  }

  if (entries.length === 0) {
    throw new CStructError("Union requires at least one arm");
  }

  const structs = entries.map((entry) => entry.struct);
  const inactive = inactive_pad(options.size);

  return {
    arms: structs,
    select: build_union_select(entries),
    inactive,
  };
}

/**
 * Build a {@link UnionField} descriptor (used by {@link decorators.union} and {@link decorators.unionField}).
 * Prefer {@link decorators.unionField} unless you need a raw descriptor.
 *
 * @example Union field via c.unionField
 * ```ts
 * import { c } from "@craftycodie/cstruct";
 *
 * @c.field(
 *   c.unionField({ size: 4 }, c.arm(ArmA, (m) => m.kind === 1))
 * )
 * data: ArmA | null = null;
 * ```
 */
export type ArmsCtorsTuple<
  A extends readonly (readonly [StructClass, ...unknown[]])[],
> = A extends readonly [
  readonly [infer C extends StructClass, ...unknown[]],
  ...infer Tail extends readonly (readonly [StructClass, ...unknown[]])[],
]
  ? readonly [C, ...ArmsCtorsTuple<Tail>]
  : readonly [];

export function create_union<
  T extends object,
  const A extends readonly (readonly [StructClass, ...unknown[]])[],
>(
  name: string,
  options: UnionOptions,
  arms: A
): UnionField<T, ArmsCtorsTuple<A>> {
  const {
    arms: structs,
    select,
    inactive,
  } = parse_union_definition(options, arms);

  return {
    kind: "union",
    name,
    arms: structs as unknown as ArmsCtorsTuple<A>,
    select: select as UnionSelect<object>,
    inactive,
    size: union_size(structs, inactive.count),
  };
}
