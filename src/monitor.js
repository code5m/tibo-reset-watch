import { classifyProjectLead, classifyReset } from "./classify.js";
import { DEFAULT_FEED_URL, fetchPosts } from "./feed.js";
import { sendWeChat } from "./notifiers.js";
import { loadState, pruneSeen, saveState } from "./state.js";
import { formatChinaTime, inferResetTime } from "./time.js";

const FEED_URL = process.env.TIBO_RESET_FEED_URL || DEFAULT_FEED_URL;
const STATE_PATH = process.env.STATE_PATH || "state/notified.json";
const BOOTSTRAP_NOTIFY_LATEST = (process.env.BOOTSTRAP_NOTIFY_LATEST || "true").toLowerCase() === "true";
const BOOTSTRAP_MAX_AGE_HOURS = Number(process.env.BOOTSTRAP_MAX_AGE_HOURS || 24);
const ALERT_ON_HINTS = (process.env.ALERT_ON_HINTS || "false").toLowerCase() === "true";
const DISCOVER_PROJECTS = (process.env.DISCOVER_PROJECTS || "true").toLowerCase() === "true";

function resetTitle(kind) {
  if (kind === "completed") return "🔥 Tibo Reset：已执行";
  if (kind === "banked") return "🏦 Tibo Reset：Banked reset";
  if (kind === "scheduled") return "⏰ Tibo Reset：计划重置";
  return "👀 Tibo Reset：新线索";
}

function resetBody(post, classification) {
  const inferred = inferResetTime(post.text, post.createdAt);
  const resetTime = classification.kind === "completed"
    ? "已执行（以该帖时间作为确认时间）"
    : inferred
      ? formatChinaTime(inferred)
      : "原帖未提供可可靠换算的精确时间";

  return [
    "Tibo：" + post.text,
    "",
    "发帖时间（北京时间）：" + formatChinaTime(post.createdAt),
    "重置时间（北京时间）：" + resetTime,
    "类型：" + classification.kind,
    "",
    "原帖：" + post.url,
    classification.kind === "completed"
      ? "现在可以安排使用额度了。"
      : "请按原帖与北京时间安排额度使用。"
  ].join("\n");
}

async function deliverReset(post, classification, state) {
  const key = "reset:" + post.versionKey;
  if (state.notified[key]) return false;

  await sendWeChat({
    title: resetTitle(classification.kind),
    body: resetBody(post, classification),
    url: post.url
  });

  state.notified[key] = {
    postId: post.id,
    kind: classification.kind,
    notifiedAt: new Date().toISOString()
  };
  return true;
}

async function deliverProject(post, lead, state) {
  const key = "project:" + post.versionKey;
  if (state.notified[key]) return false;

  const body = [
    "Tibo 发了一条值得看的项目/工具线索：",
    post.text,
    "",
    "发现时间（北京时间）：" + formatChinaTime(post.createdAt),
    "信号：" + lead.reason.join(", "),
    "原帖：" + post.url,
    "建议先看原帖和项目主页，再决定是否投入 Codex / Work 额度。"
  ].join("\n");

  await sendWeChat({
    title: "📌 Tibo：值得看的项目线索",
    body,
    url: post.url
  });

  state.notified[key] = {
    postId: post.id,
    kind: "project-lead",
    notifiedAt: new Date().toISOString()
  };
  return true;
}

async function bootstrap(posts, state) {
  const now = Date.now();
  const candidate = posts
    .map(post => ({ post, classification: classifyReset(post.text) }))
    .filter(({ classification }) => classification.actionable || (ALERT_ON_HINTS && classification.kind === "hint"))
    .filter(({ post }) => now - new Date(post.createdAt).getTime() <= BOOTSTRAP_MAX_AGE_HOURS * 3_600_000)
    .at(-1);

  if (BOOTSTRAP_NOTIFY_LATEST && candidate) {
    await deliverReset(candidate.post, candidate.classification, state);
  }

  const markedAt = new Date().toISOString();
  for (const post of posts) {
    state.seen[post.versionKey] = markedAt;
  }

  state.initialized = true;
  state.initializedAt = markedAt;
}

async function monitor(posts, state) {
  let sent = 0;

  for (const post of posts) {
    if (state.seen[post.versionKey]) continue;

    const reset = classifyReset(post.text);

    if (reset.actionable || (ALERT_ON_HINTS && reset.kind === "hint")) {
      if (await deliverReset(post, reset, state)) sent++;
    } else if (DISCOVER_PROJECTS) {
      const lead = classifyProjectLead(post.text);
      if (lead.actionable && await deliverProject(post, lead, state)) {
        sent++;
      }
    }

    state.seen[post.versionKey] = new Date().toISOString();
  }

  return sent;
}

async function main() {
  const state = loadState(STATE_PATH);
  const posts = await fetchPosts(FEED_URL);

  if (!state.initialized) {
    await bootstrap(posts, state);
    pruneSeen(state);
    saveState(STATE_PATH, state);
    console.log("Initialized baseline with", posts.length, "posts.");
    return;
  }

  const sent = await monitor(posts, state);
  pruneSeen(state);
  saveState(STATE_PATH, state);
  console.log("Processed", posts.length, "posts; sent", sent, "notification(s).");
}

main().catch(error => {
  console.error(error?.stack || error);
  process.exitCode = 1;
});
