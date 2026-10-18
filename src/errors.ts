export type CStructOperation = "read" | "write";

/** A path segment: a field name or an array index. */
export type CStructPathSegment = string | number;

function formatPath(path: readonly CStructPathSegment[]): string {
  let out = "";
  for (const segment of path) {
    if (typeof segment === "number") {
      out += `[${segment}]`;
    } else {
      out += out === "" ? segment : `.${segment}`;
    }
  }
  return out;
}

function causeMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

/**
 * Thrown by struct reads and writes. `path` locates the failing field,
 * e.g. `["metadata", "points", 3, "x"]` for `metadata.points[3].x`.
 */
export class CStructError extends Error {
  readonly operation: CStructOperation;
  readonly path: CStructPathSegment[];

  constructor(
    operation: CStructOperation,
    path: CStructPathSegment[],
    cause: unknown
  ) {
    super("", { cause });
    this.name = "CStructError";
    this.operation = operation;
    this.path = path;
    this.message = this.describe();
  }

  /** Prefix a path segment as the error unwinds through an enclosing field. */
  prepend(segment: CStructPathSegment): this {
    this.path.unshift(segment);
    this.message = this.describe();
    return this;
  }

  private describe(): string {
    const where = this.path.length === 0 ? "" : ` at ${formatPath(this.path)}`;
    return `${this.operation} failed${where}: ${causeMessage(this.cause)}`;
  }
}

/** Attach `segment` to an error thrown while reading or writing a field. */
export function withPath(
  error: unknown,
  operation: CStructOperation,
  segment: CStructPathSegment
): CStructError {
  if (error instanceof CStructError) {
    return error.prepend(segment);
  }
  return new CStructError(operation, [segment], error);
}

/** Wrap an error escaping a top-level read or write, keeping existing paths. */
export function asCStructError(
  error: unknown,
  operation: CStructOperation
): CStructError {
  return error instanceof CStructError
    ? error
    : new CStructError(operation, [], error);
}
