import {vaultBackend, invokeVault} from "../uni_modules/resetwatch-secure-session";

/** Fail closed. There is deliberately no uni storage/localStorage fallback for credentials. */
export function createVaultAdapter(backend, invoke, timeoutMs = 10000) {
  function request(operation, origin, value = "") {
    return new Promise((resolve, reject) => {
      let finished = false;
      const finish = (error, result) => {
        if (finished) return;
        finished = true; clearTimeout(timer);
        error ? reject(error) : resolve(result);
      };
      const error = code => Object.assign(new Error("\u5b89\u5168\u5b58\u50a8\u64cd\u4f5c\u672a\u5b8c\u6210\uff1b\u4e0d\u4f1a\u6539\u7528\u660e\u6587\u4fdd\u5b58\u3002"), {code});
      const timer = setTimeout(() => finish(error("vault_timeout")), timeoutMs);
      try {
        invoke(operation, origin, value, raw => {
          if (finished) return;
          try {
            const result = JSON.parse(raw);
            if (result.ok !== true) {finish(error(["locked","unsupported","unreadable"].includes(result.code) ? result.code : "vault_failed")); return;}
            if (operation === "read" && typeof result.value !== "string") {finish(error("invalid_response")); return;}
            finish(null, operation === "read" ? result.value : true);
          } catch {finish(error("invalid_response"));}
        });
      } catch {finish(error("vault_failed"));}
    });
  }
  return {backend, read: origin => request("read", origin), write: (origin, value) => request("write", origin, value), remove: origin => request("remove", origin)};
}
export function nativeVault() {
  try {return createVaultAdapter(vaultBackend(), invokeVault);}
  catch {return {backend:"unsupported"};}
}
