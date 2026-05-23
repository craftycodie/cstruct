import { CStructError } from "./errors";
import type { PrimitiveType } from "./primitive";

/**
 * Integer enum slot: wire type plus the set of allowed numeric values.
 * Prefer {@link decorators.enumType} on a field instead of building this directly.
 *
 * @example Packet status field
 * ```ts
 * import { c } from "@craftycodie/cstruct";
 *
 * const Status = { Ok: 0, Error: 1 } as const;
 *
 * @c.struct()
 * class Packet {
 *   @c.field(c.enum("u8", Status))
 *   status!: number;
 * }
 * ```
 */
export interface EnumField {
  readonly kind: "enum";
  readonly storage: PrimitiveType;
  readonly values: ReadonlySet<number>;
}

export function is_enum_field(type: unknown): type is EnumField {
  return (
    typeof type === "object" &&
    type !== null &&
    "kind" in type &&
    type.kind === "enum"
  );
}

/**
 * Numeric members from a TypeScript enum or `as const` object.
 *
 * @example
 * ```ts
 * const Status = { Ok: 0, Error: 1 } as const;
 * enum_numeric_values(Status); // Set { 0, 1 }
 * ```
 */
export function enum_numeric_values(enumObj: object): ReadonlySet<number> {
  const values = new Set<number>();
  for (const value of Object.values(enumObj)) {
    if (typeof value === "number") {
      values.add(value);
    }
  }
  if (values.size === 0) {
    throw new CStructError(
      "c.enum() requires numeric enum members (TypeScript enum or as const map)"
    );
  }
  return values;
}

/**
 * Build an {@link EnumField} for {@link decorators.field} (same as `c.enum(storage, map)`).
 *
 * @example
 * ```ts
 * import { c } from "@craftycodie/cstruct";
 *
 * const Status = { Ok: 0, Error: 1 } as const;
 *
 * @c.struct()
 * class Packet {
 *   @c.field(c.enum("u8", Status))
 *   status!: number;
 * }
 * ```
 */
export function create_enum_field(
  storage: PrimitiveType,
  enumObj: object
): EnumField {
  return { kind: "enum", storage, values: enum_numeric_values(enumObj) };
}

/**
 * Validate a wire value against an {@link EnumField} after reading a primitive.
 *
 * @example
 * ```ts
 * const field = create_enum_field("u8", { Ok: 0, Error: 1 });
 * read_enum(0, field, "status"); // 0
 * // read_enum(9, field, "status") throws CStructError
 * ```
 */
export function read_enum(
  raw: number | bigint,
  field: EnumField,
  label: string
): number {
  const value = typeof raw === "bigint" ? Number(raw) : raw;
  if (!field.values.has(value)) {
    throw new CStructError(
      `Invalid ${label}: enum value ${value} is not defined`
    );
  }
  return value;
}

/**
 * Validate a JS value and coerce it for writing as a primitive.
 *
 * @example
 * ```ts
 * const field = create_enum_field("u8", { Ok: 0, Error: 1 });
 * write_enum(0, field, "status"); // 0
 * write_enum(1, field, "status"); // 1
 * ```
 */
export function write_enum(
  value: unknown,
  field: EnumField,
  label: string
): number | bigint {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new CStructError(`${label}: expected an integer enum value`);
  }
  if (!field.values.has(value)) {
    throw new CStructError(
      `Invalid ${label}: enum value ${value} is not defined`
    );
  }
  if (field.storage === "u64" || field.storage === "i64") {
    return BigInt(value);
  }
  return value;
}
