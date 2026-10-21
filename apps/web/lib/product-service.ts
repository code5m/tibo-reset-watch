import crypto from "node:crypto";
import { db } from "@/lib/db";
import { validateCatalog } from "@/public/workbench/reset-core";
import { emptyPersonal, validatePersonal, notificationCandidates, widgetSummary, inQuietHours } from "@/public/workbench/product-core";

type Connection = { query: (sql: string, params?: unknown[]) => Promise<{ rows: any[] }> };
type Profile = { id: string; display_name: string; data: ReturnType<typeof emptyPersonal>; version: number; created_at: string };
export class ProductError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status=status; }
}
function fail(status: number, message: string): never { throw new ProductError(status, message); }
const hash = (value: string) => crypto.createHash("sha256").update(value).digest("hex");
const token = () => "rw_" + crypto.randomBytes(32).toString("hex");
const uuid = (v: unknown): string => typeof v==="string" && /^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(v) ? v : fail(400,"ID 不正确");
const text = (v: unknown, max: number): string => typeof v==="string" && v.trim() && v.length<=max ? v.trim() : fail(400,"文字缺失或超长");
const pool = () => db() || fail(503,"数据库未配置；不是没有新消息。");
export function credentials(request: Request) {
  const header = request.headers.get("authorization");
  if(header?.startsWith("Bearer ")) return header.slice(7);
  return request.headers.get("cookie")?.split(";").map(s=>s.trim()).find(s=>s.startsWith("resetwatch_profile="))?.split("=")[1] || "";
}
async function profile(c: Connection, bearer: string): Promise<Profile> {
  if(!/^rw_[a-f0-9]{64}$/.test(bearer)) fail(401,"请先创建或连接你的设备档案。");
  const p=(await c.query("select id,display_name,data,version,created_at from product_profiles where secret_hash=$1",[hash(bearer)])).rows[0];
  return p || fail(401,"设备档案已失效，请重新连接。");
}
const audit=(c: Connection, actor: string, action: string, resource: string, metadata: object={}) =>
  c.query("insert into product_audit(actor_id,action,resource_id,metadata) values($1,$2,$3,$4::jsonb)",[actor,action,resource,JSON.stringify(metadata)]);
async function transaction<T>(fn:(c:Connection)=>Promise<T>):Promise<T> {
  const c=await pool().connect();
  try { await c.query("begin"); const result=await fn(c); await c.query("commit"); return result; }
  catch(e) { await c.query("rollback").catch(()=>{}); throw e; }
  finally { c.release(); }
}
async function limit(c:Connection,bucket:string,max=60) {
  const r=(await c.query(`insert into product_rate_limits(bucket,window_start,hits) values($1,date_trunc('hour',now()),1)
  on conflict(bucket) do update set hits=case when product_rate_limits.window_start<date_trunc('hour',now()) then 1 else product_rate_limits.hits+1 end,
  window_start=date_trunc('hour',now()) returning hits`,[bucket])).rows[0];
  if(r.hits>max) fail(429,"操作过于频繁，请稍后重试。");
}
async function catalog(c:Connection) {
  const r=(await c.query("select value,updated_at from app_settings where key=$1",["resetwatch.catalog.v1"])).rows[0];
  return { ...validateCatalog(r?.value?.catalog || {schemaVersion:1,events:[]}),updatedAt:r?.updated_at||null };
}
export async function productCapabilities() {
  const configured=Boolean(db());
  let ready=false;
  if(configured) ready=Boolean((await pool().query("select to_regclass('public.product_profiles') as name")).rows[0]?.name);
  return {schemaVersion:1,serverTime:new Date().toISOString(),database:configured,storage:ready,
    inApp:ready,personalQuotaAccess:false,nativePush:ready&&relayConfigured(),
    wechat:ready&&relayConfigured()&&Boolean(process.env.WECHAT_APP_ID&&process.env.WECHAT_APP_SECRET&&process.env.WECHAT_TEMPLATE_ID&&encryptionKey()),
    wechatTemplateId:process.env.WECHAT_TEMPLATE_ID||null,sendEnabled:process.env.PRODUCT_SEND_ENABLED==="true",
    sources:[{id:"tibo",name:"Tibo · Codex / ChatGPT Work",mode:"official-post-review",available:true}],
    nativeWidgets:{ios:"source_requires_host_app",android:"source_requires_host_app",harmony:"requires_deveco_validation"},
    note:ready?"功能是否已送达以各条回执为准。":"需要应用数据库迁移 006；不会自动向生产数据库建表。"};
}
export async function readProduct(view:string,bearer:string,admin=false,eventId?:string|null) {
  if(view==="capabilities") return productCapabilities();
  const c=pool();
  if(view==="widget") {
    const data=await catalog(c);
    const events=[...data.events].sort((a,b)=>Date.parse(b.posts.at(-1)!.publishedAt)-Date.parse(a.posts.at(-1)!.publishedAt));
    return widgetSummary(eventId ? events.find(e=>e.id===eventId):events[0],data.updatedAt);
  }
  if(view==="drafts") {
    if(!admin) fail(403,"内容审核仅限运营人员。");
    return {drafts:(await c.query("select * from product_drafts order by updated_at desc limit 100")).rows};
  }
  const p=await profile(c,bearer);
  if(view==="profile") return {profile:p};
  if(view==="deliveries") return {deliveries:(await c.query(`select id,event_id,phase,channel,status,provider_id,error_code,
    occurred_at,queued_at,attempted_at,accepted_at,received_at,opened_at
    from product_deliveries where profile_id=$1 order by queued_at desc limit 100`,[p.id])).rows};
  if(view==="devices") return {devices:(await c.query("select id,kind,consent_at,revoked_at from product_devices where profile_id=$1 order by created_at desc",[p.id])).rows};
  if(view==="workspaces") {
    const rows=(await c.query(`select w.id,w.name,w.data,w.version,w.owner_id,
    case when w.owner_id=$1 then 'owner' else m.role end as role
    from product_workspaces w left join product_members m on m.workspace_id=w.id and m.profile_id=$1
    where w.owner_id=$1 or m.profile_id=$1 order by w.created_at`,[p.id])).rows;
    for(const w of rows) w.members=(await c.query(`select p.id,p.display_name,m.role from product_members m
      join product_profiles p on p.id=m.profile_id where m.workspace_id=$1`,[w.id])).rows;
    return {workspaces:rows};
  }
  if(view==="export") return {schemaVersion:1,exportedAt:new Date().toISOString(),profile:{name:p.display_name,data:p.data},
    note:"不导出设备访问凭据、推送标识或其他团队成员数据。"};
  fail(404,"页面不存在。");
}
async function workspace(c:Connection,id:string,p:Profile,minimum:"viewer"|"editor"|"owner"="viewer",lock=false) {
  const w=(await c.query("select * from product_workspaces where id=$1"+(lock?" for update":""),[uuid(id)])).rows[0];
  if(!w) fail(404,"团队空间不存在。");
  const role=w.owner_id===p.id?"owner":(await c.query("select role from product_members where workspace_id=$1 and profile_id=$2",[id,p.id])).rows[0]?.role;
  if(!role || ({viewer:0,editor:1,owner:2} as Record<string,number>)[role]<({viewer:0,editor:1,owner:2})[minimum]) fail(403,"当前角色没有此权限。");
  return {...w,role};
}
export async function mutateProduct(body:any,bearer:string,admin=false) {
  const action=body?.action;
  if(action==="profile.create") {
    if(body.consent!==true) fail(400,"请先同意仅为本产品创建独立设备档案。");
    await limit(pool(),"profile-enrollment",120);
    return transaction(async c=>{
      const secret=token(),id=crypto.randomUUID(),data=emptyPersonal();
      const p=(await c.query(`insert into product_profiles(id,secret_hash,display_name,data)
        values($1,$2,$3,$4::jsonb) returning id,display_name,data,version,created_at`,
        [id,hash(secret),text(body.name||"我的设备",80),JSON.stringify(data)])).rows[0];
      await audit(c,id,action,id);
      return {profile:p,token:secret};
    });
  }
  if(action==="draft.save" || action==="draft.record-publication") {
    if(!admin) fail(403,"内容审核仅限运营人员。");
    return transaction(async c=>{
      if(action==="draft.save") {
        const data=await catalog(c), e=data.events.find(e=>e.id===body.eventId);
        if(!e) fail(400,"事件必须已经入库且可核验。");
        if(!["alert","social"].includes(body.kind)) fail(400,"草稿类型不正确。");
        const id=crypto.randomUUID();
        await c.query("insert into product_drafts(id,event_id,kind,body) values($1,$2,$3,$4)",[id,e.id,body.kind,text(body.text,16000)]);
        await audit(c,"admin-session",action,id,{eventId:e.id,kind:body.kind});
        return {id,status:"draft",published:false};
      }
      if(body.confirmation!=="已在外部发布") fail(400,"请明确确认外部发布事实。");
      let url:URL; try {url=new URL(body.url);} catch {return fail(400,"发布链接无效。");}
      if(url.protocol!=="https:" || url.username || url.password || !["x.com","mp.weixin.qq.com"].includes(url.hostname)) fail(400,"只记录 X 或公众号的 HTTPS 发布链接。");
      const rows=(await c.query(`update product_drafts set status='externally_published',external_url=$2,
        updated_at=now(),version=version+1 where id=$1 and version=$3 returning id`,[uuid(body.id),url.href,body.expectedVersion])).rows;
      if(!rows.length) fail(409,"草稿已变化，请刷新后核对。");
      await audit(c,"admin-session",action,body.id,{url:url.href});
      return {recorded:true,publishedByThisService:false};
    });
  }
  if(action==="device.register") {
    const p=await profile(pool(),bearer);
    if(body.consent!==true) fail(400,"未获得推送用途同意。");
    if(!encryptionKey()) fail(503,"推送标识加密密钥未配置。");
    let target:object;
    if(body.kind==="wechat") {
      const appid=process.env.WECHAT_APP_ID, secret=process.env.WECHAT_APP_SECRET, templateId=process.env.WECHAT_TEMPLATE_ID;
      if(!appid||!secret||!templateId) fail(503,"微信 AppID、密钥或模板尚未配置。");
      const code=text(body.code,300);
      const url=new URL("https://api.weixin.qq.com/sns/jscode2session");
      url.search=new URLSearchParams({appid,secret,js_code:code,grant_type:"authorization_code"}).toString();
      const response=await fetch(url,{signal:AbortSignal.timeout(10000),redirect:"error"});
      const data=await response.json();
      if(!response.ok || typeof data.openid!=="string" || data.errcode) fail(400,"微信登录验证失败，请重新授权。");
      target={openid:data.openid,templateId};
    } else if(body.kind==="uni-push") {
      if(!relayConfigured()) fail(503,"系统推送服务尚未配置。");
      target={cid:text(body.cid,200)};
    } else return fail(400,"设备通道不支持。");
    return transaction(async c=>{
      const digest=hash(body.kind+":"+JSON.stringify(target));
      // Lock an absent token too: concurrent enrollments cannot steal a destination.
      await c.query("select pg_advisory_xact_lock(hashtextextended($1,0))",[digest]);
      const old=(await c.query("select id,profile_id from product_devices where token_hash=$1 for update",[digest])).rows[0];
      if(old && old.profile_id!==p.id) fail(409,"此设备已关联其他档案，请先解除原关联。");
      const id=old?.id||crypto.randomUUID();
      await c.query(`insert into product_devices(id,profile_id,kind,token_hash,encrypted_target,consent_at)
        values($1,$2,$3,$4,$5,now()) on conflict(token_hash) do update
        set consent_at=now(),revoked_at=null,encrypted_target=excluded.encrypted_target`,
        [id,p.id,body.kind,digest,encrypt(JSON.stringify(target))]);
      await audit(c,p.id,action,id,{kind:body.kind});
      return {id,registered:true,delivered:false};
    });
  }
  return transaction(async c=>{
    const p=await profile(c,bearer);
    await limit(c,p.id,600);
    if(action==="profile.save") {
      let data:ReturnType<typeof emptyPersonal>;
      try { data=validatePersonal(body.data); } catch(e) { return fail(400,e instanceof Error?e.message:"个人数据格式错误"); }
      const rows=(await c.query(`update product_profiles set data=$2::jsonb,version=version+1
        where id=$1 and version=$3 returning id,display_name,data,version,created_at`,[p.id,JSON.stringify(data),body.expectedVersion])).rows;
      if(!rows.length) fail(409,"其他设备已更新偏好，请重新读取，不能覆盖。");
      if(!data.preferences.enabled) await c.query("update product_deliveries set status='cancelled' where profile_id=$1 and status='queued'",[p.id]);
      await audit(c,p.id,action,p.id,{version:rows[0].version});
      return {profile:rows[0]};
    }
    if(action==="profile.delete") {
      if(body.confirmation!=="DELETE") fail(400,"请确认删除此设备档案。");
      if((await c.query("select id from product_workspaces where owner_id=$1 limit 1",[p.id])).rows.length) fail(409,"请先删除或转让你拥有的团队空间。");
      await c.query("delete from product_profiles where id=$1",[p.id]);
      await c.query("update product_audit set actor_id='deleted-profile' where actor_id=$1",[p.id]);
      return {deleted:true,scope:"本产品档案；不影响 OpenAI 账户"};
    }
    if(action==="device.revoke") {
      const rows=(await c.query("update product_devices set revoked_at=now() where id=$1 and profile_id=$2 returning id",[uuid(body.id),p.id])).rows;
      if(!rows.length) fail(404,"未找到此设备。");
      await c.query("update product_deliveries set status='cancelled' where device_id=$1 and status='queued'",[body.id]);
      await audit(c,p.id,action,body.id);
      return {revoked:true,note:"停止后续发送；已交给服务商的消息无法撤回。"};
    }
    if(action==="delivery.ack") {
      if(!["received","opened"].includes(body.stage)) fail(400,"回执阶段不正确。");
      const field=body.stage==="opened"?"opened_at":"received_at";
      const rows=(await c.query(`update product_deliveries set ${field}=coalesce(${field},now())
        where id=$1 and profile_id=$2 and status in ('available','accepted','unknown') returning id`,[uuid(body.id),p.id])).rows;
      if(!rows.length) fail(404,"无可确认的本账户消息。");
      return {recorded:true,evidence:"client-reported",readByHuman:"unknown"};
    }
    if(action==="delivery.retry") {
      if(body.confirmation!=="可能重复发送") fail(400,"请先确认未知结果重试可能重复发送。");
      const r=await c.query("update product_deliveries set status='queued',error_code=null where id=$1 and profile_id=$2 and status in ('failed','unknown') returning id",[uuid(body.id),p.id]);
      if(!r.rows.length) fail(409,"此消息状态已变化，不能重复重试。");
      await audit(c,p.id,action,body.id);return {queued:true,duplicateRiskAcknowledged:true};
    }
    if(action==="workspace.create") {
      if((await c.query("select count(*)::int as n from product_workspaces where owner_id=$1",[p.id])).rows[0].n>=10) fail(400,"每个档案最多拥有 10 个空间。");
      const id=crypto.randomUUID();
      await c.query("insert into product_workspaces(id,owner_id,name,data) values($1,$2,$3,$4::jsonb)",[id,p.id,text(body.name,100),JSON.stringify(emptyPersonal())]);
      await audit(c,p.id,action,id); return {id};
    }
    if(action==="workspace.join") {
      const secret=text(body.invite,100);
      const invite=(await c.query("select * from product_invites where token_hash=$1 for update",[hash(secret)])).rows[0];
      if(!invite || invite.used_at || Date.parse(invite.expires_at)<=Date.now()) fail(400,"邀请已使用、已过期或无效。");
      const w=(await c.query("select owner_id from product_workspaces where id=$1",[invite.workspace_id])).rows[0];
      if(w.owner_id===p.id) fail(400,"你已经是此空间的所有者。");
      if((await c.query("select profile_id from product_members where workspace_id=$1 and profile_id=$2",[invite.workspace_id,p.id])).rows.length) fail(409,"你已加入此空间，不重复消费邀请。");
      await c.query("insert into product_members(workspace_id,profile_id,role) values($1,$2,$3)",[invite.workspace_id,p.id,invite.role]);
      await c.query("update product_invites set used_at=now() where token_hash=$1",[hash(secret)]);
      await audit(c,p.id,action,invite.workspace_id); return {id:invite.workspace_id};
    }
    if(typeof action==="string"&&action.startsWith("workspace.")) {
      const minimum=action==="workspace.save"?"editor":"owner";
      const w=await workspace(c,body.id,p,minimum,true);
      if(action==="workspace.invite") {
        if(!["viewer","editor"].includes(body.role)) fail(400,"只能邀请查看者或编辑者。");
        const secret=token();
        await c.query("insert into product_invites(token_hash,workspace_id,role,expires_at) values($1,$2,$3,now()+interval '24 hours')",[hash(secret),w.id,body.role]);
        await audit(c,p.id,action,w.id,{role:body.role});
        return {invite:secret,expiresInHours:24,oneTime:true};
      }
      if(action==="workspace.save") {
        let data; try { data=validatePersonal(body.data); } catch { return fail(400,"团队任务数据无效。"); }
        if(w.version!==body.expectedVersion) fail(409,"团队空间已有新版本，请刷新后合并。");
        await c.query("update product_workspaces set data=$2::jsonb,version=version+1 where id=$1",[w.id,JSON.stringify(data)]);
        await audit(c,p.id,action,w.id,{version:w.version+1});
        return {version:w.version+1};
      }
      if(action==="workspace.member") {
        const member=uuid(body.memberId);
        if(member===w.owner_id) fail(400,"不能通过成员操作修改所有者。");
        if(body.role==="remove") await c.query("delete from product_members where workspace_id=$1 and profile_id=$2",[w.id,member]);
        else {
          if(!["viewer","editor"].includes(body.role)) fail(400,"角色不正确。");
          const r=await c.query("update product_members set role=$3 where workspace_id=$1 and profile_id=$2 returning profile_id",[w.id,member,body.role]);
          if(!r.rows.length) fail(404,"成员不存在。");
        }
        await audit(c,p.id,action,w.id,{member,role:body.role}); return {updated:true};
      }
      if(action==="workspace.delete") {
        if(body.confirmation!=="DELETE") fail(400,"请确认删除团队空间。");
        await c.query("delete from product_workspaces where id=$1",[w.id]);
        await audit(c,p.id,action,w.id); return {deleted:true};
      }
    }
    fail(400,"不支持的操作。");
  });
}
function encryptionKey():Buffer|null {
  const k=process.env.PRODUCT_DEVICE_KEY;
  return k&&/^[a-f0-9]{64}$/i.test(k)?Buffer.from(k,"hex"):null;
}
function encrypt(value:string) {
  const key=encryptionKey()||fail(503,"设备加密密钥未配置。"),iv=crypto.randomBytes(12);
  const c=crypto.createCipheriv("aes-256-gcm",key,iv);
  const body=Buffer.concat([c.update(value,"utf8"),c.final()]);
  return Buffer.concat([iv,c.getAuthTag(),body]).toString("base64");
}
function decrypt(value:string) {
  const key=encryptionKey()||fail(503,"设备加密密钥未配置。"),raw=Buffer.from(value,"base64");
  const c=crypto.createDecipheriv("aes-256-gcm",key,raw.subarray(0,12));c.setAuthTag(raw.subarray(12,28));
  return JSON.parse(Buffer.concat([c.update(raw.subarray(28)),c.final()]).toString("utf8"));
}
function relayConfigured() {
  try {
    const url=new URL(process.env.PRODUCT_PUSH_RELAY_URL||"");
    return url.protocol==="https:" && !url.username&&!url.password &&
      Boolean(process.env.PRODUCT_PUSH_RELAY_SECRET&&encryptionKey());
  } catch { return false; }
}
/** One batch; caller repeats using nextCursor. No client polls X or sends its own 6/3/1 reminders. */
export async function planProduct(cursor:string|null) {
  const c=pool(),data=await catalog(c);
  const list=(await c.query("select id from product_profiles where ($1::uuid is null or id>$1::uuid) order by id limit 101",[cursor?uuid(cursor):null])).rows;
  let queued=0;
  for(const row of list.slice(0,100)) await transaction(async tx=>{
    const p=(await tx.query("select * from product_profiles where id=$1 for update",[row.id])).rows[0];
    if(!p) return;
    const personal=validatePersonal(p.data),candidates=notificationCandidates(data.events,personal.preferences,Date.parse(p.created_at));
    const devices=(await tx.query("select id from product_devices where profile_id=$1 and revoked_at is null",[p.id])).rows;
    const targets=[{channel:"in_app",id:null},...devices.map(d=>({channel:"native",id:d.id}))];
    for(const item of candidates) for(const target of targets) {
      const r=await tx.query(`insert into product_deliveries(id,profile_id,event_id,phase,source_post_id,device_id,target_key,channel,payload,status,occurred_at)
      values($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11) on conflict(profile_id,event_id,phase,channel,target_key) do nothing returning id`,
      [crypto.randomUUID(),p.id,item.eventId,item.phase,item.sourcePostId,target.id,target.id||"in_app",target.channel,
        JSON.stringify({title:item.title,body:item.body}),target.channel==="in_app"?"available":"queued",item.occurredAt]);
      queued+=r.rows.length;
    }
  });
  return {queued,nextCursor:list.length>100?list[99].id:null};
}
export async function dispatchProduct() {
  if(process.env.PRODUCT_SEND_ENABLED!=="true") return {sent:0,blocked:"PRODUCT_SEND_ENABLED is not true"};
  const c=pool(),data=await catalog(c);
  // A crash after a provider call is ambiguous; never silently re-send and claim exactly-once delivery.
  await c.query("update product_deliveries set status='unknown',error_code='lease_expired' where status='processing' and attempted_at<now()-interval '5 minutes'");
  const items=await transaction(async tx=>{
    const rows=(await tx.query("select * from product_deliveries where status='queued' and channel='native' order by queued_at for update skip locked limit 20")).rows;
    for(const row of rows) await tx.query("update product_deliveries set status='processing',attempted_at=now(),attempts=attempts+1 where id=$1",[row.id]);
    return rows;
  });
  let accepted=0,cancelled=0,unknown=0;
  for(const item of items) {
    const record=(await c.query(`select d.encrypted_target,d.kind,d.revoked_at,p.data from product_devices d
      join product_profiles p on p.id=d.profile_id where d.id=$1 and d.profile_id=$2`,[item.device_id,item.profile_id])).rows[0];
    const e=data.events.find(e=>e.id===item.event_id);
    let allowed=false;
    if(record&&e&&!record.revoked_at) {
      const preferences=validatePersonal(record.data).preferences;
      if(inQuietHours(preferences,Date.now())) { await c.query("update product_deliveries set status='queued' where id=$1",[item.id]);continue; }
      allowed=notificationCandidates([e],preferences,0).some(x=>x.phase===item.phase);
    }
    if(!allowed) {await c.query("update product_deliveries set status='cancelled',error_code='no_longer_actionable' where id=$1",[item.id]);cancelled++;continue;}
    try {
      const target=decrypt(record.encrypted_target);
      if(record.kind!=="uni-push" || !relayConfigured()) {
        // WeChat bridge uses the same authenticated relay contract and its own server-side credentials.
        if(!relayConfigured()) throw new Error("provider_unconfigured");
      }
      const payload=JSON.stringify({deliveryId:item.id,kind:record.kind,target,title:item.payload.title,body:item.payload.body,eventId:item.event_id});
      const ts=String(Date.now()),sig=crypto.createHmac("sha256",process.env.PRODUCT_PUSH_RELAY_SECRET!).update(ts+"."+payload).digest("hex");
      const r=await fetch(process.env.PRODUCT_PUSH_RELAY_URL!,{method:"POST",redirect:"error",signal:AbortSignal.timeout(10000),
        headers:{"Content-Type":"application/json","X-ResetWatch-Time":ts,"X-ResetWatch-Signature":sig,"Idempotency-Key":item.id},body:payload});
      const response=await r.json();
      if(r.ok&&response.accepted===true&&typeof response.providerId==="string"&&response.providerId.length<=200) {
        await c.query("update product_deliveries set status='accepted',provider_id=$2,accepted_at=now() where id=$1",[item.id,response.providerId]);
        accepted++;
      } else if(response.accepted===false && response.safeToRetry===false) {
        await c.query("update product_deliveries set status='failed',error_code='provider_rejected' where id=$1",[item.id]);
      } else throw new Error("provider_result_unknown");
    } catch {
      // Do not leak targets, credentials, provider response bodies or private network errors.
      await c.query("update product_deliveries set status='unknown',error_code='provider_result_unknown' where id=$1",[item.id]);unknown++;
    }
  }
  return {accepted,cancelled,unknown,deviceDelivery:"unknown unless a client receipt is received"};
}
