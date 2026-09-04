// Scope-aware "free identifier" finder: lists identifiers referenced in a file (or in one
// named function) that have no binding in any enclosing scope. Usage:
//   node free-ids.mjs <file> [functionName] [--all]
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(new URL("../package.json", import.meta.url));
const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;

const [file, fnName, flag] = process.argv.slice(2);
const code = readFileSync(file, "utf8");
const ast = parser.parse(code, { sourceType: "module", plugins: ["jsx", "typescript"] });
const GLOBALS = new Set(["window","document","console","Math","JSON","Object","Array","Number","String","Boolean","Date","Map","Set","Promise","setTimeout","clearTimeout","requestAnimationFrame","cancelAnimationFrame","localStorage","navigator","alert","confirm","Blob","URL","FileReader","Image","XMLSerializer","ResizeObserver","Error","parseInt","parseFloat","isFinite","isNaN","undefined","NaN","Infinity","Symbol","Function","RegExp","encodeURIComponent","decodeURIComponent","Float32Array","Uint16Array","Uint32Array","Worker","self","performance","structuredClone","Intl","globalThis","queueMicrotask","AbortController","Text"]);
const free = new Map();
function visit(path, root) {
  path.traverse({
    Identifier(p) {
      if (!p.isReferencedIdentifier()) return;
      const name = p.node.name;
      if (GLOBALS.has(name)) return;
      // JSX intrinsic tags (lowercase) are not identifiers we care about
      if (p.parentPath.isJSXOpeningElement() || p.parentPath.isJSXClosingElement()) { if (/^[a-z]/.test(name)) return; }
      if (p.scope.hasBinding(name)) {
        if (!root) return;
        // Bound inside the target function (its own scope or a nested one) → not free.
        const b = p.scope.getBinding(name);
        if (b.scope === root.scope || isDescendant(b.scope, root.scope)) return;
        free.set(name, (free.get(name) || 0) + 1);
        return;
      }
      free.set(name, (free.get(name) || 0) + 1);
    },
    JSXIdentifier(p) {
      const name = p.node.name;
      if (!/^[A-Z]/.test(name)) return;
      if (!(p.parentPath.isJSXOpeningElement() || p.parentPath.isJSXClosingElement())) return;
      if (p.scope.hasBinding(name)) {
        if (!root) return;
        const b = p.scope.getBinding(name);
        if (isDescendant(b.scope, root.scope) || b.scope === root.scope) return;
        free.set(name, (free.get(name) || 0) + 1); return;
      }
      free.set(name, (free.get(name) || 0) + 1);
    },
  });
}
function isDescendant(scope, ancestor) { let s = scope; while (s) { if (s === ancestor) return true; s = s.parent; } return false; }

if (fnName) {
  let found = false;
  traverse(ast, {
    "FunctionDeclaration|FunctionExpression|ArrowFunctionExpression"(path) {
      let name = path.node.id?.name;
      if (!name && path.parentPath.isVariableDeclarator()) name = path.parentPath.node.id.name;
      if (name !== fnName || found) return;
      found = true; visit(path, path); path.stop();
    },
  });
  if (!found) { console.error("function not found:", fnName); process.exit(1); }
} else {
  traverse(ast, { Program(path) { visit(path, null); path.stop(); } });
}
const entries = [...free.entries()].sort((a, b) => a[0].localeCompare(b[0]));
if (flag === "--all") console.log(entries.map(([n, c]) => `${n}(${c})`).join(" "));
else console.log(entries.map(([n]) => n).join(", "));
console.error(`${entries.length} free identifiers`);
