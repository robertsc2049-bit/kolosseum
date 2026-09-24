// DEV NOTE: FULL-UI-20 status, support and error-reporting static surface contract.
// The interactive platform-status/support-report/support-history panel moved
// to React (AccountSupportPanel.tsx + useAccountSupport.ts, mounted at
// #account-support-root) - see public/app-src/__tests__/AccountSupportPanel.test.tsx
// for its behavioral proof. Two small bridges keep app.js's global error
// handling connected to the React panel (see useAccountSupport.ts's DEV
// NOTE); this file still asserts those bridges exist. Backend routes,
// service and schema are untouched and still asserted directly below.
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
const client = read("public/app-src/api/accountSupportClient.ts");
const hook = read("public/app-src/screens/account/useAccountSupport.ts");
const panel = read("public/app-src/screens/account/AccountSupportPanel.tsx");

test("platform status is visible and reads the existing factual /health surface, not an invented incident feed", () => {
  assert.match(html, /id="account-support-root"/u);

  assert.match(client, /export async function loadPlatformStatus[\s\S]{0,40}request\("GET", "\/health"\)/u);
  assert.match(hook, /const result = await loadPlatformStatus\(\)/u);
  assert.match(hook, /operational \? "Operational" : "Degraded"/u);
  assert.doesNotMatch(panel, /incident/iu);
  assert.doesNotMatch(hook, /incident/iu);
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
  assert.match(hook, /function generateCorrelationId/u);
  assert.match(hook, /function buildBrowserContextSnapshot/u);
  assert.match(hook, /const openReportForm = useCallback/u);
  assert.match(hook, /route_hash: window\.location\.hash \|\| "#\/"/u);

  assert.match(panel, /<span>Correlation ID<\/span>/u);
  assert.match(panel, /<span>Route<\/span>/u);
  assert.match(panel, /<span>Timestamp<\/span>/u);
  assert.match(panel, /<span>Browser context<\/span>/u);

  // The preview shown before submission and the payload actually submitted
  // must be the same captured context object, not two independently built
  // values that could drift.
  assert.match(hook, /correlation_id: context\.correlation_id/u);
  assert.match(panel, /reportContext\.correlation_id/u);
});

test("the description is a required, length-bounded user-entered field, recorded verbatim only through the explicit description column", () => {
  assert.match(panel, /<textarea[\s\S]{0,40}required[\s\S]{0,40}maxLength=\{4000\}/u);
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

  assert.match(hook, /const retryFailedRequest = useCallback/u);
  assert.match(hook, /context\.method !== "GET"/u);
  assert.match(client, /export async function retryFailedGet\(path: string\)[\s\S]{0,40}request\("GET", path\)/u);
  assert.doesNotMatch(panel, /canRetry[\s\S]{0,200}"POST"/u);

  // A recovery action always exists and is always non-destructive - it only
  // ever navigates to a known-good view. It bridges to legacy since only
  // legacy's state.role/setView() know the current actor and safe screen.
  assert.match(hook, /const recoverToSafeScreen = useCallback/u);
  assert.match(hook, /new CustomEvent\(RECOVER_EVENT\)/u);
  assert.match(js, /document\.addEventListener\("kolosseum:recover-to-safe-screen", \(\) => \{/u);
  assert.match(js, /setView\(state\.role === "coach" \? "coach-overview" : "today"\)/u);
});

test("support history displays only factually persisted states, defaulting to submitted", () => {
  assert.match(schema, /status\s+TEXT NOT NULL DEFAULT 'submitted'/u);
  assert.match(schema, /status IN \('submitted', 'acknowledged', 'closed'\)/u);

  assert.match(panel, /function HistoryRow/u);
  assert.match(hook, /const refreshHistory = useCallback/u);
  assert.match(panel, /titleCase\(report\.status\)/u);

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

  // The global error notice hands the failure context to the React panel
  // via a bridge event instead of building the report form itself.
  assert.match(js, /new CustomEvent\("kolosseum:open-support-report", \{ detail: \{ failureContext: options\.failureContext \} \}\)/u);
  assert.match(hook, /const OPEN_REPORT_EVENT = "kolosseum:open-support-report"/u);
});

test("actor access: history and report creation are scoped to the caller's own resolved session, and cross-user correlation ids are rejected", () => {
  assert.match(service, /cleanString\(existing\.rows\[0\]\.user_id\) !== userId/u);
  assert.match(routes, /session\.account_row\.user_id/u);
});

test("every new interactive status/support control is a real focusable button/form, not a div handler (keyboard reachability)", () => {
  for (const label of ["Check platform status", "Report a problem", "Retry the failed request", "Return to a safe screen", "Cancel"]) {
    const re = new RegExp(`<button[\\s\\S]*?type="button"[\\s\\S]*?>${label}</button>`, "u");
    assert.match(panel, re, `${label} must be a real <button type="button">`);
  }

  assert.match(panel, /<form className="form-panel" onSubmit=\{handleSubmit\}>/u);
  assert.match(panel, /<textarea/u);
  assert.match(panel, /<button className="button primary" type="submit"/u);
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
  assert.match(panel, /className="panel status-support-panel"/u);
  assert.match(panel, /className="support-report-panel"/u);
});
