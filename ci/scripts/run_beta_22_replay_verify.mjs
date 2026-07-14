// DEV NOTE: BETA-22 verify-only CI replay runner.
// Mode admission is delegated to parseBeta22CliMode. Fixture update, write, accept, refresh,
// and record modes are forbidden and no file-write API is used.

import fs from "node:fs";
import process from "node:process";

import {
  parseBeta22CliMode,
  verifyBeta22Manifest,
  verifyBeta22Suite
} from "../lib/beta22_replay_verify_lib.mjs";

function readText(path) {
  return fs.readFileSync(
    path,
    "utf8"
  );
}

function readJson(path) {
  return JSON.parse(
    readText(path)
  );
}

function emitAndExit(
  result,
  exitCode
) {
  const output =
    `${JSON.stringify(
      result,
      null,
      2
    )}\n`;

  if (exitCode === 0) {
    process.stdout.write(output);
  }
  else {
    process.stderr.write(output);
  }

  process.exit(exitCode);
}

const mode =
  parseBeta22CliMode(
    process.argv.slice(2)
  );

if (!mode.ok) {
  emitAndExit(
    mode,
    1
  );
}

const paths = {
  contract:
    "replay/contracts/beta22_replay_verify_contract.json",
  failure_tokens:
    "replay/contracts/beta22_replay_verify_failure_tokens.json",
  vectors:
    "replay/suite/beta_phase1_7/vectors.json",
  vector_manifest:
    "replay/suite/beta_phase1_7/manifest.json",
  verify_inputs:
    "replay/suite/beta_phase1_7/verify_inputs.json",
  expected_outputs:
    "replay/suite/beta_phase1_7/expected_outputs.json",
  verify_manifest:
    "replay/suite/beta_phase1_7/verify_manifest.json"
};

const fileTexts = {
  contract:
    readText(paths.contract),
  failure_tokens:
    readText(
      paths.failure_tokens
    ),
  vectors:
    readText(paths.vectors),
  vector_manifest:
    readText(
      paths.vector_manifest
    ),
  verify_inputs:
    readText(
      paths.verify_inputs
    ),
  expected_outputs:
    readText(
      paths.expected_outputs
    )
};

const manifestResult =
  verifyBeta22Manifest(
    readJson(
      paths.verify_manifest
    ),
    fileTexts
  );

if (!manifestResult.ok) {
  emitAndExit(
    manifestResult,
    1
  );
}

const result =
  verifyBeta22Suite({
    suite:
      JSON.parse(
        fileTexts.vectors
      ),
    bindings:
      JSON.parse(
        fileTexts.verify_inputs
      ),
    expectedOutputs:
      JSON.parse(
        fileTexts.expected_outputs
      ),
    contract:
      JSON.parse(
        fileTexts.contract
      )
  });

if (!result.ok) {
  emitAndExit(
    result,
    1
  );
}

emitAndExit(
  result,
  0
);
