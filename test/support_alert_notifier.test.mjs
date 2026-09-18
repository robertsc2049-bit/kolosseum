// DEV NOTE: structural/wiring proof for src/api/support_alert_notifier.ts.
// This file's actual runtime behaviour (no-op when unconfigured; correct
// request shape when configured; never throws on a failed/erroring send) was
// verified manually against the built dist output with a mocked
// globalThis.fetch across all four code paths - see the PR that introduced
// this file for the transcript. An automated equivalent doesn't live here
// because this file is wired into lint:fast/test:unit's green-unit CI job,
// which runs source-only and never builds dist/ first (see the same
// constraint documented in test/s_v1_o_01_status_page.test.mjs).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const notifierSource = readFileSync("src/api/support_alert_notifier.ts", "utf8");
const productSupportRoutes = readFileSync("src/api/product_support.routes.ts", "utf8");
const orgOwnerSupportRoutes = readFileSync("src/api/org_owner_support.routes.ts", "utf8");
const envExample = readFileSync(".env.example", "utf8");

test("the notifier is a safe no-op unless all three env vars are configured", () => {
  assert.match(notifierSource, /const apiKey = process\.env\.RESEND_API_KEY;/u);
  assert.match(notifierSource, /const to = process\.env\.KOLOSSEUM_SUPPORT_ALERT_EMAIL_TO;/u);
  assert.match(notifierSource, /const from = process\.env\.KOLOSSEUM_SUPPORT_ALERT_EMAIL_FROM;/u);
  assert.match(notifierSource, /if \(!apiKey \|\| !to \|\| !from\) return;/u);
});

test("the notifier never throws - a failed send is caught and logged, never propagated", () => {
  assert.match(notifierSource, /catch \(error\) \{\s*\n\s*\/\/ eslint-disable-next-line no-console\s*\n\s*console\.error\("WARN: support alert email failed to send"/u);
  assert.match(notifierSource, /if \(!response\.ok\) \{/u);
});

test("both support-report routes call the notifier after a successful create, with the real actor_type and the created report's own fields", () => {
  assert.match(productSupportRoutes, /import \{ notifySupportRequestCreated \} from "\.\/support_alert_notifier\.js";/u);
  assert.match(
    productSupportRoutes,
    /const report = await createSupportReport\(session\.account_row\.user_id, request\.body\);\s*\n\s*await notifySupportRequestCreated\(\{\s*\n\s*actor_type: "athlete_or_coach",\s*\n\s*correlation_id: String\(report\.correlation_id\),\s*\n\s*user_id: session\.account_row\.user_id,\s*\n\s*description: String\(report\.description\)\s*\n\s*\}\);/u
  );

  assert.match(orgOwnerSupportRoutes, /import \{ notifySupportRequestCreated \} from "\.\/support_alert_notifier\.js";/u);
  assert.match(
    orgOwnerSupportRoutes,
    /const report = await createOrgOwnerSupportReport\(user_id, request\.body\);\s*\n\s*await notifySupportRequestCreated\(\{\s*\n\s*actor_type: "org_owner",\s*\n\s*correlation_id: String\(report\.correlation_id\),\s*\n\s*user_id,\s*\n\s*description: String\(report\.description\)\s*\n\s*\}\);/u
  );
});

test(".env.example documents all three optional support-alert env vars", () => {
  assert.match(envExample, /RESEND_API_KEY=/u);
  assert.match(envExample, /KOLOSSEUM_SUPPORT_ALERT_EMAIL_TO=/u);
  assert.match(envExample, /KOLOSSEUM_SUPPORT_ALERT_EMAIL_FROM=/u);
});

test("the notifier never imports engine code", () => {
  assert.doesNotMatch(notifierSource, /@kolosseum\/engine|from "\.\.\/engine|from "\.\/engine|engine\/src\//u);
});
