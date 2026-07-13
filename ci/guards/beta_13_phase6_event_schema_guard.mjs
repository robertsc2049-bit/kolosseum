// @law: Repo Governance
// @severity: high
// @scope: engine
// DEV NOTE: BETA-13 closed-world Phase 6 runtime event schema guard.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
let failed = false;

function fail(message) {
  failed = true;

  console.error(
    `CI_BETA_13_PHASE6_EVENT_SCHEMA::FAIL::${message}`
  );
}

function read(relativePath) {
  const filePath = path.join(root, relativePath);

  if (!fs.existsSync(filePath)) {
    fail(`missing::${relativePath}`);
    return "";
  }

  return fs.readFileSync(filePath, "utf8");
}

function sha256(content) {
  return crypto
    .createHash("sha256")
    .update(content, "utf8")
    .digest("hex");
}

const source = read(
  "engine/src/runtime/beta13_phase6_event_schema.js"
);

const publicSource = read(
  "engine/src/runtime/session_summary.js"
);

const typeSource = read(
  "engine/types/runtime/session_summary.d.ts"
);

const testSource = read(
  "test/beta_13_phase6_event_schema.test.mjs"
);

const runnerSource = read(
  "ci/scripts/run_beta_13_phase6_event_schema_tests.mjs"
);

const docSource = read(
  "docs/runtime/BETA_13_PHASE6_EVENT_SCHEMA.md"
);

const packageSource = read("package.json");

for (const token of [
  "SESSION_START",
  "WORK_ITEM_START",
  "WORK_ITEM_DONE",
  "WORK_ITEM_SKIP",
  "SPLIT_ENTER",
  "SPLIT_RETURN_DECISION",
  "PAIN_FLAG",
  "PAIN_FOLLOW_UP",
  "SESSION_END",
  "phase6_event_schema_unknown_event_type",
  "phase6_event_schema_unknown_work_item",
  "phase6_event_schema_unknown_session",
  "phase6_event_schema_unknown_block",
  "phase6_event_schema_user_block_id_forbidden",
  "phase6_event_schema_free_text_forbidden",
  "phase6_event_schema_append_only_violation",
  "admitBeta13Phase6EventBeforeReducer"
]) {
  if (!source.includes(token)) {
    fail(`source_token_missing::${token}`);
  }
}

for (const forbidden of [
  "Math.random",
  "Date.now",
  "new Date(",
  "randomUUID",
  "performance.now"
]) {
  if (source.includes(forbidden)) {
    fail(`forbidden_source_token::${forbidden}`);
  }
}

if (
  !publicSource.includes(
    'from "./beta13_phase6_event_schema.js"'
  )
) {
  fail("public_runtime_re_export_missing");
}

for (const token of [
  "beta13Phase6EventSchemaContract",
  "validateBeta13Phase6EventInput",
  "validateBeta13Phase6EventLog",
  "appendBeta13Phase6EventLog",
  "admitBeta13Phase6EventBeforeReducer"
]) {
  if (!typeSource.includes(token)) {
    fail(`public_type_missing::${token}`);
  }
}

for (const token of [
  "unknown event type fails",
  "unknown work item fails",
  "unknown route session fails",
  "user-entered block ID is forbidden",
  "free-text runtime truth is forbidden",
  "canonical event rejects unknown block ID",
  "append-only sequence tamper fails",
  "pain follow-up is required",
  "invalid payload fails before reducer state changes"
]) {
  if (!testSource.includes(token)) {
    fail(`test_missing::${token}`);
  }
}

for (const token of [
  "npm run build",
  "beta_13_phase6_event_schema.test.mjs"
]) {
  if (!runnerSource.includes(token)) {
    fail(`runner_token_missing::${token}`);
  }
}

for (const token of [
  "node ci/scripts/run_beta_13_phase6_event_schema_tests.mjs",
  "node ci/guards/beta_13_phase6_event_schema_guard.mjs"
]) {
  if (!packageSource.includes(token)) {
    fail(`package_entrypoint_missing::${token}`);
  }
}

for (const token of [
  "User-entered block IDs are forbidden.",
  "Free-text runtime truth is forbidden.",
  "Append-only law",
  "Invalid event logs fail before reducer state changes."
]) {
  if (!docSource.includes(token)) {
    fail(`documentation_token_missing::${token}`);
  }
}

const fixtureRoot = path.join(
  root,
  "test",
  "fixtures",
  "beta_13_phase6_event_schema"
);

const manifestPath = path.join(
  fixtureRoot,
  "manifest.json"
);

if (!fs.existsSync(manifestPath)) {
  fail("fixture_manifest_missing");
}
else {
  const manifest = JSON.parse(
    fs.readFileSync(manifestPath, "utf8")
  );

  const expectedNames = [
    "general_strength.json",
    "powerlifting.json",
    "rugby_union.json"
  ];

  const actualNames = manifest.fixtures
    .map((entry) => entry.file)
    .sort();

  if (
    JSON.stringify(actualNames) !==
    JSON.stringify(expectedNames)
  ) {
    fail("fixture_file_set_invalid");
  }

  const expectedActivities = [
    "general_strength",
    "powerlifting",
    "rugby_union"
  ];

  const actualActivities = manifest.fixtures
    .map((entry) => entry.activity_id)
    .sort();

  if (
    JSON.stringify(actualActivities) !==
    JSON.stringify(expectedActivities)
  ) {
    fail("fixture_activity_set_invalid");
  }

  for (const entry of manifest.fixtures) {
    const filePath = path.join(
      fixtureRoot,
      entry.file
    );

    if (!fs.existsSync(filePath)) {
      fail(`fixture_missing::${entry.file}`);
      continue;
    }

    const content = fs.readFileSync(
      filePath,
      "utf8"
    );

    if (sha256(content) !== entry.sha256) {
      fail(`fixture_hash_mismatch::${entry.file}`);
    }
  }
}

if (!failed) {
  const runtimePath = path.join(
    root,
    "engine",
    "dist",
    "src",
    "runtime",
    "beta13_phase6_event_schema.js"
  );

  if (!fs.existsSync(runtimePath)) {
    fail("compiled_runtime_missing");
  }
  else {
    const runtime = await import(
      pathToFileURL(runtimePath).href
    );

    const session = JSON.parse(
      fs.readFileSync(
        path.join(
          fixtureRoot,
          "powerlifting.json"
        ),
        "utf8"
      )
    );

    let reducerCalls = 0;

    try {
      runtime.admitBeta13Phase6EventBeforeReducer(
        session,
        [],
        session.session_id,
        {
          event_type: "UNKNOWN_EVENT"
        },
        {
          accepted: []
        },
        () => {
          reducerCalls += 1;
          return {};
        }
      );

      fail("unknown_event_runtime_probe_accepted");
    }
    catch (error) {
      if (
        error?.failure_token !==
        "phase6_event_schema_unknown_event_type"
      ) {
        fail(
          "unknown_event_runtime_probe_wrong_failure"
        );
      }
    }

    if (reducerCalls !== 0) {
      fail("reducer_called_before_validation");
    }

    const first =
      runtime.appendBeta13Phase6EventLog(
        session,
        [],
        session.session_id,
        {
          event_type: "SESSION_START"
        }
      );

    const second =
      runtime.appendBeta13Phase6EventLog(
        session,
        [],
        session.session_id,
        {
          event_type: "SESSION_START"
        }
      );

    if (
      runtime.stableBeta13Phase6EventJson(first) !==
      runtime.stableBeta13Phase6EventJson(second)
    ) {
      fail("runtime_event_materialisation_unstable");
    }

    if (
      !Object.isFrozen(first) ||
      !Object.isFrozen(first[0])
    ) {
      fail("runtime_event_log_not_frozen");
    }
  }
}

if (failed) {
  process.exitCode = 1;
}
else {
  console.log(
    JSON.stringify({
      ok: true,
      guard: "BETA-13",
      token:
        "CI_BETA_13_PHASE6_EVENT_SCHEMA",
      message:
        "Phase 6 event schema contract passed."
    })
  );
}
