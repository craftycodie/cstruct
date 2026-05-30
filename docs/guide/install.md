# Install & setup

## Install

```bash
npm install @craftycodie/cstruct
```

## Decorator requirements

cstruct uses [Stage 3 decorators](https://github.com/tc39/proposal-decorators). Your compiler or test runner must enable them:

| Tool | Setting |
|------|---------|
| TypeScript 5+ | `"experimentalDecorators": false`, `"useDefineForClassFields": true` |
| SWC / Vitest | `decoratorVersion: "2022-03"`, `legacyDecorator: false` |

Import from `@craftycodie/cstruct` before any `@c.struct()` class so the `Symbol.metadata` polyfill is installed.

## Struct I/O

After `@c.struct()`, use `c.read`, `c.write`, `c.sizeof`, `c.toJson`, and `c.fromJson` with the class constructor:

```ts
import { c } from "@craftycodie/cstruct";

@c.struct()
class Header {
  @c.field("u32")
  length!: number;
}

const bytes = c.write(Header, { length: 100 } as Header);
const value = c.read(Header, bytes);
```

The [Quick start](/guide/quick-start) page walks through a full example.
