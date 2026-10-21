/**
 * ResetWatch's shared, dependency-free presentation contract.
 * Canonical source; sync-platforms.mjs copies this file into both clients.
 * No X polling, secrets, push permissions or account balances belong here.
 */
export const SCHEMA_VERSION = 1;
export const TYPES = ["global", "banked", "quota_correction", "unknown"];
export const STAGES = ["announced", "scheduled", "propagating", "completed", "banked_credited", "info"];
export const TYPE_LABELS = { global: "Global Reset", banked: "Banked Reset", quota_correction: "额度补偿", unknown: "类型未核实" };
const ISO = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?(?:Z|[+-]\d\d:\d\d)$/;
const DAY = 86400000;
export function instant(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || !ISO.test(value)) return null;
  const parts = value.match(/^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d):(\d\d)/);
  if (!parts) return null;
  const [, y, mo, day, h, m, s] = parts.map(Number);
  if (mo<1 || mo>12 || day<1 || day>new Date(Date.UTC(y,mo,0)).getUTCDate() || h>23 || m>59 || s>59) return null;
  const n = Date.parse(value);
  return Number.isFinite(n) ? n : null;
}
function text(value, name, max, required = true) {
  if (value == null && !required) return null;
  if (typeof value !== "string" || value.length > max || (required && !value.trim()))
    throw new Error(`${name} 缺失或超长`);
  return value.trim();
}
function stamp(value, name, required = true) {
  if (value == null && !required) return null;
  if (instant(value) === null) throw new Error(`${name} 必须是包含时区的 ISO 时间`);
  return new Date(instant(value)).toISOString();
}
export function safePostUrl(value, id) {
  return typeof value === "string" &&
    /^https:\/\/x\.com\/thsottiaux\/status\/[0-9]+$/.test(value) &&
    value.split("/").at(-1) === id;
}
/** Fail closed: demos, HTML, arbitrary properties and private metadata never pass the public contract. */
export function validateCatalog(input) {
  if (!input || input.schemaVersion !== SCHEMA_VERSION || !Array.isArray(input.events) || input.events.length > 200)
    throw new Error("目录格式不正确（schemaVersion=1，最多 200 个事件）");
  const eventIds = new Set(), postIds = new Set();
  const events = input.events.map(e => {
    if (!e || e.demo) throw new Error("演示事件禁止发布");
    const id = text(e.id, "事件 ID", 100);
    if (!/^[a-zA-Z0-9_-]+$/.test(id) || eventIds.has(id)) throw new Error("事件 ID 不合法或重复");
    eventIds.add(id);
    if (!TYPES.includes(e.type)) throw new Error("事件类型不正确");
    if (!Array.isArray(e.posts) || !e.posts.length || e.posts.length > 50) throw new Error("每事件须有 1–50 条原帖");
    const posts = e.posts.map(p => {
      const pid = text(p.id, "原帖 ID", 30);
      if (!/^\d+$/.test(pid) || postIds.has(pid) || !safePostUrl(p.url, pid)) throw new Error("原帖 ID/链接不匹配或重复");
      postIds.add(pid);
      if (!STAGES.includes(p.stage)) throw new Error("原帖阶段不正确");
      if (p.stage === "banked_credited" && e.type !== "banked") throw new Error("Banked 发放不得归到 Global 或补偿事件");
      if (!["official", "archive", "unverified"].includes(p.evidence)) throw new Error("来源核验级别不正确");
      return {
        id: pid, url: p.url, publishedAt: stamp(p.publishedAt, "发帖时间"),
        stage: p.stage, evidence: p.evidence,
        original: text(p.original, "英文原文", 12000),
        translation: text(p.translation, "中文译文", 12000, false),
        explanation: text(p.explanation, "解释", 4000, false)
      };
    }).sort((a,b) => instant(a.publishedAt) - instant(b.publishedAt));
    let deadline = null;
    if (e.deadline != null) {
      const d = e.deadline, source = posts.find(p => p.id === d.sourcePostId);
      if (!source || source.evidence !== "official") throw new Error("截止时间必须关联已核实的官方原帖");
      if (!["upper_bound", "execution_time"].includes(d.kind)) throw new Error("截止时间性质不正确");
      if (!["PDT", "PST", "UTC", "explicit"].includes(d.basis)) throw new Error("换算依据不正确");
      const at = stamp(d.at, "截止时间");
      if (instant(at) < instant(source.publishedAt)) throw new Error("截止时间早于承诺发帖时间");
      deadline = { at, kind: d.kind, basis: d.basis, sourcePostId: source.id,
        alternativeAt: stamp(d.alternativeAt, "备选截止", false),
        note: text(d.note, "截止说明", 1000, false) };
    }
    return { id, type: e.type, title: text(e.title, "标题", 200), posts, deadline };
  });
  return { schemaVersion: SCHEMA_VERSION, events };
}
export function beijing(value, seconds = true) {
  const n = instant(value);
  if (n === null) return "未知";
  const d = new Date(n + 8 * 3600000), p = n => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}年${d.getUTCMonth()+1}月${d.getUTCDate()}日 ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}${seconds ? ":"+p(d.getUTCSeconds()) : ""}`;
}
function localParts(value, zone) {
  const n = instant(value);
  if (n === null || typeof Intl === "undefined") throw new Error("时区数据不可用");
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year:"numeric", month:"2-digit",day:"2-digit",
    hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23" });
  return Object.fromEntries(f.formatToParts(new Date(n)).map(p => [p.type,p.value]));
}
function offsetAt(n, zone) {
  const p = localParts(n, zone);
  return Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,+p.second) - Math.floor(n/1000)*1000;
}
export function pacific(value) {
  try {
    const p = localParts(value, "America/Los_Angeles");
    const zone = offsetAt(instant(value),"America/Los_Angeles") === -7*3600000 ? "PDT" : "PST";
    return `${p.year}年${+p.month}月${+p.day}日 ${p.hour}:${p.minute}:${p.second}（${zone}）`;
  } catch { return "未知（当前环境缺少时区数据）"; }
}
/** Resolve the END of the source's actual Pacific calendar day, never the Beijing date. */
export function pacificEod(publishedAt, wording = "PT") {
  const p = localParts(publishedAt, "America/Los_Angeles");
  const wall = Date.UTC(+p.year,+p.month-1,+p.day+1);
  let utc = wall + 8*3600000;
  for (let i=0;i<3;i++) utc = wall - offsetAt(utc,"America/Los_Angeles");
  return {
    at: new Date(utc).toISOString(),
    alternativeAt: wording === "PST" && utc !== wall+8*3600000 ? new Date(wall+8*3600000).toISOString() : null,
    kind: "upper_bound",
    basis: offsetAt(utc-1000,"America/Los_Angeles") === -7*3600000 ? "PDT" : "PST"
  };
}
export function duration(ms) {
  if (!Number.isFinite(ms)) return "未知";
  const s = Math.floor(Math.abs(ms)/1000), days = Math.floor(s/86400);
  return `${days ? days+"天 " : ""}${Math.floor(s%86400/3600)}时${Math.floor(s%3600/60)}分${s%60}秒`;
}
/** Source-post history and the EVENT's current state are intentionally separate. */
export function eventState(e, now = Date.now()) {
  const visible = e.posts.filter(p => instant(p.publishedAt) <= now);
  const official = visible.filter(p => p.evidence === "official" || e.demo);
  const done = official.filter(p => p.stage === "completed" || p.stage === "banked_credited").at(-1);
  const latest = official.at(-1);
  if (e.type === "unknown") return { code:"unverified",label:"类型待核实",done:null };
  if (!latest) return { code:"unverified",label:"待核实",done:null };
  if (e.type === "quota_correction") return { code:"correction",label:"针对性额度补偿",done:done || null };
  if (done) return { code:"completed",label:e.type === "banked" ? "官方确认 Banked 发放" : "官方确认完成",done };
  if (e.deadline && instant(e.deadline.at) < now) return { code:"overdue",label:"已过参考截止 · 完成未知",done:null };
  if (e.type === "banked") return { code:"banked",label:"Banked 公告 · 发放待确认",done:null };
  return { code:latest.stage,label:latest.stage === "propagating" ? "官方表示传播中" : "已宣布 · 尚未确认完成",done:null };
}
export function defaultPostIndex(e, now = Date.now()) {
  const s = eventState(e, now);
  if (s.done) return e.posts.findIndex(p=>p.id===s.done.id);
  const timed = e.posts.map((p,i)=>({p,i})).filter(x=>instant(x.p.publishedAt)<=now);
  return timed.at(-1)?.i ?? 0;
}
export function metrics(e, post, now = Date.now()) {
  const s=eventState(e,now), pub=instant(post.publishedAt), end=instant(e.deadline?.at);
  let deadlineLabel="最晚重置时间", deadlineValue="未知", deadlineNote="没有可信截止，不能计算倒计时";
  if (end !== null) {
    if (s.done) {
      const delta=end-instant(s.done.publishedAt);
      deadlineLabel="官方确认相对参考截止";
      deadlineValue=(delta>=0 ? "提前 " : "延后 ")+duration(delta);
      deadlineNote="确认发帖时间 ≠ 个人实际到账";
    } else {
      deadlineLabel="距离参考最晚截止";
      deadlineValue=(end>=now ? "还有 " : "已过 ")+duration(end-now);
      deadlineNote=end>=now ? "可能提前，不能保证旧额度保留至此" : "截止已过，不等于确认完成";
    }
  }
  return { current:beijing(now), elapsed:pub===null ? "未知" : pub>now ? "时间异常（未来时间）" : duration(now-pub),
    deadlineLabel,deadlineValue,deadlineNote,state:s };
}
export function actionText(e, now=Date.now()) {
  if (e.demo) return "演示数据，不代表当前官方消息；不会发送通知。";
  const s=eventState(e,now);
  if(s.code==="unverified") return "证据尚未核实，不能据此判断即将重置。";
  if(s.code==="completed") return "官方已确认该阶段完成；请核对账户实际额度，不再追赶旧额度窗口。";
  if(e.type==="banked") return "这是 Banked Reset，不等于自动清空旧额度；发放、使用方式和有效期以官方原帖为准。";
  if(e.type==="quota_correction") return "这是针对性补偿，不是全员 Reset；是否适用及个人到账仍需核实。";
  if(s.code==="propagating") return "官方表示传播中；旧额度可能已经变化，请核验当前可见用量，不把参考截止当作保留保证。";
  if(s.code==="overdue") return "已过参考最晚截止，完成情况仍未知；不要把倒计时归零当作到账。";
  return "不要等到参考最晚截止。优先完成已有的重要代码审查、功能实现、测试和调研，不做无意义耗额。";
}
export function copyDraft(e, now=Date.now(), marketing=false) {
  const s=eventState(e,now);
  const name=e.type==="quota_correction"?"Tibo 额度补偿":e.type==="banked"?"Tibo Banked Reset":e.type==="unknown"?"Tibo 消息（类型待核实）":"Tibo Global Reset";
  const headline=e.type==="quota_correction" ? `${name}：适用范围与到账请核实` :
    s.done ? `${name}：官方确认完成（北京时间 ${beijing(s.done.publishedAt,false)}）` :
    `${name}：最晚${e.type==="banked"?"发放":"重置"}时间${e.deadline ? "参考北京时间 "+beijing(e.deadline.at,false) : "未知"}`;
  const sources=e.posts.filter(p=>safePostUrl(p.url,p.id)).map(p=>p.url).join("\n");
  return `${e.demo ? "【演示，禁止当新闻发布】\n" : ""}${headline}\n${TYPE_LABELS[e.type]} · ${s.label}\n${actionText(e,now)}\n${marketing ? "关注 ResetWatch：原帖核验、北京时间换算与历史对比。本文为独立第三方草稿，未发布。\n" : "以下为本次检查的时间快照，不代表个人到账。\n"}${sources}\n核查/生成时间：北京时间 ${beijing(now)}`;
}
export function demoCatalog(now=Date.now()) {
  const ts=n=>new Date(n).toISOString();
  return {schemaVersion:1,events:[{
    id:"demo-only",type:"global",title:"演示事件 · 非真实 Tibo 公告",demo:true,
    deadline:{at:ts(now+3*3600000),kind:"upper_bound",basis:"explicit",sourcePostId:"demo-2",alternativeAt:null,note:"演示用参考截止"},
    posts:[
      {id:"demo-1",url:null,publishedAt:ts(now-2*3600000),stage:"announced",evidence:"unverified",
        original:"Sample announcement. Demo only — not an actual Tibo post.",translation:"示例重置公告。仅演示，不是 Tibo 的真实推文。",explanation:"展示首次公告，禁止将此内容作为官方消息。"},
      {id:"demo-2",url:null,publishedAt:ts(now-90*60000),stage:"scheduled",evidence:"unverified",
        original:"Sample timing update. Demo only.",translation:"示例时间更新。仅演示。",explanation:"最晚参考时间置顶；切换原帖后，已过时间同步变化。"}
    ]
  }]};
}
