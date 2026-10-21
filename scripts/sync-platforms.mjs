import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const check = process.argv.includes("--check");
for (const [source, targets] of [
  ["packages/reset-core/index.js", ["apps/web/public/workbench/reset-core.js", "apps/client/common/reset-core.js"]],
  ["packages/reset-core/index.d.ts", ["apps/web/public/workbench/reset-core.d.ts"]]
]) {
  const content = readFileSync(resolve(root, source), "utf8");
  for (const target of targets) {
    const out = resolve(root, target);
    if (check) {
      if (readFileSync(out, "utf8") !== content) throw new Error("Generated core drift: " + target);
    } else {
      mkdirSync(dirname(out), { recursive: true });
      writeFileSync(out, content);
    }
  }
}
console.log(check ? "Shared core parity PASS" : "Shared core synchronized");
