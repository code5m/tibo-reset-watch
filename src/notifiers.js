async function postJson(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error("HTTP " + response.status + ": " + await response.text());
  }
  return response;
}

export async function notifyServerChan(title, body) {
  const key = process.env.SERVERCHAN_SENDKEY;
  if (!key) return false;

  const url = "https://sctapi.ftqq.com/" + encodeURIComponent(key) + ".send";
  const form = new URLSearchParams({ title, desp: body });
  const response = await fetch(url, { method: "POST", body: form });

  if (!response.ok) {
    throw new Error("ServerChan HTTP " + response.status + ": " + await response.text());
  }
  return true;
}

export async function notifyWxPusher(title, body, url) {
  const token = process.env.WXPUSHER_APP_TOKEN;
  const uids = (process.env.WXPUSHER_UIDS || "")
    .split(",")
    .map(value => value.trim())
    .filter(Boolean);

  if (!token || !uids.length) return false;

  await postJson("https://wxpusher.zjiecode.com/api/send/message", {
    appToken: token,
    content: body,
    summary: title,
    contentType: 1,
    uids,
    url
  });

  return true;
}

export async function sendWeChat({ title, body, url }) {
  if ((process.env.DRY_RUN || "false").toLowerCase() === "true") {
    console.log("[DRY_RUN]", title);
    console.log(body);
    return;
  }

  const configured = Boolean(
    process.env.SERVERCHAN_SENDKEY ||
    (process.env.WXPUSHER_APP_TOKEN && process.env.WXPUSHER_UIDS)
  );

  if (!configured) {
    throw new Error("No WeChat notifier configured. Set SERVERCHAN_SENDKEY or WXPUSHER_APP_TOKEN + WXPUSHER_UIDS.");
  }

  const results = await Promise.allSettled([
    notifyServerChan(title, body),
    notifyWxPusher(title, body, url)
  ]);

  const delivered = results.some(result => result.status === "fulfilled" && result.value === true);
  if (!delivered) {
    const reasons = results
      .filter(result => result.status === "rejected")
      .map(result => result.reason?.message || String(result.reason));
    throw new Error("All configured WeChat notifiers failed: " + reasons.join("; "));
  }
}
