<template>
<view class="page" :class="{'theme-dark':dark}">
<view class="heading"><view><text class="brand">ResetWatch</text><text class="sub">独立第三方产品 · 先看到公告，再安排工作</text></view><text class="badge">{{demoMode?'演示 · 非新闻':'公开事件'}}</text></view>
<text class="hero" v-if="tab==='events'">把下一次重置，变成下一次交付。</text>
<view class="notice">{{message}}</view>
<view v-if="event && tab==='events'" class="row"><text class="badge">{{state.label}}</text><button @tap="tab='share'">分享文案（未发布）</button></view>
 <view v-if="tab==='events'">
  <view class="searchbar"><input v-model="search" placeholder="搜索已加载事件原文 / 译文" @input="filterEvents"/><button :disabled="!profile || demoMode || busy || !event || !visibleEvents.length" @tap="bookmarkCurrent">{{isBookmarked?'取消收藏':'收藏'}}</button></view><view class="toolbar"><picker v-if="event && visibleEvents.length" :range="visibleEvents" range-key="title" :value="visibleEvents.findIndex(e=>e.id===event.id)" @change="chooseEvent"><view class="picker">{{event.title}} ▾</view></picker><button @tap="refresh(false)">刷新</button></view>
  <view v-if="search && !visibleEvents.length" class="empty">已加载事件中没有搜索结果。</view>
  <view v-else-if="!event" class="empty"><text>暂无可展示事件。服务端未连接或原帖尚待校对。</text><button @tap="startDemo">查看交互演示（非真实公告）</button></view>
  <view v-else class="tweet">
   <view class="tweet-head" @touchstart="touchStart" @touchend="touchEnd">
    <view class="avatar">TS</view><view class="author"><text class="name">Tibo</text><text>@thsottiaux</text><text>北京时间 {{beijing(post.publishedAt)}}</text><text>美国太平洋时间 {{pacific(post.publishedAt)}}</text></view><text class="x">𝕏</text>
   </view>
   <view class="state-row"><text class="badge">{{state.label}}</text><text>{{event.demo ? '演示，不是官方原帖' : post.evidence==='official' ? '原帖已校对' : '原帖未独立核实'}}</text></view>
   <scroll-view scroll-x class="column-scroll">
    <view class="cols">
     <view class="col">
      <text class="label">通俗解释</text>
      <text class="key">{{headline}}</text>
      <text class="note">{{deadlineNote}}</text>
      <text class="body">{{post.explanation || '解释尚未核实。'}}</text>
     </view>
     <view class="col"><text class="label">中文翻译</text><text class="body">{{post.translation || '中文译文尚未校对。'}}</text></view>
     <view class="col"><text class="label">English original</text><text class="body english">{{post.original}}</text></view>
    </view>
   </scroll-view>
   <view class="clock-heading">动态时间状态 <text>仅前台每秒刷新</text></view>
   <view class="metrics">
    <view><text>当前时间 · 北京时间</text><text class="value">{{time.current}}</text><text>Asia/Shanghai · UTC+8</text></view>
    <view><text>距离这条推文发布</text><text class="value">{{time.elapsed}}</text></view>
    <view><text>{{time.deadlineLabel}}</text><text class="value">{{time.deadlineValue}}</text><text>{{time.deadlineNote}}</text></view>
   </view>
   <view class="action">{{actionText(event,clock)}}</view>
   <button v-if="post.url" @tap="copy(post.url)">复制 𝕏 原帖链接 ↗</button>
   <text class="footnote">原帖引用卡片，非 X 官方嵌入。个人到账时间未知。</text>
  </view>
  <view v-if="event && visibleEvents.length" class="pager"><button :disabled="postIndex===0" @tap="go(postIndex-1)">← 上一条</button><view><text>第 {{postIndex+1}} / {{event.posts.length}} 条</text><view class="dots"><button v-for="(p,i) in event.posts" :key="p.id" :class="{on:i===postIndex}" @tap="go(i)" :aria-label="'第'+(i+1)+'条'"></button></view></view><button :disabled="postIndex===event.posts.length-1" @tap="go(postIndex+1)">下一条 →</button></view>
  <button v-if="nextOffset!==null && !demoMode" @tap="refresh(true)">加载更多事件</button>
  <text class="footnote">顶部滑动翻页，正文横向阅读，手势互不干扰。</text>
 </view>

<view v-if="tab==='history'">
 <picker :range="historyTypes" range-key="label" @change="historyType=historyTypes[Number($event.detail.value)].id"><view class="picker">类型：{{historyTypes.find(x=>x.id===historyType).label}} ▾</view></picker>
 <view v-for="e in historyEvents" :key="e.id" class="panel" @tap="selectById(e.id)">
 <text class="eyebrow">{{typeLabels[e.type]}}</text><text class="key">{{e.title}}</text><text class="badge">{{eventState(e,clock).label}}</text>
 <text>首次公告：{{beijing(e.posts[0].publishedAt,false)}}</text><text>参考截止：{{beijing(e.deadline && e.deadline.at,false)}}</text>
 <text>官方确认：{{beijing(eventState(e,clock).done && eventState(e,clock).done.publishedAt,false)}}</text>
 <text>公告到确认：{{confirmDuration(e)}}</text><text class="muted">个人到账未知，不以官方发帖时间替代。</text></view>
 <view v-if="!historyEvents.length" class="empty">已加载事件中没有匹配记录。</view>
</view>
<view v-if="tab==='reminders'">
 <view class="panel"><text class="key">告警与送达</text><text>新公告优先，不必等到 6/3/1 小时。渠道登记不等于消息已送达。</text>
 <view class="setting"><text>启用档案提醒</text><switch :checked="preferences.enabled" @change="preferences.enabled=$event.detail.value"/></view>
 <text class="label">事件类型</text><checkbox-group @change="preferences.types=$event.detail.value"><label v-for="t in historyTypes.slice(1)" :key="t.id" class="check"><checkbox :value="t.id" :checked="preferences.types.includes(t.id)"/>{{t.label}}</label></checkbox-group>
 <text class="label">参考截止临近提醒（同一事件）</text><checkbox-group @change="preferences.windows=$event.detail.value.map(Number)"><label v-for="h in [6,3,1]" :key="h" class="check"><checkbox :value="String(h)" :checked="preferences.windows.includes(h)"/>{{h}} 小时</label></checkbox-group>
 <view class="setting"><text>免打扰（北京时间）</text><switch :checked="preferences.quiet.enabled" @change="preferences.quiet.enabled=$event.detail.value"/></view>
 <view class="row"><picker mode="time" :value="preferences.quiet.start" @change="preferences.quiet.start=$event.detail.value"><view class="picker">{{preferences.quiet.start}}</view></picker><text>至</text><picker mode="time" :value="preferences.quiet.end" @change="preferences.quiet.end=$event.detail.value"><view class="picker">{{preferences.quiet.end}}</view></picker></view>
 <text class="muted">免打扰期间可能错过提前行动窗口。</text><button :disabled="!profile || demoMode || busy" @tap="savePreferences">保存偏好</button>
 </view>
 <view class="panel"><text class="key">系统通知</text><text>{{capabilityText}}</text><button :disabled="!profile || demoMode || busy" @tap="registerPush">{{isMini?'主动申请本次订阅消息':'核对系统授权并登记推送'}}</button><text class="muted">{{isMini?'不承诺一次授权可无限接收；以平台额度和授权为准。':'先核对 OS 权限，再登记标识；不在访问首页时申请权限。'}}</text>
 <view v-for="d in devices" :key="d.id" class="setting"><text>{{d.kind}} · {{d.revoked_at?'已撤销':'已登记'}}</text><button v-if="!d.revoked_at" :disabled="busy || demoMode" @tap="revoke(d.id)">撤销</button></view></view>
 <view class="panel"><view class="row"><text class="key grow">消息轨迹</text><button @tap="loadDeliveries">刷新</button></view><view v-for="d in deliveries" :key="d.id" class="receipt"><text class="key">{{d.event_id}}</text><text>{{deliveryLabel(d)}}</text><text>入队：{{beijing(d.queued_at,false)}}</text><text>服务商接受：{{beijing(d.accepted_at,false)}}</text><text>客户端报告收到：{{beijing(d.received_at,false)}}</text><button v-if="['available','accepted','unknown'].includes(d.status)" :disabled="demoMode" @tap="ack(d.id)">标记打开</button></view><text v-if="!deliveries.length">尚无记录，不等于已收到。</text></view>
</view>
<view v-if="tab==='mine'">
 <view class="panel"><text class="eyebrow">MY RESETWATCH</text><text class="key">{{profile?profile.display_name:'访客'}}</text><text>{{profile?'服务端档案 · 版本 '+profile.version:'公开消息无需登录。保存偏好与任务需独立档案，不涉及 OpenAI 账号。'}}</text>
 <input v-if="!profile" v-model="profileName" maxlength="80" placeholder="独立设备档案名称"/>
 <button v-if="!profile" :disabled="demoMode || busy" @tap="createProfile">同意用途并创建档案</button>
 <input v-if="!profile" v-model="recoveryInput" password placeholder="连接已有档案：输入恢复码"/>
 <button v-if="!profile" :disabled="demoMode || busy" @tap="connectProfile">连接已有档案</button>
 <view v-if="recoveryCode" class="secret"><text>恢复码仅显示一次，请私下保存，关闭后不再显示。</text><button @tap="copy(recoveryCode)">复制恢复码</button><button @tap="recoveryCode=''">已保存，隐藏</button></view>
 <view class="vault-status">
 <text class="label">本机安全保存</text><text>{{vaultText}}</text>
 <button v-if="profile && vault.available && !vault.remembered" :disabled="busy || demoMode" @tap="rememberConnection">同意并安全保存连接</button>
 <button v-if="vault.available" :disabled="busy || demoMode" @tap="forgetSavedConnection">清除本机保存的凭据</button>
 <text class="muted">默认仅保留本次连接。不支持安全存储时不会降级为明文保存；凭据不跨服务域名使用。</text>
 </view>
 <button v-if="profile" :disabled="busy" @tap="reloadProfile">重新读取档案</button><button v-if="profile" :disabled="busy || demoMode" @tap="logout">断开本次连接</button>
 </view>
 <view class="panel"><view class="setting"><text>主题</text><picker :range="themeOptions" range-key="label" @change="changeTheme"><view class="picker">{{themeOptions.find(x=>x.id===theme).label}} ▾</view></picker></view><button v-if="isMini" @tap="tab='reminders';loadDeliveries()">提醒偏好与送达记录</button>
 <text>关注来源：Tibo。其他服务尚未核验接入，不能显示为在线。</text><text>不读取 OpenAI 密码、Cookie 或个人额度。</text></view>
 <view class="panel"><text class="key">使用安排</text><input v-model="taskTitle" maxlength="200" placeholder="原本就需要完成的重要工作"/><button :disabled="!profile || demoMode || busy" @tap="addTask">添加任务</button>
 <view v-for="t in profile?profile.data.tasks:[]" :key="t.id" class="setting"><text :class="{done:t.done}">{{t.title}}</text><button :disabled="busy || demoMode" @tap="toggleTask(t.id)">{{t.done?'恢复待办':'标记完成'}}</button><button :disabled="busy || demoMode" @tap="removeTask(t.id)">删除</button></view>
 </view>
 <view class="panel"><text class="key">收藏</text><button v-for="id in profile?profile.data.bookmarks:[]" :key="id" @tap="selectById(id)">{{events.find(e=>e.id===id)?.title || id}}</button><text v-if="!profile || !profile.data.bookmarks.length">还没有收藏的事件。</text></view>
 <view class="panel"><text class="key">团队工作安排</text><input v-model="teamName" maxlength="100" placeholder="新团队名称"/><button :disabled="!profile || demoMode || busy" @tap="createTeam">创建团队</button><input v-model="inviteInput" password placeholder="私下收到的单次邀请"/><button :disabled="!profile || demoMode || busy" @tap="joinTeam">加入团队</button><button :disabled="!profile" @tap="loadTeams">刷新团队</button>
 <view v-for="w in teams" :key="w.id" class="receipt"><text class="key">{{w.name}}</text><text>{{roleLabels[w.role]}} · 版本 {{w.version}}</text><view v-for="t in w.data.tasks" :key="t.id" class="setting"><text>{{t.title}}</text><button :disabled="w.role==='viewer' || demoMode || busy" @tap="toggleTeamTask(w.id,t.id)">{{t.done?'恢复':'完成'}}</button></view><view v-if="w.role!=='viewer'"><input v-model="teamTaskTitle" maxlength="200" placeholder="团队任务"/><button :disabled="demoMode || busy" @tap="addTeamTask(w.id)">添加团队任务</button></view><button v-if="w.role==='owner'" :disabled="demoMode || busy" @tap="inviteViewer(w.id)">生成查看者邀请</button></view></view>
 <view class="panel"><text class="key">数据与服务连接</text><input v-model="originInput" placeholder="https://你的已部署服务域名"/><button :disabled="busy" @tap="saveOrigin">确认信任此域名并连接</button><text class="muted">切换域名会清除本次内存凭据，不会向新域名发送原档案恢复码。</text><button @tap="startDemo">明确标注的交互演示</button><button @tap="copySubscription">复制现有网站订阅入口</button><button :disabled="!profile || demoMode || busy" @tap="exportData">复制本产品数据导出</button><button :disabled="!profile || demoMode || busy" @tap="deleteProfile">删除本产品档案</button></view>
</view>
<view v-if="tab==='share'"><view class="panel"><text class="key">① 用户告警</text><text selectable>{{alertDraft}}</text><button :disabled="!event" @tap="copy(alertDraft)">复制告警（未发送）</button></view><view class="panel"><text class="key">② 独立传播稿</text><text selectable>{{socialDraft}}</text><button :disabled="!event" @tap="copy(socialDraft)">复制传播稿（未发布）</button></view><button @tap="tab='events'">返回动态</button></view>
<text class="footnote">{{lastLoaded?'最近成功读取：北京时间 '+beijing(lastLoaded):'尚未连接真实数据源'}}{{stale?' · 数据可能陈旧':''}}</text><text class="footnote">{{clockNote}}</text>
<view class="bottom-tabs"><button v-for="item in tabs" :key="item.id" :class="{chosen:tab===item.id || (isMini && tab==='reminders' && item.id==='mine')}" @tap="changeTab(item.id)"><text class="tab-icon">{{item.icon}}</text><text>{{item.label}}</text></button></view>
</view>
</template>

<script>
import {getEvents,apiOrigin,normalizeOrigin} from "../../common/api.js";
import {product,setSession,clearSession,clientSession} from "../../common/product.js";
import {nativeVault} from "../../common/secure-vault.js";
import {authorizePush,startPushListening,forgetPushConsent,flushReceipts} from "../../common/push.js";
import {emptyPersonal,validatePersonal,deliveryLabel,clockStatus} from "../../common/product-core.js";
import {validateCatalog,beijing,pacific,eventState,defaultPostIndex,metrics,actionText,copyDraft,demoCatalog,instant,duration,TYPE_LABELS} from "../../common/reset-core.js";
const clone=x=>JSON.parse(JSON.stringify(x));
const id=()=>Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,12);
const modal=options=>new Promise(resolve=>uni.showModal({...options,success:resolve,fail:()=>resolve({confirm:false})}));
export default{
 data(){let info={};try{info=uni.getSystemInfoSync();}catch{}return{
  isMini:info.uniPlatform==="mp-weixin",systemDark:info.theme==="dark",tab:"events",search:"",historyType:"",theme:"system",
  themeOptions:[{id:"system",label:"跟随系统"},{id:"light",label:"浅色"},{id:"dark",label:"深色"}],
  roleLabels:{owner:"所有者",editor:"编辑者",viewer:"查看者"},
  historyTypes:[{id:"",label:"全部类型"},{id:"global",label:"Global Reset"},{id:"banked",label:"Banked Reset"},{id:"quota_correction",label:"定向补偿"}],
  events:[],eventIndex:0,postIndex:0,demoMode:false,message:"先阅读公开消息，再决定是否订阅。",clock:Date.now(),skew:0,lastLoaded:null,nextOffset:null,originInput:"",busy:false,clockNote:"设备时钟尚未校准。",
  vault:{available:false,backend:"unsupported",remembered:false,lastError:null},profile:null,preferences:emptyPersonal().preferences,profileName:"我的设备",recoveryInput:"",recoveryCode:"",taskTitle:"",teams:[],teamName:"",inviteInput:"",teamTaskTitle:"",caps:null,devices:[],deliveries:[]
 };},
 computed:{
  tabs(){return[{id:"events",label:"动态",icon:"◷"},{id:"history",label:"历史",icon:"▤"},...(!this.isMini?[{id:"reminders",label:"提醒",icon:"◎"}]:[]),{id:"mine",label:"我的",icon:"○"}];},
  dark(){return this.theme==="dark"||(this.theme==="system"&&this.systemDark);},
  event(){return this.events[this.eventIndex]||null;},post(){return this.event?.posts[this.postIndex]||null;},
  state(){return this.event?eventState(this.event,this.clock):{code:"unknown",label:"未知",done:null};},
  time(){return this.event?metrics(this.event,this.post,this.clock):{};},typeLabels(){return TYPE_LABELS;},
  visibleEvents(){const q=this.search.trim().toLowerCase();return this.events.filter(e=>!q||(e.title+" "+e.posts.map(p=>p.original+" "+(p.translation||"")).join(" ")).toLowerCase().includes(q));},
  historyEvents(){return this.events.filter(e=>!this.historyType||e.type===this.historyType);},
  isBookmarked(){return this.profile?.data.bookmarks.includes(this.event?.id);},
  headline(){if(this.state.done)return "官方确认完成：北京时间 "+beijing(this.state.done.publishedAt,false);return "重置最晚时间："+(this.event?.deadline?"北京时间 "+beijing(this.event.deadline.at,false):"未知");},
  deadlineNote(){if(this.state.done)return "本轮已确认完成；查看旧预告不会回滚状态。";const d=this.event?.deadline;return d?`（${d.basis==="explicit"?"明确时间窗口":d.basis+" 换算"}，${d.kind==="execution_time"?"官方明确执行时刻":"参考最晚截止，可能提前"}）`:"没有可信截止，不生成虚假倒计时。";},
  alertDraft(){return this.event?copyDraft(this.event,this.clock):"先选择事件。";},socialDraft(){return this.event?copyDraft(this.event,this.clock,true):"先选择事件。";},
  stale(){return this.lastLoaded&&this.clock-this.lastLoaded>120000;},
  vaultText(){if(!this.vault.available)return "当前平台仅支持本次内存连接（小程序 / Web）。";if(this.vault.lastError)return "安全存储操作未确认成功，请解锁后重试；不使用明文备用。";const names={"android-keystore":"Android Keystore","ios-keychain":"iOS Keychain","harmony-asset":"鸿蒙关键资产存储"};return(this.vault.remembered?"已安全保存，下次前台打开可恢复连接：":"仅本次连接；可主动启用：")+names[this.vault.backend];},
  capabilityText(){return this.caps?`服务端发送：${this.caps.sendEnabled?'开启':'关闭'}；${this.isMini?'微信':'原生'}配置：${(this.isMini?this.caps.wechat:this.caps.nativePush)?'已配置，送达另行验证':'未配置'}`:"渠道状态未知。";}
 },
 onLoad(options){clientSession.install(nativeVault());this.updateVault();this._requestedEvent=options?.event||null;try{this.originInput=apiOrigin();this.theme=uni.getStorageSync("resetwatch.theme")||"system";}catch{}},
 onShow(){this._visible=true;this.startTimers();if(!this.demoMode)this.refresh(false);this.resumeConnection();startPushListening();},
 onHide(){this.stopTimers();clientSession.invalidatePending();this.clearSecretInputs();},onUnload(){this.stopTimers();clientSession.invalidatePending();this.clearSecretInputs();},
 onPullDownRefresh(){this.refresh(false).finally(()=>uni.stopPullDownRefresh());},
 methods:{
  beijing,pacific,eventState,actionText,deliveryLabel,
  updateVault(){this.vault=clientSession.snapshot();},
  clearSecretInputs(){this.recoveryCode="";this.recoveryInput="";this.inviteInput="";},
  async resumeConnection(){if(this.demoMode)return;try{await clientSession.restore();if(this._visible&&!this.demoMode)await this.loadProfileSilently();}catch(e){if(this._visible)this.toast(e.message);}finally{this.updateVault();}},
  rememberConnection(){return this.work(async()=>{this.live();const choice=await modal({title:"安全保存连接",content:"将此服务的连接凭据保存到系统安全存储，不同步到其他设备。你可随时清除。\n"+apiOrigin()});if(!choice.confirm||!this._visible)return;try{if(await clientSession.remember(true))this.toast("已安全保存到此设备。");}finally{this.updateVault();}});},
  forgetSavedConnection(){return this.work(async()=>{this.live();try{await clientSession.forget({disconnect:false});this.toast("已清除本机保存；当前内存连接保留。");}finally{this.updateVault();}});},
  toast(text){this.message=text;uni.showToast({title:text.slice(0,45),icon:"none",duration:3000});},
  async work(fn){if(this.busy)return;this.busy=true;try{await fn();}catch(e){this.toast(e.message||"操作未完成。");}finally{this.busy=false;}},
  live(){if(this.demoMode)throw Error("演示模式禁止写入服务端。");},
  startTimers(){this.stopTimers();this._visible=true;this._tick=setInterval(()=>{this.clock=Date.now()+this.skew;},1000);this._poll=setInterval(()=>{if(!this.demoMode&&!this.busy)this.refresh(false);},60000);},
  stopTimers(){this._visible=false;this._generation=(this._generation||0)+1;clearInterval(this._tick);clearInterval(this._poll);this._request?.abort();},
  async refresh(append=false){
   if(this.busy)return;this.busy=true;const gen=(this._generation||0)+1;this._generation=gen;
   try{const before=Date.now();this._request=getEvents(append?this.nextOffset||0:0);const d=await this._request.promise;
    if(!this._visible||this._generation!==gen)return;
    const prior=this.event?.id,postId=this.post?.id,data=validateCatalog({schemaVersion:d.schemaVersion,events:d.events});
    this.events=append?[...this.events,...data.events.filter(e=>!this.events.some(v=>v.id===e.id))]:data.events;
    const c=clockStatus(d.serverTime,before,Date.now(),Date.now());this.skew=c.skew;this.clock=Date.now()+this.skew;
    this.clockNote=c.calibrated?(c.skewWarning?"服务端已校准；设备时钟偏差超过 1 分钟。":"已按服务端时间校准。"):"设备时钟未经校准。";
    this.demoMode=false;this.lastLoaded=this.clock;this.nextOffset=d.nextOffset;this.eventIndex=Math.max(0,this.events.findIndex(e=>e.id===(this._requestedEvent||prior)));
    this._requestedEvent=null;const pi=this.event?.posts.findIndex(p=>p.id===postId)??-1;this.postIndex=pi>=0?pi:this.event?defaultPostIndex(this.event,this.clock):0;
    this.message=`已加载 ${this.events.length}/${d.total} 个事件；原帖证据和个人到账单独核验。`;
   }catch(e){if(this._visible&&this._generation===gen)this.message=e.message+"；不代表没有新 Reset。";}finally{this.busy=false;}
  },
  startDemo(){this._generation=(this._generation||0)+1;this._request?.abort();this.demoMode=true;this.skew=0;this.clock=Date.now();this.events=demoCatalog(this.clock).events;this.eventIndex=0;this.postIndex=defaultPostIndex(this.event,this.clock);this.nextOffset=null;this.lastLoaded=null;this.tab="events";this.message="演示数据，不是官方消息；禁止保存、通知或发布。";},
  chooseEvent(ev){const e=this.visibleEvents[Number(ev.detail.value)];if(e)this.selectById(e.id);},
  filterEvents(){if(this.visibleEvents.length&&!this.visibleEvents.some(e=>e.id===this.event?.id))this.selectById(this.visibleEvents[0].id);},
  selectById(value){const i=this.events.findIndex(e=>e.id===value);if(i<0){this.toast("事件尚未加载，请刷新或加载更多。");return;}this.eventIndex=i;this.postIndex=defaultPostIndex(this.event,this.clock);this.tab="events";},
  go(n){if(this.event&&n>=0&&n<this.event.posts.length)this.postIndex=n;},
  touchStart(e){if(e.touches.length===1)this._touch={x:e.touches[0].clientX,y:e.touches[0].clientY};},
  touchEnd(e){const t=this._touch;this._touch=null;if(!t||!e.changedTouches.length)return;const dx=e.changedTouches[0].clientX-t.x,dy=e.changedTouches[0].clientY-t.y;if(Math.abs(dx)>55&&Math.abs(dx)>Math.abs(dy)*1.5)this.go(this.postIndex+(dx<0?1:-1));},
  confirmDuration(e){const d=eventState(e,this.clock).done;return d?duration(instant(d.publishedAt)-instant(e.posts[0].publishedAt)):"未知";},
  copy(value){uni.setClipboardData({data:String(value),success:()=>this.toast("已复制；未发送或发布。"),fail:()=>this.toast("复制失败，请手动选择文本。")});},
  async loadProfileSilently(){try{this.caps=await product("capabilities");if(!clientSession.snapshot().connected)return;const d=await product("profile");this.applyProfile(d.profile);await flushReceipts();}catch(e){if(e.status===401){await clientSession.forget();this.applyProfile(null);this.updateVault();}else this.message="档案服务未就绪："+e.message;}},
  applyProfile(p){this.profile=p;this.preferences=clone(p?.data.preferences||emptyPersonal().preferences);if(p)this.theme=p.data.preferences.theme;},
  reloadProfile(){return this.work(async()=>{this.applyProfile((await product("profile")).profile);this.toast("已重新读取服务端档案。");});},
  createProfile(){return this.work(async()=>{this.live();const ok=await modal({title:"创建独立档案",content:"仅在 ResetWatch 保存提醒偏好、收藏和任务。不需要 OpenAI 登录。是否同意？"});if(!ok.confirm)return;await clientSession.forget();const d=await product("",{action:"profile.create",name:this.profileName,consent:true});setSession(d.token);this.updateVault();this.applyProfile(d.profile);this.recoveryCode=d.token;this.toast("已创建，恢复码请私下保存。");});},
  connectProfile(){return this.work(async()=>{this.live();const token=this.recoveryInput.trim();this.recoveryInput="";await clientSession.forget();setSession(token);this.updateVault();try{this.applyProfile((await product("profile")).profile);this.recoveryInput="";await flushReceipts();this.toast("档案已连接。");}catch(e){clearSession();throw e;}finally{this.updateVault();}});},
  async saveData(data){this.live();if(!this.profile)throw Error("请先连接设备档案。");const d=await product("",{action:"profile.save",expectedVersion:this.profile.version,data:validatePersonal(data)});this.applyProfile(d.profile);this.toast("已保存到服务端。");},
  savePreferences(){return this.work(async()=>{const d=clone(this.profile.data);d.preferences=clone(this.preferences);d.preferences.theme=this.theme;await this.saveData(d);});},
  changeTheme(e){this.theme=this.themeOptions[Number(e.detail.value)].id;uni.setStorageSync("resetwatch.theme",this.theme);},
  bookmarkCurrent(){return this.work(async()=>{const d=clone(this.profile.data),eid=this.event.id;d.bookmarks=d.bookmarks.includes(eid)?d.bookmarks.filter(x=>x!==eid):[...d.bookmarks,eid];await this.saveData(d);});},
  addTask(){return this.work(async()=>{const d=clone(this.profile.data);d.tasks.push({id:id(),title:this.taskTitle.trim(),done:false,priority:"high",createdAt:new Date().toISOString(),eventId:null});await this.saveData(d);this.taskTitle="";});},
  toggleTask(tid){return this.work(async()=>{const d=clone(this.profile.data),t=d.tasks.find(t=>t.id===tid);t.done=!t.done;await this.saveData(d);});},
  removeTask(tid){return this.work(async()=>{const d=clone(this.profile.data);d.tasks=d.tasks.filter(t=>t.id!==tid);await this.saveData(d);});},
  async loadDeliveries(){try{if(!this.profile){this.toast("请先连接档案。");return;}const [d,v]=await Promise.all([product("deliveries"),product("devices")]);this.deliveries=d.deliveries;this.devices=v.devices;}catch(e){this.toast(e.message);}},
  registerPush(){return this.work(async()=>{this.live();const r=await authorizePush(this.caps,this.isMini);if(!r.cancelled)this.toast(r.note);await this.loadDeliveries();});},
  revoke(deviceId){return this.work(async()=>{this.live();const ok=await modal({title:"撤销授权",content:"停止此设备后续推送；无法撤回已经发出的消息。"});if(!ok.confirm)return;await product("",{action:"device.revoke",id:deviceId});forgetPushConsent();await this.loadDeliveries();this.toast("授权已撤销。");});},
  ack(deliveryId){return this.work(async()=>{this.live();await product("",{action:"delivery.ack",id:deliveryId,stage:"opened"});await this.loadDeliveries();});},
  changeTab(tab){this.tab=tab;if(tab==="reminders")this.loadDeliveries();if(tab==="mine"&&this.profile)this.loadTeams();},
  async loadTeams(){try{if(!this.profile)return;this.teams=(await product("workspaces")).workspaces;}catch(e){this.toast(e.message);}},
  createTeam(){return this.work(async()=>{this.live();await product("",{action:"workspace.create",name:this.teamName});await this.loadTeams();this.teamName="";});},
  joinTeam(){return this.work(async()=>{this.live();await product("",{action:"workspace.join",invite:this.inviteInput.trim()});this.inviteInput="";await this.loadTeams();});},
  async saveTeam(w,data){this.live();if(w.role==="viewer")throw Error("查看者没有修改权限。");await product("",{action:"workspace.save",id:w.id,expectedVersion:w.version,data:validatePersonal(data)});await this.loadTeams();},
  addTeamTask(wid){return this.work(async()=>{const w=this.teams.find(w=>w.id===wid),d=clone(w.data);d.tasks.push({id:id(),title:this.teamTaskTitle.trim(),priority:"normal",done:false,createdAt:new Date().toISOString(),eventId:null});await this.saveTeam(w,d);this.teamTaskTitle="";});},
  toggleTeamTask(wid,tid){return this.work(async()=>{const w=this.teams.find(w=>w.id===wid),d=clone(w.data),t=d.tasks.find(t=>t.id===tid);t.done=!t.done;await this.saveTeam(w,d);});},
  inviteViewer(wid){return this.work(async()=>{this.live();const r=await product("",{action:"workspace.invite",id:wid,role:"viewer"});this.recoveryCode=r.invite;this.toast("单次查看邀请已生成，24 小时有效，请私下复制发送。");});},
  saveOrigin(){return this.work(async()=>{const value=normalizeOrigin(this.originInput);const ok=await modal({title:"确认服务地址",content:"仅连接你信任的 ResetWatch 服务。切换会断开旧档案。\\n"+value});if(!ok.confirm)return;forgetPushConsent();try{await clientSession.forget();}finally{this.applyProfile(null);this.teams=[];this.devices=[];this.deliveries=[];this.clearSecretInputs();this.updateVault();}uni.setStorageSync("resetwatch.apiOrigin",value);this.demoMode=false;this.toast("域名已保存，请刷新事件并重新连接档案。");});},
  copySubscription(){try{this.copy(apiOrigin()+"/subscribe");}catch(e){this.toast(e.message);}},
  logout(){return this.work(async()=>{this.live();let serverError=null;try{await product("",{action:"profile.logout"});}catch(e){serverError=e;}try{forgetPushConsent();await clientSession.forget();}finally{this.applyProfile(null);this.clearSecretInputs();this.deliveries=[];this.devices=[];this.teams=[];this.updateVault();}if(serverError)this.toast("本机已断开；服务端退出未确认，请网络恢复后核对。");});},
  exportData(){return this.work(async()=>{this.live();this.copy(JSON.stringify(await product("export"),null,2));});},
  deleteProfile(){return this.work(async()=>{this.live();const ok=await modal({title:"永久删除本产品档案",content:"将删除本产品偏好和任务，不影响 OpenAI 账户。此操作不可撤销。"});if(!ok.confirm)return;await product("",{action:"profile.delete",confirmation:"DELETE"});forgetPushConsent();try{await clientSession.forget();}finally{this.applyProfile(null);this.teams=[];this.deliveries=[];this.devices=[];this.clearSecretInputs();this.updateVault();}this.toast("本产品档案已删除。");});}
 }
};
</script>

<style>
.page{--bg:#f2f5f3;--surface:#fff;--text:#182d29;--muted:#576d66;--line:#d7e2dd;--brand:#14624d;--soft:#e9f3ee;background:var(--bg);color:var(--text);padding:32rpx 24rpx calc(150rpx + env(safe-area-inset-bottom));min-height:100vh;box-sizing:border-box}
.theme-dark{--bg:#10201c;--surface:#192d27;--text:#e7f0eb;--muted:#b1c5bd;--line:#3a5349;--brand:#91d6b8;--soft:#233f33}
text{display:block;overflow-wrap:anywhere}.heading{display:flex;justify-content:space-between;gap:20rpx;align-items:center;padding:16rpx 0 26rpx}.brand{font-size:42rpx;font-weight:800}.sub,.footnote,.muted,.note{font-size:24rpx;line-height:1.6;color:var(--muted)}.hero{font-size:40rpx;line-height:1.45;font-weight:700;margin:16rpx 0}
.notice{padding:22rpx;background:var(--soft);border-radius:22rpx;margin:20rpx 0;line-height:1.6;font-size:26rpx}.badge{background:var(--soft);color:var(--brand);padding:10rpx 16rpx;border-radius:14rpx;font-size:23rpx}.eyebrow{font-size:22rpx;color:var(--brand);letter-spacing:2rpx;margin-bottom:16rpx}
.toolbar,.row,.setting,.searchbar{display:flex;gap:16rpx;align-items:center;flex-wrap:wrap}.toolbar{margin:20rpx 0}.toolbar picker,.grow,.searchbar input{flex:1;min-width:0}.picker{background:var(--surface);padding:22rpx;border:1px solid var(--line);border-radius:18rpx;font-size:26rpx}.searchbar{margin:20rpx 0}.setting{justify-content:space-between;padding:18rpx 0;border-bottom:1px solid var(--line)}.setting>text{flex:1}
.tweet,.panel{background:var(--surface);border:1px solid var(--line);border-radius:30rpx;padding:28rpx;margin:24rpx 0}.tweet-head{display:flex;gap:20rpx}.avatar{display:flex;align-items:center;justify-content:center;background:var(--soft);width:78rpx;height:78rpx;border-radius:50%;font-weight:700;flex-shrink:0;font-size:26rpx}.author{flex:1;min-width:0}.author text{font-size:23rpx;line-height:1.7;color:var(--muted)}.author .name{font-size:30rpx;color:var(--text);font-weight:700}.x{font-size:44rpx}
.state-row{display:flex;align-items:center;gap:16rpx;flex-wrap:wrap;margin:22rpx 0;font-size:23rpx;color:var(--muted)}
.column-scroll{white-space:nowrap;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
.cols{display:flex;width:1330rpx;white-space:normal;padding:28rpx 0}.col{width:410rpx;padding:0 22rpx;box-sizing:border-box;flex:none}.col:first-child{width:480rpx;padding-left:0}.col+.col{border-left:1px solid var(--line)}.label{font-size:24rpx;color:var(--muted);margin:16rpx 0}.key{font-size:30rpx;font-weight:700;line-height:1.6;margin-bottom:16rpx}.col .key{color:var(--brand)}.body{font-size:28rpx;line-height:1.7;margin-top:18rpx}.english{word-break:normal}
.clock-heading{font-size:27rpx;font-weight:600;margin:26rpx 0}.clock-heading text{font-size:22rpx;font-weight:400;color:var(--muted)}.metrics>view{background:var(--bg);border:1px solid var(--line);border-radius:22rpx;padding:22rpx;margin:14rpx 0}.metrics text{font-size:23rpx;color:var(--muted)}.metrics .value{font-size:32rpx;color:var(--text);font-weight:700;margin:12rpx 0;font-variant-numeric:tabular-nums}.action{background:var(--soft);padding:24rpx;border-radius:20rpx;font-size:27rpx;line-height:1.7;margin:22rpx 0}
.pager{display:flex;justify-content:space-between;align-items:center;gap:12rpx}.pager>view{text-align:center;font-size:24rpx}.dots{display:flex;justify-content:center;flex-wrap:wrap}.dots button{position:relative;min-width:72rpx;min-height:72rpx;background:transparent;padding:0;margin:0}.dots button:after{content:"";position:absolute;width:12rpx;height:12rpx;left:30rpx;top:30rpx;border:0;background:var(--line);border-radius:8rpx}.dots button.on:after{background:var(--brand);width:32rpx;left:20rpx}
button{background:var(--surface);color:var(--text);border-radius:18rpx;font-size:26rpx;line-height:1.5;min-height:88rpx;padding:20rpx 24rpx;margin:12rpx 0;box-sizing:border-box}button:after{border-color:var(--line);border-radius:18rpx}button[disabled]{opacity:.45;color:var(--muted)}input{min-height:88rpx;border:1px solid var(--line);border-radius:18rpx;padding:10rpx 20rpx;background:var(--bg);font-size:28rpx;box-sizing:border-box;margin:16rpx 0;color:var(--text)}
.panel>text{line-height:1.7;margin:12rpx 0;font-size:27rpx}.check{display:inline-flex;align-items:center;font-size:26rpx;min-height:88rpx;margin-right:20rpx}.receipt{padding:22rpx 0;border-top:1px solid var(--line);margin-top:16rpx;font-size:26rpx;line-height:1.7}.done{text-decoration:line-through;color:var(--muted)}.secret{background:var(--soft);padding:22rpx;border-radius:20rpx}.footnote{margin:20rpx 0}.empty{padding:36rpx;line-height:1.7;background:var(--surface);border-radius:24rpx}
.bottom-tabs{position:fixed;bottom:0;left:0;right:0;display:flex;background:var(--surface);border-top:1px solid var(--line);padding:8rpx 16rpx calc(8rpx + env(safe-area-inset-bottom));z-index:20}.bottom-tabs button{flex:1;padding:10rpx 0;margin:0;min-height:96rpx;background:transparent;font-size:24rpx;border-radius:20rpx}.bottom-tabs button:after{border:0}.bottom-tabs .chosen{background:var(--soft);color:var(--brand);font-weight:700}.tab-icon{font-size:32rpx;margin-bottom:4rpx}
@media(min-width:700px){.page{max-width:1000px;margin:auto}.bottom-tabs{max-width:1000px;margin:auto}.cols{width:100%}.col,.col:first-child{flex:1;width:auto}.metrics{display:flex;gap:12rpx}.metrics>view{flex:1;min-width:0}}
</style>
