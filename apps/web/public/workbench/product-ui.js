import {emptyPersonal,validatePersonal,deliveryLabel} from "./product-core.js";
import {beijing} from "./reset-core.js";

/** Real API-backed controls. No credentials in localStorage; no background sending from UI. */
export function initProductUI(hooks) {
  const $=id=>document.getElementById(id);
  let profile=null,capabilities=null,workspaces=[],drafts=[],pending=0,theme="system",activeTeam=null;
  const clone=v=>JSON.parse(JSON.stringify(v));
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const toast=(text,error=false)=>{ $("product-status").textContent=text; $("product-status").classList.toggle("error",error); };
  const allowed=()=>!hooks.isDemo()&&!!profile;
  async function api(view,body) {
    const response=await fetch("/api/v1/product"+(view?"?view="+encodeURIComponent(view):""),{
      method:body?"POST":"GET",credentials:"same-origin",cache:"no-store",
      headers:body?{"Content-Type":"application/json"}:undefined,body:body?JSON.stringify(body):undefined,
      signal:AbortSignal.timeout(15000)
    });
    let data;try{data=await response.json();}catch{throw Error("服务响应无效，未确认操作成功。");}
    if(!response.ok){const err=Error(data.message||"服务不可用。");err.status=response.status;throw err;}
    return data;
  }
  async function run(work) {
    if(pending)return;
    pending++;renderLocks();
    try {await work();}
    catch(e){toast(e.message||"请求失败，未确认成功。",true);}
    finally{pending--;renderLocks();}
  }
  function setTheme(value,persist=false) {
    theme=["light","dark","system"].includes(value)?value:"system";
    const dark=theme==="dark"||(theme==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.dataset.theme=dark?"dark":"light";
    $("theme-choice").value=theme;
    $("theme-toggle").textContent=dark?"切换浅色":"切换深色";
    if(persist)try{localStorage.setItem("resetwatch-theme",theme);}catch{}
  }
  function requireLive() {if(hooks.isDemo())throw Error("当前是演示事件，禁止写入生产档案、草稿或发送通知。");}
  async function reloadProfile(silent=false) {
    try {profile=(await api("profile")).profile;renderProfile();return profile;}
    catch(e) {profile=null;renderProfile();if(e.status!==401||!silent)throw e;return null;}
  }
  async function savePersonal(data) {
    requireLive();
    if(!profile)throw Error("请先连接独立设备档案。");
    const next=validatePersonal(data);
    try {
      profile=(await api("",{action:"profile.save",expectedVersion:profile.version,data:next})).profile;
      renderProfile();toast("已保存到服务端。偏好启用不等于通知已送达。");
    } catch(e) {
      if(e.status===409)toast("其他设备已更新。你的表单尚未保存，请先重新读取并核对，不会覆盖。",true);
      throw e;
    }
  }
  function renderLocks() {
    document.querySelectorAll("[data-write]").forEach(b=>{b.disabled=!!pending||!allowed();});
    document.querySelectorAll("[data-enroll]").forEach(b=>{b.disabled=!!pending||hooks.isDemo();});
    $("profile-create").disabled=!!pending||hooks.isDemo()||!!profile;
    document.querySelectorAll("[data-operator]").forEach(b=>{b.disabled=!!pending||hooks.isDemo()||!hooks.getCurrent();});
    $("bookmark").disabled=!!pending||!allowed()||!hooks.getCurrent()||$("event-view").hidden;
    $("enrollment-warning").hidden=!hooks.isDemo();
    $("profile-name").textContent=profile?profile.display_name:"访客 · 尚未连接设备档案";
  }
  function renderProfile() {
    const data=profile?.data||emptyPersonal(),p=data.preferences;
    $("profile-state").textContent=profile?`服务端档案已连接 · 版本 ${profile.version}`:"访客可看公开事件。保存偏好、收藏和任务需创建或连接独立档案。";
    $("pref-enabled").checked=p.enabled;
    $("pref-quiet").checked=p.quiet.enabled;
    $("quiet-start").value=p.quiet.start;$("quiet-end").value=p.quiet.end;
    document.querySelectorAll("[data-window]").forEach(e=>e.checked=p.windows.includes(Number(e.dataset.window)));
    document.querySelectorAll("[data-kind]").forEach(e=>e.checked=p.types.includes(e.dataset.kind));
    $("pref-tibo").checked=p.sources.includes("tibo");
    if(profile)setTheme(p.theme);
    $("task-list").innerHTML=data.tasks.length?data.tasks.map(t=>`<li class="task-row"><label><input type="checkbox" data-task-check="${esc(t.id)}" ${t.done?"checked":""} data-write><span class="${t.done?"done":""}">${esc(t.title)}</span></label><span class="tag">${t.priority==="high"?"优先":"普通"}</span><button data-task-remove="${esc(t.id)}" data-write aria-label="删除任务 ${esc(t.title)}">删除</button></li>`).join(""):'<li class="muted">还没有任务。安排真实工作，不为用完额度制造任务。</li>';
    $("bookmark-list").innerHTML=data.bookmarks.length?data.bookmarks.map(id=>{
      const e=hooks.getEvents().find(e=>e.id===id);
      return `<li><button data-bookmark-open="${esc(id)}">${esc(e?.title||id)}</button><button data-bookmark-remove="${esc(id)}" data-write aria-label="移除收藏">移除</button></li>`;
    }).join(""):'<li class="muted">暂无收藏。</li>';
    selectionChanged();renderLocks();
  }
  function selectionChanged() {
    if(hooks.isDemo())toast("演示模式禁止写入服务端；本次展示未发送通知。");
    const e=hooks.getCurrent();
    $("bookmark").textContent=profile?.data.bookmarks.includes(e?.id)?"取消收藏":"收藏当前事件";
    renderLocks();
  }
  function buildPreferences() {
    const data=clone(profile.data);
    data.preferences={
      theme,enabled:$("pref-enabled").checked,
      sources:$("pref-tibo").checked?["tibo"]:[],
      types:[...document.querySelectorAll("[data-kind]:checked")].map(e=>e.dataset.kind),
      windows:[...document.querySelectorAll("[data-window]:checked")].map(e=>Number(e.dataset.window)),
      quiet:{enabled:$("pref-quiet").checked,start:$("quiet-start").value,end:$("quiet-end").value}
    };
    return data;
  }
  async function loadDelivery() {
    if(!profile){$("delivery-list").textContent="连接档案后查看你自己的送达记录。";return;}
    const [messages,devices]=await Promise.all([api("deliveries"),api("devices")]);
    $("delivery-list").innerHTML=messages.deliveries.length?messages.deliveries.map(d=>`<article class="receipt"><div><strong>${esc(d.event_id)}</strong><span class="tag">${esc(d.phase)}</span></div><p>${esc(deliveryLabel(d))}</p><dl class="receipt-times"><dt>入队</dt><dd>${esc(beijing(d.queued_at,false))}</dd><dt>服务商接受</dt><dd>${esc(beijing(d.accepted_at,false))}</dd><dt>客户端报告收到</dt><dd>${esc(beijing(d.received_at,false))}</dd><dt>报告打开</dt><dd>${esc(beijing(d.opened_at,false))}</dd></dl>${["available","accepted","unknown"].includes(d.status)?`<button data-ack="${esc(d.id)}" data-write>标记已打开</button>`:""}${["failed","unknown"].includes(d.status)?`<button data-retry="${esc(d.id)}" data-write>确认风险后重试</button>`:""}</article>`).join(""):"暂无消息记录；这不代表你已收到提醒。";
    $("device-list").innerHTML=devices.devices.length?devices.devices.map(d=>`<li><span>${esc(d.kind)} · ${d.revoked_at?"授权已撤销":"已登记 · 送达待验证"}</span>${d.revoked_at?"":`<button data-revoke="${esc(d.id)}" data-write>撤销设备授权</button>`}</li>`).join(""):"<li>尚未登记原生推送设备；请在相应客户端主动授权。</li>";
    renderLocks();
  }
  async function loadTeams() {
    if(!profile){$("team-list").textContent="连接档案后使用团队空间。";return;}
    workspaces=(await api("workspaces")).workspaces;
    if(activeTeam&&!workspaces.some(w=>w.id===activeTeam))activeTeam=null;
    if(!activeTeam)activeTeam=workspaces[0]?.id||null;
    const w=workspaces.find(w=>w.id===activeTeam);
    $("team-select").replaceChildren(...workspaces.map(w=>{const o=document.createElement("option");o.value=w.id;o.textContent=w.name;return o;}));
    $("team-select").value=activeTeam||"";
    if(!w){$("team-list").textContent="暂无团队空间。可以创建，或用所有者发给你的单次邀请加入。";return;}
    const owner=w.role==="owner",edit=owner||w.role==="editor";
    $("team-list").innerHTML=`<h3>${esc(w.name)}</h3><p>你的权限：<strong>${{owner:"所有者",editor:"编辑者",viewer:"查看者"}[w.role]}</strong> · 版本 ${w.version}</p>
      <ul class="task-list">${w.data.tasks.map(t=>`<li class="task-row"><label><input type="checkbox" data-team-task="${esc(t.id)}" ${t.done?"checked":""} ${edit?"data-write":"disabled"}>${esc(t.title)}</label></li>`).join("")||"<li>没有团队任务。</li>"}</ul>
      ${edit?'<div class="form-row"><input id="team-task-title" maxlength="200" placeholder="团队重要任务"><button id="team-task-add" data-write>添加团队任务</button></div>':"<p>查看者不能修改任务；权限由后端再次校验。</p>"}
      <h4>成员</h4><ul>${w.members.map(m=>`<li class="member"><span>${esc(m.display_name)} · ${esc(m.role)}</span>${owner?`<select data-member="${esc(m.id)}" aria-label="成员角色"><option value="viewer" ${m.role==="viewer"?"selected":""}>查看者</option><option value="editor" ${m.role==="editor"?"selected":""}>编辑者</option></select><button data-member-save="${esc(m.id)}" data-write>更新</button><button data-member-remove="${esc(m.id)}" data-write>移除</button>`:""}</li>`).join("")||"<li>暂无其他成员。</li>"}</ul>
      ${owner?'<div class="form-row"><select id="invite-role" aria-label="邀请权限"><option value="viewer">查看者</option><option value="editor">编辑者</option></select><button id="invite-create" data-write>生成 24 小时单次邀请</button><button id="team-delete" class="danger" data-write>删除团队空间</button></div>':""}`;
    renderLocks();
  }
  async function saveTeam(data) {
    const w=workspaces.find(w=>w.id===activeTeam);requireLive();
    if(!w||w.role==="viewer")throw Error("当前角色不能修改团队。");
    await api("",{action:"workspace.save",id:w.id,expectedVersion:w.version,data:validatePersonal(data)});
    await loadTeams();toast("团队数据已保存。");
  }
  async function loadDrafts() {
    const result=await api("drafts");drafts=result.drafts;
    $("saved-drafts").innerHTML=drafts.length?drafts.map(d=>`<article class="receipt"><strong>${d.kind==="alert"?"用户告警":"传播稿"}</strong> · ${esc(d.status)}<p>${esc(d.body)}</p>${d.external_url?`<a href="${esc(d.external_url)}" target="_blank" rel="noopener noreferrer">已记录的外部发布链接 ↗</a>`:`<button data-publication="${esc(d.id)}" data-operator>记录已在外部发布</button>`}</article>`).join(""):"没有服务端草稿。";
    renderLocks();
  }
  function confirmAction(text){return window.confirm(text);}
  function download(name,data) {
    const a=document.createElement("a"),url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json"}));
    a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function bind(id,fn) {$(id).onclick=()=>run(fn);}
  function showSecret(title,secret) {
    $("secret-title").textContent=title;$("secret-value").value=secret;$("secret-dialog").showModal();
  }
  $("close-secret").onclick=()=>{$("secret-value").value="";$("secret-dialog").close();};
  $("secret-dialog").addEventListener("close",()=>{$("secret-value").value="";});
  $("copy-secret").onclick=()=>run(async()=>{try{await navigator.clipboard.writeText($("secret-value").value);toast("已复制，请妥善保管，不要放入截图、日志或公开仓库。");}catch{$("secret-value").focus();$("secret-value").select();toast("无法自动复制，已选中，可手动复制。");}});
  bind("profile-create",async()=>{
    requireLive();if(!$("profile-consent").checked)throw Error("请先同意只为 ResetWatch 创建独立设备档案。");
    const d=await api("",{action:"profile.create",name:$("profile-input").value||"我的设备",consent:true});profile=d.profile;
    showSecret("恢复码只在此显示一次；可用于连接其他设备。",d.token);renderProfile();toast("档案创建成功；没有申请 OpenAI 账号权限。");
  });
  bind("profile-connect",async()=>{requireLive();const token=$("recovery-input").value.trim();profile=(await api("",{action:"profile.connect",token})).profile;$("recovery-input").value="";renderProfile();toast("已连接现有档案。");});
  bind("profile-refresh",async()=>{await reloadProfile();toast("档案已重新读取，表单已更新为服务端版本。");});
  bind("profile-logout",async()=>{requireLive();await api("",{action:"profile.logout"});profile=null;renderProfile();$("delivery-list").textContent="连接档案后查看记录。";$("team-list").textContent="连接档案后查看团队。";toast("已断开本浏览器；服务端档案没有删除。");});
  bind("profile-export",async()=>{requireLive();download("ResetWatch-personal-data.json",await api("export"));toast("已导出本产品数据，不包含恢复码和推送标识。");});
  bind("profile-delete",async()=>{requireLive();if(!confirmAction("永久删除本产品档案、偏好和个人任务？不影响 OpenAI 账户。此操作不可撤销。"))return;await api("",{action:"profile.delete",confirmation:"DELETE"});profile=null;renderProfile();await loadDelivery();await loadTeams();toast("本产品档案已删除。");});
  bind("pref-save",()=>savePersonal(buildPreferences()));
  $("theme-toggle").onclick=()=>setTheme(document.documentElement.dataset.theme==="dark"?"light":"dark",true);
  $("theme-choice").onchange=()=>{setTheme($("theme-choice").value,true);toast("主题已应用本机；连接档案后点保存偏好可跨设备同步。");};
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change",()=>{if(theme==="system")setTheme(theme);});
  bind("bookmark",async()=>{
    const e=hooks.getCurrent();if(!e)throw Error("请先选择事件。");
    const d=clone(profile.data);d.bookmarks=d.bookmarks.includes(e.id)?d.bookmarks.filter(x=>x!==e.id):[...d.bookmarks,e.id];await savePersonal(d);
  });
  bind("task-add",async()=>{const d=clone(profile.data),title=$("task-title").value.trim();if(!title)throw Error("请填写真实任务。");d.tasks.push({id:crypto.randomUUID(),title,done:false,priority:$("task-priority").value,createdAt:new Date(hooks.now()).toISOString(),eventId:$("task-link").checked?hooks.getCurrent()?.id||null:null});await savePersonal(d);$("task-title").value="";});
  bind("delivery-refresh",loadDelivery);
  bind("team-refresh",loadTeams);
  bind("team-create",async()=>{requireLive();activeTeam=(await api("",{action:"workspace.create",name:$("team-name").value.trim()})).id;await loadTeams();$("team-name").value="";toast("团队空间已创建。");});
  bind("team-join",async()=>{requireLive();activeTeam=(await api("",{action:"workspace.join",invite:$("team-invite").value.trim()})).id;$("team-invite").value="";await loadTeams();toast("已加入团队。");});
  $("team-select").onchange=()=>{activeTeam=$("team-select").value;run(loadTeams);};
  bind("drafts-refresh",loadDrafts);
  for(const [button,kind,field] of [["save-alert","alert","alert-draft"],["save-social","social","social-draft"]])bind(button,async()=>{requireLive();const e=hooks.getCurrent();if(!e)throw Error("没有可保存的事件。");await api("",{action:"draft.save",kind,eventId:e.id,text:$(field).value});toast("已保存为运营草稿，没有发送或发布。");await loadDrafts();});
  bind("widget-refresh",async()=>{const d=await api("widget");$("widget-title").textContent=d.available?d.title:"暂无可核验事件";$("widget-state").textContent=d.available?d.statusLabel:d.reason;$("widget-window").textContent=d.available?d.confirmedAt?"官方确认："+beijing(d.confirmedAt,false):d.deadlineText:"最晚时间未知";$("widget-note").textContent="数据快照："+beijing(d.serverTime)+"；系统刷新策略不保证秒级更新。";});
  document.addEventListener("click",ev=>{
    const b=ev.target.closest("button");if(!b||b.disabled)return;
    if(b.dataset.open){hooks.showTab(b.dataset.open);return;}
    if(b.dataset.bookmarkOpen){hooks.selectEvent(b.dataset.bookmarkOpen);hooks.showTab("feed");return;}
    const doChange=async()=>{
      requireLive();
      if(b.dataset.taskRemove){const d=clone(profile.data);d.tasks=d.tasks.filter(t=>t.id!==b.dataset.taskRemove);await savePersonal(d);}
      if(b.dataset.bookmarkRemove){const d=clone(profile.data);d.bookmarks=d.bookmarks.filter(x=>x!==b.dataset.bookmarkRemove);await savePersonal(d);}
      if(b.dataset.revoke){if(!confirmAction("撤销此设备的后续推送授权？已经发送的消息无法撤回。"))return;await api("",{action:"device.revoke",id:b.dataset.revoke});await loadDelivery();toast("设备授权已撤销。");}
      if(b.dataset.ack){await api("",{action:"delivery.ack",id:b.dataset.ack,stage:"opened"});await loadDelivery();toast("仅记录主动打开操作，不据此推断已经阅读。");}
      if(b.dataset.retry){if(!confirmAction("上次发送结果可能未知。重试可能重复发送，确认继续？"))return;await api("",{action:"delivery.retry",id:b.dataset.retry,confirmation:"可能重复发送"});await loadDelivery();toast("已请求重新入队，尚未确认送达。");}
      if(b.id==="team-task-add"){const w=workspaces.find(w=>w.id===activeTeam),d=clone(w.data);d.tasks.push({id:crypto.randomUUID(),title:$("team-task-title").value.trim(),done:false,priority:"normal",createdAt:new Date().toISOString(),eventId:null});await saveTeam(d);}
      if(b.id==="invite-create"){const d=await api("",{action:"workspace.invite",id:activeTeam,role:$("invite-role").value});showSecret("24 小时有效、只能使用一次；请私下发送给受邀者。",d.invite);}
      if(b.id==="team-delete"){if(!confirmAction("永久删除这个团队空间及其任务和邀请？"))return;await api("",{action:"workspace.delete",id:activeTeam,confirmation:"DELETE"});activeTeam=null;await loadTeams();toast("团队空间已删除。");}
      if(b.dataset.memberSave||b.dataset.memberRemove){const memberId=b.dataset.memberSave||b.dataset.memberRemove,role=b.dataset.memberRemove?"remove":document.querySelector(`[data-member="${memberId}"]`).value;if(role==="remove"&&!confirmAction("移除此成员的团队访问权限？"))return;await api("",{action:"workspace.member",id:activeTeam,memberId,role});await loadTeams();}
      if(b.dataset.publication){const d=drafts.find(d=>d.id===b.dataset.publication);const url=window.prompt("输入已经在 X 或微信公众号发布的 HTTPS 永久链接（此操作不会代你发布）。");if(!url)return;if(!confirmAction("确认这篇草稿已经在外部发布？这里只记录该事实。"))return;await api("",{action:"draft.record-publication",id:d.id,expectedVersion:d.version,url,confirmation:"已在外部发布"});await loadDrafts();toast("外部发布记录已保存，本产品没有执行公开发布。");}
    };
    if(b.matches("[data-task-remove],[data-bookmark-remove],[data-revoke],[data-ack],[data-retry],#team-task-add,#invite-create,#team-delete,[data-member-save],[data-member-remove],[data-publication]"))run(doChange);
  });
  document.addEventListener("change",ev=>{
    const el=ev.target;
    if(el.dataset.taskCheck)run(async()=>{const d=clone(profile.data),t=d.tasks.find(t=>t.id===el.dataset.taskCheck);t.done=el.checked;try{await savePersonal(d);}catch(e){el.checked=!el.checked;throw e;}});
    if(el.dataset.teamTask)run(async()=>{const w=workspaces.find(w=>w.id===activeTeam),d=clone(w.data),t=d.tasks.find(t=>t.id===el.dataset.teamTask);t.done=el.checked;try{await saveTeam(d);}catch(e){el.checked=!el.checked;throw e;}});
  });
  let installPrompt=null;
  window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();installPrompt=e;$("install-app").hidden=false;});
  bind("install-app",async()=>{if(!installPrompt){toast("使用浏览器菜单中的添加到主屏幕；可用性取决于当前浏览器。");return;}await installPrompt.prompt();installPrompt=null;});
  try{setTheme(localStorage.getItem("resetwatch-theme")||"system");}catch{setTheme("system");}
  renderProfile();
  // Loading capabilities or an existing session is read-only. Permission requests only follow a click.
  api("capabilities").then(d=>{
    capabilities=d;
    $("capability-state").textContent=`数据库：${d.storage?"已迁移":"未就绪"}；发送总开关：${d.sendEnabled?"开启":"关闭"}；原生推送配置：${d.nativePush?"已配置（未等同真机验证）":"未配置"}。`;
    $("source-state").textContent=(d.sources||[]).map(s=>`${s.name}：${s.available?"可用":"未接入"}`).join("；")||"来源状态未知";
  }).catch(e=>{$("capability-state").textContent="渠道状态未知："+e.message;});
  reloadProfile(true).catch(e=>toast("档案服务："+e.message,true));
  if("serviceWorker" in navigator&&location.protocol==="https:"&&!hooks.isDemo()){
    navigator.serviceWorker.register("./sw.js",{scope:"/workbench/"}).catch(()=>{});
  }
  return {selectionChanged,onTab(name){
    if(name==="delivery")run(loadDelivery);
    if(name==="teams")run(loadTeams);
    if(name==="tasks")renderProfile();
  }};
}
