// DEV NOTE: BETA-21 deterministic replay-vector suite generator.

import fs from "node:fs";
import path from "node:path";

import {
  buildBeta21ReplayVectorManifest,
  buildBeta21ReplayVectorSuite,
  renderBeta21ReplayVectorSuite
} from "../lib/beta21_replay_vector_envelope_lib.mjs";

const mode =
  process.argv.includes(
    "--write"
  )
    ? "write"
    : "check";

const suitePath =
  path.join(
    "replay",
    "suite",
    "beta_phase1_7",
    "vectors.json"
  );

const manifestPath =
  path.join(
    "replay",
    "suite",
    "beta_phase1_7",
    "manifest.json"
  );

const suite =
  buildBeta21ReplayVectorSuite();

const suiteText =
  renderBeta21ReplayVectorSuite(
    suite
  );

const manifest =
  buildBeta21ReplayVectorManifest(
    suiteText
  );

const manifestText =
  `${JSON.stringify(
    manifest,
    null,
    2
  )}\n`;

function writeUtf8(
  filePath,
  content
) {
  fs.mkdirSync(
    path.dirname(filePath),
    {
      recursive: true
    }
  );

  fs.writeFileSync(
    filePath,
    content,
    "utf8"
  );
}

function checkExact(
  filePath,
  expected
) {
  if (
    !fs.existsSync(filePath)
  ) {
    console.error(
      JSON.stringify({
        ok: false,
        failure_token:
          "beta21_missing_phase_output",
        path: filePath
      })
    );

    process.exit(1);
  }

  const actual =
    fs.readFileSync(
      filePath,
      "utf8"
    );

  if (actual !== expected) {
    console.error(
      JSON.stringify({
        ok: false,
        failure_token:
          "beta21_replay_divergence",
        path: filePath
      })
    );

    process.exit(1);
  }
}

if (mode === "write") {
  writeUtf8(
    suitePath,
    suiteText
  );

  writeUtf8(
    manifestPath,
    manifestText
  );
}
else {
  checkExact(
    suitePath,
    suiteText
  );

  checkExact(
    manifestPath,
    manifestText
  );
}

console.log(
  JSON.stringify({
    ok: true,
    mode,
    vector_count:
      suite.vectors.length,
    positive_vector_count:
      manifest
        .positive_vector_count,
    negative_shell_count:
      manifest
        .negative_shell_count,
    suite_sha256:
      manifest.suite_sha256
  })
);
