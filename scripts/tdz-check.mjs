// TDZ check for a big component: any identifier referenced DURING RENDER (i.e. not inside
// a nested function) of the named function, whose `const`/`let` binding in that same
// function is declared textually later, will throw "Cannot access X before initialization".
// Dependency arrays are the classic case. Usage: node tdz-check.mjs <file> <functionName>
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(new URL("../package.json", import.meta.url));
const parser = require("@babel/parser"); const traverse = require("@babel/traverse").default;
const [file, fnName] = process.argv.slice(2);
const code = readFileSync(file, "utf8");
const ast = parser.parse(code, { sourceType: "module", plugins: ["jsx", "typescript"] });
const problems = [];
traverse(ast, {
  "FunctionDeclaration|FunctionExpression|ArrowFunctionExpression"(path) {
    let name = path.node.id?.name;
    if (!name && path.parentPath.isVariableDeclarator()) name = path.parentPath.node.id.name;
    if (name !== fnName) return;
    const fnScope = path.scope;
    path.traverse({
      Identifier(p) {
        if (!p.isReferencedIdentifier()) return;
        const b = p.scope.getBinding(p.node.name);
        if (!b || b.scope !== fnScope) return;
        if (b.kind !== "const" && b.kind !== "let") return;
        // Executed during render only if no nested function sits between the reference and the component.
        if (p.getFunctionParent() !== path) return;
        const declPos = b.identifier.start;
        if (p.node.start < declPos) {
          const line = code.slice(0, p.node.start).split("\n").length;
          const dline = code.slice(0, declPos).split("\n").length;
          problems.push(`${p.node.name} used at line ${line} but declared at line ${dline}`);
        }
      },
    });
    path.stop();
  },
});
if (problems.length) { console.log(problems.join("\n")); process.exit(1); } else console.log("no TDZ hazards in", fnName);
