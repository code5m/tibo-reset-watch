import {beijing,pacific,instant,duration,eventState,defaultPostIndex,metrics,actionText,copyDraft,demoCatalog,validateCatalog,TYPE_LABELS,pacificEod} from "./reset-core.js";
import {initProductUI} from "./product-ui.js";
import {clockStatus} from "./product-core.js";
let productUI=null,networkError=false,clockInfo=null;
const $=id=>document.getElementById(id);
let events=[],selected=0,page=0,isDemo=false,offset=0,loadedAt=null,nextOffset=null,busy=false,serverSkew=0;
let catalogVersion=null,requestGeneration=0,pendingSignals=[],calculatedDeadline=null;
const now=()=>Date.now()+serverSkew;
const current=()=>events[selected];
function message(value,error=false){$("message").textContent=value;$("message").classList.toggle("error",error);}
function showTab(name){
  document.querySelectorAll(".tab").forEach(el=>el.hidden=el.id!=="tab-"+name);
  document.querySelectorAll("[data-tab]").forEach(el=>el.classList.toggle("active",el.dataset.tab===name));
  if(name==="history")renderHistory();
  if(name==="studio")renderDrafts();
  productUI?.onTab(name);
}
function setEvents(items,append=false){
  const priorEvent=current()?.id,priorPost=current()?.posts[page]?.id;
  events=append ? [...events,...items.filter(e=>!events.some(v=>v.id===e.id))] : items;
  const previousIndex=events.findIndex(e=>e.id===priorEvent);
  selected=previousIndex>=0?previousIndex:0;
  $("event-select").replaceChildren(...events.map((e,i)=>{
    const option=document.createElement("option");option.value=String(i);option.textContent=e.title;return option;
  }));
  $("event-select").value=String(selected);
  $("event-count").textContent=String(events.length);
  $("empty").hidden=!!events.length;$("event-view").hidden=!events.length;
  const previousPost=current()?.posts.findIndex(p=>p.id===priorPost)??-1;
  page=previousPost>=0?previousPost:current()?defaultPostIndex(current(),now()):0;applyFilter();
}
async function load(append=false){
  if(busy)return;busy=true;const generation=++requestGeneration;$("refresh").disabled=true;
  try{
    const requestedOffset=append?nextOffset:0;const requestStarted=Date.now();
    const response=await fetch(`/api/v1/reset-events?limit=20&offset=${requestedOffset||0}`,{cache:"no-store",credentials:"omit"});
    const data=await response.json();
    if(generation!==requestGeneration)return;
    if(!response.ok)throw new Error(data.message||"数据服务暂不可用");
    const normalized=validateCatalog({schemaVersion:data.schemaVersion,events:data.events});
    clockInfo=clockStatus(data.serverTime,requestStarted,Date.now(),Date.now());serverSkew=clockInfo.skew;networkError=false;
    isDemo=false;loadedAt=now();offset=requestedOffset||0;nextOffset=data.nextOffset;
    $("more").hidden=nextOffset==null;$("mode-tag").textContent="真实数据";
    $("data-note").textContent=`共 ${data.total} 个已入库事件 · ${data.pendingReviewCount||0} 条信号待校对`;
    message("已连接数据服务。原帖可信程度单独标注，个人到账时间不作推断。");
    setEvents(normalized.events,append);
  }catch(e){
    if(generation!==requestGeneration)return;
    // Never replace an API failure with demo data or report "no new reset".
    networkError=true;
    message(`数据读取失败：${e.message}。这不代表没有新 Reset。`,true);
    if(!events.length)setEvents([]);
  }finally{busy=false;$("refresh").disabled=false;tick();}
}
function demo(){
  requestGeneration++;
  isDemo=true;serverSkew=0;loadedAt=null;nextOffset=null;$("more").hidden=true;
  $("mode-tag").textContent="演示 · 非真实公告";$("data-note").textContent="模拟事件，不发送通知";
  message("当前是交互演示，英文、时间与事件均不是最新官方消息。点击“刷新数据”返回真实服务。");
  selected=0;setEvents(demoCatalog(Date.now()).events);
}
function draw(){
  const e=current();if(!e){$("global-state").textContent="暂无可展示数据";return;}
  page=Math.min(Math.max(0,page),e.posts.length-1);const p=e.posts[page],s=eventState(e,now());
  $("event-title").textContent=e.title;$("event-type").textContent=TYPE_LABELS[e.type];
  $("event-state").textContent=s.label;
  $("post-beijing").textContent="北京时间 "+beijing(p.publishedAt);
  $("post-pacific").textContent="美国太平洋时间 "+pacific(p.publishedAt);
  const stageLabels={announced:"首次宣布",scheduled:"时间承诺",propagating:"传播进展",completed:"完成确认",banked_credited:"Banked 发放确认",info:"信息更新"};
  $("post-stage").textContent=stageLabels[p.stage]||"信息更新";
  $("post-evidence").textContent=e.demo?"演示内容":({official:"原帖已校对",archive:"归档来源 · 官方尚待核验",unverified:"未核实，不能据此确认重置"}[p.evidence]);
  if(s.done){
    $("meaning-title").textContent="官方确认完成：北京时间 "+beijing(s.done.publishedAt,false);
    $("meaning-note").textContent="这是本轮事件的当前状态；下方保留这条历史原帖的原意。";
  }else if(e.deadline){
    $("meaning-title").textContent="重置最晚时间：北京时间 "+beijing(e.deadline.at,false);
    $("meaning-note").textContent=`（${e.deadline.basis==="explicit"?"明确时间窗口":e.deadline.basis+" 换算"}，${e.deadline.kind==="execution_time"?"官方明确执行时刻":"参考最晚截止，可能提前"}）`+
      (e.deadline.alternativeAt?` 字面 PST 备选：北京时间 ${beijing(e.deadline.alternativeAt,false)}。`:"");
  }else{
    $("meaning-title").textContent="重置最晚时间：未知";$("meaning-note").textContent="没有可信时间承诺，不推算准确到账。";
  }
  $("meaning-text").textContent=p.explanation||"解释未核实。";
  $("translation").textContent=p.translation||"中文译文尚未校对，不以机器猜测补齐。";
  $("original").textContent=p.original;
  const source=$("source");source.hidden=!p.url;if(p.url)source.href=p.url;else source.removeAttribute("href");
  $("source-note").textContent=e.demo?"演示卡片 · 无真实原帖链接":"X 原帖引用 · 非官方实时嵌入";
  $("page-count").textContent=`第 ${page+1} / ${e.posts.length} 条`;
  $("previous").disabled=page===0;$("next").disabled=page===e.posts.length-1;
  $("page-dots").replaceChildren(...e.posts.map((_,i)=>{
    const b=document.createElement("button");b.className=i===page?"active":"";
    b.setAttribute("aria-label",`查看第 ${i+1} 条推文`);b.setAttribute("aria-current",i===page?"true":"false");
    b.onclick=()=>go(i);return b;
  }));
  renderDrafts();tick();productUI?.selectionChanged();
}
function go(n){const e=current();if(!e||n<0||n>=e.posts.length)return;page=n;draw();document.querySelector(".column-scroll").scrollLeft=0;}
function tick(){
  const t=now();$("top-clock").textContent=beijing(t);
  const e=current();
  if(e){
    const m=metrics(e,e.posts[page],t);
    $("clock").textContent=m.current;$("elapsed").textContent=m.elapsed;
    $("deadline-label").textContent=m.deadlineLabel;$("deadline-value").textContent=m.deadlineValue;$("deadline-note").textContent=m.deadlineNote;
    $("global-state").textContent=m.state.label;$("event-state").textContent=m.state.label;$("action").textContent=actionText(e,t);
  }
  $("freshness").textContent=isDemo?"演示模式：时钟在走，不代表正在监控 X。":
    loadedAt?`最近成功读取：北京时间 ${beijing(loadedAt)} · 已过 ${duration(t-loadedAt)}${t-loadedAt>120000?" · 数据可能陈旧，请刷新":""} · 个人账户到账时间未知`:
    "尚未成功读取服务端。动态时钟不代表数据源健康或通知已经送达。";
  if(!isDemo){$("freshness").textContent+=(networkError?" · 最近请求失败，状态可能陈旧。":"")+(clockInfo?.calibrated?clockInfo.skewWarning?" · 已校准；设备时钟偏差超过 1 分钟。":" · 已按服务端时间校准。":" · 时钟未经服务端校准。");}
}
function renderHistory(){
  const table=document.createElement("table"),head=document.createElement("tr");
  ["事件 / 类型","首次公告（北京）","参考最晚截止","官方确认","公告到确认","相对截止","个人到账"].forEach(v=>{const th=document.createElement("th");th.textContent=v;head.append(th);});
  table.append(head);
  for(const e of events.filter(e=>!$("history-filter").value||e.type===$("history-filter").value)){
    const s=eventState(e,now()),first=e.posts[0],d=instant(e.deadline?.at),done=instant(s.done?.publishedAt);
    const values=[`${e.title} / ${TYPE_LABELS[e.type]}`,beijing(first.publishedAt,false),beijing(e.deadline?.at,false),beijing(s.done?.publishedAt,false),
      done!==null?duration(done-instant(first.publishedAt)):"未知",done!==null&&d!==null?(d>=done?"提前 ":"延后 ")+duration(d-done):"不可计算","未知"];
    const row=document.createElement("tr");for(const v of values){const td=document.createElement("td");td.textContent=v;row.append(td);}table.append(row);
  }
  $("history").replaceChildren(table);
}
function renderDrafts(){const e=current();$("alert-draft").value=e?copyDraft(e,now()):"请先选择事件。";$("social-draft").value=e?copyDraft(e,now(),true):"请先选择事件。";}
async function copy(id){try{await navigator.clipboard.writeText($(id).value);message("已复制草稿，尚未向任何平台发布。");}catch{$(id).focus();$(id).select();message("浏览器不允许自动复制，已选中文本，可手动复制。");}}
async function readCatalog(){
  try{
    const r=await fetch("/api/admin/reset-catalog",{cache:"no-store"}),d=await r.json();
    if(!r.ok)throw new Error(d.message||"请先登录管理员");
    catalogVersion=d.version;$("catalog-editor").value=JSON.stringify(d.catalog,null,2);
    pendingSignals=d.pendingSignals||[];
    $("pending").textContent=JSON.stringify(pendingSignals,null,2);
    $("signal-picker").replaceChildren(...pendingSignals.map((p,i)=>{
      const option=document.createElement("option");option.value=String(i);
      option.textContent=`${beijing(p.source_created_at,false)} · ${String(p.body).slice(0,55)}`;return option;
    }));fillSignal();
    $("review-status").textContent=`已读取版本 ${catalogVersion}。待审原帖只提供素材，不自动认定 Reset 类型或同轮关系。`;
  }catch(e){$("review-status").textContent=e.message;}
}

function fillSignal(){
  const p=pendingSignals[Number($("signal-picker").value)||0];calculatedDeadline=null;
  if(!p)return;
  $("edit-event-id").value="review-"+p.source_post_id;$("edit-title").value="待核实事件";
  $("edit-original").value=p.body;$("edit-type").value="unknown";$("edit-stage").value="info";
  $("edit-evidence").value="unverified";$("edit-translation").value="";$("edit-explanation").value="";$("edit-deadline").value="";
}
function calculateEod(){
  if(isDemo){$("review-status").textContent="演示模式禁止操作生产目录。";return;}
  const p=pendingSignals[Number($("signal-picker").value)||0];
  if(!p){$("review-status").textContent="请先选择原帖。";return;}
  try{
    if(!/\bEOD\b/i.test(p.body))throw new Error("所选原文没有 EOD，禁止按日终猜测。");
    calculatedDeadline=pacificEod(p.source_created_at,/\bPST\b/.test(p.body)?"PST":"PT");
    $("edit-deadline").value=new Date(instant(calculatedDeadline.at)+8*3600000).toISOString().slice(0,19);
    $("review-status").textContent="已计算参考最晚截止；仍需核对原文当地日期与 PST/PDT 歧义。";
  }catch(e){$("review-status").textContent=e.message;}
}
function addPost(){
  if(isDemo){$("review-status").textContent="演示模式禁止操作生产目录。";return;}
  try{
    if(catalogVersion===null)throw new Error("请先读取目录并登录管理员。");
    const p=pendingSignals[Number($("signal-picker").value)||0];if(!p)throw new Error("请先选择待审原帖。");
    const catalog=JSON.parse($("catalog-editor").value),id=$("edit-event-id").value.trim();
    let e=catalog.events.find(e=>e.id===id);
    if(!e){e={id,title:$("edit-title").value,type:$("edit-type").value,posts:[],deadline:null};catalog.events.push(e);}
    else if(e.type!==$("edit-type").value)throw new Error("同一事件的类型不一致；请确认归组，不能把补偿与 Global 混为一轮。");
    const post={id:p.source_post_id,url:p.source_url,publishedAt:p.source_created_at,original:p.body,
      stage:$("edit-stage").value,evidence:$("edit-evidence").value,
      translation:$("edit-translation").value.trim()||null,explanation:$("edit-explanation").value.trim()||null};
    const index=e.posts.findIndex(v=>v.id===post.id);if(index<0)e.posts.push(post);else e.posts[index]=post;
    if($("edit-deadline").value){
      const at=new Date($("edit-deadline").value+"+08:00").toISOString();
      const matches=calculatedDeadline?.at===at;
      e.deadline={at,sourcePostId:post.id,kind:"upper_bound",basis:matches?calculatedDeadline.basis:"explicit",
        alternativeAt:matches?calculatedDeadline.alternativeAt:null,note:"编辑者已核验的参考最晚窗口，可能提前。"};
    }
    const validated=validateCatalog(catalog);$("catalog-editor").value=JSON.stringify(validated,null,2);
    $("review-status").textContent="已加入本地草稿。点击“校验并保存目录”才会写入服务端；不会自动群发。";
  }catch(e){$("review-status").textContent=e.message;}
}

async function saveCatalog(){
  if(isDemo){$("review-status").textContent="演示模式禁止保存生产目录。";return;}
  if(catalogVersion===null){$("review-status").textContent="请先读取目录，避免覆盖现有修改。";return;}
  try{
    const catalog=validateCatalog(JSON.parse($("catalog-editor").value));
    const r=await fetch("/api/admin/reset-catalog",{method:"PUT",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({expectedVersion:catalogVersion,catalog})}),d=await r.json();
    if(!r.ok)throw new Error(d.message||"保存失败");
    catalogVersion=d.version;$("review-status").textContent=`已保存版本 ${d.version}；没有自动发送告警或群发营销。`;await load();
  }catch(e){$("review-status").textContent=e.message;}
}

function applyFilter(){
  const query=$("event-search").value.trim().toLowerCase(),type=$("event-filter").value;
  const matches=events.map((e,i)=>({e,i})).filter(({e})=>(!type||e.type===type)&&(!query||(e.title+" "+e.posts.map(p=>p.original+" "+(p.translation||"")).join(" ")).toLowerCase().includes(query)));
  $("event-select").replaceChildren(...matches.map(({e,i})=>{const o=document.createElement("option");o.value=String(i);o.textContent=e.title;return o;}));
  if(matches.length&&!matches.some(v=>v.i===selected)){selected=matches[0].i;page=defaultPostIndex(current(),now());}
  $("event-select").value=String(selected);
  $("no-match").hidden=!events.length||!!matches.length;
  $("event-view").hidden=!matches.length;
  draw();productUI?.selectionChanged();
}
$("event-search").oninput=applyFilter;$("event-filter").onchange=applyFilter;
$("history-filter").onchange=renderHistory;
document.querySelectorAll("[data-tab]").forEach(b=>b.onclick=()=>showTab(b.dataset.tab));
$("refresh").onclick=()=>load();$("demo").onclick=demo;$("empty-demo").onclick=demo;$("more").onclick=()=>load(true);
$("event-select").onchange=()=>{selected=Number($("event-select").value);page=defaultPostIndex(current(),now());draw();};
$("previous").onclick=()=>go(page-1);$("next").onclick=()=>go(page+1);
$("signal-picker").onchange=fillSignal;$("calculate-eod").onclick=calculateEod;$("add-post").onclick=addPost;
$("load-catalog").onclick=readCatalog;$("save-catalog").onclick=saveCatalog;
document.querySelectorAll("[data-copy]").forEach(b=>b.onclick=()=>copy(b.dataset.copy));
$("tweet").addEventListener("keydown",ev=>{
  if(ev.target.closest("input,textarea,select,button,a,.column-scroll"))return;
  if(ev.key==="ArrowLeft"){ev.preventDefault();go(page-1);}
  if(ev.key==="ArrowRight"){ev.preventDefault();go(page+1);}
});
let touch=null;
$("swipe-zone").addEventListener("touchstart",e=>{if(e.touches.length===1)touch={x:e.touches[0].clientX,y:e.touches[0].clientY};},{passive:true});
$("swipe-zone").addEventListener("touchend",e=>{
  if(!touch)return;const dx=e.changedTouches[0].clientX-touch.x,dy=e.changedTouches[0].clientY-touch.y;touch=null;
  if(Math.abs(dx)>55&&Math.abs(dx)>Math.abs(dy)*1.5)go(page+(dx<0?1:-1));
},{passive:true});
const timer=setInterval(()=>{if(!document.hidden)tick();},1000);
const poll=setInterval(()=>{if(!document.hidden&&!isDemo&&!busy)load();},60000);
window.addEventListener("pagehide",()=>{clearInterval(timer);clearInterval(poll);});
document.addEventListener("visibilitychange",()=>{if(!document.hidden){tick();if(!isDemo)load();}});
productUI=initProductUI({getCurrent:current,getEvents:()=>events,now,isDemo:()=>isDemo,showTab,notify:message,
  selectEvent(id){const i=events.findIndex(e=>e.id===id);if(i<0){message("这个收藏尚未加载，请加载更多事件后再查看。");return;}
  $("event-search").value="";$("event-filter").value="";selected=i;page=defaultPostIndex(current(),now());applyFilter();}});
tick();
if(globalThis.RESETWATCH_DEMO_PREVIEW===true||location.protocol==="file:"||new URLSearchParams(location.search).get("demo")==="1")demo();else load();
