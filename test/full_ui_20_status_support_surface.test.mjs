// DEV NOTE: FULL-UI-20 status, support and error-reporting static surface contract.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const html = read("public/app/index.html");
const css = read("public/app/styles.css");
const js = read("public/app/app.js");
const routes = read("src/api/product_support.routes.ts");
const service = read("src/api/product_support_service.ts");
const serverTs = read("src/server.ts");
const schema = read("schema.sql");

test("platform status is visible and reads the existing factual /health surface, not an invented incident feed", () => {
  for (const id of ["checkPlatformStatusButton", "platformStatusValue", "platformStatusChecked"]) {
    assert.ok(html.includes(`id="${id}"`), `Expected ${id}`);
  }

  assert.match(js, /async function refreshPlatformStatus/u);
  assert.match(js, /api\("GET", "\/health"\)/u);
  assert.doesNotMatch(js, /refreshPlatformStatus[\s\S]{0,600}incident/iu);
});

test("support routes are session-authenticated and delegate to product_support_service, never a client-supplied user id", () => {
  assert.match(serverTs, /productSupportRouter/u);
  assert.match(routes, /"\/support\/reports"/u);
  assert.match(routes, /createSupportReport/u);
  assert.match(routes, /listSupportReportsForUser/u);
  assert.match(routes, /resolveProductSession/u);
  assert.doesNotMatch(routes, /request\.body\.user_id/u);
  assert.match(service, /createSupportReport\(\s*userId: string/u);
  assert.match(service, /listSupportReportsForUser\(\s*userId: string/u);
});

test("a report attaches route, timestamp, browser context and a generated correlation ID, shown before submission", () => {
  for (const id of [
    "openSupportReportButton", "supportReportPanel", "supportReportCorrelationId",
    "supportReportRoute", "supportReportTimestamp", "supportReportBrowserSummary",
    "supportReportDescription"
  ]) {
    assert.ok(html.includes(`id="${id}"`), `Expected ${id}`);
  }

  assert.match(js, /function generateCorrelationId/u);
  assert.match(js, /function buildBrowserContextSnapshot/u);
  assert.match(js, /function openSupportReportForm/u);
  assert.match(js, /location\.hash \|\| "#\/"/u);

  // The preview shown before submission and the payload actually submitted
  // must be the same captured context object, not two independently built
  // values that could drift.
  assert.match(js, /currentSupportReportContext\.correlation_id/u);
  assert.match(js, /correlation_id: currentSupportReportContext\.correlation_id/u);
});

test("the description is a required, length-bounded user-entered field, recorded verbatim only through the explicit description column", () => {
  assert.match(html, /<textarea id="supportReportDescription" required maxlength="4000"/u);
  assert.match(service, /description\.length > 4000/u);
  assert.match(schema, /description\s+TEXT NOT NULL/u);
  assert.match(schema, /char_length\(description\) BETWEEN 1 AND 4000/u);
});

test("browser and failure context are rebuilt server-side from an explicit allowlist - a client cannot smuggle a token, cookie or password through this path", () => {
  assert.match(service, /function buildBrowserContext/u);
  assert.match(service, /function buildFailureContext/u);

  // The allowlist explicitly rebuilds each field - it never spreads or
  // forwards the caller's object verbatim.
  assert.doesNotMatch(service, /\.\.\.\s*(?:browser_context|failure_context|inputValue\.browser_context|inputValue\.failure_context)/u);
  assert.doesNotMatch(service, /\btoken\b|\bcookie\b|\bpassword\b|\bstack\b|authorization/iu);

  const supportInputKeysMatch = service.match(/supportReportInputKeys = new Set\(\[[\s\S]*?\]\)/u);
  assert.ok(supportInputKeysMatch, "expected an explicit supportReportInputKeys allowlist");
  assert.doesNotMatch(supportInputKeysMatch[0], /token|cookie|password|stack/iu);
});

test("retry only ever re-runs the one safe read that failed - never a mutation", () => {
  assert.match(service, /allowedFailureMethods = new Set\(\["GET", "POST", "PUT", "PATCH", "DELETE"\]\)/u);
  assert.match(service, /retryable: safeMethod === "GET" && safePath !== null/u);

  assert.match(html, /id="supportRetryButton"[\s\S]{0,80}hidden/u);
  assert.match(js, /async function retrySupportFailedRequest/u);
  assert.match(js, /context\.method !== "GET"/u);
  assert.match(js, /await api\("GET", context\.path\)/u);
  assert.doesNotMatch(js, /retrySupportFailedRequest[\s\S]{0,400}api\("POST"/u);
  assert.doesNotMatch(js, /retrySupportFailedRequest[\s\S]{0,400}api\("DELETE"/u);

  // A recovery action always exists and is always non-destructive - it only
  // ever navigates to a known-good view.
  assert.match(js, /function recoverToSafeScreen/u);
  assert.match(js, /setView\(state\.role === "coach" \? "coach-overview" : "today"\)/u);
});

test("support history displays only factually persisted states, defaulting to submitted", () => {
  assert.match(schema, /status\s+TEXT NOT NULL DEFAULT 'submitted'/u);
  assert.match(schema, /status IN \('submitted', 'acknowledged', 'closed'\)/u);

  assert.match(js, /function renderSupportHistory/u);
  assert.match(js, /async function refreshSupportHistory/u);
  assert.match(js, /titleCase\(report\.status\)/u);

  // The product client never writes acknowledged/closed itself.
  assert.doesNotMatch(routes, /'acknowledged'|'closed'/u);
  assert.doesNotMatch(service, /status:\s*"acknowledged"|status:\s*"closed"/u);
});

test("submitting the same correlation ID twice replays the original report instead of creating a duplicate", () => {
  assert.match(service, /ON CONFLICT \(correlation_id\) DO NOTHING/u);
  assert.match(service, /if \(existing\.rows\[0\]\)/u);
  assert.match(service, /support_report_correlation_id_conflict/u);
});

test("error notices offer a report action carrying the failed request's safe context, never the raw error payload or stack", () => {
  assert.match(js, /function buildFailureContextFromError/u);
  assert.match(js, /error\.requestMethod = method/u);
  assert.match(js, /error\.requestPath = path/u);
  assert.match(js, /options\.failureContext/u);
  assert.doesNotMatch(js, /buildFailureContextFromError[\s\S]{0,400}\.stack/u);
});

test("actor access: history and report creation are scoped to the caller's own resolved session, and cross-user correlation ids are rejected", () => {
  assert.match(service, /cleanString\(existing\.rows\[0\]\.user_id\) !== userId/u);
  assert.match(routes, /session\.account_row\.user_id/u);
});

test("every new interactive status/support control is a real focusable button/form, not a div handler (keyboard reachability)", () => {
  for (const id of [
    "checkPlatformStatusButton", "openSupportReportButton", "supportRetryButton",
    "supportRecoveryButton", "cancelSupportReportButton"
  ]) {
    const re = new RegExp(`<button[^>]*id="${id}"[^>]*type="button"`, "u");
    assert.match(html, re, `${id} must be a real <button type="button">`);
  }

  assert.match(html, /<form id="supportReportForm"/u);
  assert.match(html, /<textarea id="supportReportDescription"/u);
});

test("status/support markup does not get hidden on narrow (mobile) viewports", () => {
  const mobileHidingRules = [...css.matchAll(/@media[^{]*\{[\s\S]*?\n\}/gu)]
    .map((match) => match[0])
    .filter((block) => /max-width/u.test(block));

  for (const block of mobileHidingRules) {
    for (const selector of ["status-support-panel", "support-report-panel", "support-history-row"]) {
      assert.doesNotMatch(
        block,
        new RegExp(`\\.${selector}[^{]*\\{[^}]*display:\\s*none`, "u"),
        `${selector} must not be hidden on narrow viewports`
      );
    }
  }

  assert.match(css, /\.status-support-panel\b/u);
  assert.match(css, /\.support-report-panel\b/u);
});
