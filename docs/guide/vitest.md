# Vitest

Schema-first `c.struct({ ... })` layouts need no test configuration.

Tests that declare `@c.class()` classes are compiled by Vite's esbuild. esbuild rejects `@c.class()` in standard-decorator mode (`class` is a reserved word), so enable legacy decorators for tests:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: {
    tsconfigRaw: {
      compilerOptions: {
        experimentalDecorators: true,
        useDefineForClassFields: false,
      },
    },
  },
});
```

To test with standard decorators instead, keep `experimentalDecorators` off and write `@(c.class())`, or compile tests with TypeScript. cstruct's own repository runs every test both ways; see its `vitest.config.ts`.

Packages that only import a prebuilt `dist/` need none of this: decorators are compiled away at build time.
