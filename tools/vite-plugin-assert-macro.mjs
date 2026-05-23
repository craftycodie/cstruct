import { transformAssertMacro } from "./swc-assert-macro.mjs";

const TS_FILE = /\.[cm]?tsx?$/;

/**
 * Vite plugin: run before unplugin-swc so decorators are still handled by SWC.
 */
export default function assertMacroPlugin() {
  return {
    name: "assert-macro",
    enforce: "pre",
    transform(code, id) {
      const path = id.split("?")[0];
      if (!TS_FILE.test(path) || path.includes("node_modules")) {
        return null;
      }

      return { code: transformAssertMacro(code, path) };
    },
  };
}
