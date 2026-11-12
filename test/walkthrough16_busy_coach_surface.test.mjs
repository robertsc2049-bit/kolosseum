// Walkthrough 16 (2026-11-12): a coach with 50 athletes and ~570 logged
// sessions. The notification bell re-derives every notification on each
// 60-second poll, and used to re-attempt one INSERT ... ON CONFLICT per
// derived notification (~600 writes a poll, growing with every session).
// Each derivation run now reads the recipient's stored keys once and only
// writes notifications that are genuinely new.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const service = fs.readFileSync("src/api/product_notification_service.ts", "utf8");
const fnBody = (signature) => {
  const start = service.indexOf(signature);
  assert.ok(start >= 0, signature);
  return service.slice(start, service.indexOf("\n}\n", start));
};

test("a busy coach's notification poll only writes notifications that are not stored yet", () => {
  const insert = fnBody("export async function insertDerivedNotification(");
  assert.ok(insert.includes("if (stored?.has(key)) return;"), "skips already-stored keys");
  assert.ok(insert.includes("ON CONFLICT (recipient_user_id, notification_type, source_record_id) DO NOTHING"), "still guards a concurrent run");

  const derive = fnBody("async function deriveNotificationsForRecipient(");
  assert.ok(derive.includes("SELECT notification_type, source_record_id FROM product_notifications WHERE recipient_user_id = $1"), "reads stored keys once per run");
  assert.ok(derive.includes("storedKeysByClient.delete(client as object);"), "the per-run cache never outlives the run");
  assert.ok(derive.indexOf("finally") > derive.indexOf("storedKeysByClient.set("), "cleared in a finally");
});

test("the stored-key separator is plain text, never a NUL byte", () => {
  assert.ok(!service.includes("\u0000"), "no NUL bytes in the service source");
});
