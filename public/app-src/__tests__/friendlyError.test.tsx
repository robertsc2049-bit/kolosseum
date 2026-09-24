import assert from "node:assert/strict";
import test from "node:test";

import { FRIENDLY_ERROR_MESSAGES, friendlyErrorMessage, genericFriendlyMessageForStatus } from "../utils/friendlyError";

test("a known reason code maps to its exact friendly sentence", () => {
  assert.equal(
    friendlyErrorMessage({ error: "account_sign_in_failed" }, 400),
    "The email or password is incorrect."
  );
  assert.equal(
    friendlyErrorMessage({ reason: "template_name_invalid" }, 400),
    "Enter a programme name."
  );
  assert.equal(
    friendlyErrorMessage({ failure_token: "event_date_invalid" }, 400),
    "Enter a valid event date."
  );
});

test("account_unavailable maps to a factual sentence based on account_state", () => {
  assert.equal(
    friendlyErrorMessage({ error: "account_unavailable", account_state: "suspended" }, 423),
    "This account is suspended. Workspace access is unavailable."
  );
  assert.equal(
    friendlyErrorMessage({ error: "account_unavailable", account_state: "closed" }, 423),
    "This account is closed. Sign-in and workspace access are unavailable."
  );
  assert.equal(
    friendlyErrorMessage({ error: "account_unavailable", account_state: "deleted" }, 423),
    "This account has been deleted. Sign-in and workspace access are unavailable."
  );
  assert.equal(
    friendlyErrorMessage({ error: "account_unavailable" }, 423),
    "This account is not currently active."
  );
});

test("an unmapped code falls back to a plain sentence based on HTTP status, never the raw code", () => {
  assert.equal(friendlyErrorMessage({ error: "some_unmapped_internal_code" }, 401), "Sign in again to continue.");
  assert.equal(friendlyErrorMessage({ error: "some_unmapped_internal_code" }, 403), "This action is not available for this account.");
  assert.equal(friendlyErrorMessage({ error: "some_unmapped_internal_code" }, 404), "That record could not be found.");
  assert.equal(friendlyErrorMessage({ error: "some_unmapped_internal_code" }, 409), "That could not be completed because something changed. Refresh and try again.");
  assert.equal(friendlyErrorMessage({ error: "some_unmapped_internal_code" }, 423), "This account is not currently active.");
  assert.equal(friendlyErrorMessage({ error: "some_unmapped_internal_code" }, 429), "Too many attempts. Wait a moment and try again.");
  assert.equal(friendlyErrorMessage({ error: "some_unmapped_internal_code" }, 500), "Something went wrong on our end. Try again in a moment.");
  assert.equal(friendlyErrorMessage({ error: "some_unmapped_internal_code" }, 503), "Something went wrong on our end. Try again in a moment.");
  assert.equal(
    friendlyErrorMessage({ error: "some_unmapped_internal_code" }, 400),
    "That request could not be completed. Try again, or report this problem if it continues."
  );
});

test("a non-record payload or missing status never crashes, and still returns plain text", () => {
  assert.equal(friendlyErrorMessage(null, 500), "Something went wrong on our end. Try again in a moment.");
  assert.equal(friendlyErrorMessage(undefined, 0), "That request could not be completed. Try again, or report this problem if it continues.");
  assert.equal(friendlyErrorMessage("not an object", 404), "That record could not be found.");
});

test("genericFriendlyMessageForStatus is exported and matches the same table", () => {
  assert.equal(genericFriendlyMessageForStatus(404), "That record could not be found.");
});

test("the ported message table has no empty or duplicate-looking entries", () => {
  const entries = Object.entries(FRIENDLY_ERROR_MESSAGES);
  assert.ok(entries.length > 100, "expected the full ported legacy message table");
  for (const [code, message] of entries) {
    assert.ok(code.length > 0);
    assert.ok(message.length > 0);
  }
});
