import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyHealth, recordFailure, recordSuccess } from "../src/health.js";

test("health failure increments streak", () => {
  const health = createEmptyHealth();
  recordFailure(health, new Error("boom"), new Date("2026-10-07T10:00:00Z"));
  assert.equal(health.consecutiveFailures, 1);
  assert.match(health.lastError, /boom/);
});

test("daily health persistence happens once per China date", () => {
  const health = createEmptyHealth();
  const first = recordSuccess(health, { source: "public-feed", sourceAgeMinutes: 2 }, new Date("2026-10-07T10:00:00Z"));
  assert.equal(first.shouldPersist, true);
  const second = recordSuccess(health, { source: "public-feed", sourceAgeMinutes: 3 }, new Date("2026-10-07T11:00:00Z"));
  assert.equal(second.shouldPersist, false);
});
