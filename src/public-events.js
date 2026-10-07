import fs from "node:fs";
import { classifyProjectLead, classifyReset } from "./classify.js";
import { saveJsonAtomic } from "./state.js";
import { formatChinaTime } from "./time.js";

export function createEmptyPublicEvents() {
  return {
    version: 1,
    updatedAt: null,
    items: []
  };
}

export function loadPublicEvents(filePath) {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return {
      version: 1,
      updatedAt: parsed?.updatedAt || null,
      items: Array.isArray(parsed?.items) ? parsed.items : []
    };
  } catch {
    return createEmptyPublicEvents();
  }
}

export function toPublicEvent(post) {
  const reset = classifyReset(post?.text || "");
  const project = reset.kind === "ignore"
    ? classifyProjectLead(post?.text || "")
    : { actionable: false, score: 0, reason: [] };

  const published = new Date(post.createdAt);
  const category = reset.kind !== "ignore"
    ? "reset"
    : project.actionable
      ? "project"
      : "post";

  return {
    id: String(post.id),
    versionKey: String(post.versionKey),
    text: String(post.text),
    url: String(post.url),
    source: String(post.source || "unknown"),
    postKind: String(post.kind || "post"),
    publishedAt: published.toISOString(),
    publishedAtChina: formatChinaTime(published),
    category,
    resetKind: reset.kind === "ignore" ? null : reset.kind,
    actionable: Boolean(reset.actionable),
    projectScore: project.actionable ? project.score : null,
    projectReason: project.actionable ? project.reason : []
  };
}

export function mergePublicEvents(current, posts, {
  max = 200,
  now = new Date()
} = {}) {
  const feed = current && typeof current === "object"
    ? current
    : createEmptyPublicEvents();

  const byVersion = new Map(
    (Array.isArray(feed.items) ? feed.items : [])
      .filter(item => item?.versionKey)
      .map(item => [item.versionKey, item])
  );

  for (const post of posts || []) {
    if (!post?.id || !post?.versionKey || !post?.createdAt) continue;
    byVersion.set(post.versionKey, toPublicEvent(post));
  }

  const items = [...byVersion.values()]
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
    .slice(0, max);

  return {
    version: 1,
    updatedAt: now.toISOString(),
    items
  };
}

export function updatePublicEvents(filePath, posts, options = {}) {
  const current = loadPublicEvents(filePath);
  const next = mergePublicEvents(current, posts, options);
  saveJsonAtomic(filePath, next);
  return next;
}
