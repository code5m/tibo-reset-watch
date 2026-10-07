import { classifyProjectLead, classifyReset } from "./classify.js";
import { DEFAULT_FEED_URL, fetchPosts } from "./feed.js";
import { loadHealth, recordFailure, recordSuccess, saveHealth } from "./health.js";
import { updatePublicEvents } from "./public-events.js";
import { sendNotification } from "./notifiers.js";
import { loadState, pruneProjectQueue, pruneScheduledReminders, pruneSeen, saveState } from "./state.js";
import { chinaDateKey, chinaHour, formatChinaTime, hoursUntil, inferResetTime } from "./time.js";

const FEED_URL = process.env.TIBO_RESET_FEED_URL || DEFAULT_FEED_URL;
const STATE_PATH = process.env.STATE_PATH || "state/notified.json";
const HEALTH_PATH = process.env.HEALTH_PATH || "state/health.json";
const PUBLIC_EVENTS_PATH = process.env.PUBLIC_EVENTS_PATH || "state/public-events.json";
const SOURCE_MODE = process.env.SOURCE_MODE || "auto";
const FEED_MAX_AGE_MINUTES = Number(process.env.FEED_MAX_AGE_MINUTES || 20);
const BOOTSTRAP_NOTIFY_LATEST = (process.env.BOOTSTRAP_NOTIFY_LATEST || "true").toLowerCase() === "true";
const BOOTSTRAP_MAX_AGE_HOURS = Number(process.env.BOOTSTRAP_MAX_AGE_HOURS || 24);
const ALERT_ON_HINTS = (process.env.ALERT_ON_HINTS || "false").toLowerCase() === "true";
const DISCOVER_PROJECTS = (process.env.DISCOVER_PROJECTS || "true").toLowerCase() === "true";
const PROJECT_DIGEST_HOUR_CN = Number(process.env.PROJECT_DIGEST_HOUR_CN || 20);
const FAILURE_ALERT_THRESHOLD = Number(process.env.FAILURE_ALERT_THRESHOLD || 3);

function resetTitle(kind) {
  if (kind === "completed") return "🔥 Tibo Reset：已执行";
  if (kind === "banked") return "🏦 Tibo Reset：Banked reset";
  if (kind === "scheduled") return "⏰ Tibo Reset：计划重置";
  return "👀 Tibo Reset：新线索";
}

function burnAdvice(classification, inferred, now = new Date()) {
  if (classification.kind === "completed") {
    return "建议：重置已完成。若你当前有高价值任务，可优先安排使用；不要为了“烧额度”制造无价值任务。";
  }

  if (classification.kind === "banked") {
    return "建议：这是 banked reset / 备用重置信号。先确认它适用的窗口和范围，再决定是否提前消耗当前额度。";
  }

  if (classification.kind === "scheduled" && inferred) {
    const hours = hoursUntil(inferred, now);
    if (hours !== null && hours > 0 && hours <= 6) {
      return "建议：距离预计重置不足 6 小时。若当前窗口仍有高价值待办，可优先完成；不要仅为清空额度做无意义消耗。";
    }
    if (hours !== null && hours > 6 && hours <= 24) {
      return "建议：重置预计在 24 小时内。把剩余额度优先分配给代码审查、测试、文档、调研等真实待办。";
    }
  }

  return "建议：按实际待办和重置时间安排使用，优先保证任务价值，不建议为了清零而无目的消耗。";
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
    "数据源：" + post.source,
    "",
    "原帖：" + post.url,
    burnAdvice(classification, inferred)
  ].join("\n");
}

async function deliverReset(post, classification, state) {
  const key = "reset:" + post.versionKey;
  if (state.notified[key]) return false;

  const delivery = await sendNotification({
    title: resetTitle(classification.kind),
    body: resetBody(post, classification),
    url: post.url,
    event: { id: post.id, versionKey: post.versionKey, type: "reset", resetKind: classification.kind, actionable: classification.actionable, text: post.text, publishedAt: post.createdAt, publishedAtChina: formatChinaTime(post.createdAt), permalink: post.url, source: post.source }
  });

  state.notified[key] = {
    postId: post.id,
    kind: classification.kind,
    providers: delivery.providers,
    notifiedAt: new Date().toISOString()
  };

  if (classification.kind === "scheduled") {
    const target = inferResetTime(post.text, post.createdAt);
    if (target) {
      state.scheduledReminders[key] = {
        postId: post.id,
        url: post.url,
        text: post.text,
        targetAt: target.toISOString(),
        oneHourReminderSent: false
      };
    }
  }

  return true;
}

function enqueueProject(post, lead, state) {
  const key = "project:" + post.versionKey;
  if (state.notified[key]) return false;
  if (state.projectQueue.some(item => item.key === key)) return false;

  state.projectQueue.push({
    key,
    postId: post.id,
    text: post.text,
    url: post.url,
    createdAt: post.createdAt,
    reason: lead.reason,
    score: lead.score
  });
  pruneProjectQueue(state);
  return true;
}

async function maybeSendScheduledResetReminders(state, now = new Date()) {
  let sent = 0;

  for (const [key, item] of Object.entries(state.scheduledReminders || {})) {
    if (item.oneHourReminderSent) continue;

    const target = new Date(item.targetAt);
    if (Number.isNaN(target.getTime())) continue;

    const minutes = (target.getTime() - now.getTime()) / 60_000;
    if (minutes > 60 || minutes < 0) continue;

    const delivery = await sendNotification({
      title: "⏳ Tibo Reset：预计 1 小时内重置",
      body: [
        "Tibo 之前公布的 Reset 已进入临近窗口。",
        "",
        "预计重置（北京时间）：" + formatChinaTime(target),
        "原帖：" + item.url,
        "",
        "现在建议先打开 ChatGPT Settings → Usage，或在 Codex CLI 输入 /status，确认真实剩余额度。",
        "如果仍有高价值待办，再优先安排代码审查、测试、文档、调研或实现任务；不要为了清零而制造无意义任务。"
      ].join("\n"),
      url: item.url
    });

    item.oneHourReminderSent = true;
    item.reminderProviders = delivery.providers;
    item.remindedAt = now.toISOString();
    state.scheduledReminders[key] = item;
    sent++;
  }

  return sent;
}

async function maybeSendProjectDigest(state, now = new Date()) {
  if (!DISCOVER_PROJECTS || !state.projectQueue.length) return false;

  const today = chinaDateKey(now);
  const hour = chinaHour(now);
  if (hour < PROJECT_DIGEST_HOUR_CN || state.lastProjectDigestDate === today) {
    return false;
  }

  const items = [...state.projectQueue]
    .sort((a, b) => b.score - a.score || new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5);

  const lines = [
    "今天 Tibo 分享/推荐的高信号项目线索：",
    ""
  ];

  for (const [index, item] of items.entries()) {
    lines.push(
      (index + 1) + ". " + item.text,
      "   北京时间：" + formatChinaTime(item.createdAt),
      "   原帖：" + item.url,
      ""
    );
  }

  lines.push("建议：只挑真正与你当前项目相关的内容投入 Codex / Work 额度。");

  const delivery = await sendNotification({
    title: "📌 Tibo 项目线索日报（" + items.length + " 条）",
    body: lines.join("\n"),
    url: items[0]?.url || "https://x.com/thsottiaux"
  });

  for (const item of state.projectQueue) {
    state.notified[item.key] = {
      postId: item.postId,
      kind: "project-lead-digest",
      providers: delivery.providers,
      notifiedAt: now.toISOString()
    };
  }

  state.projectQueue = [];
  state.lastProjectDigestDate = today;
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
  let queued = 0;

  for (const post of posts) {
    if (state.seen[post.versionKey]) continue;

    const reset = classifyReset(post.text);

    if (reset.actionable || (ALERT_ON_HINTS && reset.kind === "hint")) {
      if (await deliverReset(post, reset, state)) sent++;
    } else if (DISCOVER_PROJECTS) {
      const lead = classifyProjectLead(post.text);
      if (lead.actionable && enqueueProject(post, lead, state)) queued++;
    }

    state.seen[post.versionKey] = new Date().toISOString();
  }

  return { sent, queued };
}

async function maybeAlertMonitorFailure(health) {
  if (
    Number(health.consecutiveFailures || 0) >= FAILURE_ALERT_THRESHOLD &&
    !health.failureAlertedForStreak
  ) {
    await sendNotification({
      title: "⚠️ Tibo Reset Watch 连续抓取失败",
      body: [
        "监控连续失败次数：" + health.consecutiveFailures,
        "最近错误：" + health.lastError,
        "最近成功：" + (health.lastSuccessAt ? formatChinaTime(health.lastSuccessAt) : "尚无"),
        "",
        "这不是 Reset 通知，而是监控健康告警。请检查 Actions / Feed / X API。"
      ].join("\n"),
      url: "https://github.com/code5m/tibo-reset-watch/actions"
    });
    health.failureAlertedForStreak = true;
    return true;
  }
  return false;
}

async function main() {
  const state = loadState(STATE_PATH);
  const health = loadHealth(HEALTH_PATH);

  try {
    const result = await fetchPosts({
      feedUrl: FEED_URL,
      sourceMode: SOURCE_MODE,
      xBearerToken: process.env.X_BEARER_TOKEN || null,
      cachedXUserId: health.cachedXUserId,
      feedMaxAgeMinutes: FEED_MAX_AGE_MINUTES
    });

    updatePublicEvents(PUBLIC_EVENTS_PATH, result.posts);

    if (!state.initialized) {
      await bootstrap(result.posts, state);
    } else {
      const counts = await monitor(result.posts, state);
      console.log("Processed", result.posts.length, "posts; sent", counts.sent, "reset alert(s); queued", counts.queued, "project lead(s).");
    }

    const reminderCount = await maybeSendScheduledResetReminders(state);
    if (reminderCount) {
      console.log("Sent", reminderCount, "pre-reset reminder(s).");
    }

    await maybeSendProjectDigest(state);

    pruneSeen(state);
    pruneProjectQueue(state);
    pruneScheduledReminders(state);
    saveState(STATE_PATH, state);

    const healthResult = recordSuccess(health, {
      ...result.meta,
      xUserId: result.meta?.xUserId || health.cachedXUserId
    });

    if (healthResult.shouldPersist) {
      saveHealth(HEALTH_PATH, healthResult.health);
    }

    console.log("Source:", result.meta.source, "source age(min):", result.meta.sourceAgeMinutes);
  } catch (error) {
    recordFailure(health, error);

    try {
      await maybeAlertMonitorFailure(health);
    } catch (alertError) {
      console.error("Health alert failed:", alertError?.message || alertError);
    }

    saveHealth(HEALTH_PATH, health);
    console.error(error?.stack || error);
    process.exitCode = 1;
  }
}

main();
