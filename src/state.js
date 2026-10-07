import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export function createEmptyState() {
  return {
    version: 3,
    initialized: false,
    initializedAt: null,
    seen: {},
    notified: {},
    projectQueue: [],
    lastProjectDigestDate: null,
    scheduledReminders: {}
  };
}

export function loadState(statePath) {
  try {
    const parsed = JSON.parse(fs.readFileSync(statePath, "utf8"));
    const empty = createEmptyState();
    return {
      ...empty,
      initialized: Boolean(parsed.initialized),
      initializedAt: parsed.initializedAt || null,
      seen: parsed.seen && typeof parsed.seen === "object" ? parsed.seen : {},
      notified: parsed.notified && typeof parsed.notified === "object" ? parsed.notified : {},
      projectQueue: Array.isArray(parsed.projectQueue) ? parsed.projectQueue : [],
      lastProjectDigestDate: parsed.lastProjectDigestDate || null,
      scheduledReminders: parsed.scheduledReminders && typeof parsed.scheduledReminders === "object"
        ? parsed.scheduledReminders
        : {}
    };
  } catch {
    return createEmptyState();
  }
}

export function saveJsonAtomic(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = filePath + ".tmp";
  fs.writeFileSync(tempPath, JSON.stringify(value, null, 2) + "\n");
  fs.renameSync(tempPath, filePath);
}

export function saveState(statePath, state) {
  saveJsonAtomic(statePath, state);
}

export function postVersionKey(id, text) {
  const hash = crypto.createHash("sha256").update(String(text)).digest("hex").slice(0, 16);
  return String(id) + ":" + hash;
}

export function pruneSeen(state, max = 1500) {
  const entries = Object.entries(state.seen || {});
  if (entries.length <= max) return;
  entries
    .sort((a, b) => String(a[1]).localeCompare(String(b[1])))
    .slice(0, entries.length - max)
    .forEach(([key]) => delete state.seen[key]);
}

export function pruneProjectQueue(state, max = 20) {
  if (!Array.isArray(state.projectQueue)) state.projectQueue = [];
  if (state.projectQueue.length > max) {
    state.projectQueue = state.projectQueue.slice(-max);
  }
}

export function pruneScheduledReminders(state, now = new Date()) {
  if (!state.scheduledReminders || typeof state.scheduledReminders !== "object") {
    state.scheduledReminders = {};
    return;
  }

  for (const [key, item] of Object.entries(state.scheduledReminders)) {
    const target = new Date(item?.targetAt || "");
    if (Number.isNaN(target.getTime()) || now.getTime() - target.getTime() > 6 * 3_600_000) {
      delete state.scheduledReminders[key];
    }
  }
}
