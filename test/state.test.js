import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyState, postVersionKey, pruneSeen } from "../src/state.js";

test("post version changes when text changes", () => {
  assert.notEqual(postVersionKey("1", "a"), postVersionKey("1", "b"));
});

test("empty state has v2 reliability shape", () => {
  assert.deepEqual(createEmptyState(), {
    version: 2,
    initialized: false,
    initializedAt: null,
    seen: {},
    notified: {},
    projectQueue: [],
    lastProjectDigestDate: null
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
