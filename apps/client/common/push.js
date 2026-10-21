import config from "../config.json";
import {product} from "./product.js";
import {apiOrigin} from "./api.js";

let listener=null;
const storeKey=()=> "resetwatch.pushConsent."+apiOrigin();
const receiptKey=()=> "resetwatch.receipts."+apiOrigin();
const UUID=/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const call=(name,args={})=>new Promise((resolve,reject)=>{
 if(typeof uni[name]!=="function")return reject(Error("当前平台不支持此系统能力，不能视为授权成功。"));
 uni[name]({...args,success:resolve,fail:()=>reject(Error("系统操作未完成，请核对权限及平台配置。"))});
});
/** Explicit user action only. Registration and OS authorization never mean delivered. */
export async function authorizePush(caps,isMini){
 const consent=await call("showModal",{title:"启用额度提醒",content:"仅用于 ResetWatch 已核验事件提醒。设备标识将加密保存；服务商接受不等于设备送达。是否继续？"});
 if(!consent.confirm)return {cancelled:true};
 if(isMini){
  if(!config.wechatSubscriptionMessagesEnabled||!caps?.wechat||!caps.wechatTemplateId)throw Error("微信订阅消息尚未配置，不能申请授权。");
  const r=await call("requestSubscribeMessage",{tmplIds:[caps.wechatTemplateId]});
  if(r[caps.wechatTemplateId]!=="accept")throw Error("本次未同意订阅，不会登记或声称推送已开启。");
  const login=await call("login",{provider:"weixin"});
  const result=await product("",{action:"device.register",kind:"wechat",consent:true,code:login.code});
  return {...result,note:"本次订阅授权已登记；不代表无限次订阅或已经送达。"};
 }
 if(!config.nativePushEnabled||!caps?.nativePush)throw Error("系统推送尚未配置，不能登记。");
 const settings=typeof uni.getAppAuthorizeSetting==="function"?uni.getAppAuthorizeSetting():null;
 if(settings?.notificationAuthorized!=="authorized"){
  if(typeof uni.openAppAuthorizeSetting==="function")await call("openAppAuthorizeSetting");
  throw Error("请在系统设置中允许通知后再登记；当前授权未验证。");
 }
 const {cid}=await call("getPushClientId");
 const result=await product("",{action:"device.register",kind:"uni-push",consent:true,cid});
 uni.setStorageSync(storeKey(),true);startPushListening();
 return {...result,note:"推送标识已登记；等待真实回执验证送达。"};
}
export function stopPushListening(){
 if(listener&&typeof uni.offPushMessage==="function")uni.offPushMessage(listener);
 listener=null;
}
export function startPushListening(){
 let consent=false;try{consent=uni.getStorageSync(storeKey())===true;}catch{return;}
 if(!consent||listener||typeof uni.onPushMessage!=="function")return;
 listener=message=>{
  let payload=message?.data?.payload;try{if(typeof payload==="string")payload=JSON.parse(payload);}catch{return;}
  if(!UUID.test(payload?.deliveryId||""))return;
  const stage=message.type==="click"?"opened":message.type==="receive"?"received":null;if(!stage)return;
  let items=uni.getStorageSync(receiptKey())||[];if(!Array.isArray(items))items=[];
  // Store IDs only, never message bodies, recipient identities, tokens or credentials.
  if(!items.some(x=>x.id===payload.deliveryId&&x.stage===stage))items.push({id:payload.deliveryId,stage});
  uni.setStorageSync(receiptKey(),items.slice(-100));flushReceipts().catch(()=>{});
 };
 uni.onPushMessage(listener);
}
export async function flushReceipts(){
 let items=uni.getStorageSync(receiptKey())||[];if(!Array.isArray(items))return;
 for(const item of [...items]){
  try{await product("",{action:"delivery.ack",id:item.id,stage:item.stage});}
  catch(e){if(e.status!==404)break;}
  items=items.filter(x=>x.id!==item.id||x.stage!==item.stage);uni.setStorageSync(receiptKey(),items);
 }
}
export function forgetPushConsent(){
 try{uni.removeStorageSync(storeKey());uni.removeStorageSync(receiptKey());}catch{}
 stopPushListening();
}
