// DEV NOTE: CI guard surface. This script enforces the beta token report contract.
// It validates the central report helper and topic token catalogue only; it does
// not reinterpret stable token meaning or inspect runtime/product semantics.

import {
  BETA_TOKEN_REPORT_TOPIC_TOKENS,
  CI_TOKEN_REPORT_CONTRACT_TOKEN,
  CI_TOKEN_REPORT_SCHEMA_VERSION,
  createCiTokenReport
} from "./ci_token_report.mjs";

function fail(message, details = {}) {
  const report = createCiTokenReport({
    guard: "BETA-03",
    token: CI_TOKEN_REPORT_CONTRACT_TOKEN,
    failures: [
      {
        token: CI_TOKEN_REPORT_CONTRACT_TOKEN,
        message,
        source: "ci/scripts/ci_token_report_contract_guard.mjs",
        details
      }
    ]
  });

  console.error(JSON.stringify(report));
  process.exit(1);
}

function assertTopicToken(name, value) {
  if (typeof value !== "string" || !/^CI_[A-Z0-9_]+$/.test(value)) {
    fail("CI token report topic token is invalid.", {
      topic: name,
      token: value
    });
  }
}

const expectedTopics = ["spine", "schema", "registry", "copy", "replay", "phase7", "phase8"];

for (const topic of expectedTopics) {
  if (!Object.prototype.hasOwnProperty.call(BETA_TOKEN_REPORT_TOPIC_TOKENS, topic)) {
    fail("CI token report topic token is missing.", { topic });
  }

  assertTopicToken(topic, BETA_TOKEN_REPORT_TOPIC_TOKENS[topic]);
}

const probe = createCiTokenReport({
  guard: "BETA-03",
  token: CI_TOKEN_REPORT_CONTRACT_TOKEN,
  failures: []
});

if (probe.ok !== true || probe.schema_version !== CI_TOKEN_REPORT_SCHEMA_VERSION || probe.failure_count !== 0) {
  fail("CI token report no-failure shape is invalid.", { probe });
}

console.log("OK: ci_token_report_contract_guard");
