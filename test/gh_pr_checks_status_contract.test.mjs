import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseGhPrChecksText } from "../scripts/gh_pr_checks_status.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const scriptPath = path.join(__dirname, "..", "scripts", "gh_pr_checks_status.mjs");

test("gh pr checks parser treats summary success output as green", () => {
  const text = `
All checks were successful
0 cancelled, 0 failing, 10 successful, 0 skipped, and 0 pending checks
  `.trim();

  const parsed = parseGhPrChecksText(text);

  assert.equal(parsed.source, "summary");
  assert.equal(parsed.isGreen, true);
  assert.equal(parsed.hasPending, false);
  assert.equal(parsed.hasFailing, false);
  assert.equal(parsed.successfulCount, 10);
});

test("gh pr checks parser treats row-list success output as green", () => {
  const text = `
ci      pass    30s     https://example.test/ci
guard   pass    12s     https://example.test/guard
integration     pass    2m58s   https://example.test/integration
  `.trim();

  const parsed = parseGhPrChecksText(text);

  assert.equal(parsed.source, "rows");
  assert.equal(parsed.isGreen, true);
  assert.equal(parsed.hasPending, false);
  assert.equal(parsed.hasFailing, false);
  assert.equal(parsed.successfulCount, 3);
});

test("gh pr checks parser treats row-list pending output as pending and not green", () => {
  const text = `
integration     pending 0       https://example.test/integration
ci      pass    30s     https://example.test/ci
unit    pass    28s     https://example.test/unit
  `.trim();

  const parsed = parseGhPrChecksText(text);

  assert.equal(parsed.source, "rows");
  assert.equal(parsed.isGreen, false);
  assert.equal(parsed.hasPending, true);
  assert.equal(parsed.hasFailing, false);
  assert.equal(parsed.pendingCount, 1);
});

test("gh pr checks parser treats row-list failing output as failing and not green", () => {
  const text = `
integration     fail    2m58s   https://example.test/integration
ci      pass    30s     https://example.test/ci
  `.trim();

  const parsed = parseGhPrChecksText(text);

  assert.equal(parsed.source, "rows");
  assert.equal(parsed.isGreen, false);
  assert.equal(parsed.hasPending, false);
  assert.equal(parsed.hasFailing, true);
  assert.equal(parsed.failingCount, 1);
});

test("gh pr checks cli exits zero for green stdin input", () => {
  const text = `
ci      pass    30s     https://example.test/ci
guard   pass    12s     https://example.test/guard
integration     pass    2m58s   https://example.test/integration
  `.trim();

  const out = spawnSync(process.execPath, [scriptPath, "--stdin", "--json"], {
    input: text,
    encoding: "utf8"
  });

  assert.equal(out.status, 0);
  const parsed = JSON.parse(out.stdout.trim());
  assert.equal(parsed.isGreen, true);
});

test("gh pr checks cli exits non-zero for pending stdin input", () => {
  const text = `
integration     pending 0       https://example.test/integration
ci      pass    30s     https://example.test/ci
  `.trim();

  const out = spawnSync(process.execPath, [scriptPath, "--stdin", "--json"], {
    input: text,
    encoding: "utf8"
  });

  assert.equal(out.status, 1);
  const parsed = JSON.parse(out.stdout.trim());
  assert.equal(parsed.hasPending, true);
  assert.equal(parsed.isGreen, false);
});
