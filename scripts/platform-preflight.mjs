import {readFileSync} from "node:fs";
import {resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const target=process.argv[2];
if(!["web","mp-weixin","ios","android","harmony"].includes(target)){
  console.error("Usage: node scripts/platform-preflight.mjs web|mp-weixin|ios|android|harmony");process.exit(2);
}
const config=JSON.parse(readFileSync(resolve(root,"apps/client/config.json"),"utf8"));
const manifest=JSON.parse(readFileSync(resolve(root,"apps/client/manifest.json"),"utf8"));
const errors=[];
if(target!=="web"){
 if(!/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(config.apiBaseUrl)||/example|localhost|127\.0\.0\.1/i.test(config.apiBaseUrl))
  errors.push("Set a real production HTTPS apiBaseUrl in apps/client/config.json.");
 if(target==="mp-weixin"&&!/^wx[0-9a-f]{16}$/i.test(manifest["mp-weixin"].appid))
  errors.push("A real WeChat AppID and approved request domain are required.");
 if(["ios","android","harmony"].includes(target)&&!/^__UNI__[A-Z0-9]+$/i.test(manifest.appid))
  errors.push("Set the DCloud appid assigned to this project; do not invent one.");
}
if(errors.length){console.error("RELEASE BLOCKED\n"+errors.join("\n"));process.exit(1);}
console.log("Source configuration check PASS for "+target+". This is NOT an SDK build, signature, device test or store approval.");
