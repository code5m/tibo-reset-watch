import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {stripTypeScriptTypes} from "node:module";
globalThis.__routeCalls=[];
let source=stripTypeScriptTypes(readFileSync(new URL("../apps/web/app/api/v1/product/route.ts",import.meta.url),"utf8")).replace(/^import .+;\n/gm,"");
const prefix=`class ProductError extends Error{constructor(status,m){super(m);this.status=status;}}
const credentials=r=>r.headers.get('authorization')||'',isAdmin=async()=>false;
const readProduct=async(view)=>{globalThis.__routeCalls.push(view);return {profile:{id:'fixture'}};};
const mutateProduct=async(body)=>{globalThis.__routeCalls.push(body.action);return {saved:true};};`;
const route=await import("data:text/javascript;base64,"+Buffer.from(prefix+source).toString("base64"));
const origin="https://resetwatch.test";
const req=(body,headers={})=>new Request(origin+"/api/v1/product",{method:"POST",headers:{"Content-Type":"application/json","Origin":origin,...headers},body:typeof body==="string"?body:JSON.stringify(body)});
test("product API rejects untrusted browser origin before reading data",async()=>{
 const n=__routeCalls.length;assert.equal((await route.POST(req({},{"Origin":"https://attacker.test"}))).status,403);assert.equal(__routeCalls.length,n);
});
test("product API rejects non-JSON forms",async()=>assert.equal((await route.POST(req({},{"Content-Type":"text/plain"}))).status,415));
test("product API rejects malformed JSON",async()=>assert.equal((await route.POST(req("{"))).status,400));
test("product API enforces streaming byte limit",async()=>assert.equal((await route.POST(req({large:"x".repeat(270000)}))).status,413));
test("profile connection uses a HttpOnly secure cookie",async()=>{
 const r=await route.POST(req({action:"profile.connect",token:"fixture"}));assert.equal(r.status,200);assert.match(r.headers.get("set-cookie"),/HttpOnly/);assert.match(r.headers.get("set-cookie"),/SameSite=Strict/);assert.match(r.headers.get("set-cookie"),/Secure/);
});
test("logout explicitly expires profile cookie",async()=>assert.match((await route.POST(req({action:"profile.logout"}))).headers.get("set-cookie"),/Max-Age=0/));
test("CORS allows exact trusted origin and varies cache",async()=>{
 const r=await route.OPTIONS(new Request(origin+"/api/v1/product",{method:"OPTIONS",headers:{Origin:origin}}));
 assert.equal(r.status,204);assert.equal(r.headers.get("access-control-allow-origin"),origin);assert.equal(r.headers.get("vary"),"Origin");
});
