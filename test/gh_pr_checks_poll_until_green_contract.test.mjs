import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  parseArgs,
  interpretPollResult,
  parseStatusHelperProcessResult,
  pollUntilGreen
} from "../scripts/gh_pr_checks_poll_until_green.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pollerPath = path.join(__dirname, "..", "scripts", "gh_pr_checks_poll_until_green.mjs");

test("gh pr checks poller source contract pins repo-owned single-owner parser usage and json-only status parsing", async () => {
  const fs = await import("node:fs/promises");
  const source = await fs.readFile(pollerPath, "utf8");

  assert.match(source, /scripts\/gh_pr_checks_status\.mjs/);
  assert.match(source, /--repo/);
  assert.match(source, /--pr/);
  assert.match(source, /--json/);
  assert.match(source, /parseStatusHelperProcessResult/);
  assert.match(source, /emitted non-JSON output/);
  assert.doesNotMatch(source, /gh\s+pr\s+checks\s+--watch/);
});

test("gh pr checks poller parseArgs pins required repo and pr args", () => {
  const args = parseArgs(["--repo", "robertsc2049-bit/kolosseum", "--pr", "382"]);

  assert.equal(args.repo, "robertsc2049-bit/kolosseum");
  assert.equal(args.pr, "382");
  assert.equal(args.attempts, 20);
  assert.equal(args.delaySeconds, 15);
  assert.equal(args.json, false);
});

test("gh pr checks poller interpretPollResult returns green verdict", () => {
  const verdict = interpretPollResult(
    { isGreen: true, hasPending: false, hasFailing: false },
    2,
    20
  );

  assert.deepEqual(verdict, {
    done: true,
    ok: true,
    reason: "green"
  });
});

test("gh pr checks poller interpretPollResult returns failing verdict", () => {
  const verdict = interpretPollResult(
    { isGreen: false, hasPending: false, hasFailing: true },
    2,
    20
  );

  assert.deepEqual(verdict, {
    done: true,
    ok: false,
    reason: "failing"
  });
});

test("gh pr checks poller interpretPollResult returns timeout on final pending attempt", () => {
  const verdict = interpretPollResult(
    { isGreen: false, hasPending: true, hasFailing: false },
    20,
    20
  );

  assert.deepEqual(verdict, {
    done: true,
    ok: false,
    reason: "timeout"
  });
});

test("gh pr checks poller helper process result accepts pending json on non-zero exit", () => {
  const interpreted = parseStatusHelperProcessResult({
    status: 1,
    stdout: JSON.stringify({
      ok: true,
      isGreen: false,
      hasPending: true,
      hasFailing: false,
      source: "rows"
    }),
    stderr: ""
  });

  assert.equal(interpreted.exitCode, 1);
  assert.equal(interpreted.parsed.hasPending, true);
  assert.equal(interpreted.parsed.isGreen, false);
});

test("gh pr checks poller helper process result accepts failing json on non-zero exit", () => {
  const interpreted = parseStatusHelperProcessResult({
    status: 1,
    stdout: JSON.stringify({
      ok: true,
      isGreen: false,
      hasPending: false,
      hasFailing: true,
      source: "rows"
    }),
    stderr: ""
  });

  assert.equal(interpreted.exitCode, 1);
  assert.equal(interpreted.parsed.hasFailing, true);
  assert.equal(interpreted.parsed.isGreen, false);
});

test("gh pr checks poller helper process result rejects empty stdout", () => {
  assert.throws(
    () =>
      parseStatusHelperProcessResult({
        status: 1,
        stdout: "",
        stderr: "gh_pr_checks_status returned no stdout."
      }),
    /returned no stdout/i
  );
});

test("gh pr checks poller helper process result rejects raw row output leakage in json mode", () => {
  assert.throws(
    () =>
      parseStatusHelperProcessResult({
        status: 1,
        stdout: `
integration     pending 0       https://example.test/integration
ci      pass    30s     https://example.test/ci
        `.trim(),
        stderr: ""
      }),
    /non-JSON output/i
  );
});

test("gh pr checks poller stops immediately when first attempt is green", () => {
  let calls = 0;

  const result = pollUntilGreen({
    repo: "robertsc2049-bit/kolosseum",
    pr: "382",
    attempts: 20,
    delaySeconds: 0,
    runStatus() {
      calls += 1;
      return {
        ok: true,
        isGreen: true,
        hasPending: false,
        hasFailing: false
      };
    },
    sleepFn() {
      throw new Error("sleep should not be called when green immediately");
    }
  });

  assert.equal(calls, 1);
  assert.equal(result.ok, true);
  assert.equal(result.reason, "green");
  assert.equal(result.attemptsUsed, 1);
});

test("gh pr checks poller retries pending and then returns green", () => {
  let calls = 0;
  let sleeps = 0;

  const result = pollUntilGreen({
    repo: "robertsc2049-bit/kolosseum",
    pr: "382",
    attempts: 5,
    delaySeconds: 0,
    runStatus() {
      calls += 1;

      if (calls < 3) {
        return {
          ok: true,
          isGreen: false,
          hasPending: true,
          hasFailing: false
        };
      }

      return {
        ok: true,
        isGreen: true,
        hasPending: false,
        hasFailing: false
      };
    },
    sleepFn() {
      sleeps += 1;
    }
  });

  assert.equal(calls, 3);
  assert.equal(sleeps, 2);
  assert.equal(result.ok, true);
  assert.equal(result.reason, "green");
  assert.equal(result.attemptsUsed, 3);
});

test("gh pr checks poller stops on failing state without extra retries", () => {
  let calls = 0;

  const result = pollUntilGreen({
    repo: "robertsc2049-bit/kolosseum",
    pr: "382",
    attempts: 5,
    delaySeconds: 0,
    runStatus() {
      calls += 1;
      return {
        ok: true,
        isGreen: false,
        hasPending: false,
        hasFailing: true
      };
    },
    sleepFn() {
      throw new Error("sleep should not be called on failing state");
    }
  });

  assert.equal(calls, 1);
  assert.equal(result.ok, false);
  assert.equal(result.reason, "failing");
  assert.equal(result.attemptsUsed, 1);
});

test("gh pr checks poller times out after final pending attempt", () => {
  let calls = 0;
  let sleeps = 0;

  const result = pollUntilGreen({
    repo: "robertsc2049-bit/kolosseum",
    pr: "382",
    attempts: 3,
    delaySeconds: 0,
    runStatus() {
      calls += 1;
      return {
        ok: true,
        isGreen: false,
        hasPending: true,
        hasFailing: false
      };
    },
    sleepFn() {
      sleeps += 1;
    }
  });

  assert.equal(calls, 3);
  assert.equal(sleeps, 2);
  assert.equal(result.ok, false);
  assert.equal(result.reason, "timeout");
  assert.equal(result.attemptsUsed, 3);
});

test("gh pr checks poller cli source pins json output branch", async () => {
  const fs = await import("node:fs/promises");
  const source = await fs.readFile(pollerPath, "utf8");

  assert.match(source, /JSON\.stringify\(result\)/);
  assert.match(source, /process\.exit\(result\.ok \? 0 : 1\)/);
});
