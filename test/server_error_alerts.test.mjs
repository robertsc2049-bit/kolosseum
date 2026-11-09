// Server error alerts (src/api/server_error_alerts.ts): the pure parts - how
// a route and an error code are kept without anything personal, and what the
// admin's email says. The recording, hourly batching and console summary are
// proven against a real database in server_error_alerts_persistent
// .integration.test.mjs.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { errorCodeFrom, normaliseRoute, serverErrorDigestEmail } from "../dist/src/api/server_error_alerts.js";

test("ids, numbers, tokens and emails in a route become :id; words stay", () => {
  assert.equal(normaliseRoute("/messages/thread_9f8e7d6c5b4a3/read"), "/messages/:id/read");
  assert.equal(normaliseRoute("/account/sessions/123/sets?x=1"), "/account/sessions/:id/sets");
  assert.equal(normaliseRoute("/admin/accounts/3f2b7c1e-8a9d-4e5f-9b0c-1d2e3f4a5b6c"), "/admin/accounts/:id");
  assert.equal(normaliseRoute("/coach/share/coach%40example.com"), "/coach/share/:id");
  assert.equal(normaliseRoute("/account/coach-onboarding/declarations"), "/account/coach-onboarding/declarations");
  assert.equal(normaliseRoute("/progress-insights/e1rm-history"), "/progress-insights/e1rm-history");
  assert.equal(normaliseRoute("/admin/org-owner-data-rights/deletions/:deletion_request_id/erase-plan"), "/admin/org-owner-data-rights/deletions/:deletion_request_id/erase-plan");
});

test("only a code token is kept as the error - never an exception's free-text message", () => {
  assert.equal(errorCodeFrom({ ok: false, error: "admin_two_step_unavailable" }), "admin_two_step_unavailable");
  assert.equal(errorCodeFrom({ ok: false, code: "INTERNAL", error: "duplicate key value violates unique constraint \"x\" Key (email)=(a@b.com)" }), "INTERNAL");
  assert.equal(errorCodeFrom({ error: "x".repeat(81) }), "unknown");
  assert.equal(errorCodeFrom("boom"), "unknown");
  assert.equal(errorCodeFrom(null), "unknown");
});

test("the email says how many, when, which kinds, and where to look", () => {
  const groups = [
    { method: "POST", route: "/account/sessions/:id/sets", status: 500, error_code: "INTERNAL", count: 7, first_at: "2026-11-09T14:05:00.000Z", last_at: "2026-11-09T14:20:00.000Z" },
    { method: "GET", route: "/messages/:id", status: 503, error_code: "messaging_unavailable", count: 1, first_at: "2026-11-09T13:58:00.000Z", last_at: "2026-11-09T13:58:00.000Z" }
  ];
  const { subject, lines } = serverErrorDigestEmail(groups);
  assert.equal(subject, "Kolosseum: 8 server errors on the live app");
  assert.equal(lines[0], "The live app sent 8 server errors since 9 Nov, 13:58. Someone saw \"something went wrong\" each time.");
  assert.ok(lines.includes("- POST /account/sessions/:id/sets - INTERNAL (500): 7, 9 Nov, 14:05 to 9 Nov, 14:20"));
  assert.ok(lines.includes("- GET /messages/:id - messaging_unavailable (503): 1, at 9 Nov, 13:58"));
  assert.ok(lines.some((line) => line.includes("grep -B2 -A20 ERROR_REPORT")));
  assert.equal(serverErrorDigestEmail([groups[1]]).subject, "Kolosseum: 1 server error on the live app");
});

test("the recorder runs before every router, digests start with the server, and the console shows the last 24 hours", () => {
  const server = readFileSync("src/server.ts", "utf8");
  const mounted = server.indexOf("app.use(recordServerErrors);");
  assert.ok(mounted > 0 && mounted < server.indexOf("app.use(express.json("), "mounted before any router");
  assert.match(readFileSync("src/main.ts", "utf8"), /startServerErrorDigests\(\);/u);
  assert.match(readFileSync("src/api/product_admin.routes.ts", "utf8"), /server_errors: await serverErrorSummary\(\)/u);
  const js = readFileSync("public/admin/admin.js", "utf8");
  assert.match(js, /Server errors: none in the last 24 hours\./u);
  assert.match(js, /box\.innerHTML = backupsHtml \+ serverErrorsHtml\(serverErrors\);/u);
  for (const page of ["public/admin/index.html", "public/org/index.html"]) {
    assert.match(readFileSync(page, "utf8"), /<link rel="icon" href="\/app\/icons\/icon-192\.png" \/>/u, page);
  }
});
