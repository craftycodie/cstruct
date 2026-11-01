import type { Codec, Parent } from "./codec";
import type { Ctx } from "./ctx";

export type StructReader = (ctx: Ctx, at: number) => Parent;

/** A nested struct plan: its reader can be called directly. */
interface NestedPlan {
  getReader(): StructReader;
}

/** An array codec whose loop can be generated inline. */
interface InlineArray {
  count: number;
  element: Codec;
  stride: number;
}

interface ReaderSource {
  codecs: readonly Codec[];
  /** Creates the result object; undefined for plain records. */
  create: (() => object) | undefined;
  names: readonly string[];
  offsets: readonly number[];
  /** Precise (path-reporting) reader used when the fast one throws. */
  slow: StructReader;
}

let codegenEnabled = true;

/** Turn generated readers on or off (they need `new Function`). */
export function setCodegen(enabled: boolean): void {
  codegenEnabled = enabled;
}

const EMPTY_PARENT = Object.freeze({});

/** @internal Times a generated reader fell back to the slow path (tests). */
export const codegenStats = { slowPaths: 0 };

function plainRecord(): object {
  return {};
}

/**
 * Generate a reader that builds the result in one object literal with
 * primitive reads inlined. Returns undefined when code generation is off or
 * unavailable (CSP, Cloudflare Workers), and the caller keeps its closures.
 *
 * When no field needs the partly built record (union selectors) and the
 * result is a plain object, fields are written as a literal so every record
 * shares one hidden class; otherwise they are assigned in order.
 */
export function generateReader(source: ReaderSource): StructReader | undefined {
  if (!codegenEnabled) {
    return;
  }
  const { names, offsets, codecs, create } = source;
  const literal =
    create === undefined && !codecs.some((codec) => codec.usesParent);
  const parent = literal ? "EMPTY" : "out";

  /** Nested readers called directly, so each call site stays monomorphic. */
  const readers: StructReader[] = [];
  const readerFor = (codec: Codec): string | undefined => {
    const getReader = (codec as Partial<NestedPlan>).getReader;
    if (typeof getReader !== "function") {
      return;
    }
    readers.push(getReader.call(codec));
    return `readers[${readers.length - 1}]`;
  };

  /** Expression reading `codec` at offset expression `at`. */
  const expression = (codec: Codec, at: string, fallback: string): string => {
    if (codec.readSource) {
      return codec.readSource(at);
    }
    const reader = readerFor(codec);
    return reader ? `${reader}(ctx, ${at})` : fallback;
  };

  /** Statements that must run before field i's value expression. */
  const setup: string[][] = names.map(() => []);
  const reads = names.map((_, i) => {
    const codec = codecs[i];
    const at = `at + ${offsets[i]}`;
    const array = codec as Partial<InlineArray>;
    if (
      !codec.usesParent &&
      array.element !== undefined &&
      array.count !== undefined &&
      array.stride !== undefined
    ) {
      const element = expression(
        array.element,
        `${at} + i * ${array.stride}`,
        `codecs[${i}].element.read(ctx, ${at} + i * ${array.stride}, ${parent})`
      );
      setup[i].push(
        `const f${i} = [];`,
        `for (let i = 0; i < ${array.count}; i++) f${i}.push(${element});`
      );
      return `f${i}`;
    }
    return expression(codec, at, `codecs[${i}].read(ctx, ${at}, ${parent})`);
  });

  const lines: string[] = [];
  if (literal) {
    lines.push(...setup.flat());
    const fields = names.map(
      (name, i) => `${JSON.stringify(name)}: ${reads[i]}`
    );
    lines.push(`return { ${fields.join(", ")} };`);
  } else {
    lines.push("const out = create();");
    names.forEach((name, i) => {
      lines.push(...setup[i], `out[${JSON.stringify(name)}] = ${reads[i]};`);
    });
    lines.push("return out;");
  }
  const body = lines.join("\n    ");

  const factory = `return function read(ctx, at) {
  const dv = ctx.dv;
  const u8 = ctx.u8;
  try {
    ${body}
  } catch {
    stats.slowPaths++;
    return slow(ctx, at);
  }
};`;

  try {
    // Source is built only from JSON-quoted field names and numeric offsets.
    return new Function(
      "codecs",
      "readers",
      "create",
      "slow",
      "EMPTY",
      "stats",
      factory
    )(
      codecs,
      readers,
      create ?? plainRecord,
      source.slow,
      EMPTY_PARENT,
      codegenStats
    ) as StructReader;
  } catch {
    // EvalError under a Content Security Policy: keep the closure reader.
    return;
  }
}

export type StructWriter = (ctx: Ctx, at: number, record: Parent) => void;

/** A nested struct plan: its record writer can be called directly. */
interface NestedWriterPlan {
  getRecordWriter(): StructWriter;
  /** Validate a value and fill its defaults, giving the record to write. */
  prepare(value: unknown): Parent;
}

interface WriterSource {
  codecs: readonly Codec[];
  names: readonly string[];
  offsets: readonly number[];
  /** Precise (path-reporting) writer used when the fast one throws. */
  slow: StructWriter;
}

/**
 * Generate a writer with one call site per field, so each field's codec is
 * monomorphic (and inlined) at its site. Nested structs are called directly
 * and array loops are generated inline. Any error re-runs the closure
 * writer, which rewrites the same bytes and reports the field path.
 */
export function generateWriter(source: WriterSource): StructWriter | undefined {
  if (!codegenEnabled) {
    return;
  }
  const { names, offsets, codecs } = source;
  const writers: StructWriter[] = [];
  const plans: NestedWriterPlan[] = [];
  /** `(at, value) => statement` writing a nested struct, if codec is one. */
  const writerFor = (
    codec: Codec
  ): ((at: string, value: string) => string) | undefined => {
    const plan = codec as Partial<NestedWriterPlan>;
    if (typeof plan.getRecordWriter !== "function") {
      return;
    }
    const k = writers.length;
    writers.push(plan.getRecordWriter());
    plans.push(plan as NestedWriterPlan);
    return (at, value) =>
      `writers[${k}](ctx, ${at}, plans[${k}].prepare(${value}));`;
  };

  const lines = names.map((name, i) => {
    const codec = codecs[i];
    const at = `at + ${offsets[i]}`;
    const value = `rec[${JSON.stringify(name)}]`;
    const array = codec as Partial<InlineArray>;
    if (
      array.element !== undefined &&
      array.count !== undefined &&
      array.stride !== undefined
    ) {
      const elementAt = `${at} + i * ${array.stride}`;
      const nested = writerFor(array.element);
      const write = nested
        ? nested(elementAt, `v${i}[i]`)
        : `codecs[${i}].element.write(ctx, ${elementAt}, v${i}[i], rec);`;
      return [
        `const v${i} = ${value};`,
        `if (!Array.isArray(v${i}) || v${i}.length < ${array.count}) throw 0;`,
        `for (let i = 0; i < ${array.count}; i++) ${write}`,
      ].join("\n    ");
    }
    const nested = writerFor(codec);
    return nested
      ? nested(at, value)
      : `codecs[${i}].write(ctx, ${at}, ${value}, rec);`;
  });

  const factory = `return function write(ctx, at, rec) {
  try {
    ${lines.join("\n    ")}
  } catch {
    slow(ctx, at, rec);
  }
};`;

  try {
    // Source is built only from JSON-quoted field names and numeric offsets.
    return new Function("codecs", "writers", "plans", "slow", factory)(
      codecs,
      writers,
      plans,
      source.slow
    ) as StructWriter;
  } catch {
    return;
  }
}
