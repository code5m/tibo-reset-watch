import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const dir=new URL("../apps/client/common/",import.meta.url);
globalThis.__clientOrigin="https://resetwatch.example";
const load=source=>import("data:text/javascript;base64,"+Buffer.from(source).toString("base64"));
const api=await load(readFileSync(new URL("product.js",dir),"utf8")
 .replace(/^import .*;\n/gm,"")
 .replace('let sessionToken', 'const apiOrigin=()=>globalThis.__clientOrigin;\nlet sessionToken'));
const calls=[],storage=new Map(),requests=[];let callback,consent=true,permission="authorized",providerType="receive",failProduct=null;
globalThis.__pushConfig={nativePushEnabled:true,wechatSubscriptionMessagesEnabledEnabled:true,wechatSubscriptionMessagesEnabled:true};
globalThis.__fakeProduct=async(view,body)=>{calls.push(body);if(failProduct)throw Object.assign(Error("failure"),{status:failProduct});return{id:"device",registered:true,delivered:false};};

const push=await load(`const config=globalThis.__pushConfig;const product=(...a)=>globalThis.__fakeProduct(...a);const apiOrigin=()=>globalThis.__clientOrigin;\n`
 +readFileSync(new URL("push.js",dir),"utf8").replace(/^import .*;\n/gm,""));
function setup(){
 calls.length=0;requests.length=0;storage.clear();failProduct=null;consent=true;permission="authorized";
 globalThis.uni={
  getStorageSync:k=>storage.get(k),setStorageSync:(k,v)=>storage.set(k,v),removeStorageSync:k=>storage.delete(k),
  showModal:o=>{calls.push({system:"consent"});o.success({confirm:consent});},
  getAppAuthorizeSetting:()=>({notificationAuthorized:permission}),
  openAppAuthorizeSetting:o=>{calls.push({system:"settings"});o.success({});},
  getPushClientId:o=>{calls.push({system:"cid"});o.success({cid:"private-device-id"});},
  requestSubscribeMessage:o=>o.success({template:"accept"}),
  login:o=>o.success({code:"one-time-login-code"}),
  onPushMessage:cb=>{callback=cb;calls.push({system:"listen"});},offPushMessage:()=>{callback=null;},
  request:o=>{requests.push(o);return{abort(){calls.push({aborted:true});}};}
 };
 push.stopPushListening();api.clearSession();
}
const token="rw_"+"a".repeat(64),deliveryId="12345678-1234-1234-1234-123456789abc";
test("client credential remains in memory and never saved to storage",async()=>{
 setup();api.setSession(token);const r=api.productRequest("profile");assert.equal(requests[0].header.Authorization,"Bearer "+token);
 requests[0].success({statusCode:200,data:{profile:{id:"p"}}});await r.promise;
 assert.equal(storage.size,0);api.clearSession();
 const r2=api.productRequest("profile");assert.ok(!requests[1].header.Authorization);requests[1].success({statusCode:401,data:{message:"unauthorized"}});
 await assert.rejects(r2.promise,e=>e.status===401);
});
test("client rejects malformed recovery credentials",()=>{setup();assert.throws(()=>api.setSession("bad"));});
test("request can be aborted and transport failures never become success",async()=>{
 setup();const r=api.productRequest("profile");r.abort();requests[0].fail({});await assert.rejects(r.promise);assert.ok(calls.some(c=>c.aborted));
});
test("push listener does not start before user consent",()=>{setup();push.startPushListening();assert.ok(!callback);});
test("cancelled push consent makes no enrollment request",async()=>{
 setup();consent=false;assert.deepEqual(await push.authorizePush({nativePush:true},false),{cancelled:true});
 assert.equal(calls.filter(x=>x.action).length,0);assert.ok(!calls.some(c=>c.system==="cid"));
});
test("missing server capability cannot register a device",async()=>{
 setup();await assert.rejects(push.authorizePush({nativePush:false},false));assert.ok(!calls.some(c=>c.action));
});
test("OS permission refusal never becomes a registered device",async()=>{
 setup();permission="denied";await assert.rejects(push.authorizePush({nativePush:true},false));
 assert.ok(!calls.some(c=>c.system==="cid"));assert.equal(calls.filter(c=>c.action).length,0);
});
test("native registration is not a delivery receipt",async()=>{
 setup();const r=await push.authorizePush({nativePush:true},false);
 assert.equal(r.delivered,false);assert.equal(calls.find(c=>c.action)?.kind,"uni-push");
 assert.ok(callback);assert.ok(!JSON.stringify([...storage]).includes("private-device-id"));
});
test("WeChat uses one-time login code, does not accept client-supplied OpenID",async()=>{
 setup();const r=await push.authorizePush({wechat:true,wechatTemplateId:"template"},true);
 assert.equal(r.delivered,false);assert.equal(calls.find(c=>c.action).code,"one-time-login-code");assert.ok(!calls.find(c=>c.action).openid);
});
test("WeChat subscription rejected: no login or device write",async()=>{
 setup();uni.requestSubscribeMessage=o=>o.success({template:"reject"});await assert.rejects(push.authorizePush({wechat:true,wechatTemplateId:"template"},true));
 assert.ok(!calls.some(c=>c.action));
});
test("received payload stores only bounded IDs and never claims human reading",async()=>{
 setup();await push.authorizePush({nativePush:true},false);failProduct=401;
 callback({type:"receive",data:{payload:{deliveryId,eventId:"e",secret:"DO_NOT_STORE"}}});await new Promise(r=>setImmediate(r));
 const saved=storage.get("resetwatch.receipts."+globalThis.__clientOrigin);
 assert.deepEqual(saved,[{id:deliveryId,stage:"received"}]);assert.ok(!JSON.stringify([...storage]).includes("DO_NOT_STORE"));
});
test("retry pending receipt on reconnected session without duplicate entries",async()=>{
 failProduct=null;await push.flushReceipts();assert.deepEqual(storage.get("resetwatch.receipts."+globalThis.__clientOrigin),[]);
 assert.equal(calls.at(-1).action,"delivery.ack");assert.equal(calls.at(-1).stage,"received");
});
test("untrusted malformed delivery payload ignored",async()=>{
 setup();await push.authorizePush({nativePush:true},false);const n=calls.length;callback({type:"receive",data:{payload:{deliveryId:"attacker"}}});
 assert.equal(calls.length,n);
});
test("revoking consent removes listener and pending receipt IDs",()=>{
 push.forgetPushConsent();assert.ok(!callback);assert.equal(storage.size,0);
});
test("parallel receipt arrivals are serialized without dropping new IDs",async()=>{
 setup();await push.authorizePush({nativePush:true},false);
 const second="22345678-1234-4234-8234-123456789abc";
 let resume;const wait=new Promise(r=>resume=r);let first=true;
 globalThis.__fakeProduct=async(view,body)=>{calls.push(body);if(first){first=false;await wait;}return{recorded:true};};
 callback({type:"receive",data:{payload:{deliveryId}}});
 callback({type:"receive",data:{payload:{deliveryId:second}}});
 assert.equal(storage.get("resetwatch.receipts."+globalThis.__clientOrigin).length,2);
 resume();await push.flushReceipts();
 assert.deepEqual(storage.get("resetwatch.receipts."+globalThis.__clientOrigin),[]);
 assert.equal(calls.filter(c=>c.action==="delivery.ack"&&c.id===second).length,1);
 push.forgetPushConsent();
});
