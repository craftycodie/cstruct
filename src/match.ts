import {
  COMPILE,
  type Codec,
  type CompileEnv,
  compileType,
  type Parent,
  readWith,
  writeWith,
} from "./engine/codec";
import type { FieldOptions, FieldType } from "./field";
import { alignOf, CFieldType, type Endian } from "./field-type";
import type { infer as Infer } from "./struct";

/** Arm schemas keyed by discriminant value (numbers, enum keys, strings). */
export type MatchArms = Readonly<Record<string | number, FieldType>>;

export interface MatchOptions<
  Fallback extends FieldType | undefined = undefined,
> extends FieldOptions {
  /** Arm used when the discriminant matches no key. Default: decode as null. */
  fallback?: Fallback;
  /** Slot size in bytes. Default: the largest arm (and fallback). */
  size?: number;
}

export type MatchValue<
  Arms extends MatchArms,
  Fallback extends FieldType | undefined,
> =
  | { [K in keyof Arms]: Infer<Arms[K]> }[keyof Arms]
  | (Fallback extends FieldType ? Infer<Fallback> : null);

const PATH_SEPARATOR = ".";

/**
 * A union slot whose arm is chosen by a discriminant elsewhere in the parent
 * record, named by a dot path:
 *
 *   c.match("general.file_type", { 3: Film, 4: Film, 6: Variant })
 *
 * Keys are compared as strings, so numeric codes, enum key names and bigints
 * all work. The slot is as large as the largest arm unless `size` is given;
 * unused bytes are zero on write.
 */
export class CMatch<
  const Arms extends MatchArms,
  const Fallback extends FieldType | undefined = undefined,
  const O extends MatchOptions<Fallback> = MatchOptions<Fallback>,
> extends CFieldType<MatchValue<Arms, Fallback>, O> {
  readonly path: string;
  readonly arms: Arms;
  private readonly keys: string[];
  private readonly slotSize: number;

  constructor(path: string, arms: Arms, options?: O) {
    super(options);
    this.path = path;
    this.arms = arms;
    this.keys = Object.keys(arms);
    if (this.keys.length === 0) {
      throw new Error("c.match needs at least one arm");
    }
    const types = this.armTypes();
    const largest = Math.max(...types.map((type) => type.getSize()));
    if (options?.size !== undefined && options.size < largest) {
      throw new RangeError(
        `c.match size ${options.size} is smaller than its largest arm (${largest} bytes)`
      );
    }
    this.slotSize = options?.size ?? largest;
  }

  private armTypes(): FieldType[] {
    const types = this.keys.map((key) => this.arms[key]);
    const fallback = this.options.fallback;
    return fallback ? [...types, fallback] : types;
  }

  getSize(): number {
    return this.slotSize;
  }

  getAlign(): number {
    return Math.max(1, ...this.armTypes().map(alignOf));
  }

  read(
    buffer: Uint8Array,
    offset: number,
    endian: Endian,
    parent: Record<string, unknown> = {}
  ): MatchValue<Arms, Fallback> {
    return readWith(this, buffer, offset, endian, parent);
  }

  write(
    buffer: Uint8Array,
    offset: number,
    value: MatchValue<Arms, Fallback> | null | undefined,
    endian: Endian,
    parent: Record<string, unknown> = {}
  ): void {
    writeWith(this, buffer, offset, value, endian, parent);
  }

  [COMPILE](env: CompileEnv): Codec<unknown> {
    const { path, keys, slotSize } = this;
    const segments = path.split(PATH_SEPARATOR);
    const discriminant = (parent: Parent): unknown => {
      let value: unknown = parent;
      for (const segment of segments) {
        value = (value as Parent | null | undefined)?.[segment];
      }
      return value;
    };
    const indexByKey = new Map(keys.map((key, i) => [key, i]));
    const armTypes = keys.map((key) => this.arms[key]);
    const codecs = armTypes.map((type) => compileType(type, env));
    const sizes = armTypes.map((type) => type.getSize());
    const fallbackType = this.options.fallback;
    const fallback = fallbackType
      ? { codec: compileType(fallbackType, env), size: fallbackType.getSize() }
      : undefined;

    const select = (parent: Parent) => {
      const index = indexByKey.get(String(discriminant(parent)));
      if (index !== undefined) {
        return { codec: codecs[index], size: sizes[index] };
      }
      return fallback;
    };

    return {
      usesParent: true,
      read: (ctx, at, parent) => {
        const arm = select(parent);
        return arm ? arm.codec.read(ctx, at, parent) : null;
      },
      write: (ctx, at, value, parent) => {
        if (value === null || value === undefined) {
          ctx.u8.fill(0, at, at + slotSize);
          return;
        }
        const arm = select(parent);
        if (!arm) {
          throw new Error(
            `c.match: no arm for ${path} = ${String(discriminant(parent))}`
          );
        }
        arm.codec.write(ctx, at, value, parent);
        ctx.u8.fill(0, at + arm.size, at + slotSize);
      },
    };
  }
}

export function match<
  const Arms extends MatchArms,
  const Fallback extends FieldType | undefined = undefined,
>(
  path: string,
  arms: Arms,
  options?: MatchOptions<Fallback>
): CMatch<Arms, Fallback> {
  return new CMatch(path, arms, options);
}
