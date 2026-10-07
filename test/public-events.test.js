import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyPublicEvents, mergePublicEvents, toPublicEvent } from "../src/public-events.js";

function post(id, text, createdAt) {
  return {
    id,
    text,
    createdAt,
    url: "https://x.com/thsottiaux/status/" + id,
    kind: "post",
    source: "test",
    versionKey: id + ":v1"
  };
}

test("public event maps actionable reset signal", () => {
  const event = toPublicEvent(post(
    "1",
    "Codex weekly limit reset has been processed. Enjoy!",
    "2026-10-07T03:35:00Z"
  ));

  assert.equal(event.category, "reset");
  assert.equal(event.resetKind, "completed");
  assert.equal(event.actionable, true);
  assert.match(event.publishedAtChina, /2026/);
});

test("public feed deduplicates versions and sorts newest first", () => {
  const feed = mergePublicEvents(createEmptyPublicEvents(), [
    post("1", "hello", "2026-10-07T01:00:00Z"),
    post("2", "world", "2026-10-07T02:00:00Z"),
    post("2", "world", "2026-10-07T02:00:00Z")
  ], { now: new Date("2026-10-07T03:00:00Z") });

  assert.equal(feed.items.length, 2);
  assert.equal(feed.items[0].id, "2");
  assert.equal(feed.updatedAt, "2026-10-07T03:00:00.000Z");
});
