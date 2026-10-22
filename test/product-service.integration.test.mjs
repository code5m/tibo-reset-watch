/**
 * Real SQL/transaction/RBAC integration. Never points at a user database.
 * Run only with RESETWATCH_TEST_DATABASE=true and a local *_test database.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {stripTypeScriptTypes} from "node:module";
import {createHash} from "node:crypto";
import {emptyPersonal} from "../packages/product-core/index.js";
const url=process.env.TEST_DATABASE_URL;
test("PostgreSQL product integration", {skip:!url}, async t=>{
 if(process.env.RESETWATCH_TEST_DATABASE!=="true") throw Error("Explicit test database flag required");
 const parsed=new URL(url);
 if(!["127.0.0.1","localhost"].includes(parsed.hostname)||!parsed.pathname.endsWith("_test")) throw Error("Refuse non-local/non-test database");
 const {default:pg}=await import("pg");
 const pool=new pg.Pool({connectionString:url,max:6});
 globalThis.__productTestPool=pool;
 const original=readFileSync(new URL("../apps/web/lib/product-service.ts",import.meta.url),"utf8");
 const js=stripTypeScriptTypes(original)
   .replace('import { db } from "@/lib/db";',"const db=()=>globalThis.__productTestPool;")
   .replace('"@/public/workbench/reset-core"',JSON.stringify(new URL("../packages/reset-core/index.js",import.meta.url).href))
   .replace('"@/public/workbench/product-core"',JSON.stringify(new URL("../packages/product-core/index.js",import.meta.url).href));
 const svc=await import("data:text/javascript;base64,"+Buffer.from(js).toString("base64"));
 const envNames=["PRODUCT_DEVICE_KEY","PRODUCT_PUSH_RELAY_URL","PRODUCT_PUSH_RELAY_SECRET","PRODUCT_SEND_ENABLED"];
 const oldEnv=Object.fromEntries(envNames.map(k=>[k,process.env[k]])),oldFetch=globalThis.fetch;
 let alice,bob,workspace,device,delivery;
 try {
  await pool.query(readFileSync(new URL("../database/migrations/006_product_design.sql",import.meta.url),"utf8"));
  await pool.query("truncate product_profiles,product_workspaces,product_members,product_invites,product_devices,product_deliveries,product_audit,product_drafts,product_rate_limits cascade");
  const now=Date.now(),pub=new Date(now-60000).toISOString();
  const e={id:"product-test",title:"TEST FIXTURE NOT NEWS",type:"global",posts:[{id:"123456",url:"https://x.com/thsottiaux/status/123456",original:"TEST FIXTURE NOT NEWS",translation:null,explanation:null,publishedAt:pub,stage:"announced",evidence:"official"}],deadline:null};
  await pool.query("insert into app_settings(key,value) values('resetwatch.catalog.v1',$1::jsonb) on conflict(key) do update set value=excluded.value",
   [JSON.stringify({version:1,catalog:{schemaVersion:1,events:[e]}})]);
  await t.test("schema migration is idempotent",()=>pool.query(readFileSync(new URL("../database/migrations/006_product_design.sql",import.meta.url),"utf8")));
  await t.test("profile creation requires explicit consent",async()=>assert.rejects(svc.mutateProduct({action:"profile.create"},""),{status:400}));
  await t.test("create independent device profiles",async()=>{
   alice=await svc.mutateProduct({action:"profile.create",consent:true,name:"Alice test"},"");
   bob=await svc.mutateProduct({action:"profile.create",consent:true,name:"Bob test"},"");
   assert.notEqual(alice.token,bob.token);assert.equal(alice.profile.data.preferences.enabled,false);
  });
  await t.test("database stores a hash, not the recovery credential",async()=>{
   const r=(await pool.query("select secret_hash from product_profiles where id=$1",[alice.profile.id])).rows[0];
   assert.equal(r.secret_hash,createHash("sha256").update(alice.token).digest("hex"));assert.notEqual(r.secret_hash,alice.token);
  });
  await t.test("profile save persists and rejects stale version",async()=>{
   const data=emptyPersonal();data.preferences.enabled=true;
   const saved=await svc.mutateProduct({action:"profile.save",expectedVersion:1,data},alice.token);
   assert.equal(saved.profile.version,2);
   await assert.rejects(svc.mutateProduct({action:"profile.save",expectedVersion:1,data},alice.token),{status:409});
  });
  await t.test("invalid credentials cannot read someone else's data",async()=>assert.rejects(svc.readProduct("profile","rw_"+"0".repeat(64)),{status:401}));
  await t.test("planner is durably idempotent",async()=>{
   await pool.query("update product_profiles set created_at=now()-interval '1 day' where id=$1",[alice.profile.id]);
   const a=await svc.planProduct(null),b=await svc.planProduct(null);
   assert.equal(a.queued,1);assert.equal(b.queued,0);
   delivery=(await svc.readProduct("deliveries",alice.token)).deliveries[0];assert.equal(delivery.status,"available");
  });
  await t.test("one profile cannot forge another's delivery receipt",async()=>assert.rejects(svc.mutateProduct({action:"delivery.ack",id:delivery.id,stage:"opened"},bob.token),{status:404}));
  await t.test("opening is client-reported, never labeled human-read",async()=>{
   const r=await svc.mutateProduct({action:"delivery.ack",id:delivery.id,stage:"opened"},alice.token);
   assert.equal(r.evidence,"client-reported");assert.equal(r.readByHuman,"unknown");
  });
  await t.test("create team and single-use viewer invite",async()=>{
   workspace=await svc.mutateProduct({action:"workspace.create",name:"Test workspace"},alice.token);
   const invite=await svc.mutateProduct({action:"workspace.invite",id:workspace.id,role:"viewer"},alice.token);
   await svc.mutateProduct({action:"workspace.join",invite:invite.invite},bob.token);
   await assert.rejects(svc.mutateProduct({action:"workspace.join",invite:invite.invite},bob.token),{status:400});
  });
  await t.test("viewer cannot edit or invite",async()=>{
   await assert.rejects(svc.mutateProduct({action:"workspace.save",id:workspace.id,data:emptyPersonal(),expectedVersion:1},bob.token),{status:403});
   await assert.rejects(svc.mutateProduct({action:"workspace.invite",id:workspace.id,role:"editor"},bob.token),{status:403});
  });
  await t.test("owner can grant editor, edits use optimistic versioning",async()=>{
   await svc.mutateProduct({action:"workspace.member",id:workspace.id,memberId:bob.profile.id,role:"editor"},alice.token);
   assert.equal((await svc.mutateProduct({action:"workspace.save",id:workspace.id,data:emptyPersonal(),expectedVersion:1},bob.token)).version,2);
   await assert.rejects(svc.mutateProduct({action:"workspace.save",id:workspace.id,data:emptyPersonal(),expectedVersion:1},alice.token),{status:409});
  });
  await t.test("draft is not automatically published",async()=>{
   await assert.rejects(svc.mutateProduct({action:"draft.save"},alice.token),{status:403});
   const r=await svc.mutateProduct({action:"draft.save",eventId:e.id,kind:"alert",text:"TEST DRAFT"},alice.token,true);
   assert.equal(r.published,false);assert.equal(r.status,"draft");
  });
  await t.test("native enrollment encrypts target and prevents stealing",async()=>{
   process.env.PRODUCT_DEVICE_KEY="a".repeat(64);process.env.PRODUCT_PUSH_RELAY_URL="https://relay.resetwatch.test";
   process.env.PRODUCT_PUSH_RELAY_SECRET="test-only-not-a-production-secret";
   device=await svc.mutateProduct({action:"device.register",consent:true,kind:"uni-push",cid:"test-device-cid"},alice.token);
   const r=(await pool.query("select encrypted_target from product_devices where id=$1",[device.id])).rows[0];
   assert.ok(!r.encrypted_target.includes("test-device-cid"));
   await assert.rejects(svc.mutateProduct({action:"device.register",consent:true,kind:"uni-push",cid:"test-device-cid"},bob.token),{status:409});
  });
  await t.test("concurrent destination enrollment has exactly one owner",async()=>{
   const enroll=t=>svc.mutateProduct({action:"device.register",consent:true,kind:"uni-push",cid:"race-device-cid"},t);
   const results=await Promise.allSettled([enroll(alice.token),enroll(bob.token)]);
   assert.equal(results.filter(x=>x.status==="fulfilled").length,1);
   assert.equal(results.filter(x=>x.status==="rejected"&&x.reason.status===409).length,1);
   const targets=(await pool.query("select id,profile_id from product_devices where token_hash=$1",[
    createHash("sha256").update('uni-push:{"cid":"race-device-cid"}').digest("hex")])).rows;
   assert.equal(targets.length,1);
   await pool.query("delete from product_devices where id=$1",[targets[0].id]);
  });
  await t.test("send switch defaults to blocked",async()=>{
   delete process.env.PRODUCT_SEND_ENABLED;await svc.planProduct(null);
   assert.ok((await svc.dispatchProduct()).blocked);
  });
  await t.test("provider accepted is not device delivered",async()=>{
   process.env.PRODUCT_SEND_ENABLED="true";
   globalThis.fetch=async(_,init)=>{assert.ok(init.headers["X-ResetWatch-Signature"]);return Response.json({accepted:true,providerId:"fixture-request"});};
   const r=await svc.dispatchProduct();assert.equal(r.accepted,1);
   const native=(await svc.readProduct("deliveries",alice.token)).deliveries.find(x=>x.channel==="native");
   assert.equal(native.status,"accepted");assert.equal(native.received_at,null);
  });
  await t.test("explicit retry changes request key but preserves delivery identity",async()=>{
   const native=(await svc.readProduct("deliveries",alice.token)).deliveries.find(x=>x.channel==="native");
   await pool.query("update product_deliveries set status='unknown' where id=$1",[native.id]);
   await assert.rejects(svc.mutateProduct({action:"delivery.retry",id:native.id},alice.token),{status:400});
   await svc.mutateProduct({action:"delivery.retry",id:native.id,confirmation:"可能重复发送"},alice.token);
   const row=(await pool.query("select payload from product_deliveries where id=$1",[native.id])).rows[0];
   assert.notEqual(row.payload.requestId,native.id);
   globalThis.fetch=async(_,init)=>{
    const sent=JSON.parse(init.body);
    assert.equal(sent.deliveryId,native.id);assert.equal(sent.requestId,row.payload.requestId);
    assert.equal(init.headers["Idempotency-Key"],row.payload.requestId);
    return Response.json({accepted:true,providerId:"fixture-explicit-retry"});
   };
   assert.equal((await svc.dispatchProduct()).accepted,1);
  });
  await t.test("a receipt blocks a subsequent duplicate-risk retry",async()=>{
   const native=(await svc.readProduct("deliveries",alice.token)).deliveries.find(x=>x.channel==="native");
   await svc.mutateProduct({action:"delivery.ack",id:native.id,stage:"received"},alice.token);
   await pool.query("update product_deliveries set status='unknown' where id=$1",[native.id]);
   await assert.rejects(svc.mutateProduct({action:"delivery.retry",id:native.id,confirmation:"可能重复发送"},alice.token),{status:409});
  });
  await t.test("revocation persists without claiming provider recall",async()=>{
   const r=await svc.mutateProduct({action:"device.revoke",id:device.id},alice.token);assert.equal(r.revoked,true);
   assert.ok((await svc.readProduct("devices",alice.token)).devices[0].revoked_at);
  });
  await t.test("export never includes token or encrypted destinations",async()=>{
   const r=JSON.stringify(await svc.readProduct("export",alice.token));
   assert.ok(!r.includes(alice.token));assert.ok(!r.includes("encrypted_target"));
  });
  await t.test("owner deletion blocked until team is removed",async()=>{
   await assert.rejects(svc.mutateProduct({action:"profile.delete",confirmation:"DELETE"},alice.token),{status:409});
   await svc.mutateProduct({action:"workspace.delete",id:workspace.id,confirmation:"DELETE"},alice.token);
   await svc.mutateProduct({action:"profile.delete",confirmation:"DELETE"},alice.token);
   await assert.rejects(svc.readProduct("profile",alice.token),{status:401});
  });
  await t.test("profile deletion cascades device data and delivery records",async()=>{
   assert.equal((await pool.query("select count(*)::int as n from product_devices where profile_id=$1",[alice.profile.id])).rows[0].n,0);
   assert.equal((await pool.query("select count(*)::int as n from product_deliveries where profile_id=$1",[alice.profile.id])).rows[0].n,0);
  });
 } finally {
  globalThis.fetch=oldFetch;
  for(const k of envNames) oldEnv[k]===undefined?delete process.env[k]:process.env[k]=oldEnv[k];
  await pool.end();delete globalThis.__productTestPool;
 }
});
