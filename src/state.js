import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export function createEmptyState() {
  return { version: 1, initialized: false, seen: {}, notified: {} };
}

export function loadState(statePath) {
  try {
    const parsed = JSON.parse(fs.readFileSync(statePath, "utf8"));
    return {
      version: 1,
      initialized: Boolean(parsed.initialized),
      initializedAt: parsed.initializedAt || null,
      seen: parsed.seen && typeof parsed.seen === "object" ? parsed.seen : {},
      notified: parsed.notified && typeof parsed.notified === "object" ? parsed.notified : {}
    };
  } catch {
    return createEmptyState();
  }
}

export function saveState(statePath, state) {
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  const tempPath = statePath + ".tmp";
  fs.writeFileSync(tempPath, JSON.stringify(state, null, 2) + "\n");
  fs.renameSync(tempPath, statePath);
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
