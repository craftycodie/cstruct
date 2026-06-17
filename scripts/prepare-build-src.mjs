import fs from "node:fs/promises";

const srcRoot = "src";
const outRoot = ".build-src";

await fs.rm(outRoot, { recursive: true, force: true });
await fs.cp(srcRoot, outRoot, { recursive: true });
