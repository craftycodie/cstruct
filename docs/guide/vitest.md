# Vitest

If you author or test `@c.class()` decorators in your own project (not only consuming prebuilt `dist/`), enable TypeScript's legacy decorators in Vitest:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: {
    target: "es2022",
    tsconfigRaw: {
      compilerOptions: {
        experimentalDecorators: true,
        useDefineForClassFields: false,
      },
    },
  },
});
```

Consumers that only import from published `dist/` do not need this — decorators are compiled away at build time.

Schema-first `c.struct({ ... })` layouts do not require decorator configuration in tests.
