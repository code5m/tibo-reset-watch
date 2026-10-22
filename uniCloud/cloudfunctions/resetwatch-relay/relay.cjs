'use strict';
const crypto = require('node:crypto');
const UUID = /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
const text = (value, max) => typeof value === 'string' && value.length > 0 && value.length <= max && !/[\x00-\x08]/.test(value);
const reply = (statusCode, data) => ({mpserverlessComposedResponse:true, isBase64Encoded:false,
  statusCode, headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'},body:JSON.stringify(data)});
const rejected = (status, code) => reply(status,{accepted:false,safeToRetry:false,code});
const unknown = code => reply(503,{accepted:null,safeToRetry:false,code});

/** Dependency-injected policy: a durable reservation precedes every external send. */
function createRelay({store, send, secret, enabled, now=Date.now}) {
  return async function handle(event) {
    if(event?.httpMethod !== 'POST') return rejected(405,'method_not_allowed');
    if(typeof secret !== 'string' || secret.length < 32) return rejected(503,'relay_unconfigured');
    const headers=Object.fromEntries(Object.entries(event.headers || {}).map(([k,v])=>[k.toLowerCase(),String(v)]));
    const stamp=headers['x-resetwatch-time'], signature=headers['x-resetwatch-signature'];
    if(!/^\d{13}$/.test(stamp || '') || Math.abs(now()-Number(stamp)) > 300000 || !/^[a-f0-9]{64}$/i.test(signature || ''))
      return rejected(401,'signature_invalid_or_expired');
    if(typeof event.body !== 'string' || event.body.length > 48000) return rejected(413,'request_too_large');
    const raw=event.isBase64Encoded ? Buffer.from(event.body,'base64') : Buffer.from(event.body,'utf8');
    if(raw.length > 32768) return rejected(413,'request_too_large');
    const expected=crypto.createHmac('sha256',secret).update(stamp+'.').update(raw).digest();
    if(!crypto.timingSafeEqual(expected,Buffer.from(signature,'hex'))) return rejected(401,'signature_invalid_or_expired');
    let body;
    try{body=JSON.parse(raw.toString('utf8'));}catch{return rejected(400,'invalid_json');}
    const requestId=body?.requestId || body?.deliveryId;
    if(!body || !UUID.test(body.deliveryId || '') || !UUID.test(requestId || '') || headers['idempotency-key']!==requestId ||
      !['wechat','uni-push'].includes(body.kind) || !text(body.title,600) || !text(body.body,4000) ||
      !text(body.eventId,100) || !/^[a-zA-Z0-9_-]+$/.test(body.eventId)) return rejected(400,'invalid_contract');
    // Missing destinations must NEVER turn a targeted send into a provider broadcast.
    if(!body.target || (body.kind==='uni-push' ? !text(body.target.cid,200) || typeof body.target.cid!=='string' :
      !text(body.target.openid,200) || !text(body.target.templateId,200))) return rejected(400,'target_required');
    if(!enabled) return rejected(503,'relay_sending_disabled');
    const digest=sha(raw);let claim;
    try{claim=await store.claim(requestId,digest,now());}catch{return unknown('ledger_unavailable');}
    if(!claim.fresh) {
      if(claim.hash !== digest) return rejected(409,'idempotency_payload_conflict');
      if(claim.result) return reply(claim.result.accepted===true?200:claim.result.accepted===false?422:503,{...claim.result,replayed:true});
      return unknown('previous_attempt_pending_or_unknown');
    }
    let result;
    try {
      result=await send(body);
      if(result?.accepted===true && text(result.providerId,200)) {
        result={accepted:true,providerId:result.providerId,deviceDelivery:'unknown',
          correlation:result.correlation || 'provider_task'};
      } else if(result?.accepted===false) result={accepted:false,safeToRetry:false,code:'provider_rejected'};
      else throw Error('ambiguous_provider_result');
    } catch {result={accepted:null,safeToRetry:false,code:'provider_result_unknown'};}
    try{await store.finish(requestId,result,now());}catch{return unknown('ledger_commit_unknown');}
    return result.accepted===true?reply(200,result):result.accepted===false?reply(422,result):reply(503,result);
  };
}

/** Provider adapters never log request bodies, destination identifiers or credentials. */
function createSender({cloud, env, now=Date.now}) {
  let tokenCache=null;
  async function wechatToken() {
    if(tokenCache && tokenCache.expiresAt > now()+60000)return tokenCache.value;
    if(!env.WECHAT_APP_ID || !env.WECHAT_APP_SECRET)throw Error('wechat_unconfigured');
    const r=await cloud.httpclient.request('https://api.weixin.qq.com/cgi-bin/stable_token',{
      method:'POST',contentType:'json',dataType:'json',timeout:8000,followRedirect:false,
      data:{grant_type:'client_credential',appid:env.WECHAT_APP_ID,secret:env.WECHAT_APP_SECRET,force_refresh:false}});
    const d=r.data;
    if(r.status!==200 || !text(d?.access_token,2048) || !Number.isFinite(d.expires_in))throw Error('token_failed');
    tokenCache={value:d.access_token,expiresAt:now()+Math.max(0,d.expires_in)*1000};return tokenCache.value;
  }
  return async body => {
    if(body.kind==='uni-push') {
      if(!/^__UNI__[a-zA-Z0-9]+$/.test(env.DCLOUD_APP_ID || '') || !text(body.target?.cid,200))throw Error('native_unconfigured');
      const r=await cloud.getPushManager({appId:env.DCLOUD_APP_ID}).sendMessage({
        push_clientid:body.target.cid,title:body.title,content:body.body,
        payload:{deliveryId:body.deliveryId,eventId:body.eventId},force_notification:true,
        request_id:(body.requestId||body.deliveryId).replace(/-/g,'')});
      if(r?.errCode!==0) return {accepted:false};
      const providerId=r.data && typeof r.data==='object'?Object.keys(r.data)[0]:null;
      if(!text(providerId,200)) throw Error('missing_provider_task');
      return {accepted:true,providerId,correlation:'provider_task'};
    }
    if(body.kind!=='wechat' || body.target.templateId !== env.WECHAT_TEMPLATE_ID)throw Error('template_mismatch');
    // Field identifiers and value lengths must match the developer's approved template.
    const map=JSON.parse(env.WECHAT_TEMPLATE_FIELDS || 'null');
    if(!map || typeof map!=='object' || Array.isArray(map) || Object.keys(map).length<1 || Object.keys(map).length>10)
      throw Error('template_fields_unconfigured');
    const values={title:body.title,body:body.body,
      time:new Date(now()+8*3600000).toISOString().slice(0,19).replace('T',' ')};
    const data={};
    for(const [field,spec] of Object.entries(map)) {
      if(!/^[a-z]+\d+$/.test(field) || !spec || !Object.hasOwn(values,spec.source) ||
        !Number.isInteger(spec.maxLength) || spec.maxLength<1 || spec.maxLength>200)throw Error('template_mapping_invalid');
      data[field]={value:Array.from(values[spec.source]).slice(0,spec.maxLength).join('')};
    }
    const accessToken=await wechatToken();
    const r=await cloud.httpclient.request('https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token='+encodeURIComponent(accessToken),{
      method:'POST',contentType:'json',dataType:'json',timeout:8000,followRedirect:false,
      data:{touser:body.target.openid,template_id:body.target.templateId,
        page:'pages/home/index?event='+encodeURIComponent(body.eventId),data,miniprogram_state:'formal',lang:'zh_CN'}});
    if(r.status!==200 || r.data?.errcode!==0)return {accepted:false};
    // WeChat does not supply a delivery receipt here; this ID is explicitly local correlation.
    return {accepted:true,providerId:'wechat-accepted:'+(body.requestId||body.deliveryId),correlation:'local_request_id_not_device_receipt'};
  };
}
module.exports={createRelay,createSender};
