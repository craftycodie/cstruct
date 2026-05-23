import { parseSync, printSync } from "@swc/core";

const parseOptions = {
  syntax: "typescript",
  decorators: true,
  dynamicImport: true,
};

const zeroSpan = { start: 0, end: 0 };
const TRAILING_SEMICOLON = /;\s*$/;

function expressionSource(expression) {
  const printed = printSync({
    type: "Module",
    span: zeroSpan,
    body: [
      {
        type: "ExpressionStatement",
        span: zeroSpan,
        expression,
      },
    ],
  }).code;

  return printed.trim().replace(TRAILING_SEMICOLON, "");
}

function visit(node, onCallExpression) {
  if (!node || typeof node !== "object") {
    return;
  }

  if (node.type === "CallExpression") {
    onCallExpression(node);
  }

  for (const value of Object.values(node)) {
    if (Array.isArray(value)) {
      for (const child of value) {
        visit(child, onCallExpression);
      }
    } else if (value && typeof value === "object" && "type" in value) {
      visit(value, onCallExpression);
    }
  }
}

/**
 * Expands `assert(expr)` → `assert(expr, "expr")` (C `#_expression` stringification).
 */
export function transformAssertMacro(source, filename) {
  const ast = parseSync(source, {
    ...parseOptions,
    filename,
  });

  visit(ast, (node) => {
    if (node.callee?.type !== "Identifier" || node.callee.value !== "assert") {
      return;
    }
    if (node.arguments.length !== 1) {
      return;
    }

    const arg = node.arguments[0];
    if (!arg?.expression) {
      return;
    }

    const expressionText = expressionSource(arg.expression);
    node.arguments.push({
      spread: null,
      expression: {
        type: "StringLiteral",
        span: zeroSpan,
        value: expressionText,
      },
    });
  });

  return printSync(ast, { minify: false }).code;
}
