// A deletion request can't be missed (deletion_request_deadlines.ts): the
// admin is emailed on each new request, the server starts the daily overdue
// check, and the admin console shows every request's erase-by date with a
// count of what's waiting. Behaviour is proven against a real database in
// deletion_request_deadlines_persistent.integration.test.mjs; this pins the
// wiring the unit job can see without a build.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

test("both kinds of deletion request email the admin, only when newly made", () => {
  for (const [file, kind] of [["src/api/data_rights_service.ts", "athlete_or_coach"], ["src/api/org_owner_data_rights_service.ts", "org_owner"]]) {
    const source = read(file);
    assert.match(source, /import \{ notifyDeletionRequested \} from "\.\/deletion_request_deadlines\.js";/u, file);
    assert.match(source, new RegExp(String.raw`if \(\(inserted\.rowCount \?\? 0\) > 0\) \{\s*await notifyDeletionRequested\(\{ kind: "${kind}"`, "u"), file);
  }
});

test("the server starts the daily deadline check, which is a no-op without email", () => {
  assert.match(read("src/main.ts"), /\nstartDeletionDeadlineSweeps\(\);/u);
  const source = read("src/api/deletion_request_deadlines.ts");
  assert.match(source, /if \(sweepTimer \|\| !process\.env\.RESEND_API_KEY \|\| !process\.env\.KOLOSSEUM_SUPPORT_ALERT_EMAIL_TO\) return;/u);
  assert.match(source, /export const DELETION_DUE_DAYS = 30;/u);
});

test("the admin queues show each request's erase-by date, oldest open first, and how many are waiting", () => {
  const html = read("public/admin/index.html");
  const js = read("public/admin/admin.js");
  assert.equal(html.match(/<thead><tr><th>Erase by<\/th><th>Deletion request<\/th>/gu)?.length, 2, "erase-by comes first, so it shows on a phone without scrolling sideways");
  assert.match(html, /id="deletionDeadlineSummary"/u);
  assert.match(html, /id="orgOwnerDeletionDeadlineSummary"/u);
  assert.equal(js.match(/row\.innerHTML = `\$\{deadlineCell\(request\)\}<td>\$\{escapeHtml\(request\.deletion_request_id\)\}<\/td>/gu)?.length, 2);
  assert.match(js, /el\("deletionDeadlineSummary"\)\.textContent = deadlineSummary\(state\.dataRightsDeletions\);/u);
  assert.match(js, /el\("orgOwnerDeletionDeadlineSummary"\)\.textContent = deadlineSummary\(state\.orgOwnerDataRightsDeletions\);/u);
  assert.equal(js.match(/<td colspan="7" class="muted">No deletion requests match\.<\/td>/gu)?.length, 2);
  assert.match(read("src/api/product_admin_review_service.ts"), /const DELETION_QUEUE_ORDER = "\(queue_status = 'completed'\), CASE WHEN queue_status <> 'completed' THEN requested_at END ASC, requested_at DESC";/u);
});
