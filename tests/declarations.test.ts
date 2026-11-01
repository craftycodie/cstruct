import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { afterAll, describe, expect, it } from "vitest";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const work = mkdtempSync(path.join(tmpdir(), "cstruct-declarations-"));

afterAll(() => {
  rmSync(work, { recursive: true, force: true });
});

const baseOptions: ts.CompilerOptions = {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  strict: true,
  experimentalDecorators: true,
  declaration: true,
  emitDeclarationOnly: true,
  skipLibCheck: true,
  typeRoots: [path.join(root, "node_modules/@types")],
  types: ["node"],
};

function messages(diagnostics: readonly ts.Diagnostic[]): string[] {
  return diagnostics.map((diagnostic) =>
    ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")
  );
}

/** Emit cstruct's declarations as an installed package under `work`. */
function installPackage(): string[] {
  const packageDir = path.join(work, "node_modules/@craftycodie/cstruct");
  const program = ts.createProgram([path.join(root, "src/index.ts")], {
    ...baseOptions,
    rootDir: path.join(root, "src"),
    outDir: packageDir,
  });
  const result = program.emit();
  writeFileSync(
    path.join(packageDir, "package.json"),
    JSON.stringify({
      name: "@craftycodie/cstruct",
      type: "module",
      exports: { ".": { types: "./index.d.ts" } },
    })
  );
  return messages([
    ...ts.getPreEmitDiagnostics(program),
    ...result.diagnostics,
  ]);
}

/**
 * Emit declarations for `fixture` as a consumer of the installed package.
 * Returns the errors and the module specifiers the `.d.ts` imports.
 */
function emitConsumer(fixture: string): {
  errors: string[];
  imports: string[];
} {
  const consumerDir = path.join(work, "consumer");
  mkdirSync(consumerDir, { recursive: true });
  const file = path.join(consumerDir, "index.ts");
  writeFileSync(file, ts.sys.readFile(path.join(root, fixture)) ?? "");
  let declarations = "";
  // No @types/node: the package's types must not need Node.
  const program = ts.createProgram([file], {
    ...baseOptions,
    skipLibCheck: false,
    types: [],
  });
  const result = program.emit(undefined, (_name, text) => {
    declarations += text;
  });
  const imports = [
    ...declarations.matchAll(/(?:from |import\()"([^"]+)"/g),
  ].map((match) => match[1] ?? "");
  return {
    errors: messages([
      ...ts.getPreEmitDiagnostics(program),
      ...result.diagnostics,
    ]),
    imports: [...new Set(imports)],
  };
}

describe("declaration emit", () => {
  it("lets a consumer export schemas built from every public factory", () => {
    expect(installPackage()).toEqual([]);
    const { errors, imports } = emitConsumer(
      "tests/fixtures/public-declarations.ts"
    );
    // Types the package root does not export fail here (TS2742, TS4023)
    // or are imported by a path into the package's files; Node types such
    // as Buffer fail to resolve.
    expect(errors).toEqual([]);
    expect(imports).toEqual(["@craftycodie/cstruct"]);
  }, 60_000);
});
