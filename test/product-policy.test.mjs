import test from "node:test";
import assert from "node:assert/strict";
import {emptyPersonal,validatePersonal,notificationCandidates,inQuietHours,clockStatus,deliveryLabel,widgetSummary} from "../packages/product-core/index.js";
const now=Date.parse("2026-10-22T12:00:00+08:00");
const post=(id,stage,at=now-60000)=>({id,url:`https://x.com/thsottiaux/status/${id}`,publishedAt:new Date(at).toISOString(),evidence:"official",stage,original:"TEST FIXTURE"});
const event=()=>({id:"test-event",type:"global",title:"TEST FIXTURE",posts:[post("123","announced")],
 deadline:{at:new Date(now+3600000).toISOString(),sourcePostId:"123",kind:"upper_bound",basis:"explicit"}});
const prefs=()=>({...emptyPersonal().preferences,enabled:true});
test("unknown fields never enter personal payload",()=>assert.equal(validatePersonal({...emptyPersonal(),token:"do not export"}).token,undefined));
test("notification enrollment is opt-in",()=>assert.equal(emptyPersonal().preferences.enabled,false));
test("malformed imported state rejected",()=>assert.throws(()=>validatePersonal({schemaVersion:999})));
test("arbitrary preference source and types rejected",()=>{const p=emptyPersonal();p.preferences.types=["everything"];assert.throws(()=>validatePersonal(p));});
test("invalid task dates rejected",()=>{const p=emptyPersonal();p.tasks=[{id:"1",title:"test",done:false,priority:"high",createdAt:"2026-02-31"}];assert.throws(()=>validatePersonal(p));});
test("bounded data avoids unbounded profile document",()=>{const p=emptyPersonal();p.bookmarks=Array(501).fill("a");assert.throws(()=>validatePersonal(p));});
test("cross-midnight quiet hours use Beijing",()=>{const p=prefs();p.quiet.enabled=true;assert.equal(inQuietHours(p,Date.parse("2026-10-22T23:30:00+08:00")),true);assert.equal(inQuietHours(p,now),false);});
test("quiet end is excluded",()=>{const p=prefs();p.quiet.enabled=true;assert.equal(inQuietHours(p,Date.parse("2026-10-22T07:00:00+08:00")),false);});
test("all-day ambiguous quiet hours rejected",()=>{const p=emptyPersonal();p.preferences.quiet={enabled:true,start:"00:00",end:"00:00"};assert.throws(()=>validatePersonal(p));});
test("clock uses round trip midpoint and exposes skew",()=>{const v=clockStatus("2026-10-22T04:00:00Z",now-120500,now-120000,now,now);assert.equal(v.calibrated,true);assert.equal(v.skewWarning,true);});
test("unknown server time not presented as calibrated",()=>assert.equal(clockStatus(null,now,now,null,now).calibrated,false));
test("no success is stale",()=>assert.equal(clockStatus(null,now,now,null,now).stale,true));
test("ordinary announcement is actionable",()=>assert.ok(notificationCandidates([event()],prefs(),now-3600000,now).some(x=>x.phase==="announced")));
test("only most urgent entered window is selected",()=>{const r=notificationCandidates([event()],prefs(),now-3600000,now).filter(x=>x.phase.startsWith("reminder"));assert.deepEqual(r.map(x=>x.phase),["reminder_1"]);});
test("completed event never schedules old quota reminders",()=>{const e=event();e.posts.push(post("124","completed"));const r=notificationCandidates([e],prefs(),now-3600000,now);assert.deepEqual(r.map(x=>x.phase),["completed"]);});
test("propagating signal does not produce old quota deadline reminder",()=>{const e=event();e.posts.push(post("124","propagating"));assert.deepEqual(notificationCandidates([e],prefs(),now-3600000,now).map(x=>x.phase),["propagating"]);});
test("future official posts ignored",()=>{const e=event();e.posts=[post("123","completed",now+3600000)];assert.deepEqual(notificationCandidates([e],prefs(),0,now),[]);});
test("third-party record is not an official trigger",()=>{const e=event();e.posts[0].evidence="archive";assert.deepEqual(notificationCandidates([e],prefs(),0,now),[]);});
test("demo never notifies",()=>assert.deepEqual(notificationCandidates([{...event(),demo:true}],prefs(),0,now),[]));
test("unfollowed source stays silent",()=>{const p=prefs();p.sources=[];assert.deepEqual(notificationCandidates([event()],p,0,now),[]);});
test("overdue does not count as completed",()=>{const e=event();e.deadline.at=new Date(now-1000).toISOString();assert.deepEqual(notificationCandidates([e],prefs(),0,now),[]);});
test("banked never emits Global reminder",()=>{const e=event();e.type="banked";assert.ok(notificationCandidates([e],prefs(),0,now).every(x=>!x.phase.startsWith("reminder")));});
test("enrollment does not replay old completion",()=>{const e=event();e.posts=[post("123","completed")];assert.deepEqual(notificationCandidates([e],prefs(),now,now),[]);});
test("provider acceptance not equated with device delivery",()=>assert.match(deliveryLabel({status:"accepted"}),/设备送达未知/));
test("client click is not proof of reading",()=>assert.match(deliveryLabel({status:"accepted",opened_at:new Date().toISOString()}),/不等于已阅读/));
test("widget cannot claim personal quota or arrival",()=>assert.equal(widgetSummary(event(),null,now).personalArrival,null));
test("empty widget is unavailable, not no-reset",()=>assert.equal(widgetSummary(null,null,now).available,false));

test("a new explicit time commitment has its own dedupe phase",()=>{
 const e=event();e.posts.push(post("125","scheduled"));assert.ok(notificationCandidates([e],prefs(),0,now).some(x=>x.phase==="schedule_125"));
});
