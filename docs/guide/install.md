# Install

```bash
npm install @craftycodie/cstruct
```

## TypeScript

Enable legacy decorators if you use `@c.class()` / `@c.field()`:

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "strictPropertyInitialization": false
  }
}
```

Schema-only usage (`c.struct({ ... })`) does not require decorators.

## Node

This package uses Node `Buffer` for I/O. It targets Node.js 18+.
