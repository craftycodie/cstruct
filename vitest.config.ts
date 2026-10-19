import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

const include = ["src/**/*.test.ts", "tests/**/*.test.ts"];

/**
 * Compile TypeScript with tsc's own emitter and standard (stage 3)
 * decorators. esbuild cannot be used for this project: it rejects
 * `@c.class()` because `class` is a reserved word.
 */
function typescriptStage3(): Plugin {
  return {
    name: "typescript-stage3-decorators",
    enforce: "pre",
    transform(code, id) {
      if (!id.endsWith(".ts")) {
        return;
      }
      const output = ts.transpileModule(code, {
        fileName: id,
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.ESNext,
          experimentalDecorators: false,
          useDefineForClassFields: true,
          sourceMap: true,
        },
      });
      return { code: output.outputText, map: output.sourceMapText };
    },
  };
}

/** Tests that use syntax only standard (stage 3) decorators allow. */
const stage3Only = ["tests/**/*.stage3.test.ts"];

export default defineConfig({
  resolve: {
    alias: {
      "@craftycodie/cstruct": path.join(root, "src/index.ts"),
    },
  },
  test: {
    // Every test runs under both decorator modes cstruct supports.
    projects: [
      {
        extends: true,
        esbuild: {
          tsconfigRaw: {
            compilerOptions: {
              experimentalDecorators: true,
              useDefineForClassFields: false,
            },
          },
        },
        test: {
          name: "legacy-decorators",
          include,
          exclude: stage3Only,
        },
      },
      {
        extends: true,
        esbuild: false,
        plugins: [typescriptStage3()],
        test: {
          name: "stage3-decorators",
          include,
        },
      },
    ],
  },
});
