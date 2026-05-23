# Contributing

Thanks for your interest in `@craftycodie/cstruct`. Bug reports, fixes, and documentation improvements are welcome.

## Getting started

```bash
git clone https://github.com/craftycodie/cstruct.git
cd cstruct
npm ci
```

Use Node.js 22 (same as CI).

## Development

| Command | Purpose |
| --- | --- |
| `npm test` | Run the Vitest suite |
| `npm run check` | Lint and format check (Biome via Ultracite) |
| `npm run fix` | Auto-fix lint and format issues |
| `npm run typecheck` | Type-check without emitting |
| `npm run build` | Build ESM and CJS outputs |
| `npm run validate` | Run check, test, typecheck, and docs build |

Before opening a pull request, run `npm run validate` locally.

Tests live in `tests/` and may also sit next to source as `*.test.ts`. This library relies on [Stage 3 decorators](https://github.com/tc39/proposal-decorators); Vitest uses SWC with `decoratorVersion: "2022-03"`.

## Pull requests

1. Open an issue first for large changes so we can agree on direction.
2. Branch from `main`.
3. Keep changes focused; include tests when behavior changes.
4. Open a PR against `main`. CI runs `npm run check`, `npm run build`, and `npm test`.

## Issues

Use [GitHub Issues](https://github.com/craftycodie/cstruct/issues) for bugs and feature requests. Include a minimal reproduction when reporting a bug.

## Documentation

User guides and API reference are published at [craftycodie.github.io/cstruct](https://craftycodie.github.io/cstruct/). Source lives in `docs/`. Run `npm run docs` for local preview.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
