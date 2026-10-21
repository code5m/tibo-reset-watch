import {beijing} from "./reset-core.js";
const $=id=>document.getElementById(id);
let busy=false;
async function refresh(){
 if(busy||document.hidden)return;busy=true;
 try{
  const event=new URLSearchParams(location.search).get("event");
  const r=await fetch("/api/v1/product?view=widget"+(event?"&event="+encodeURIComponent(event):""),{cache:"no-store",credentials:"omit",signal:AbortSignal.timeout(10000)});
  const d=await r.json();if(!r.ok)throw Error();
  $("title").textContent=d.available?d.title:"暂无可核验事件";
  $("state").textContent=d.available?d.statusLabel:d.reason||"未知";
  $("deadline").textContent=d.available?(d.confirmedAt?"官方确认完成："+beijing(d.confirmedAt,false):d.deadlineText):"最晚时间未知";
  $("action").textContent=d.action||"";
  $("updated").textContent="服务端快照："+beijing(d.serverTime)+"；来源目录更新："+beijing(d.updatedAt);
 }catch{$("state").textContent="读取失败，状态未知";$("updated").textContent="当前无法核对新事件。不会把失败显示为没有 Reset。";}
 finally{busy=false;}
}
refresh();const timer=setInterval(refresh,60000);
addEventListener("pagehide",()=>clearInterval(timer));
document.addEventListener("visibilitychange",()=>{if(!document.hidden)refresh();});
