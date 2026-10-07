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

export function wxPusherTargets(env = process.env) {
  const uids = String(env.WXPUSHER_UIDS || "")
    .split(",")
    .map(value => value.trim())
    .filter(Boolean);

  const topicIds = String(env.WXPUSHER_TOPIC_IDS || env.WXPUSHER_TOPIC_ID || "")
    .split(",")
    .map(value => Number(value.trim()))
    .filter(value => Number.isInteger(value) && value > 0);

  return { uids, topicIds };
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
  const { uids, topicIds } = wxPusherTargets();
  if (!token || (!uids.length && !topicIds.length)) return false;

  const payload = {
    appToken: token,
    content: body,
    summary: title,
    contentType: 1,
    url
  };
  if (uids.length) payload.uids = uids;
  if (topicIds.length) payload.topicIds = topicIds;

  const response = await fetchWithRetry("https://wxpusher.zjiecode.com/api/send/message", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });

  validateWxPusherResponse(await parseJsonResponse(response, "WxPusher"));
  return true;
}

export async function notifySubscriberGateway({ title, body, url, event = null }) {
  const endpoint = process.env.SUBSCRIBER_GATEWAY_URL;
  if (!endpoint) return false;

  const token = process.env.SUBSCRIBER_GATEWAY_TOKEN || "";
  const headers = { "content-type": "application/json" };
  if (token) headers.authorization = "Bearer " + token;

  const response = await fetchWithRetry(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      title,
      body,
      url,
      event,
      source: "tibo-reset-watch"
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error("Subscriber gateway HTTP " + response.status + ": " + text.slice(0, 300));
  }
  return true;
}

export async function sendNotification({ title, body, url, event = null }) {
  if ((process.env.DRY_RUN || "false").toLowerCase() === "true") {
    console.log("[DRY_RUN]", title);
    console.log(body);
    return { delivered: true, providers: ["dry-run"] };
  }

  const targets = wxPusherTargets();
  const configured = Boolean(
    process.env.SERVERCHAN_SENDKEY ||
    (process.env.WXPUSHER_APP_TOKEN && (targets.uids.length || targets.topicIds.length)) ||
    process.env.SUBSCRIBER_GATEWAY_URL
  );

  if (!configured) {
    throw new Error(
      "No notifier configured. Set SERVERCHAN_SENDKEY, WXPUSHER_APP_TOKEN + UID/topic, or SUBSCRIBER_GATEWAY_URL."
    );
  }

  const tasks = [
    ["serverchan", () => notifyServerChan(title, body)],
    ["wxpusher", () => notifyWxPusher(title, body, url)],
    ["subscriber-gateway", () => notifySubscriberGateway({ title, body, url, event })]
  ];

  const results = await Promise.allSettled(tasks.map(([, run]) => run()));
  const providers = [];
  const reasons = [];

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const name = tasks[i][0];
    if (result.status === "fulfilled" && result.value === true) {
      providers.push(name);
    } else if (result.status === "rejected") {
      reasons.push(name + ": " + (result.reason?.message || String(result.reason)));
    }
  }

  if (!providers.length) {
    throw new Error("All configured notifiers failed: " + reasons.join("; "));
  }

  return { delivered: true, providers };
}

// Backward-compatible alias for integrations that imported the v2 name.
export const sendWeChat = sendNotification;
