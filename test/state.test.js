import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyState, postVersionKey, pruneSeen, pruneScheduledReminders } from "../src/state.js";

test("post version changes when text changes", () => {
  assert.notEqual(postVersionKey("1", "a"), postVersionKey("1", "b"));
});

test("empty state has v3 reliability shape", () => {
  assert.deepEqual(createEmptyState(), {
    version: 3,
    initialized: false,
    initializedAt: null,
    seen: {},
    notified: {},
    projectQueue: [],
    lastProjectDigestDate: null,
    scheduledReminders: {}
  });
});

test("seen state is pruned to requested size", () => {
  const state = createEmptyState();
  for (let i = 0; i < 5; i++) {
    state.seen["k" + i] = "2026-10-07T00:00:0" + i + "Z";
  }
  pruneSeen(state, 3);
  assert.equal(Object.keys(state.seen).length, 3);
});

test("expired scheduled reminders are pruned", () => {
  const state = createEmptyState();
  state.scheduledReminders.a = { targetAt: "2026-10-07T00:00:00Z" };
  state.scheduledReminders.b = { targetAt: "2026-10-07T10:00:00Z" };
  pruneScheduledReminders(state, new Date("2026-10-07T11:00:00Z"));
  assert.equal(Boolean(state.scheduledReminders.a), false);
  assert.equal(Boolean(state.scheduledReminders.b), true);
});
