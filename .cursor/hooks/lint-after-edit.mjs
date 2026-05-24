#!/usr/bin/env node
/**
 * afterFileEdit hook: run ultracite fix on the edited file when the project uses ultracite.
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

const input = JSON.parse(readFileSync(0, "utf8"));
const roots = input.workspace_roots ?? [process.cwd()];

let filePath = input.file_path ?? "";
if (!filePath) {
  process.exit(0);
}
if (!isAbsolute(filePath)) {
  filePath = resolve(roots[0] ?? process.cwd(), filePath);
}

const LINTABLE = /\.(ts|tsx|js|mjs|cjs|json|md)$/i;
if (!LINTABLE.test(filePath)) {
  process.exit(0);
}

function findUltraciteRoot(startDir) {
  let current = startDir;
  for (;;) {
    const pkgPath = join(current, "package.json");
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
        const check = pkg.scripts?.check ?? "";
        const fix = pkg.scripts?.fix ?? "";
        if (
          String(check).includes("ultracite") ||
          String(fix).includes("ultracite") ||
          existsSync(join(current, "node_modules", "ultracite"))
        ) {
          return current;
        }
      } catch {
        // ignore invalid package.json
      }
    }
    const parent = dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

const projectRoot = findUltraciteRoot(dirname(filePath));
if (!projectRoot) {
  process.exit(0);
}

const relPath = relative(projectRoot, filePath);
if (relPath.startsWith("..")) {
  process.exit(0);
}

try {
  execSync(`npx ultracite fix "${relPath.replaceAll("\\", "/")}"`, {
    cwd: projectRoot,
    stdio: "inherit",
  });
} catch {
  // Report via hooks log; do not block the agent (afterFileEdit is informational).
  process.exit(0);
}
