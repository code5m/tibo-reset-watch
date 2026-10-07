import test from "node:test";
import assert from "node:assert/strict";
import { classifyProjectLead, classifyReset } from "../src/classify.js";

test("completed Codex reset is actionable", () => {
  const result = classifyReset("Codex weekly limit reset has been processed. Enjoy!");
  assert.equal(result.kind, "completed");
  assert.equal(result.actionable, true);
});

test("terse processed reset is actionable", () => {
  const result = classifyReset("the reset has been processed. Enjoy!");
  assert.equal(result.kind, "completed");
  assert.equal(result.actionable, true);
});

test("scheduled reset stays scheduled", () => {
  const result = classifyReset("Codex limits reset tomorrow 10am PT");
  assert.equal(result.kind, "scheduled");
  assert.equal(result.actionable, true);
});

test("vague reset hint is non-actionable by default", () => {
  const result = classifyReset("Codex limit reset soon, hopefully");
  assert.equal(result.kind, "hint");
  assert.equal(result.actionable, false);
});

test("unrelated reset is ignored", () => {
  assert.equal(classifyReset("I reset my laptop today").kind, "ignore");
});

test("high-signal project link is discoverable", () => {
  const result = classifyProjectLead("This is a great open source agent tool: https://github.com/acme/demo");
  assert.equal(result.actionable, true);
  assert.ok(result.score >= 2);
});

test("generic chatter does not trigger project discovery", () => {
  assert.equal(classifyProjectLead("nice weather today").actionable, false);
});
