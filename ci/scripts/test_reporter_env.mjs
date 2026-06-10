
// DEV NOTE: Repository automation script. This file exists to make a repeatable repo operation
// deterministic and reviewable. Keep side effects explicit, paths repo-root relative, and
// failure output readable for PowerShell and CI users.

import process from "node:process";

function tokenizeNodeOptions(value) {
  return String(value ?? "")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

export function applyDefaultNodeTestReporterEnv() {
  const disable = String(process.env.KOLOSSEUM_TEST_REPORTER_DISABLE ?? "").trim();
  if (disable === "1" || disable.toLowerCase() === "true") {
    return null;
  }

  const reporter = String(process.env.KOLOSSEUM_TEST_REPORTER ?? "dot").trim() || "dot";
  const existingTokens = tokenizeNodeOptions(process.env.NODE_OPTIONS);
  const hasExplicitReporter = existingTokens.some((token) => token.startsWith("--test-reporter="));

  if (!hasExplicitReporter) {
    existingTokens.push(`--test-reporter=${reporter}`);
    process.env.NODE_OPTIONS = existingTokens.join(" ");
  }

  return reporter;
}
