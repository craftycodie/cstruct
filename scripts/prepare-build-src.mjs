import fs from "node:fs/promises";
import path from "node:path";
import { transformAssertMacro } from "../tools/swc-assert-macro.mjs";

const srcRoot = "src";
const outRoot = ".build-src";

async function prepareDir(relDir = "") {
  const absIn = path.join(srcRoot, relDir);
  const entries = await fs.readdir(absIn, { withFileTypes: true });

  for (const entry of entries) {
    const relPath = relDir ? `${relDir}/${entry.name}` : entry.name;
    const absOut = path.join(outRoot, relPath);

    if (entry.isDirectory()) {
      await fs.mkdir(absOut, { recursive: true });
      await prepareDir(relPath);
      continue;
    }

    if (!entry.name.endsWith(".ts")) {
      continue;
    }

    const absInFile = path.join(srcRoot, relPath);
    const code = await fs.readFile(absInFile, "utf8");
    const output = entry.name.endsWith(".test.ts")
      ? code
      : transformAssertMacro(code, absInFile);

    await fs.mkdir(path.dirname(absOut), { recursive: true });
    await fs.writeFile(absOut, output);
  }
}

await fs.rm(outRoot, { recursive: true, force: true });
await fs.mkdir(outRoot, { recursive: true });
await prepareDir();
