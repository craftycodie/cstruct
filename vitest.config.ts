import path from "node:path";
import { fileURLToPath } from "node:url";
import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";
import assertMacro from "./tools/vite-plugin-assert-macro.mjs";

const root = path.dirname(fileURLToPath(import.meta.url));

const swcDecorators = {
  legacyDecorator: false,
  decoratorVersion: "2022-03" as const,
  decoratorMetadata: false,
  useDefineForClassFields: true,
};

export default defineConfig({
  resolve: {
    alias: {
      // Example tests import like consumers; resolve to source (no pre-build required).
      "@craftycodie/cstruct": path.join(root, "src/index.ts"),
    },
  },
  plugins: [
    assertMacro(),
    swc.vite({
      jsc: {
        parser: { syntax: "typescript", decorators: true },
        transform: swcDecorators,
        target: "es2022",
      },
    }),
  ],
  test: {
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
  },
});
