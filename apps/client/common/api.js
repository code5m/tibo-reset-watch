import config from "../config.json";
export function normalizeOrigin(value) {
  const raw = String(value || "").trim();
  // Public API origin only. Never accept a token, credentials, path, query, or fragment.
  if (!/^https:\/\/[a-z0-9.-]+(?::\d{1,5})?\/?$/i.test(raw)) throw new Error("请填写 HTTPS 服务域名，不含路径、账号或密钥");
  return raw.replace(/\/$/, "");
}
export function apiOrigin() {
  return normalizeOrigin(uni.getStorageSync("resetwatch.apiOrigin") || config.apiBaseUrl);
}
export function getEvents(offset = 0) {
  const url = apiOrigin() + "/api/v1/reset-events?limit=20&offset=" + offset;
  let task;
  const promise = new Promise((resolve, reject) => {
    task = uni.request({
      url, method: "GET", timeout: 12000,
      success(response) {
        if (response.statusCode !== 200) { reject(new Error(response.data?.message || "数据服务不可用")); return; }
        if (response.data?.schemaVersion !== 1 || !Array.isArray(response.data.events)) { reject(new Error("接口格式不兼容")); return; }
        resolve(response.data);
      },
      fail() { reject(new Error("网络读取失败，不代表没有新 Reset")); }
    });
  });
  return { promise, abort: () => task?.abort() };
}
