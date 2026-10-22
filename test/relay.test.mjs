import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
const {createRelay,createSender}=createRequire(import.meta.url)('../uniCloud/cloudfunctions/resetwatch-relay/relay.cjs');
const secret='test-only-relay-secret-never-production-12345',now=1792620000000;
const deliveryId='12345678-1234-4234-8234-123456789abc';
const payload=()=>({deliveryId,kind:'uni-push',target:{cid:'fixture-cid'},eventId:'fixture',title:'Fixture reset',body:'Not a real notification.'});
function signed(body=payload(),ts=now,base64=false) {
 const raw=JSON.stringify(body);return {httpMethod:'POST',body:base64?Buffer.from(raw).toString('base64'):raw,isBase64Encoded:base64,
 headers:{'X-ResetWatch-Time':String(ts),'X-ResetWatch-Signature':crypto.createHmac('sha256',secret).update(ts+'.'+raw).digest('hex'),
 'Idempotency-Key':body.requestId||body.deliveryId}};
}
function fixture(send=async()=>({accepted:true,providerId:'real-provider-task-from-fixture'})) {
 const records=new Map(),calls=[];
 const store={async claim(id,hash,at){if(records.has(id))return{fresh:false,...records.get(id)};records.set(id,{hash,at});return{fresh:true};},
 async finish(id,result){records.get(id).result=result;}};
 const handle=createRelay({store,secret,enabled:true,now:()=>now,send:async p=>{calls.push(p);return send(p);}});
 return {handle,store,records,calls};
}
const body=r=>JSON.parse(r.body);
test('default-off relay cannot call provider',async()=>{
 const f=fixture(),h=createRelay({store:f.store,send:()=>{throw Error('must not send');},secret,enabled:false,now:()=>now});
 assert.equal(body(await h(signed())).code,'relay_sending_disabled');assert.equal(f.records.size,0);
});
test('reject wrong method, short key and invalid signatures before ledger',async()=>{
 const f=fixture();assert.equal((await f.handle({...signed(),httpMethod:'GET'})).statusCode,405);
 const bad=signed();bad.body+=' ';assert.equal((await f.handle(bad)).statusCode,401);
 const h=createRelay({store:f.store,send:()=>{},secret:'short',enabled:true});assert.equal((await h(signed())).statusCode,503);assert.equal(f.calls.length,0);
});
test('reject replay-window expiry even with valid HMAC',async()=>{const f=fixture();assert.equal((await f.handle(signed(payload(),now-300001))).statusCode,401);});
test('HMAC authenticates decoded bytes of URLized base64 requests',async()=>{assert.equal(body(await fixture().handle(signed(payload(),now,true))).accepted,true);});
test('target missing/array/empty never becomes broadcast',async()=>{
 const f=fixture();for(const target of [null,{}, {cid:''},{cid:['a','b']},{cid:123}])assert.equal((await f.handle(signed({...payload(),target}))).statusCode,400);
 assert.equal(f.calls.length,0);
});
test('idempotency header must match signed request id',async()=>{const f=fixture(),p=signed();p.headers['Idempotency-Key']='other';assert.equal((await f.handle(p)).statusCode,400);});
test('same request is sent once, provider acceptance not receipt',async()=>{
 const f=fixture(),first=body(await f.handle(signed())),again=body(await f.handle(signed()));
 assert.equal(first.accepted,true);assert.equal(first.deviceDelivery,'unknown');assert.equal(again.replayed,true);assert.equal(f.calls.length,1);
});
test('same key with altered payload rejected',async()=>{const f=fixture();await f.handle(signed());assert.equal((await f.handle(signed({...payload(),body:'changed'}))).statusCode,409);assert.equal(f.calls.length,1);});
test('concurrent duplicate cannot reserve or send twice',async()=>{
 let release;const pending=new Promise(r=>release=r),f=fixture(async()=>{await pending;return {accepted:true,providerId:'task'};});
 const a=f.handle(signed());await new Promise(r=>setImmediate(r));const b=await f.handle(signed());assert.equal(body(b).accepted,null);release();await a;assert.equal(f.calls.length,1);
});
test('network failure remains ambiguous, never automatically sent again',async()=>{
 const f=fixture(async()=>{throw Error('SECRET_URL');});const first=await f.handle(signed());const second=await f.handle(signed());
 assert.equal(body(first).accepted,null);assert.equal(body(second).accepted,null);assert.equal(f.calls.length,1);assert.ok(!first.body.includes('SECRET_URL'));
});
test('ledger failure before provider means no send',async()=>{
 const f=fixture();f.store.claim=async()=>{throw Error('database unavailable');};const r=await f.handle(signed());assert.equal(body(r).code,'ledger_unavailable');assert.equal(f.calls.length,0);
});
test('ledger commit failure after provider is unknown and cannot resend',async()=>{
 const f=fixture();f.store.finish=async()=>{throw Error('db');};assert.equal(body(await f.handle(signed())).code,'ledger_commit_unknown');await f.handle(signed());assert.equal(f.calls.length,1);
});
test('only a new explicit requestId permits another attempt while deliveryId remains stable',async()=>{
 const f=fixture(async()=>({accepted:false}));await f.handle(signed());await f.handle(signed());assert.equal(f.calls.length,1);
 await f.handle(signed({...payload(),requestId:'22345678-1234-4234-8234-123456789abc'}));assert.equal(f.calls.length,2);assert.equal(f.calls[0].deliveryId,f.calls[1].deliveryId);
});
test('signed oversized body rejected',async()=>{const f=fixture();assert.equal((await f.handle(signed({...payload(),body:'x'.repeat(40000)}))).statusCode,413);});
test('native sender uses one target, provider task ID and delivery payload',async()=>{
 let args;const send=createSender({env:{DCLOUD_APP_ID:'__UNI__FIXTURE'},cloud:{getPushManager:()=>({sendMessage:async a=>{args=a;return{errCode:0,data:{task42:{cid:'successed_offline'}}};}})}});
 const result=await send(payload());assert.equal(result.providerId,'task42');assert.equal(args.push_clientid,'fixture-cid');assert.deepEqual(args.payload,{deliveryId,eventId:'fixture'});assert.equal(args.request_id.length,32);
});
test('provider success without task evidence remains ambiguous',async()=>{
 const send=createSender({env:{DCLOUD_APP_ID:'__UNI__FIXTURE'},cloud:{getPushManager:()=>({sendMessage:async()=>({errCode:0})})}});
 await assert.rejects(send(payload()));
});
test('WeChat fields must be configured, only actual approved template selected',async()=>{
 const calls=[],env={WECHAT_APP_ID:'wx-fixture',WECHAT_APP_SECRET:'test-secret',WECHAT_TEMPLATE_ID:'approved',WECHAT_TEMPLATE_FIELDS:JSON.stringify({thing1:{source:'title',maxLength:20}})};
 const cloud={httpclient:{request:async(url,options)=>{calls.push({url,options});return url.includes('stable_token')?{status:200,data:{access_token:'private-token',expires_in:7200}}:{status:200,data:{errcode:0}};}}};
 const send=createSender({env,cloud,now:()=>now}),p={...payload(),kind:'wechat',target:{openid:'private-openid',templateId:'approved'}};
 const r=await send(p);assert.equal(r.accepted,true);assert.match(r.correlation,/not_device_receipt/);assert.equal(calls.length,2);
 assert.equal(calls[1].options.data.touser,'private-openid');assert.equal(calls[1].options.data.data.thing1.value,'Fixture reset');
 await send(p);assert.equal(calls.length,3);await assert.rejects(send({...p,target:{...p.target,templateId:'other'}}));assert.equal(calls.length,3);
});
test('cloud ledger schema prohibits public read and write',async()=>{
 const {readFile}=await import('node:fs/promises');const schema=JSON.parse(await readFile(new URL('../uniCloud/database/resetwatch_relay_ledger.schema.json',import.meta.url)));
 assert.deepEqual(schema.permission,{read:false,create:false,update:false,delete:false});
});
