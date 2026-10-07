import { postVersionKey } from "./state.js";

export const DEFAULT_FEED_URL = "https://tibo-reset-reminder-skill.vercel.app/api/feed";

export function normalizePost(raw) {
  const id = String(raw?.id || raw?.post_id || raw?.tweet_id || raw?.rest_id || "");
  const text = String(raw?.text || raw?.full_text || raw?.content || raw?.note_tweet?.text || "").trim();
  const createdAt = raw?.created_at || raw?.createdAt || raw?.timestamp || raw?.date || null;
  const url = raw?.url || raw?.permalink || raw?.link || (id ? "https://x.com/thsottiaux/status/" + id : "https://x.com/thsottiaux");

  if (!id || !text || !createdAt) return null;
  if (Number.isNaN(new Date(createdAt).getTime())) return null;

  return {
    id,
    text,
    createdAt,
    url,
    versionKey: postVersionKey(id, text)
  };
}

export function extractPosts(body) {
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
    .map(normalizePost)
    .filter(Boolean)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

export async function fetchPosts(feedUrl = DEFAULT_FEED_URL) {
  const response = await fetch(feedUrl, {
    headers: { "user-agent": "tibo-reset-watch/1.0 (+github-actions)" }
  });

  if (!response.ok) {
    throw new Error("Feed HTTP " + response.status);
  }

  const body = await response.json();

  if (body?.stale === true) {
    throw new Error("Feed is stale; refusing to treat stale data as current.");
  }

  const posts = extractPosts(body);
  if (!posts.length) {
    throw new Error("Feed returned no recognizable posts.");
  }

  return posts;
}
