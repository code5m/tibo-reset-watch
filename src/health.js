import fs from "node:fs";
import { chinaDateKey } from "./time.js";
import { saveJsonAtomic } from "./state.js";

export function createEmptyHealth() {
  return {
    version: 1,
    lastSuccessAt: null,
    lastFailureAt: null,
    lastDailyHeartbeatDate: null,
    consecutiveFailures: 0,
    failureAlertedForStreak: false,
    lastError: null,
    lastSource: null,
    lastSourceAgeMinutes: null,
    cachedXUserId: null
  };
}

export function loadHealth(filePath) {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return { ...createEmptyHealth(), ...parsed };
  } catch {
    return createEmptyHealth();
  }
}

export function saveHealth(filePath, health) {
  saveJsonAtomic(filePath, health);
}

export function recordFailure(health, error, now = new Date()) {
  health.consecutiveFailures = Number(health.consecutiveFailures || 0) + 1;
  health.lastFailureAt = now.toISOString();
  health.lastError = String(error && error.message ? error.message : error).slice(0, 240);
  return health;
}

export function recordSuccess(health, meta, now = new Date()) {
  const today = chinaDateKey(now);
  const recovered = Number(health.consecutiveFailures || 0) > 0;
  const dailyHeartbeatDue = health.lastDailyHeartbeatDate !== today;
  const shouldPersist = recovered || dailyHeartbeatDue || !health.lastSuccessAt;

  health.consecutiveFailures = 0;
  health.failureAlertedForStreak = false;
  health.lastError = null;
  health.lastSource = meta?.source || null;
  health.lastSourceAgeMinutes = Number.isFinite(meta?.sourceAgeMinutes)
    ? Number(meta.sourceAgeMinutes.toFixed(2))
    : null;
  if (meta?.xUserId) health.cachedXUserId = String(meta.xUserId);

  if (shouldPersist) {
    health.lastSuccessAt = now.toISOString();
    health.lastDailyHeartbeatDate = today;
  }

  return { health, shouldPersist, recovered };
}
