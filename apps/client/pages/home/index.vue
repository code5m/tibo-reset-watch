<template>
<view class="page">
 <view class="heading"><view><text class="brand">ResetWatch</text><text class="sub">统一来源 · 北京时间 · 提前行动</text></view><text class="badge">{{ demoMode ? '演示数据' : '公开事件' }}</text></view>
 <view class="tabs"><button v-for="item in tabs" :key="item.id" :class="{chosen:tab===item.id}" @tap="tab=item.id">{{item.label}}</button></view>
 <view class="notice">{{message}}</view>
 <view v-if="tab==='events'">
  <view class="toolbar"><picker v-if="events.length" :range="events" range-key="title" :value="eventIndex" @change="chooseEvent"><view class="picker">{{event.title}} ▾</view></picker><button @tap="refresh(false)">刷新</button></view>
  <view v-if="!event" class="empty"><text>暂无可展示事件。服务端未连接或原帖尚待校对。</text><button @tap="startDemo">查看交互演示（非真实公告）</button></view>
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
  <view v-if="event" class="pager"><button :disabled="postIndex===0" @tap="go(postIndex-1)">← 上一条</button><view><text>第 {{postIndex+1}} / {{event.posts.length}} 条</text><view class="dots"><button v-for="(p,i) in event.posts" :key="p.id" :class="{on:i===postIndex}" @tap="go(i)" :aria-label="'第'+(i+1)+'条'"></button></view></view><button :disabled="postIndex===event.posts.length-1" @tap="go(postIndex+1)">下一条 →</button></view>
  <button v-if="nextOffset!==null && !demoMode" @tap="refresh(true)">加载更多事件</button>
  <text class="footnote">顶部滑动翻页，正文横向阅读，手势互不干扰。</text>
 </view>
 <view v-if="tab==='history'">
  <view v-for="e in events" :key="e.id" class="panel"><text class="key">{{e.title}}</text><text>{{typeLabels[e.type]}} · {{eventState(e,clock).label}}</text><text>首次公告：{{beijing(e.posts[0].publishedAt,false)}}</text><text>参考截止：{{beijing(e.deadline && e.deadline.at,false)}}</text><text>官方确认：{{beijing(eventState(e,clock).done && eventState(e,clock).done.publishedAt,false)}}</text><text>公告到确认：{{confirmDuration(e)}}</text><text>个人到账：未知，不能使用官方发帖时刻替代。</text></view>
  <view v-if="!events.length" class="empty">暂无历史数据。</view>
 </view>
 <view v-if="tab==='studio'">
  <view class="panel"><text class="key">① 用户告警</text><textarea :value="alertDraft" auto-height disabled/><button :disabled="!event" @tap="copy(alertDraft)">复制告警 · 未发送</button></view>
  <view class="panel"><text class="key">② 独立传播草稿</text><textarea :value="socialDraft" auto-height disabled/><button :disabled="!event" @tap="copy(socialDraft)">复制传播稿 · 未发布</button></view>
 </view>
 <view v-if="tab==='settings'">
  <view class="panel"><text class="key">连接你的 ResetWatch 服务</text><text>所有客户端连接同一 HTTPS 后端，不在手机内各自抓取 X。</text><input v-model="originInput" placeholder="https://你的服务域名" type="text"/><button @tap="saveOrigin">保存域名并连接</button><button @tap="startDemo">查看演示（不发送通知）</button></view>
  <view class="panel"><text class="key">通知接入状态</text><text>系统推送：尚未接通与真机验证。</text><text>微信订阅消息：尚未配置模板及授权链路。</text><text>原有网站订阅：可复制入口，在浏览器完成。</text><button @tap="copySubscription">复制网站订阅入口</button><text>本页面不把权限申请成功或前台倒计时当作“告警已送达”。</text></view>
  <view class="panel"><text class="key">隐私与数据</text><text>浏览公开事件不需要登录。只在本机保存你设置的公开服务域名；不读取 OpenAI 登录凭证或个人额度。</text><button @tap="clearLocal">清除本机设置</button></view>
 </view>
 <text class="footnote">{{lastLoaded ? '最近读取：北京时间 '+beijing(lastLoaded) : '尚未连接真实数据源'}}{{stale ? ' · 数据可能陈旧' : ''}}</text>
</view>
</template>
<script>
import {getEvents,apiOrigin,normalizeOrigin} from "../../common/api.js";
import {validateCatalog,beijing,pacific,eventState,defaultPostIndex,metrics,actionText,copyDraft,demoCatalog,instant,duration,TYPE_LABELS} from "../../common/reset-core.js";
export default {
 data(){return{tab:"events",tabs:[{id:"events",label:"事件"},{id:"history",label:"历史"},{id:"studio",label:"文案"},{id:"settings",label:"设置"}],events:[],eventIndex:0,postIndex:0,demoMode:false,message:"请先在设置填写已部署的服务域名，或查看明确标注的演示。",clock:Date.now(),skew:0,lastLoaded:null,nextOffset:null,originInput:"",busy:false};},
 computed:{
  event(){return this.events[this.eventIndex]||null;},
  post(){return this.event?.posts[this.postIndex]||null;},
  state(){return this.event?eventState(this.event,this.clock):{code:"unknown",label:"未知",done:null};},
  time(){return this.event?metrics(this.event,this.post,this.clock):{};},
  typeLabels(){return TYPE_LABELS;},
  headline(){if(this.state.done)return "官方确认完成：北京时间 "+beijing(this.state.done.publishedAt,false);return "重置最晚时间："+(this.event?.deadline?"北京时间 "+beijing(this.event.deadline.at,false):"未知");},
  deadlineNote(){if(this.state.done)return "本轮已确认完成；查看旧帖不会把事件退回到未完成。";const d=this.event?.deadline;return d?`（${d.basis==="explicit"?"明确时间窗口":d.basis+" 换算"}，${d.kind==="execution_time"?"官方明确执行时刻":"参考最晚截止，可能提前"}）`:"没有可信截止，不能计算倒计时。";},
  alertDraft(){return this.event?copyDraft(this.event,this.clock):"先选择事件。";},
  socialDraft(){return this.event?copyDraft(this.event,this.clock,true):"先选择事件。";},
  stale(){return this.lastLoaded && this.clock-this.lastLoaded>120000;}
 },
 onShow(){this._visible=true;this.startTimers();if(!this.demoMode)this.refresh(false);},
 onHide(){this.stopTimers();},onUnload(){this.stopTimers();},
 onPullDownRefresh(){this.refresh(false).finally(()=>uni.stopPullDownRefresh());},
 methods:{
  beijing,pacific,eventState,actionText,
  startTimers(){clearInterval(this._tick);clearInterval(this._poll);this._tick=setInterval(()=>{this.clock=Date.now()+this.skew;},1000);this._poll=setInterval(()=>{if(!this.demoMode)this.refresh(false);},60000);},
  stopTimers(){this._visible=false;clearInterval(this._tick);clearInterval(this._poll);this._request?.abort();},
  async refresh(append){
   if(this.busy)return;this.busy=true;const generation=(this._generation||0)+1;this._generation=generation;
   try{
    this._request=getEvents(append?this.nextOffset||0:0);const data=await this._request.promise;
    if(!this._visible||this._generation!==generation)return;
    const priorEvent=this.event?.id,priorPost=this.post?.id;
    const parsed=validateCatalog({schemaVersion:data.schemaVersion,events:data.events});
    this.events=append?[...this.events,...parsed.events.filter(e=>!this.events.some(v=>v.id===e.id))]:parsed.events;
    this.demoMode=false;this.skew=instant(data.serverTime)!==null?instant(data.serverTime)-Date.now():0;this.clock=Date.now()+this.skew;
    this.lastLoaded=this.clock;this.nextOffset=data.nextOffset;this.eventIndex=Math.max(0,this.events.findIndex(e=>e.id===priorEvent));
    const previousPost=this.event?.posts.findIndex(p=>p.id===priorPost)??-1;
    this.postIndex=previousPost>=0?previousPost:this.event?defaultPostIndex(this.event,this.clock):0;
    this.message=`已读取 ${this.events.length} / ${data.total} 个事件；${data.pendingReviewCount||0} 条信号待校对。`;
   }catch(e){if(this._visible&&this._generation===generation)this.message=e.message||"读取失败，当前 Reset 状态未知。";}
   finally{this.busy=false;}
  },
  startDemo(){this._generation=(this._generation||0)+1;this._request?.abort();this.skew=0;this.clock=Date.now();this.events=demoCatalog(this.clock).events;this.eventIndex=0;this.postIndex=1;this.demoMode=true;this.nextOffset=null;this.lastLoaded=null;this.message="交互演示，非真实 Tibo 推文；不会发出通知。";this.tab="events";},
  chooseEvent(e){this.eventIndex=Number(e.detail.value);this.postIndex=defaultPostIndex(this.event,this.clock);},
  go(i){if(this.event&&i>=0&&i<this.event.posts.length)this.postIndex=i;},
  touchStart(e){if(e.touches.length===1)this._touch={x:e.touches[0].clientX,y:e.touches[0].clientY};},
  touchEnd(e){if(!this._touch)return;const p=e.changedTouches[0],dx=p.clientX-this._touch.x,dy=p.clientY-this._touch.y;this._touch=null;if(Math.abs(dx)>55&&Math.abs(dx)>1.5*Math.abs(dy))this.go(this.postIndex+(dx<0?1:-1));},
  confirmDuration(e){const d=eventState(e,this.clock).done;return d?duration(instant(d.publishedAt)-instant(e.posts[0].publishedAt)):"未知";},
  copy(value){uni.setClipboardData({data:value,success:()=>uni.showToast({title:"已复制，未自动发布",icon:"none"}),fail:()=>uni.showToast({title:"复制失败",icon:"none"})});},
  saveOrigin(){try{const value=normalizeOrigin(this.originInput);uni.setStorageSync("resetwatch.apiOrigin",value);this.demoMode=false;this.refresh(false);}catch(e){uni.showToast({title:e.message,icon:"none"});}},
  copySubscription(){try{this.copy(apiOrigin()+"/subscribe");}catch(e){uni.showToast({title:e.message,icon:"none"});}},
  clearLocal(){uni.removeStorageSync("resetwatch.apiOrigin");this.originInput="";uni.showToast({title:"已清除本机设置",icon:"none"});}
 }
};
</script>
<style scoped>
.page{padding:30rpx 24rpx}.heading{display:flex;justify-content:space-between;align-items:center}.brand{font-size:42rpx;font-weight:800}.sub{display:block;font-size:20rpx;color:#78887e;margin-top:10rpx}.badge{display:inline-block;background:#e4eee6;color:#2c6145;padding:10rpx;border-radius:10rpx;font-size:20rpx}.tabs{display:flex;gap:8rpx;margin:28rpx 0 18rpx}.tabs button{flex:1;margin:0;background:transparent;color:#6f8075;font-size:24rpx}.tabs button.chosen{background:#214b39;color:white}.notice{padding:20rpx;background:#edf2e9;color:#5c704f;font-size:24rpx;line-height:1.8;border-radius:12rpx;margin-bottom:20rpx}.toolbar{display:flex;gap:10rpx;align-items:center;margin:20rpx 0}.toolbar picker{flex:1;min-width:0}.picker{padding:15rpx;background:white;border-radius:10rpx;font-size:24rpx;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.tweet{background:white;border:1px solid #ccd9d0;border-radius:26rpx;padding:26rpx}.tweet-head{display:flex;gap:16rpx}.avatar{width:76rpx;height:76rpx;background:#eef3ef;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:24rpx;font-weight:700;flex-shrink:0}.author{flex:1;min-width:0}.author text{display:block;font-size:19rpx;line-height:1.8;color:#78867e}.author .name{font-size:29rpx;font-weight:700;color:#182e25}.x{font-size:48rpx}.state-row{display:flex;align-items:center;gap:10rpx;font-size:18rpx;color:#859286;margin:20rpx 0}.column-scroll{border-top:1px solid #e1e8e1;border-bottom:1px solid #e1e8e1;padding:26rpx 0;box-sizing:border-box}.cols{display:flex;width:1340rpx;align-items:stretch}.col{width:440rpx;flex-shrink:0;padding:0 24rpx;box-sizing:border-box}.col:first-child{padding-left:0;width:460rpx}.col+.col{border-left:1px solid #e1e8e1}.label{display:block;font-size:21rpx;color:#829080;margin-bottom:18rpx}.key{display:block;font-size:30rpx;line-height:1.7;font-weight:700}.note{display:block;font-size:21rpx;line-height:1.8;color:#7f8b7d;margin:14rpx 0}.body{display:block;white-space:pre-wrap;font-size:27rpx;line-height:1.8;word-break:break-word}.english{font-size:29rpx}.clock-heading{font-size:23rpx;font-weight:600;margin:24rpx 0 15rpx}.clock-heading text{font-size:18rpx;color:#839084;margin-left:12rpx}.metrics>view{border:1px solid #dfe8df;border-radius:14rpx;background:#f6f9f5;padding:18rpx;margin-bottom:12rpx}.metrics text{display:block;font-size:20rpx;color:#7d897a;line-height:1.6}.metrics text.value{font-size:32rpx;font-weight:700;color:#234c36;margin:10rpx 0}.action{background:#f3f5ec;padding:20rpx;font-size:23rpx;line-height:1.8;margin:20rpx 0;border-radius:12rpx}.footnote{display:block;font-size:19rpx;color:#8d9687;line-height:1.8;margin:20rpx 0}.pager{display:flex;align-items:center;justify-content:space-between;margin:22rpx 0}.pager>view{font-size:21rpx;text-align:center}.pager button{font-size:22rpx;margin:0}.dots{display:flex;gap:8rpx;justify-content:center;margin-top:10rpx}.dots button{min-width:0;padding:0;width:28rpx;height:10rpx;border-radius:10rpx;background:#ccdaca}.dots button.on{background:#25583c}.panel{background:white;border:1px solid #dce4d8;border-radius:20rpx;padding:25rpx;margin:20rpx 0}.panel>text{display:block;line-height:1.9;font-size:25rpx}.panel .key{font-size:29rpx;margin-bottom:15rpx}.panel button{margin-top:20rpx}.panel input{padding:20rpx;background:#f5f8f2;border:1px solid #dce4d8;margin-top:20rpx;border-radius:12rpx;font-size:25rpx}.panel textarea{width:100%;font-size:25rpx;line-height:1.9;margin:20rpx 0;min-height:250rpx}.empty{padding:50rpx 20rpx;background:white;border:1px dashed #c9d8c5;border-radius:20rpx;text-align:center;font-size:25rpx;line-height:1.8}.empty button{margin-top:24rpx}
</style>
