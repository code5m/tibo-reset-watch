const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function fetchWithRetry(url, options, {
  attempts = 3,
  baseDelayMs = 1200,
  timeoutMs = 12_000
} = {}) {
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(timeoutMs)
      });
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await sleep(baseDelayMs * attempt);
      }
    }
  }

  throw lastError || new Error("request failed");
}

async function parseJsonResponse(response, provider) {
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(provider + " returned non-JSON response");
  }

  if (!response.ok) {
    throw new Error(provider + " HTTP " + response.status + ": " + JSON.stringify(payload).slice(0, 300));
  }
  return payload;
}

export function validateServerChanResponse(payload) {
  const code = Number(payload?.code);
  if (code !== 0) {
    throw new Error("ServerChan business error: " + JSON.stringify(payload).slice(0, 300));
  }
  return true;
}

export function validateWxPusherResponse(payload) {
  const code = Number(payload?.code);
  if (code !== 1000) {
    throw new Error("WxPusher business error: " + JSON.stringify(payload).slice(0, 300));
  }
  return true;
}

export async function notifyServerChan(title, body) {
  const key = process.env.SERVERCHAN_SENDKEY;
  if (!key) return false;

  let url;
  if (key.startsWith("sctp")) {
    const match = key.match(/^sctp(\d+)t/);
    if (!match) throw new Error("Invalid ServerChan SC3 SendKey format");
    url = "https://" + match[1] + ".push.ft07.com/send/" + encodeURIComponent(key) + ".send";
  } else {
    url = "https://sctapi.ftqq.com/" + encodeURIComponent(key) + ".send";
  }
  const form = new URLSearchParams({ title, desp: body });

  const response = await fetchWithRetry(url, {
    method: "POST",
    body: form
  });

  validateServerChanResponse(await parseJsonResponse(response, "ServerChan"));
  return true;
}

export async function notifyWxPusher(title, body, url) {
  const token = process.env.WXPUSHER_APP_TOKEN;
  const uids = (process.env.WXPUSHER_UIDS || "")
    .split(",")
    .map(value => value.trim())
    .filter(Boolean);

  if (!token || !uids.length) return false;

  const response = await fetchWithRetry("https://wxpusher.zjiecode.com/api/send/message", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      appToken: token,
      content: body,
      summary: title,
      contentType: 1,
      uids,
      url
    })
  });

  validateWxPusherResponse(await parseJsonResponse(response, "WxPusher"));
  return true;
}

export async function sendWeChat({ title, body, url }) {
  if ((process.env.DRY_RUN || "false").toLowerCase() === "true") {
    console.log("[DRY_RUN]", title);
    console.log(body);
    return { delivered: true, providers: ["dry-run"] };
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

  const providers = [];
  if (results[0].status === "fulfilled" && results[0].value === true) providers.push("serverchan");
  if (results[1].status === "fulfilled" && results[1].value === true) providers.push("wxpusher");

  if (!providers.length) {
    const reasons = results
      .filter(result => result.status === "rejected")
      .map(result => result.reason?.message || String(result.reason));
    throw new Error("All configured WeChat notifiers failed: " + reasons.join("; "));
  }

  return { delivered: true, providers };
}
