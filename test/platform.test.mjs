import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";
import {
  validateCatalog,instant,beijing,pacific,pacificEod,duration,metrics,eventState,
  defaultPostIndex,actionText,copyDraft,demoCatalog,safePostUrl
} from "../packages/reset-core/index.js";

const iso="2026-10-18T00:21:13+08:00";
const post=(id,at,stage="scheduled")=>({id,url:`https://x.com/thsottiaux/status/${id}`,publishedAt:at,stage,
  evidence:"official",original:"Fixture only",translation:null,explanation:null});
const event=()=>({id:"fixture-global",title:"Fixture",type:"global",
  posts:[post("123",iso),post("124","2026-10-18T05:12:21+08:00","completed")],
  deadline:{at:"2026-10-18T15:00:00+08:00",kind:"upper_bound",basis:"PDT",sourcePostId:"123",alternativeAt:null,note:null}});
const catalog=e=>({schemaVersion:1,events:[e]});
test("strict source timestamps require timezones",()=>{assert.equal(instant("2026-10-18 00:21"),null);assert.equal(instant("bad"),null);assert.equal(instant(null),null);});
test("reject invalid calendar date instead of normalizing Feb 31",()=>assert.equal(instant("2026-02-31T00:00:00Z"),null));
test("Beijing formatting is independent of machine timezone",()=>assert.equal(beijing(iso),"2026年10月18日 00:21:13"));
test("Pacific date is previous local calendar day",()=>assert.equal(pacific(iso),"2026年10月17日 09:21:13（PDT）"));
test("Pacific winter formatting uses PST",()=>assert.match(pacific("2026-12-18T00:21:13+08:00"),/12月17日 08:21:13（PST）/));
test("EOD is a latest bound on the ORIGINAL local date",()=>{const d=pacificEod(iso,"PST");assert.equal(d.at,"2026-10-18T07:00:00.000Z");assert.equal(d.alternativeAt,"2026-10-18T08:00:00.000Z");assert.equal(d.kind,"upper_bound");});
test("Oct 13 09:03 CN belongs to Oct 12 Pacific, not Oct 13",()=>assert.equal(pacificEod("2026-10-13T09:03:00+08:00").at,"2026-10-13T07:00:00.000Z"));
test("winter EOD has no misleading one-hour alternative",()=>{const d=pacificEod("2026-12-18T00:21:13+08:00","PST");assert.equal(d.at,"2026-12-18T08:00:00.000Z");assert.equal(d.alternativeAt,null);assert.equal(d.basis,"PST");});
test("EOD conversion accounts for DST ending later that local day",()=>assert.equal(pacificEod("2026-11-01T07:30:00Z").at,"2026-11-02T08:00:00.000Z"));
test("catalog projections drop secrets and unrelated attributes",()=>{const e=event();e.secret="never publish";const c=validateCatalog(catalog(e));assert.equal(c.events[0].secret,undefined);});
test("reject spoofed X URLs and mismatched post IDs",()=>{const e=event();e.posts[0].url="https://x.com.attacker.test/thsottiaux/status/123";assert.throws(()=>validateCatalog(catalog(e)));assert.equal(safePostUrl("https://x.com/thsottiaux/status/124","123"),false);});
test("one X post cannot belong to two reset events",()=>{const a=event(),b=event();b.id="another";assert.throws(()=>validateCatalog({schemaVersion:1,events:[a,b]}),/重复/);});
test("deadline must have official evidence",()=>{const e=event();e.posts[0].evidence="archive";assert.throws(()=>validateCatalog(catalog(e)),/截止时间必须/);});
test("reject a deadline before its source post",()=>{const e=event();e.deadline.at="2026-10-17T00:00:00Z";assert.throws(()=>validateCatalog(catalog(e)),/早于/);});
test("demo content cannot enter production catalog",()=>assert.throws(()=>validateCatalog(demoCatalog()),/演示/));
test("sort source posts chronologically",()=>{const e=event();e.posts.reverse();assert.equal(validateCatalog(catalog(e)).events[0].posts[0].id,"123");});
test("official completion dominates while reading an older announcement",()=>{const e=event(),n=instant("2026-10-18T12:00:00+08:00"),m=metrics(e,e.posts[0],n);assert.equal(m.state.code,"completed");assert.equal(m.deadlineValue,"提前 9时47分39秒");});
test("post age changes per page; event completion does not",()=>{const e=event(),n=instant("2026-10-18T12:05:00+08:00");assert.notEqual(metrics(e,e.posts[0],n).elapsed,metrics(e,e.posts[1],n).elapsed);assert.equal(metrics(e,e.posts[0],n).deadlineValue,metrics(e,e.posts[1],n).deadlineValue);});
test("an overdue reference deadline does not prove completion",()=>{const e=event();e.posts.pop();const n=instant("2026-10-19T00:00:00Z");assert.equal(eventState(e,n).code,"overdue");assert.match(metrics(e,e.posts[0],n).deadlineValue,/已过/);});
test("missing deadline is unknown not zero countdown",()=>{const e=event();e.deadline=null;assert.equal(metrics(e,e.posts[0],Date.now()).deadlineValue,"未知");});
test("future completion posts are not current confirmed completion",()=>assert.notEqual(eventState(event(),instant(iso)).code,"completed"));
test("an unverified Done is not official confirmation",()=>{const e=event();e.posts[1].evidence="unverified";assert.notEqual(eventState(e,instant("2026-10-18T12:00:00+08:00")).code,"completed");});
test("unknown event type cannot become an official global reset",()=>{const e=event();e.type="unknown";assert.equal(eventState(e).code,"unverified");});
test("global event cannot contain banked credited stage",()=>{const e=event();e.posts[1].stage="banked_credited";assert.throws(()=>validateCatalog(catalog(e)),/Banked/);});
test("banked action never urges burning old allowance",()=>{const e=event();e.type="banked";e.posts.pop();assert.match(actionText(e,instant(iso)),/不等于自动清空/);});
test("targeted correction is not described as everyone reset",()=>{const e=event();e.type="quota_correction";e.posts.pop();assert.match(actionText(e),/不是全员 Reset/);});
test("completed event selects Done by default",()=>assert.equal(defaultPostIndex(event()),1));
test("future timestamp is not disguised as elapsed time",()=>{const e=event();assert.match(metrics(e,e.posts[0],instant(iso)-1000).elapsed,/时间异常/);});
test("draft generation remains unpublished and preserves source URLs",()=>{const text=copyDraft(event(),Date.now(),true);assert.match(text,/未发布/);assert.match(text,/https:\/\/x\.com\/thsottiaux\/status\/123/);});
test("demo drafts carry a do-not-publish-as-news warning",()=>assert.match(copyDraft(demoCatalog().events[0]),/演示，禁止当新闻发布/));
test("duration supports days without wrapping at 24 hours",()=>assert.equal(duration(90061000),"1天 1时1分1秒"));
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
test("web and multi-platform client consume byte-identical shared semantics",()=>{
 const canonical=readFileSync(resolve(root,"packages/reset-core/index.js"),"utf8");
 for(const p of ["apps/web/public/workbench/reset-core.js","apps/client/common/reset-core.js"])
  assert.equal(readFileSync(resolve(root,p),"utf8"),canonical);
});
