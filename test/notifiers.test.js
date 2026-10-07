import test from "node:test";
import assert from "node:assert/strict";
import {
  validateServerChanResponse,
  validateWxPusherResponse,
  wxPusherTargets
} from "../src/notifiers.js";

test("serverchan success business code", () => {
  assert.equal(validateServerChanResponse({ code: 0 }), true);
});

test("wxpusher success business code", () => {
  assert.equal(validateWxPusherResponse({ code: 1000 }), true);
});

test("wxpusher targets support public topic subscribers", () => {
  const result = wxPusherTargets({
    WXPUSHER_UIDS: "UID_a, UID_b",
    WXPUSHER_TOPIC_IDS: "12,34,invalid"
  });

  assert.deepEqual(result.uids, ["UID_a", "UID_b"]);
  assert.deepEqual(result.topicIds, [12, 34]);
});
