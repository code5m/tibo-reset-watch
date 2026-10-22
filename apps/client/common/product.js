import {apiOrigin} from "./api.js";
import {createSession} from "./session-state.js";

export const clientSession = createSession(apiOrigin, {
  isBlocked(origin) {return uni.getStorageSync("resetwatch.vaultConsent." + origin) !== true;},
  setBlocked(origin, blocked) {
    // A public boolean only. Never store the token in this store.
    if (blocked) uni.removeStorageSync("resetwatch.vaultConsent." + origin);
    else uni.setStorageSync("resetwatch.vaultConsent." + origin, true);
  }
});
export function setSession(value) {clientSession.set(value);}
export function clearSession() {clientSession.clear();}
export function productRequest(view = "", body = null) {
  const origin = apiOrigin(), authorization = clientSession.authorization(origin);
  const generation = clientSession.snapshot().epoch;
  const url = origin + "/api/v1/product" + (view ? "?view=" + encodeURIComponent(view) : "");
  let task, cancel;
  const promise = new Promise((resolve, reject) => {
    let finished = false;
    const fail = error => {if (!finished) {finished = true; reject(error);}};
    const aborted = () => Object.assign(new Error("\u8fde\u63a5\u5df2\u53d8\u5316\uff0c\u5df2\u4e22\u5f03\u65e7\u8bf7\u6c42\u7ed3\u679c\u3002"), {code:"session_changed"});
    cancel = () => {fail(aborted()); task?.abort();};
    task = uni.request({url, method:body ? "POST" : "GET", data:body || undefined, timeout:15000, withCredentials:true,
      header:{...(body ? {"Content-Type":"application/json"} : {}), ...(authorization ? {Authorization:authorization} : {})},
      success(r) {
        if (finished) return;
        let same = false;
        try {same = origin === apiOrigin() && generation === clientSession.snapshot().epoch;} catch {}
        if (!same) {fail(aborted()); return;}
        if (r.statusCode >= 200 && r.statusCode < 300) {finished = true; resolve(r.data); return;}
        const e = Error(r.data?.message || "\u4ea7\u54c1\u670d\u52a1\u4e0d\u53ef\u7528\uff0c\u672a\u786e\u8ba4\u4fdd\u5b58\u6210\u529f\u3002");
        e.status = r.statusCode; fail(e);
      },
      fail() {fail(Error("\u7f51\u7edc\u8bf7\u6c42\u5931\u8d25\uff0c\u4e0d\u80fd\u89c6\u4e3a\u4fdd\u5b58\u6210\u529f\u3002"));}
    });
  });
  return {promise, abort:() => cancel?.()};
}
export async function product(view = "", body = null) {return productRequest(view, body).promise;}
