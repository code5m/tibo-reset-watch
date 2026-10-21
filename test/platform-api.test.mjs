// Tests execute the actual route bodies with mocked DB/auth; NOT a PostgreSQL integration test.
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {stripTypeScriptTypes} from "node:module";

const coreUrl=new URL("../packages/reset-core/index.js",import.meta.url).href;
async function route(path, key) {
  const original=readFileSync(new URL(path,import.meta.url),"utf8");
  const js=stripTypeScriptTypes(original).replace(/^import .+;\n/gm,"");
  const prefix=`import {validateCatalog} from ${JSON.stringify(coreUrl)};
const db=()=>globalThis.${key}.db;
const isAdmin=async()=>globalThis.${key}.admin;`;
  return import("data:text/javascript;base64,"+Buffer.from(prefix+"\n"+js).toString("base64"));
}
globalThis.__publicApi={db:null,admin:false};
globalThis.__adminApi={db:null,admin:false};
const publicRoute=await route("../apps/web/app/api/v1/reset-events/route.ts","__publicApi");
const adminRoute=await route("../apps/web/app/api/admin/reset-catalog/route.ts","__adminApi");
const empty={schemaVersion:1,events:[]};
const request=(body,origin="https://resetwatch.test",contentType="application/json")=>new Request(
  "https://resetwatch.test/api/admin/reset-catalog",
  {method:"PUT",headers:{origin,"Content-Type":contentType},body:JSON.stringify(body)});
function transaction(version=0,failAt="") {
  const calls=[];
  return {calls,release(){calls.push("release");},async query(sql,params){
    calls.push(sql);
    if(failAt&&sql.startsWith(failAt))throw new Error("PRIVATE DB ERROR");
    if(sql.startsWith("select value"))return {rows:[{value:{version,catalog:empty}}]};
    return {rows:[]};
  }};
}
test("public API returns unavailable, not no-reset, when DB is missing",async()=>{
  globalThis.__publicApi.db=null;
  const r=await publicRoute.GET(new Request("https://resetwatch.test/api/v1/reset-events"));
  assert.equal(r.status,503);assert.equal(r.headers.get("Cache-Control"),"no-store");
  assert.equal((await r.json()).availability,"unconfigured");
});
test("public API rejects unbounded pagination before queries",async()=>{
  globalThis.__publicApi.db={query(){throw new Error("must not query");}};
  for(const q of ["limit=999","offset=-1","limit=1.5","offset=foo"])assert.equal(
    (await publicRoute.GET(new Request("https://resetwatch.test/api/v1/reset-events?"+q))).status,400);
});
test("public empty catalog exposes no subscriber data",async()=>{
  globalThis.__publicApi.db={async query(sql){
    return sql.startsWith("select value")?{rows:[{value:{catalog:empty,secret:"PRIVATE"}}]}:{rows:[{count:4}]};
  }};
  const r=await publicRoute.GET(new Request("https://resetwatch.test/api/v1/reset-events"));
  const d=await r.json();
  assert.equal(r.status,200);assert.equal(r.headers.get("Access-Control-Allow-Origin"),"*");
  assert.deepEqual(d.events,[]);assert.equal(d.pendingReviewCount,4);assert.equal(d.capabilities.nativePush,false);
  assert.ok(!JSON.stringify(d).includes("PRIVATE"));
});
test("corrupted public catalog fails closed",async()=>{
  globalThis.__publicApi.db={async query(){return{rows:[{value:{catalog:{schemaVersion:9,events:[]}}}]};}};
  assert.equal((await publicRoute.GET(new Request("https://resetwatch.test/api/v1/reset-events"))).status,503);
});
test("operator GET requires an authenticated session",async()=>{
  globalThis.__adminApi={db:null,admin:false};
  assert.equal((await adminRoute.GET()).status,401);
});
test("operator PUT requires authentication before processing body",async()=>{
  globalThis.__adminApi={db:null,admin:false};
  assert.equal((await adminRoute.PUT(request({}))).status,401);
});
test("authenticated cross-origin writes are rejected",async()=>{
  globalThis.__adminApi={db:{},admin:true};
  assert.equal((await adminRoute.PUT(request({},"https://attacker.test"))).status,403);
});
test("operator writes require JSON",async()=>{
  assert.equal((await adminRoute.PUT(request({},"https://resetwatch.test","text/plain"))).status,415);
});
test("missing database is not reported as successful save",async()=>{
  globalThis.__adminApi.db=null;
  assert.equal((await adminRoute.PUT(request({expectedVersion:0,catalog:empty}))).status,503);
});
test("request body cap is enforced independently of Content-Length",async()=>{
  globalThis.__adminApi.db={connect(){throw new Error("must not connect");}};
  const r=await adminRoute.PUT(request({padding:"x".repeat(270000)}));
  assert.equal(r.status,400);assert.match((await r.json()).message,/256KB/);
});
test("invalid catalog never enters a transaction",async()=>{
  const r=await adminRoute.PUT(request({expectedVersion:0,catalog:{schemaVersion:99,events:[]}}));
  assert.equal(r.status,400);
});
test("a failed DB connection is handled without leaking database details",async()=>{
  globalThis.__adminApi.db={async connect(){throw new Error("PRIVATE DB URL");}};
  const r=await adminRoute.PUT(request({expectedVersion:0,catalog:empty}));
  assert.equal(r.status,503);assert.ok(!(await r.text()).includes("PRIVATE"));
});
test("stale version triggers rollback, no overwrite",async()=>{
  const tx=transaction(3);globalThis.__adminApi.db={async connect(){return tx;}};
  const r=await adminRoute.PUT(request({expectedVersion:2,catalog:empty}));
  assert.equal(r.status,409);assert.ok(tx.calls.includes("rollback"));assert.ok(!tx.calls.some(s=>s.startsWith("update")));
  assert.ok(tx.calls.includes("release"));
});
test("successful transaction saves version and audit but sends nothing",async()=>{
  const tx=transaction(0);globalThis.__adminApi.db={async connect(){return tx;}};
  const r=await adminRoute.PUT(request({expectedVersion:0,catalog:empty}));
  assert.equal(r.status,200);assert.deepEqual(await r.json(),{ok:true,version:1,notificationsSent:false});
  assert.ok(tx.calls.includes("commit"));assert.ok(tx.calls.some(s=>s.startsWith("insert into events")));
  assert.ok(!tx.calls.some(s=>s.includes("campaigns")));
});
test("failed write rolls back and returns an unavailable response",async()=>{
  const tx=transaction(0,"update");globalThis.__adminApi.db={async connect(){return tx;}};
  const r=await adminRoute.PUT(request({expectedVersion:0,catalog:empty}));
  assert.equal(r.status,503);assert.ok(tx.calls.includes("rollback"));assert.ok(!tx.calls.includes("commit"));
  assert.ok(tx.calls.includes("release"));
});
