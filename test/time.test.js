import test from "node:test";
import assert from "node:assert/strict";
import { formatChinaTime, inferResetTime } from "../src/time.js";

test("UTC converts to China Standard Time", () => {
  const value = formatChinaTime("2026-10-07T03:35:00Z");
  assert.match(value, /2026-10-07/);
  assert.match(value, /11:35/);
});

test("relative hours are inferred", () => {
  const date = inferResetTime("reset in 2 hours", "2026-10-07T03:35:00Z");
  assert.equal(date.toISOString(), "2026-10-07T05:35:00.000Z");
});

test("PT clock converts using Los Angeles timezone", () => {
  const date = inferResetTime("Codex reset tomorrow 10am PT", "2026-10-07T03:35:00Z");
  assert.ok(date instanceof Date);
  assert.equal(Number.isNaN(date.getTime()), false);
});

test("time without timezone is not guessed", () => {
  assert.equal(inferResetTime("reset tomorrow 10am", "2026-10-07T03:35:00Z"), null);
});
