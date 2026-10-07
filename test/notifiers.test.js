import test from "node:test";
import assert from "node:assert/strict";
import { validateServerChanResponse, validateWxPusherResponse, wxPusherTargets } from "../src/notifiers.js";

test("ServerChan success requires code 0", () => {
  assert.equal(validateServerChanResponse({ code: 0, message: "success" }), true);
  assert.throws(() => validateServerChanResponse({ code: 1, message: "failed" }));
});

test("WxPusher success requires code 1000", () => {
  assert.equal(validateWxPusherResponse({ code: 1000, msg: "处理成功" }), true);
  assert.throws(() => validateWxPusherResponse({ code: 1001, msg: "failed" }));
});


test("WxPusher supports public topic subscriptions", () => {
  assert.deepEqual(
    wxPusherTargets({ WXPUSHER_UIDS: "UID_a,UID_b", WXPUSHER_TOPIC_IDS: "12,34,bad" }),
    { uids: ["UID_a", "UID_b"], topicIds: [12, 34] }
  );
});
