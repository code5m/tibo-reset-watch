import {apiOrigin} from "./api.js";
let sessionToken="";
/** Native credentials stay in memory until a platform secure-storage adapter is installed. */
export function setSession(value){if(value&&!/^rw_[a-f0-9]{64}$/.test(value))throw Error("恢复码格式不正确。");sessionToken=value||"";}
export function clearSession(){sessionToken="";}
export function productRequest(view="",body=null){
 const url=apiOrigin()+"/api/v1/product"+(view?"?view="+encodeURIComponent(view):"");
 let task;
 const promise=new Promise((resolve,reject)=>{
  task=uni.request({url,method:body?"POST":"GET",data:body||undefined,timeout:15000,withCredentials:true,
   header:{...(body?{"Content-Type":"application/json"}:{}),...(sessionToken?{Authorization:"Bearer "+sessionToken}:{})},
   success(r){if(r.statusCode>=200&&r.statusCode<300){resolve(r.data);return;}
    const e=Error(r.data?.message||"产品服务不可用，未确认保存成功。");e.status=r.statusCode;reject(e);},
   fail(){reject(Error("网络请求失败，不能视为保存成功。"));}
  });
 });
 return {promise,abort:()=>task?.abort()};
}
export async function product(view="",body=null){return productRequest(view,body).promise;}
