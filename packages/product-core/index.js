/**
 * Shared product policy. No network, secrets, UI toolkit or private quota scraping.
 * Canonical source for web, mini-program, apps, worker and widgets.
 */
import { instant, eventState, beijing, actionText, copyDraft } from "../reset-core/index.js";

export const PRODUCT_VERSION = 1;
export const DEFAULT_PREFERENCES = Object.freeze({
  theme: "system", sources: ["tibo"], types: ["global", "banked"],
  windows: [6, 3, 1], enabled: false,
  quiet: { enabled: false, start: "23:00", end: "07:00" }
});
const ID = /^[a-zA-Z0-9_-]{1,100}$/;
const clone = value => JSON.parse(JSON.stringify(value));
const requireValue = (ok, message) => { if (!ok) throw new Error(message); };
const shortText = (v, max, label) => {
  requireValue(typeof v === "string" && v.trim().length > 0 && v.length <= max, `${label}缺失或超长`);
  return v.trim();
};
const setOf = (v, allowed, max, label) => {
  requireValue(Array.isArray(v) && v.length <= max && v.every(x => allowed(x)), `${label}不正确`);
  return [...new Set(v)];
};
export function emptyPersonal() {
  return { schemaVersion: PRODUCT_VERSION, preferences: clone(DEFAULT_PREFERENCES), tasks: [], bookmarks: [] };
}
export function validatePersonal(raw) {
  requireValue(raw && raw.schemaVersion === PRODUCT_VERSION, "个人数据版本不支持");
  const p = raw.preferences;
  requireValue(p && ["light","dark","system"].includes(p.theme) && typeof p.enabled === "boolean", "提醒偏好不正确");
  const q = p.quiet;
  requireValue(q && typeof q.enabled === "boolean" && [q.start,q.end].every(x =>
    typeof x === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(x)), "免打扰时段不正确");
  requireValue(!q.enabled || q.start !== q.end, "免打扰开始与结束时间不能相同");
  requireValue(Array.isArray(raw.tasks) && raw.tasks.length <= 200, "最多保存 200 个任务");
  const ids = new Set();
  const tasks = raw.tasks.map(t => {
    requireValue(t && ID.test(t.id) && !ids.has(t.id), "任务 ID 无效或重复"); ids.add(t.id);
    requireValue(typeof t.done === "boolean" && ["high","normal"].includes(t.priority), "任务状态不正确");
    requireValue(instant(t.createdAt) !== null, "任务创建时间不正确");
    requireValue(t.eventId == null || (typeof t.eventId === "string" && ID.test(t.eventId)), "任务关联事件不正确");
    return { id:t.id, title:shortText(t.title,200,"任务"), done:t.done, priority:t.priority,
      createdAt:new Date(instant(t.createdAt)).toISOString(), eventId:t.eventId ?? null };
  });
  return { schemaVersion: PRODUCT_VERSION, preferences: {
    theme:p.theme, enabled:p.enabled,
    sources:setOf(p.sources,x=>typeof x==="string" && ID.test(x),50,"关注来源"),
    types:setOf(p.types,x=>["global","banked","quota_correction"].includes(x),3,"提醒类型"),
    windows:setOf(p.windows,x=>[6,3,1].includes(x),3,"提醒窗口").sort((a,b)=>b-a),
    quiet:{enabled:q.enabled,start:q.start,end:q.end}
  }, tasks, bookmarks:setOf(raw.bookmarks,x=>typeof x==="string"&&ID.test(x),500,"事件收藏") };
}
export function inQuietHours(p, now) {
  if (!p.quiet.enabled) return false;
  const d=new Date(now+8*3600000), m=d.getUTCHours()*60+d.getUTCMinutes();
  const minutes=s=>Number(s.slice(0,2))*60+Number(s.slice(3));
  const a=minutes(p.quiet.start),b=minutes(p.quiet.end);
  return a<b ? m>=a&&m<b : m>=a||m<b;
}
export function clockStatus(serverTime, requestStarted, receivedAt, lastSuccess, current=Date.now()) {
  const stamp=instant(serverTime), valid=stamp!==null;
  const skew=valid ? stamp-(requestStarted+receivedAt)/2 : 0;
  return { skew, calibrated:valid, skewWarning:valid&&Math.abs(skew)>60000,
    stale:lastSuccess==null||current-lastSuccess>120000, age:lastSuccess==null?null:Math.max(0,current-lastSuccess) };
}
/** Select only a currently actionable milestone. Durable DB uniqueness handles subsequent executions. */
export function notificationCandidates(events, preferences, since, now=Date.now()) {
  if (!preferences.enabled || inQuietHours(preferences,now)) return [];
  const result=[];
  for(const e of events) {
    if(e.demo || !preferences.types.includes(e.type) || !preferences.sources.includes(e.sourceId||"tibo")) continue;
    const posts=e.posts.filter(p=>p.evidence==="official" && instant(p.publishedAt)<=now);
    if(!posts.length) continue;
    const state=eventState(e,now), last=posts.at(-1);
    if(now-instant(last.publishedAt)>7*86400000) continue;
    let phase=null, source=last;
    if(state.done) { phase=e.type==="banked"?"banked_credited":"completed"; source=state.done; }
    else if(e.type==="quota_correction") phase="correction";
    else if(state.code==="propagating") phase="propagating";
    else if(state.code==="overdue"||state.code==="unverified") continue;
    else phase=last.stage==="scheduled"?`schedule_${last.id}`:"announced";
    if(instant(source.publishedAt)>=since) result.push({eventId:e.id,phase,sourcePostId:source.id,
      occurredAt:source.publishedAt,title:copyDraft(e,now).split("\n")[0],body:actionText(e,now)});
    if(!state.done && e.type==="global" && e.deadline && state.code!=="propagating") {
      const left=instant(e.deadline.at)-now;
      // On recovery, do not burst all missed windows. Enter only the most urgent enabled window.
      const window=[...preferences.windows].sort((a,b)=>a-b).find(h=>left>0&&left<=h*3600000);
      if(window && instant(e.deadline.at)>=since) result.push({eventId:e.id,phase:`reminder_${window}`,
        sourcePostId:e.deadline.sourcePostId,occurredAt:new Date(now).toISOString(),
        title:`同一轮提醒：距参考最晚截止不足 ${window} 小时，可能提前`,
        body:actionText(e,now)});
    }
  }
  return result;
}
export function deliveryLabel(item) {
  if(item.opened_at) return "客户端报告已打开（不等于已阅读）";
  if(item.received_at) return "客户端报告收到";
  return ({
    queued:"已入队",processing:"发送中",accepted:"服务商接受 · 设备送达未知",
    available:"站内可查看",cancelled:"已取消",failed:"发送失败",unknown:"发送结果未知 · 未自动重发"
  })[item.status] || "状态未知";
}
export function sourceLabel(e) { return e.source?.name || "Tibo"; }
export function widgetSummary(e, updatedAt, now=Date.now()) {
  if(!e || e.demo) return {schemaVersion:1,available:false,reason:"没有可核验事件",serverTime:new Date(now).toISOString()};
  const state=eventState(e,now);
  return {schemaVersion:1,available:true,id:e.id,title:e.title,type:e.type,status:state.code,statusLabel:state.label,
    source:sourceLabel(e),deadlineAt:e.deadline?.at||null,deadlineKind:e.deadline?.kind||null,
    confirmedAt:state.done?.publishedAt||null,personalArrival:null,
    updatedAt:updatedAt||null,serverTime:new Date(now).toISOString(),
    deadlineText:e.deadline ? `北京时间 ${beijing(e.deadline.at,false)}（参考最晚，可能提前）`:"最晚时间未知",
    action:actionText(e,now)};
}
