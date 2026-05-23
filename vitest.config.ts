import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";
import assertMacro from "./tools/vite-plugin-assert-macro.mjs";

const swcDecorators = {
  legacyDecorator: false,
  decoratorVersion: "2022-03" as const,
  decoratorMetadata: false,
  useDefineForClassFields: true,
};

export default defineConfig({
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
