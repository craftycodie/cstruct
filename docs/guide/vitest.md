# Vitest & SWC

Example `vitest.config.ts` with Stage 3 decorators:

```ts
import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    swc.vite({
      jsc: {
        parser: { syntax: "typescript", decorators: true },
        transform: {
          legacyDecorator: false,
          decoratorVersion: "2022-03",
          decoratorMetadata: false,
          useDefineForClassFields: true,
        },
        target: "es2022",
      },
    }),
  ],
});
```

This repo also uses an assert macro plugin for tests; see `tools/vite-plugin-assert-macro.mjs` if you copy the test setup.
