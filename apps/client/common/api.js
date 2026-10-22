import config from "../config.json";
export function normalizeOrigin(value) {
  const raw = String(value || "").trim();
  // Public API origin only. Never accept a token, credentials, path, query, or fragment.
  if (!/^https:\/\/[a-z0-9.-]+(?::\d{1,5})?\/?$/i.test(raw)) throw new Error("请填写 HTTPS 服务域名，不含路径、账号或密钥");
  const match = raw.match(/^https:\/\/([^/:]+)(?::([0-9]+))?\/?$/i);
  if (!match) throw new Error("\u670d\u52a1\u57df\u540d\u683c\u5f0f\u4e0d\u6b63\u786e");
  const host = match[1].toLowerCase(), port = match[2] ? Number(match[2]) : 443;
  if (host.length > 253 || host.split(".").some(part => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(part)) || port < 1 || port > 65535)
    throw new Error("\u670d\u52a1\u57df\u540d\u6216\u7aef\u53e3\u4e0d\u6b63\u786e");
  return "https://" + host + (port === 443 ? "" : ":" + port);
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
