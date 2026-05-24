# Vitest & SWC

If you author or test `@c.struct()` classes in your own project (not only consuming prebuilt `dist/`), configure Vitest with SWC and Stage 3 decorators:

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

Consumers that only import from published `dist/` do not need this — no decorator flags required at runtime.
