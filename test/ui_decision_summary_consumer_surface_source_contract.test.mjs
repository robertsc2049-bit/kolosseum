import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("decision summary consumer surface source contract: server exposes redirect convenience and UI consumes the stable endpoint with distinct states", () => {
  const repo = process.cwd();

  const serverSrc = fs.readFileSync(path.join(repo, "src", "server.ts"), "utf8");
  const htmlSrc = fs.readFileSync(path.join(repo, "public", "decision-summary.html"), "utf8");
  const jsSrc = fs.readFileSync(path.join(repo, "public", "decision-summary.js"), "utf8");

  assert.match(
    serverSrc,
    /app\.get\("\/ui\/decision-summary\/:run_id",\s*\(req,\s*res\)\s*=>\s*\{/,
    "expected server to expose /ui/decision-summary/:run_id redirect convenience"
  );

  assert.match(
    serverSrc,
    /return res\.redirect\(`\/ui\/decision-summary\.html\?run_id=\$\{encodeURIComponent\(runId\)\}`\);/,
    "expected server redirect convenience to preserve run_id through the query string"
  );

  assert.match(
    htmlSrc,
    /<input id="runId" class="input" placeholder="e\.g\. er_\.\.\." autocomplete="off" \/>/,
    "expected consumer surface to expose one run_id input"
  );

  assert.match(
    htmlSrc,
    /<button id="btnLoad" class="btn">Load<\/button>/,
    "expected consumer surface to expose one explicit load action"
  );

  assert.match(
    htmlSrc,
    /id="stateLoading"/,
    "expected explicit loading state container"
  );

  assert.match(
    htmlSrc,
    /id="stateBadRequest"/,
    "expected explicit bad-request state container"
  );

  assert.match(
    htmlSrc,
    /id="stateNotFound"/,
    "expected explicit not-found state container"
  );

  assert.match(
    htmlSrc,
    /id="stateInvalidSource"/,
    "expected explicit invalid-source state container"
  );

  assert.match(
    htmlSrc,
    /id="successCard"/,
    "expected explicit success state container"
  );

  assert.match(
    htmlSrc,
    /id="statePill"/,
    "expected consumer surface to expose a visible state pill"
  );

  assert.match(
    htmlSrc,
    /id="vRunId"/,
    "expected success surface to display identity.run_id"
  );

  assert.match(
    htmlSrc,
    /id="vCurrentness"/,
    "expected success surface to display currentness.state"
  );

  assert.match(
    htmlSrc,
    /id="vOutcome"/,
    "expected success surface to display outcome"
  );

  assert.match(
    htmlSrc,
    /id="driversList"/,
    "expected success surface to display drivers"
  );

  assert.match(
    htmlSrc,
    /id="vCreatedAt"/,
    "expected success surface to display timeline.created_at"
  );

  assert.match(
    htmlSrc,
    /id="vCompletedAt"/,
    "expected success surface to display timeline.completed_at"
  );

  assert.match(
    htmlSrc,
    /id="vAuditSource"/,
    "expected success surface to display audit.source"
  );

  assert.match(
    htmlSrc,
    /id="vAuditResolvedFrom"/,
    "expected success surface to display audit.resolved_from"
  );

  assert.match(
    htmlSrc,
    /id="issuesList"/,
    "expected success surface to display issues"
  );

  assert.match(
    htmlSrc,
    /id="rawPayload"/,
    "expected success surface to expose the raw payload panel"
  );

  assert.match(
    jsSrc,
    /const initialRunId = qs\.get\("run_id"\);/,
    "expected consumer surface to accept run_id from the query string"
  );

  assert.match(
    jsSrc,
    /await httpJson\(`\/sessions\/decision-summary\/\$\{encodeURIComponent\(runId\)\}`\);/,
    "expected consumer surface to consume the stable decision-summary endpoint"
  );

  assert.match(
    jsSrc,
    /if \(result\.status === 400\) \{\s*renderBadRequest\(message\);/s,
    "expected explicit bad-request mapping"
  );

  assert.match(
    jsSrc,
    /if \(result\.status === 404\) \{\s*renderNotFound\(message\);/s,
    "expected explicit not-found mapping"
  );

  assert.match(
    jsSrc,
    /renderInvalidSource\(message\);/,
    "expected explicit invalid-source or internal-failure mapping"
  );
});
