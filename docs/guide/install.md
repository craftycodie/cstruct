# Install

```bash
npm install @craftycodie/cstruct
```

## TypeScript

Schema-only usage (`c.struct({ ... })`) needs no configuration.

`@c.class()` / `@c.field()` work with either decorator mode:

- **Standard decorators** (TypeScript 5+ default, `experimentalDecorators` off). cstruct installs the `Symbol.metadata` polyfill itself.
- **Legacy decorators** (`"experimentalDecorators": true`).

```json
{
  "compilerOptions": {
    "strictPropertyInitialization": false
  }
}
```

`strictPropertyInitialization: false` (or `!` on fields, or initializers like `x = 0`) avoids errors for fields that `c.read` fills in.

::: warning esbuild, Vite, Vitest and tsx with standard decorators
esbuild rejects `@c.class()` in standard-decorator mode because `class` is a reserved word (TypeScript accepts it, and the decorators spec allows it). With those tools, either enable `experimentalDecorators`, or write `@(c.class())`.
:::

## Runtimes

Node.js 18+, Bun, Deno and browsers. Reads accept `Buffer`, `Uint8Array`, `ArrayBuffer` or `DataView`. `c.write` returns a `Buffer` when the runtime has one, and a `Uint8Array` otherwise.

Without `Buffer`, `c.string` supports the `utf8`, `latin1`, `ascii` and `utf16le` encodings; `hex` and `base64` need `Buffer`.

Code generation uses `new Function`. Where that is blocked (a Content Security Policy, Cloudflare Workers) cstruct falls back to an interpreter automatically. See [Performance](./performance.md).
