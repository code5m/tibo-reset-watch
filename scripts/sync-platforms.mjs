import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const check=process.argv.includes("--check");
const pairs=[
 ["packages/reset-core/index.js",["apps/web/public/workbench/reset-core.js","apps/client/common/reset-core.js"]],
 ["packages/reset-core/index.d.ts",["apps/web/public/workbench/reset-core.d.ts"]],
 ["packages/product-core/index.js",["apps/web/public/workbench/product-core.js","apps/client/common/product-core.js"]],
 ["packages/product-core/index.d.ts",["apps/web/public/workbench/product-core.d.ts"]]
];
for(const [source,targets] of pairs) {
 const original=readFileSync(resolve(root,source),"utf8");
 for(const target of targets) {
  const content=source.includes("product-core/index.js")?original.replace('"../reset-core/index.js"','"./reset-core.js"'):original;
  const out=resolve(root,target);
  if(check) {if(readFileSync(out,"utf8")!==content)throw Error("Generated shared source drift: "+target);}
  else {mkdirSync(dirname(out),{recursive:true});writeFileSync(out,content);}
 }
}
console.log(check?"Shared source parity PASS":"Shared sources synchronized");
