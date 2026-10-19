# Performance

The first time a struct is read or written, cstruct compiles its layout into a plan:

- **Offsets are static.** Every field's byte offset is computed once.
- **Specialized code.** Readers and writers are generated with `new Function`. A reader returns one object literal with primitive reads inlined, so every record shares a hidden class. Nested structs and arrays call each other's generated code directly.
- **No per-field allocation.** One `DataView` per call, and nested values are written straight into the output buffer.

When generated code throws, the operation re-runs on the interpreter, which reports the failing field's path. Valid input never takes that path.

## Without code generation

Where `new Function` is blocked (a Content Security Policy without `unsafe-eval`, Cloudflare Workers), cstruct falls back automatically to an interpreter over the same plans, which is slower. To use it everywhere:

```ts
c.configure({ codegen: false });
```

Generated code is built only from JSON-quoted field names and numeric offsets, and `__proto__` is rejected as a field name.

## Tips

- Reuse schemas: plans are cached per schema and byte order.
- Use `c.bytes(n)` for opaque data rather than `c.u8().array(n)`.
- `{ checked: false }` skips integer range checks on write.
