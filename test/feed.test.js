import test from "node:test";
import assert from "node:assert/strict";
import { extractPosts, validatePublicFeed } from "../src/feed.js";

test("public feed rejects stale flag", () => {
  assert.throws(() => validatePublicFeed({
    stale: true,
    source: { username: "thsottiaux" },
    fetched_at: "2026-10-07T10:00:00Z"
  }, { now: new Date("2026-10-07T10:05:00Z") }));
});

test("public feed rejects unexpectedly old fetched_at", () => {
  assert.throws(() => validatePublicFeed({
    stale: false,
    source: { username: "thsottiaux" },
    fetched_at: "2026-10-07T09:00:00Z"
  }, {
    now: new Date("2026-10-07T10:00:00Z"),
    maxAgeMinutes: 20
  }));
});

test("public feed validates expected account", () => {
  assert.throws(() => validatePublicFeed({
    stale: false,
    source: { username: "someone_else" },
    fetched_at: "2026-10-07T09:55:00Z"
  }, { now: new Date("2026-10-07T10:00:00Z") }));
});

test("extractPosts preserves source and orders oldest first", () => {
  const posts = extractPosts({
    posts: [
      { id: "2", text: "second", created_at: "2026-10-07T10:02:00Z" },
      { id: "1", text: "first", created_at: "2026-10-07T10:01:00Z" }
    ]
  }, "public-feed");

  assert.equal(posts[0].id, "1");
  assert.equal(posts[0].source, "public-feed");
});
