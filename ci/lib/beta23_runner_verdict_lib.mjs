// DEV NOTE: BETA-23 stable machine-readable RunnerVerdict contract.
// This library packages BETA-22 replay results for a future Phase 8 sealing
// dependency. It emits no advice, explanation, narrative, or correctness claim.

import crypto from "node:crypto";

import {
  betaCanonicalJson
} from "../../engine/dist/src/phases/betaCanonical.js";

import {
  BETA22_PHASE_ORDER,
  BETA22_REPEAT_COUNT
} from "./beta22_replay_verify_lib.mjs";

export const BETA23_REPLAY_SUITE_VERSION =
  "1.0.0";

export const BETA23_RUNNER_VERDICT_KEYS =
  Object.freeze([
    "runner_verdict_id",
    "runner_verdict_checksum_sha256",
    "verdict",
    "canonical_input_hash",
    "selection_hash",
    "projection_hash",
    "replayed_phase_scope",
    "engine_version",
    "enum_bundle_version",
    "replay_suite_version",
    "failure_tokens"
  ]);

export const BETA23_ALLOWED_REPLAY_FAILURE_TOKENS =
  Object.freeze([
    "beta21_replay_divergence",
    "beta21_invalid_failure_token",
    "beta21_missing_phase_output"
  ]);

export const BETA23_FAILURE_TOKENS =
  Object.freeze([
    "beta23_input_invalid",
    "beta23_missing_required_field",
    "beta23_unknown_field",
    "beta23_verdict_invalid",
    "beta23_hash_invalid",
    "beta23_scope_dishonest",
    "beta23_failure_tokens_invalid",
    "beta23_runner_verdict_id_mismatch",
    "beta23_runner_verdict_checksum_mismatch",
    "beta23_runner_result_invalid",
    "beta23_manifest_invalid"
  ]);

export const beta23RunnerVerdictContract =
  Object.freeze({
    contract_id:
      "beta23_runner_verdict_contract",
    slice_id: "BETA-23",
    version: "1.0.0",
    schema_id:
      "kolosseum.beta23.runner_verdict.v1",
    replay_suite_version:
      BETA23_REPLAY_SUITE_VERSION,
    checksum_algorithm: "sha256",
    checksum_encoding:
      "lowercase_hex",
    checksum_material:
      "canonical_json_utf8_without_runner_verdict_checksum_sha256",
    id_material:
      "canonical_json_utf8_without_runner_verdict_id_and_checksum",
    verdict_values:
      Object.freeze([
        "ACCEPTED",
        "REJECTED"
      ]),
    accepted_replayed_phase_scope:
      BETA22_PHASE_ORDER,
    rejected_replayed_phase_scope:
      Object.freeze([]),
    accepted_failure_tokens:
      Object.freeze([]),
    rejected_failure_tokens:
      BETA23_ALLOWED_REPLAY_FAILURE_TOKENS,
    narrative_fields_allowed: false,
    phase8_sealing_dependency_ready:
      true
  });

const HASH_RE =
  /^[a-f0-9]{64}$/u;

const RUNNER_VERDICT_ID_RE =
  /^beta23_runner_verdict_[a-f0-9]{24}$/u;

function isRecord(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function clone(value) {
  return JSON.parse(
    JSON.stringify(value)
  );
}

function deepFreeze(value) {
  if (
    value === null ||
    (
      typeof value !== "object" &&
      typeof value !== "function"
    )
  ) {
    return value;
  }

  if (Object.isFrozen(value)) {
    return value;
  }

  Object.freeze(value);

  for (
    const child
    of Object.values(value)
  ) {
    deepFreeze(child);
  }

  return value;
}

function sha256(value) {
  return crypto
    .createHash("sha256")
    .update(value)
    .digest("hex");
}

function exactKeys(
  value,
  expectedKeys
) {
  if (!isRecord(value)) {
    return false;
  }

  return (
    Object.keys(value)
      .sort()
      .join("\u0000") ===
    [...expectedKeys]
      .sort()
      .join("\u0000")
  );
}

function exactArray(
  actual,
  expected
) {
  return (
    Array.isArray(actual) &&
    actual.length ===
      expected.length &&
    actual.every(
      (value, index) =>
        value === expected[index]
    )
  );
}

function failure(
  failureToken,
  details = {}
) {
  return deepFreeze({
    ok: false,
    failure_token:
      failureToken,
    details:
      clone(details)
  });
}

function identityMaterial(fields) {
  return {
    verdict:
      fields.verdict,
    canonical_input_hash:
      fields.canonical_input_hash,
    selection_hash:
      fields.selection_hash,
    projection_hash:
      fields.projection_hash,
    replayed_phase_scope:
      clone(
        fields.replayed_phase_scope
      ),
    engine_version:
      fields.engine_version,
    enum_bundle_version:
      fields.enum_bundle_version,
    replay_suite_version:
      fields.replay_suite_version,
    failure_tokens:
      clone(
        fields.failure_tokens
      )
  };
}

function checksumMaterial(verdict) {
  return {
    runner_verdict_id:
      verdict.runner_verdict_id,
    verdict:
      verdict.verdict,
    canonical_input_hash:
      verdict.canonical_input_hash,
    selection_hash:
      verdict.selection_hash,
    projection_hash:
      verdict.projection_hash,
    replayed_phase_scope:
      clone(
        verdict.replayed_phase_scope
      ),
    engine_version:
      verdict.engine_version,
    enum_bundle_version:
      verdict.enum_bundle_version,
    replay_suite_version:
      verdict.replay_suite_version,
    failure_tokens:
      clone(
        verdict.failure_tokens
      )
  };
}

function baseFieldsAreValid(fields) {
  if (
    !isRecord(fields) ||
    fields.verdict !== "ACCEPTED" &&
      fields.verdict !== "REJECTED" ||
    !HASH_RE.test(
      fields.canonical_input_hash ??
        ""
    ) ||
    typeof fields.engine_version !==
      "string" ||
    fields.engine_version.length === 0 ||
    typeof fields.enum_bundle_version !==
      "string" ||
    fields.enum_bundle_version.length ===
      0 ||
    fields.replay_suite_version !==
      BETA23_REPLAY_SUITE_VERSION ||
    !Array.isArray(
      fields.replayed_phase_scope
    ) ||
    !Array.isArray(
      fields.failure_tokens
    )
  ) {
    return false;
  }

  if (
    fields.verdict === "ACCEPTED"
  ) {
    return (
      HASH_RE.test(
        fields.selection_hash ??
          ""
      ) &&
      HASH_RE.test(
        fields.projection_hash ??
          ""
      ) &&
      exactArray(
        fields.replayed_phase_scope,
        BETA22_PHASE_ORDER
      ) &&
      fields.failure_tokens.length ===
        0
    );
  }

  return (
    fields.selection_hash === null &&
    fields.projection_hash === null &&
    exactArray(
      fields.replayed_phase_scope,
      []
    ) &&
    fields.failure_tokens.length >=
      1 &&
    fields.failure_tokens.every(
      (token) =>
        BETA23_ALLOWED_REPLAY_FAILURE_TOKENS
          .includes(token)
    ) &&
    new Set(
      fields.failure_tokens
    ).size ===
      fields.failure_tokens.length
  );
}

export function computeBeta23RunnerVerdictId(
  fields
) {
  if (!baseFieldsAreValid(fields)) {
    return null;
  }

  const digest =
    sha256(
      betaCanonicalJson(
        identityMaterial(fields)
      )
    );

  return (
    "beta23_runner_verdict_" +
    digest.slice(0, 24)
  );
}

export function computeBeta23RunnerVerdictChecksum(
  verdict
) {
  if (
    !isRecord(verdict) ||
    !RUNNER_VERDICT_ID_RE.test(
      verdict.runner_verdict_id ??
        ""
    )
  ) {
    return null;
  }

  return sha256(
    betaCanonicalJson(
      checksumMaterial(verdict)
    )
  );
}

export function sealBeta23RunnerVerdict(
  fields
) {
  if (!isRecord(fields)) {
    return failure(
      "beta23_input_invalid"
    );
  }

  const allowedFields = [
    "verdict",
    "canonical_input_hash",
    "selection_hash",
    "projection_hash",
    "replayed_phase_scope",
    "engine_version",
    "enum_bundle_version",
    "replay_suite_version",
    "failure_tokens"
  ];

  for (
    const required
    of allowedFields
  ) {
    if (
      !Object.prototype
        .hasOwnProperty.call(
          fields,
          required
        )
    ) {
      return failure(
        "beta23_missing_required_field",
        {
          field: required
        }
      );
    }
  }

  if (
    !exactKeys(
      fields,
      allowedFields
    )
  ) {
    return failure(
      "beta23_unknown_field"
    );
  }

  if (
    fields.verdict !== "ACCEPTED" &&
    fields.verdict !== "REJECTED"
  ) {
    return failure(
      "beta23_verdict_invalid"
    );
  }

  if (
    !HASH_RE.test(
      fields.canonical_input_hash ??
        ""
    ) ||
    fields.verdict === "ACCEPTED" &&
      (
        !HASH_RE.test(
          fields.selection_hash ??
            ""
        ) ||
        !HASH_RE.test(
          fields.projection_hash ??
            ""
        )
      )
  ) {
    return failure(
      "beta23_hash_invalid"
    );
  }

  if (
    fields.verdict === "REJECTED" &&
    (
      fields.selection_hash !== null ||
      fields.projection_hash !== null
    )
  ) {
    return failure(
      "beta23_hash_invalid"
    );
  }

  if (
    fields.verdict === "ACCEPTED" &&
    !exactArray(
      fields.replayed_phase_scope,
      BETA22_PHASE_ORDER
    ) ||
    fields.verdict === "REJECTED" &&
    !exactArray(
      fields.replayed_phase_scope,
      []
    )
  ) {
    return failure(
      "beta23_scope_dishonest"
    );
  }

  if (
    fields.verdict === "ACCEPTED" &&
    (
      !Array.isArray(
        fields.failure_tokens
      ) ||
      fields.failure_tokens.length !==
        0
    ) ||
    fields.verdict === "REJECTED" &&
    (
      !Array.isArray(
        fields.failure_tokens
      ) ||
      fields.failure_tokens.length <
        1 ||
      fields.failure_tokens.some(
        (token) =>
          !BETA23_ALLOWED_REPLAY_FAILURE_TOKENS
            .includes(token)
      ) ||
      new Set(
        fields.failure_tokens
      ).size !==
        fields.failure_tokens.length
    )
  ) {
    return failure(
      "beta23_failure_tokens_invalid"
    );
  }

  if (
    typeof fields.engine_version !==
      "string" ||
    fields.engine_version.length === 0 ||
    typeof fields.enum_bundle_version !==
      "string" ||
    fields.enum_bundle_version.length ===
      0 ||
    fields.replay_suite_version !==
      BETA23_REPLAY_SUITE_VERSION
  ) {
    return failure(
      "beta23_input_invalid"
    );
  }

  const runnerVerdictId =
    computeBeta23RunnerVerdictId(
      fields
    );

  if (!runnerVerdictId) {
    return failure(
      "beta23_input_invalid"
    );
  }

  const material = {
    runner_verdict_id:
      runnerVerdictId,
    verdict:
      fields.verdict,
    canonical_input_hash:
      fields.canonical_input_hash,
    selection_hash:
      fields.selection_hash,
    projection_hash:
      fields.projection_hash,
    replayed_phase_scope:
      clone(
        fields.replayed_phase_scope
      ),
    engine_version:
      fields.engine_version,
    enum_bundle_version:
      fields.enum_bundle_version,
    replay_suite_version:
      fields.replay_suite_version,
    failure_tokens:
      clone(
        fields.failure_tokens
      )
  };

  const checksum =
    computeBeta23RunnerVerdictChecksum(
      material
    );

  if (!checksum) {
    return failure(
      "beta23_input_invalid"
    );
  }

  return deepFreeze({
    ok: true,
    runner_verdict:
      deepFreeze({
        runner_verdict_id:
          material.runner_verdict_id,
        runner_verdict_checksum_sha256:
          checksum,
        verdict:
          material.verdict,
        canonical_input_hash:
          material.canonical_input_hash,
        selection_hash:
          material.selection_hash,
        projection_hash:
          material.projection_hash,
        replayed_phase_scope:
          material.replayed_phase_scope,
        engine_version:
          material.engine_version,
        enum_bundle_version:
          material.enum_bundle_version,
        replay_suite_version:
          material.replay_suite_version,
        failure_tokens:
          material.failure_tokens
      })
  });
}

export function verifyBeta23RunnerVerdict(
  verdict
) {
  if (!isRecord(verdict)) {
    return failure(
      "beta23_input_invalid"
    );
  }

  for (
    const required
    of BETA23_RUNNER_VERDICT_KEYS
  ) {
    if (
      !Object.prototype
        .hasOwnProperty.call(
          verdict,
          required
        )
    ) {
      return failure(
        "beta23_missing_required_field",
        {
          field: required
        }
      );
    }
  }

  if (
    !exactKeys(
      verdict,
      BETA23_RUNNER_VERDICT_KEYS
    )
  ) {
    return failure(
      "beta23_unknown_field"
    );
  }

  const fields = {
    verdict:
      verdict.verdict,
    canonical_input_hash:
      verdict.canonical_input_hash,
    selection_hash:
      verdict.selection_hash,
    projection_hash:
      verdict.projection_hash,
    replayed_phase_scope:
      verdict.replayed_phase_scope,
    engine_version:
      verdict.engine_version,
    enum_bundle_version:
      verdict.enum_bundle_version,
    replay_suite_version:
      verdict.replay_suite_version,
    failure_tokens:
      verdict.failure_tokens
  };

  const sealed =
    sealBeta23RunnerVerdict(
      fields
    );

  if (!sealed.ok) {
    return sealed;
  }

  if (
    verdict.runner_verdict_id !==
    sealed.runner_verdict
      .runner_verdict_id
  ) {
    return failure(
      "beta23_runner_verdict_id_mismatch"
    );
  }

  if (
    !HASH_RE.test(
      verdict
        .runner_verdict_checksum_sha256 ??
        ""
    ) ||
    verdict
      .runner_verdict_checksum_sha256 !==
    sealed.runner_verdict
      .runner_verdict_checksum_sha256
  ) {
    return failure(
      "beta23_runner_verdict_checksum_mismatch"
    );
  }

  return deepFreeze({
    ok: true,
    runner_verdict_id:
      verdict.runner_verdict_id,
    runner_verdict_checksum_sha256:
      verdict
        .runner_verdict_checksum_sha256
  });
}

function parseCanonicalPhase(
  expectedOutputEntry,
  phase
) {
  if (
    !isRecord(
      expectedOutputEntry
    ) ||
    !isRecord(
      expectedOutputEntry.phase_outputs
    ) ||
    typeof expectedOutputEntry
      .phase_outputs[phase] !==
      "string"
  ) {
    return null;
  }

  try {
    return JSON.parse(
      expectedOutputEntry
        .phase_outputs[phase]
    );
  }
  catch {
    return null;
  }
}

function replayAttemptsAreHonest(
  replayResult
) {
  if (
    !Array.isArray(
      replayResult.runs
    ) ||
    replayResult.runs.length !==
      BETA22_REPEAT_COUNT
  ) {
    return false;
  }

  return replayResult.runs.every(
    (run, index) => {
      if (
        run?.repeat !== index + 1 ||
        !isRecord(
          run.phase_attempt_counts
        ) ||
        !exactKeys(
          run.phase_attempt_counts,
          BETA22_PHASE_ORDER
        )
      ) {
        return false;
      }

      return BETA22_PHASE_ORDER
        .every(
          (phase) =>
            run
              .phase_attempt_counts[phase] ===
            1
        );
    }
  );
}

export function buildBeta23RunnerVerdict({
  vector,
  replayResult,
  expectedOutputEntry,
  replaySuiteVersion =
    BETA23_REPLAY_SUITE_VERSION
}) {
  if (
    !isRecord(vector) ||
    !isRecord(
      vector.cve_header
    ) ||
    !isRecord(
      vector.pins
    ) ||
    !isRecord(replayResult) ||
    replayResult.vector_id !==
      vector.cve_header.vector_id ||
    replaySuiteVersion !==
      BETA23_REPLAY_SUITE_VERSION ||
    !HASH_RE.test(
      vector
        .canonical_phase1_input_hash_sha256 ??
        ""
    )
  ) {
    return failure(
      "beta23_runner_result_invalid"
    );
  }

  const common = {
    canonical_input_hash:
      vector
        .canonical_phase1_input_hash_sha256,
    engine_version:
      vector.pins.engine_version,
    enum_bundle_version:
      vector.pins
        .enum_bundle_version,
    replay_suite_version:
      replaySuiteVersion
  };

  if (
    vector.cve_header.vector_class ===
      "positive"
  ) {
    if (
      replayResult.ok !== true ||
      replayResult.verdict !==
        "ACCEPTED" ||
      replayResult.repeat_count !==
        BETA22_REPEAT_COUNT ||
      !replayAttemptsAreHonest(
        replayResult
      ) ||
      expectedOutputEntry
        ?.vector_id !==
        vector.cve_header.vector_id
    ) {
      return failure(
        "beta23_scope_dishonest"
      );
    }

    const phase5 =
      parseCanonicalPhase(
        expectedOutputEntry,
        "phase5"
      );

    const phase7 =
      parseCanonicalPhase(
        expectedOutputEntry,
        "phase7"
      );

    if (
      !phase5 ||
      !phase7 ||
      phase5.canonical_input_hash !==
        common.canonical_input_hash ||
      phase7.canonical_input_hash !==
        common.canonical_input_hash ||
      !HASH_RE.test(
        phase5.selection_hash ??
          ""
      ) ||
      !HASH_RE.test(
        phase7.projection_hash ??
          ""
      )
    ) {
      return failure(
        "beta23_hash_invalid"
      );
    }

    return sealBeta23RunnerVerdict({
      verdict: "ACCEPTED",
      canonical_input_hash:
        common.canonical_input_hash,
      selection_hash:
        phase5.selection_hash,
      projection_hash:
        phase7.projection_hash,
      replayed_phase_scope:
        [...BETA22_PHASE_ORDER],
      engine_version:
        common.engine_version,
      enum_bundle_version:
        common.enum_bundle_version,
      replay_suite_version:
        common.replay_suite_version,
      failure_tokens: []
    });
  }

  if (
    vector.cve_header.vector_class ===
      "negative_shell"
  ) {
    if (
      replayResult.ok !== true ||
      replayResult.verdict !==
        "REJECTED" ||
      replayResult.repeat_count !== 0 ||
      !BETA23_ALLOWED_REPLAY_FAILURE_TOKENS
        .includes(
          replayResult.failure_token
        ) ||
      replayResult.failure_token !==
        vector.expected
          ?.failure_token
    ) {
      return failure(
        "beta23_runner_result_invalid"
      );
    }

    return sealBeta23RunnerVerdict({
      verdict: "REJECTED",
      canonical_input_hash:
        common.canonical_input_hash,
      selection_hash: null,
      projection_hash: null,
      replayed_phase_scope: [],
      engine_version:
        common.engine_version,
      enum_bundle_version:
        common.enum_bundle_version,
      replay_suite_version:
        common.replay_suite_version,
      failure_tokens: [
        replayResult.failure_token
      ]
    });
  }

  return failure(
    "beta23_runner_result_invalid"
  );
}

export function buildBeta23RunnerVerdicts({
  suite,
  verifyResult,
  expectedOutputs
}) {
  if (
    !isRecord(suite) ||
    suite.schema_version !==
      "kolosseum.beta21.replay_vector_suite.v1.0.0" ||
    !Array.isArray(suite.vectors) ||
    !isRecord(verifyResult) ||
    verifyResult.ok !== true ||
    verifyResult.verdict !==
      "ACCEPTED" ||
    !Array.isArray(
      verifyResult.vector_results
    ) ||
    verifyResult.vector_results.length !==
      suite.vectors.length ||
    !isRecord(expectedOutputs) ||
    expectedOutputs.schema_version !==
      "kolosseum.beta22.expected_phase_outputs.v1.0.0" ||
    !Array.isArray(
      expectedOutputs.outputs
    )
  ) {
    return failure(
      "beta23_runner_result_invalid"
    );
  }

  const verdicts = [];

  for (
    let index = 0;
    index < suite.vectors.length;
    index += 1
  ) {
    const vector =
      suite.vectors[index];

    const replayResult =
      verifyResult
        .vector_results[index];

    if (
      replayResult?.vector_id !==
      vector?.cve_header?.vector_id
    ) {
      return failure(
        "beta23_runner_result_invalid",
        {
          index
        }
      );
    }

    const expectedOutputEntry =
      expectedOutputs.outputs.find(
        (entry) =>
          entry.vector_id ===
          vector.cve_header.vector_id
      ) ??
      null;

    const built =
      buildBeta23RunnerVerdict({
        vector,
        replayResult,
        expectedOutputEntry,
        replaySuiteVersion:
          BETA23_REPLAY_SUITE_VERSION
      });

    if (!built.ok) {
      return built;
    }

    verdicts.push(
      built.runner_verdict
    );
  }

  return deepFreeze({
    ok: true,
    runner_verdicts:
      verdicts
  });
}

export function attachBeta23RunnerVerdicts({
  suite,
  verifyResult,
  expectedOutputs
}) {
  const built =
    buildBeta23RunnerVerdicts({
      suite,
      verifyResult,
      expectedOutputs
    });

  if (!built.ok) {
    return built;
  }

  return deepFreeze({
    ...clone(verifyResult),
    runner_verdict_contract_version:
      beta23RunnerVerdictContract
        .version,
    runner_verdicts:
      built.runner_verdicts
  });
}

export function buildBeta23RunnerVerdictManifest(
  fileTexts
) {
  const required = [
    "contract",
    "schema",
    "failure_tokens",
    "upstream_verify_contract",
    "upstream_verify_manifest",
    "vectors",
    "expected_outputs"
  ];

  for (
    const key
    of required
  ) {
    if (
      typeof fileTexts?.[key] !==
      "string"
    ) {
      return failure(
        "beta23_manifest_invalid",
        {
          source: key
        }
      );
    }
  }

  return deepFreeze({
    schema_version:
      "kolosseum.beta23.runner_verdict_manifest.v1.0.0",
    slice_id: "BETA-23",
    contract_version:
      beta23RunnerVerdictContract
        .version,
    replay_suite_version:
      BETA23_REPLAY_SUITE_VERSION,
    runner_output_field:
      "runner_verdicts",
    verdict_count: 8,
    paths: {
      contract:
        "replay/contracts/beta23_runner_verdict_contract.json",
      schema:
        "replay/contracts/beta23_runner_verdict.schema.json",
      failure_tokens:
        "replay/contracts/beta23_runner_verdict_failure_tokens.json",
      upstream_verify_contract:
        "replay/contracts/beta22_replay_verify_contract.json",
      upstream_verify_manifest:
        "replay/suite/beta_phase1_7/verify_manifest.json",
      vectors:
        "replay/suite/beta_phase1_7/vectors.json",
      expected_outputs:
        "replay/suite/beta_phase1_7/expected_outputs.json"
    },
    sha256: Object.fromEntries(
      required.map(
        (key) => [
          key,
          sha256(
            Buffer.from(
              fileTexts[key],
              "utf8"
            )
          )
        ]
      )
    )
  });
}

export function verifyBeta23RunnerVerdictManifest(
  manifest,
  fileTexts
) {
  const expected =
    buildBeta23RunnerVerdictManifest(
      fileTexts
    );

  if (expected?.ok === false) {
    return expected;
  }

  if (
    betaCanonicalJson(manifest) !==
    betaCanonicalJson(expected)
  ) {
    return failure(
      "beta23_manifest_invalid"
    );
  }

  return deepFreeze({
    ok: true,
    manifest_sha256:
      sha256(
        betaCanonicalJson(
          manifest
        )
      )
  });
}
