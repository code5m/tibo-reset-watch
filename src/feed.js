import { postVersionKey } from "./state.js";

export const DEFAULT_FEED_URL = "https://tibo-reset-reminder-skill.vercel.app/api/feed";
const X_API_BASE = "https://api.x.com/2";
const TARGET_USERNAME = "thsottiaux";

async function fetchJson(url, options = {}, timeoutMs = 20_000) {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(timeoutMs)
  });

  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    throw new Error("Non-JSON response from upstream");
  }

  if (!response.ok) {
    throw new Error("HTTP " + response.status + ": " + JSON.stringify(payload).slice(0, 300));
  }
  return payload;
}

export function normalizePost(raw, source = "public-feed") {
  const id = String(raw?.id || raw?.post_id || raw?.tweet_id || raw?.rest_id || "");
  const text = String(
    raw?.note_tweet?.text ||
    raw?.text ||
    raw?.full_text ||
    raw?.content ||
    ""
  ).trim();
  const createdAt = raw?.created_at || raw?.createdAt || raw?.timestamp || raw?.date || null;
  const url = raw?.url || raw?.permalink || raw?.link || (id ? "https://x.com/" + TARGET_USERNAME + "/status/" + id : "https://x.com/" + TARGET_USERNAME);
  const references = Array.isArray(raw?.referenced_tweets) ? raw.referenced_tweets : [];
  const referenceTypes = new Set(references.map(item => item?.type).filter(Boolean));
  const kind = raw?.kind ||
    (referenceTypes.has("replied_to") ? "reply" : referenceTypes.has("quoted") ? "quote" : "post");

  if (!id || !text || !createdAt) return null;
  if (Number.isNaN(new Date(createdAt).getTime())) return null;

  return {
    id,
    text,
    createdAt,
    url,
    kind,
    source,
    versionKey: postVersionKey(id, text)
  };
}

export function extractPosts(body, source = "public-feed") {
  const candidates = Array.isArray(body)
    ? body
    : Array.isArray(body?.posts)
      ? body.posts
      : Array.isArray(body?.items)
        ? body.items
        : Array.isArray(body?.data)
          ? body.data
          : [];

  return candidates
    .map(item => normalizePost(item, source))
    .filter(Boolean)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

export function validatePublicFeed(body, {
  now = new Date(),
  maxAgeMinutes = 20,
  expectedUsername = TARGET_USERNAME
} = {}) {
  const sourceUsername = String(body?.source?.username || "").toLowerCase();
  if (sourceUsername && sourceUsername !== expectedUsername.toLowerCase()) {
    throw new Error("Public Feed returned unexpected source account: " + sourceUsername);
  }
  if (body?.stale === true) {
    throw new Error("Public Feed is stale; last success: " + (body?.last_success_at || "unknown"));
  }

  let sourceAgeMinutes = null;
  if (body?.fetched_at) {
    const fetchedAt = new Date(body.fetched_at);
    if (!Number.isNaN(fetchedAt.getTime())) {
      sourceAgeMinutes = (now.getTime() - fetchedAt.getTime()) / 60_000;
      if (sourceAgeMinutes > maxAgeMinutes) {
        throw new Error("Public Feed is too old: " + sourceAgeMinutes.toFixed(1) + " minutes");
      }
    }
  }

  return { sourceAgeMinutes };
}

export async function fetchFromPublicFeed(feedUrl, maxAgeMinutes = 20) {
  const body = await fetchJson(feedUrl, {
    headers: {
      accept: "application/json",
      "user-agent": "tibo-reset-watch/2.0 (+github-actions)"
    }
  });

  const freshness = validatePublicFeed(body, { maxAgeMinutes });
  const posts = extractPosts(body, "public-feed");
  if (!posts.length) throw new Error("Public Feed returned no recognizable posts.");

  return {
    posts,
    meta: {
      source: "public-feed",
      sourceAgeMinutes: freshness.sourceAgeMinutes,
      fetchedAt: body?.fetched_at || null
    }
  };
}

async function xApiGet(path, token, params = {}) {
  const query = new URLSearchParams(params);
  const url = X_API_BASE + path + (query.size ? "?" + query.toString() : "");
  return fetchJson(url, {
    headers: {
      authorization: "Bearer " + token,
      accept: "application/json",
      "user-agent": "tibo-reset-watch/2.0"
    }
  }, 30_000);
}

export async function fetchFromXApi(token, {
  username = TARGET_USERNAME,
  maxResults = 20,
  cachedUserId = null
} = {}) {
  if (!token) throw new Error("X_BEARER_TOKEN is required for x-api mode");

  let userId = cachedUserId ? String(cachedUserId) : null;
  if (!userId) {
    const userPayload = await xApiGet("/users/by/username/" + encodeURIComponent(username), token);
    userId = String(userPayload?.data?.id || "");
    if (!userId) throw new Error("X API user lookup did not return an ID");
  }

  const payload = await xApiGet("/users/" + encodeURIComponent(userId) + "/tweets", token, {
    max_results: String(Math.min(100, Math.max(5, maxResults))),
    exclude: "retweets",
    "tweet.fields": "created_at,referenced_tweets,note_tweet"
  });

  const posts = extractPosts(payload, "x-api");
  if (!posts.length && Number(payload?.meta?.result_count || 0) > 0) {
    throw new Error("X API returned posts that could not be normalized");
  }

  return {
    posts,
    meta: {
      source: "x-api",
      sourceAgeMinutes: 0,
      fetchedAt: new Date().toISOString(),
      xUserId: userId
    }
  };
}

export async function fetchPosts({
  feedUrl = DEFAULT_FEED_URL,
  sourceMode = "auto",
  xBearerToken = null,
  cachedXUserId = null,
  feedMaxAgeMinutes = 20
} = {}) {
  const mode = String(sourceMode || "auto").toLowerCase();
  if (!["auto", "feed", "x-api"].includes(mode)) {
    throw new Error("Unsupported SOURCE_MODE: " + mode);
  }

  const errors = [];

  if ((mode === "auto" || mode === "x-api") && xBearerToken) {
    try {
      return await fetchFromXApi(xBearerToken, { cachedUserId: cachedXUserId });
    } catch (error) {
      errors.push("x-api: " + error.message);
      if (mode === "x-api") throw error;
    }
  } else if (mode === "x-api") {
    throw new Error("SOURCE_MODE=x-api requires X_BEARER_TOKEN");
  }

  if (mode === "auto" || mode === "feed") {
    try {
      return await fetchFromPublicFeed(feedUrl, feedMaxAgeMinutes);
    } catch (error) {
      errors.push("public-feed: " + error.message);
      throw new Error(errors.join(" | "));
    }
  }

  throw new Error(errors.join(" | ") || "No source available");
}
