# Performance

The first time a struct is read or written, cstruct compiles its layout into a plan:

- **Offsets are static.** Every field's byte offset is computed once.
- **Specialized code.** Readers and writers are generated with `new Function`. A reader returns one object literal with primitive reads inlined, so every record shares a hidden class. Nested structs and arrays call each other's generated code directly.
- **No per-field allocation.** One `DataView` per call, and nested values are written straight into the output buffer.

When generated code throws, the operation re-runs on the interpreter, which reports the failing field's path. Valid input never takes that path.

## Benchmarks

`npm run bench` runs Vitest benchmarks against hand-written `DataView` code as a speed-of-light reference. Representative results on Node 24 (operations per second; higher is better):

| Case | 2.0.0-alpha.3 | Now | Hand-written |
| --- | --- | --- | --- |
| Read 16-field struct | 155k | 1.4–1.7M | 2.7–3.7M |
| Read 1000 × Vec3 | 984 | 52k | 39k |
| Read Halo Reach CHDR (688 B, big-endian) | 55k | 380k | — |
| Write 16-field struct | 164k | 706k | 1.3M |
| Write 1000 × Vec3 | 645 | 28.7k | 40.6k |
| Write Halo Reach CHDR | 44k | 226k | — |

`npm run bench:save` records a baseline and `npm run bench:compare` compares against it.

## Without code generation

Where `new Function` is blocked (a Content Security Policy without `unsafe-eval`, Cloudflare Workers), cstruct falls back automatically to an interpreter over the same plans. It is about 2× slower for flat structs and still several times faster than 2.0.0-alpha.3. To use it everywhere:

```ts
c.configure({ codegen: false });
```

Generated code is built only from JSON-quoted field names and numeric offsets, and `__proto__` is rejected as a field name.

## Tips

- Reuse schemas: plans are cached per schema and byte order.
- Use `c.bytes(n)` for opaque data rather than `c.u8().array(n)`.
- `{ checked: false }` skips integer range checks on write.
