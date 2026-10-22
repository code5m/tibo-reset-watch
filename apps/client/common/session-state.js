/** Origin-bound credentials. This module never logs or persists plaintext secrets. */
const TOKEN = /^rw_[a-f0-9]{64}$/;
const BACKENDS = new Set(["android-keystore", "ios-keychain", "harmony-asset"]);
const failure = (code, message) => Object.assign(new Error(message), {code});

export function createSession(getOrigin, policy = {}) {
  let token = "", origin = "", epoch = 0, remembered = false;
  let vault = null, queue = Promise.resolve(), lastError = null;
  const current = () => getOrigin();
  const validOrigin = value => typeof value === "string" && /^https:\/\/[a-z0-9.-]+(?::[0-9]{1,5})?$/i.test(value);
  const supported = () => BACKENDS.has(vault?.backend);
  const serialize = fn => { const result = queue.then(fn); queue = result.catch(() => {}); return result; };
  const blocked = key => policy.isBlocked ? policy.isBlocked(key) !== false : false;
  const block = (key, value) => { if (policy.setBlocked) policy.setBlocked(key, value); };
  const clean = () => { token = ""; origin = ""; remembered = false; epoch++; };

  return {
    install(adapter) { vault = adapter; },
    snapshot() { return {epoch, connected: Boolean(token), remembered, backend: vault?.backend || "unsupported", available: supported(), lastError}; },
    set(value, forOrigin = current()) {
      if (!value) { clean(); return; }
      if (!TOKEN.test(value)) throw failure("invalid_token", "\u6062\u590d\u7801\u683c\u5f0f\u4e0d\u6b63\u786e\u3002");
      if (!validOrigin(forOrigin) || forOrigin !== current()) throw failure("origin_changed", "\u670d\u52a1\u57df\u540d\u5df2\u53d8\u5316\uff0c\u8bf7\u91cd\u65b0\u8fde\u63a5\u3002");
      token = value; origin = forOrigin; remembered = false; lastError = null; epoch++;
    },
    clear() { clean(); },
    invalidatePending() { epoch++; },
    authorization(forOrigin = current()) {
      if (!token) return null;
      if (forOrigin !== origin || current() !== origin) {
        clean(); throw failure("origin_changed", "\u57df\u540d\u53d8\u66f4\uff1a\u5df2\u963b\u6b62\u51ed\u636e\u53d1\u9001\uff0c\u8bf7\u91cd\u65b0\u8fde\u63a5\u3002");
      }
      return "Bearer " + token;
    },
    restore() {
      const key = current(), start = epoch;
      if (token || !supported() || blocked(key)) return Promise.resolve(false);
      return serialize(async () => {
        if (start !== epoch || key !== current() || token || blocked(key)) return false;
        try {
          const value = await vault.read(key);
          if (start !== epoch || key !== current() || blocked(key)) return false;
          if (!value) return false;
          if (!TOKEN.test(value)) throw failure("invalid_saved_token", "\u5b89\u5168\u5b58\u50a8\u6570\u636e\u65e0\u6548\uff0c\u8bf7\u91cd\u65b0\u8fde\u63a5\u3002");
          token = value; origin = key; remembered = true; lastError = null; epoch++;
          return true;
        } catch (error) { lastError = error.code || "vault_failed"; throw error; }
      });
    },
    remember(consent) {
      if (consent !== true) return Promise.reject(failure("consent_required", "\u9700\u8981\u4f60\u4e3b\u52a8\u540c\u610f\u5b89\u5168\u4fdd\u5b58\u3002"));
      if (!supported()) return Promise.reject(failure("unsupported", "\u5f53\u524d\u5e73\u53f0\u6ca1\u6709\u53ef\u7528\u7684\u5b89\u5168\u5b58\u50a8\uff1b\u4ec5\u4fdd\u7559\u672c\u6b21\u8fde\u63a5\u3002"));
      const key = current(), value = token, start = epoch;
      this.authorization(key);
      if (!value) return Promise.reject(failure("no_session", "\u8bf7\u5148\u8fde\u63a5\u6863\u6848\u3002"));
      return serialize(async () => {
        if (start !== epoch || key !== current()) return false;
        try {
          // Keep restore disabled until BOTH the native write and consent metadata succeed.
          block(key, true);
          await vault.write(key, value);
          if (start !== epoch || key !== current()) return false;
          block(key, false);
          remembered = true; lastError = null; return true;
        } catch (error) { remembered = false; lastError = error.code || "vault_failed"; throw error; }
      });
    },
    forget({disconnect = true} = {}) {
      const key = origin || current();
      if (disconnect) clean(); else {epoch++; remembered = false;}
      // Non-secret tombstone is written before deletion, so failed deletion cannot auto-restore.
      let policyError = null;
      try { block(key, true); } catch (error) { policyError = error; }
      if (!supported()) return policyError ? Promise.reject(policyError) : Promise.resolve(true);
      return serialize(async () => {
        try {
          await vault.remove(key);
          remembered = false; lastError = null;
          return true;
        } catch (error) {lastError = "removal_failed"; throw failure("removal_failed", "\u672a\u786e\u8ba4\u5b89\u5168\u5b58\u50a8\u5220\u9664\u6210\u529f\u3002\u8bf7\u89e3\u9501\u8bbe\u5907\u540e\u91cd\u8bd5\u6e05\u9664\u3002");}
      });
    }
  };
}
