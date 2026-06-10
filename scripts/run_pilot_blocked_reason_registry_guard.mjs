#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

const registryPath = path.join(repoRoot, "docs", "pilot-blocked-reasons", "pilot_blocked_reason_registry.json");
const s46TestsPath = path.join(repoRoot, "docs", "pilot-signoff", "pilot_signoff_record_negative_tests.json");
const s46RunnerPath = path.join(repoRoot, "scripts", "run_pilot_signoff_record_tests.mjs");

const REQUIRED_BLOCKED_REASON_IDS = Object.freeze([
  "payment_missing",
  "workspace_missing",
  "coach_account_inactive",
  "athlete_account_inactive",
  "coach_athlete_link_not_accepted",
  "scope_not_locked",
  "phase1_not_accepted",
  "compile_not_admitted",
  "first_session_missing",
  "factual_execution_not_proven",
  "split_return_not_proven_if_claimed",
  "partial_completion_not_proven_if_claimed",
  "coach_artefact_view_missing",
  "non_binding_note_missing",
  "history_counts_not_factual",
  "support_boundary_missing",
  "claim_guard_missing",
  "forbidden_surface_exposed",
  "source_artefact_missing"
]);

const REQUIRED_S45_READINESS_ITEM_IDS = Object.freeze([
  "payment_confirmed",
  "workspace_created",
  "coach_active",
  "athlete_active",
  "link_accepted",
  "scope_locked",
  "phase1_accepted",
  "first_compile_passed",
  "first_executable_session_exists",
  "factual_execution_checked",
  "split_return_checked_if_claimed",
  "partial_completion_checked_if_claimed",
  "coach_surface_checked",
  "coach_artefact_view_checked",
  "non_binding_note_checked",
  "history_counts_checked",
  "support_boundary_checked",
  "claim_guard_checked",
  "source_artefacts_present"
]);

const REQUIRED_S46_FAILURE_TOKENS = Object.freeze({
  unknownBlockedReason: "PILOT_BLOCKED_REASON_UNKNOWN",
  blockedEmpty: "PILOT_BLOCKED_REASON_EMPTY_FOR_BLOCKED_STATUS",
  coachReadyHasReasons: "PILOT_BLOCKED_REASON_PRESENT_FOR_COACH_READY",
  registryClosedWorld: "PILOT_BLOCKED_REASON_REGISTRY_NOT_CLOSED_WORLD",
  readinessCoverageMissing: "PILOT_BLOCKED_REASON_READINESS_MAPPING_MISSING",
  negativeBoundaryMappingInvalid: "PILOT_BLOCKED_REASON_NEGATIVE_BOUNDARY_MAPPING_INVALID"
});

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function fail(token, pathValue, message) {
  return { ok: false, token, path: pathValue, message };
}

function pass() {
  return { ok: true };
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value, keys) {
  if (!isObject(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return JSON.stringify(actual) === JSON.stringify(expected);
}

function assertUniqueStrings(values, pathValue) {
  const seen = new Set();

  for (const value of values) {
    if (typeof value !== "string" || value.length < 1) {
      return fail("PILOT_BLOCKED_REASON_INVALID_STRING", pathValue, "Expected non-empty string.");
    }

    if (seen.has(value)) {
      return fail("PILOT_BLOCKED_REASON_DUPLICATE", pathValue, `Duplicate value '${value}'.`);
    }

    seen.add(value);
  }

  return pass();
}

function validateRegistryShape(registry) {
  const topLevelKeys = [
    "registry_id",
    "registry_version",
    "scope",
    "closed_world",
    "status_model",
    "blocked_reasons",
    "s45_readiness_item_mappings",
    "s45_negative_boundary_failure_mapping"
  ];

  if (!exactKeys(registry, topLevelKeys)) {
    return fail("PILOT_BLOCKED_REASON_REGISTRY_SHAPE_INVALID", "$", "Registry must contain exactly the declared top-level fields.");
  }

  if (registry.registry_id !== "pilot_blocked_reason_registry") {
    return fail("PILOT_BLOCKED_REASON_REGISTRY_ID_INVALID", "$.registry_id", "Invalid registry_id.");
  }

  if (registry.registry_version !== "1.0.0") {
    return fail("PILOT_BLOCKED_REASON_REGISTRY_VERSION_INVALID", "$.registry_version", "Invalid registry_version.");
  }

  if (registry.scope !== "kolosseum.v0.paid_coach_pilot") {
    return fail("PILOT_BLOCKED_REASON_REGISTRY_SCOPE_INVALID", "$.scope", "Invalid registry scope.");
  }

  if (registry.closed_world !== true) {
    return fail(REQUIRED_S46_FAILURE_TOKENS.registryClosedWorld, "$.closed_world", "Registry must be closed-world.");
  }

  if (!exactKeys(registry.status_model, [
    "allowed_final_statuses",
    "blocked_requires_non_empty_reasons",
    "coach_ready_requires_empty_reasons",
    "unknown_blocked_reason_fails"
  ])) {
    return fail("PILOT_BLOCKED_REASON_STATUS_MODEL_INVALID", "$.status_model", "Invalid status_model shape.");
  }

  if (JSON.stringify(registry.status_model.allowed_final_statuses) !== JSON.stringify(["coach_ready", "blocked"])) {
    return fail("PILOT_BLOCKED_REASON_STATUS_MODEL_INVALID", "$.status_model.allowed_final_statuses", "Allowed final statuses must be exactly coach_ready and blocked.");
  }

  if (registry.status_model.blocked_requires_non_empty_reasons !== true) {
    return fail("PILOT_BLOCKED_REASON_STATUS_MODEL_INVALID", "$.status_model.blocked_requires_non_empty_reasons", "Blocked status must require non-empty reasons.");
  }

  if (registry.status_model.coach_ready_requires_empty_reasons !== true) {
    return fail("PILOT_BLOCKED_REASON_STATUS_MODEL_INVALID", "$.status_model.coach_ready_requires_empty_reasons", "Coach Ready must require empty reasons.");
  }

  if (registry.status_model.unknown_blocked_reason_fails !== true) {
    return fail("PILOT_BLOCKED_REASON_STATUS_MODEL_INVALID", "$.status_model.unknown_blocked_reason_fails", "Unknown blocked reasons must fail.");
  }

  if (!Array.isArray(registry.blocked_reasons)) {
    return fail("PILOT_BLOCKED_REASON_REGISTRY_SHAPE_INVALID", "$.blocked_reasons", "blocked_reasons must be an array.");
  }

  if (!Array.isArray(registry.s45_readiness_item_mappings)) {
    return fail("PILOT_BLOCKED_REASON_REGISTRY_SHAPE_INVALID", "$.s45_readiness_item_mappings", "s45_readiness_item_mappings must be an array.");
  }

  const boundary = registry.s45_negative_boundary_failure_mapping;
  if (!exactKeys(boundary, [
    "blocked_reason_id",
    "applies_to_every_negative_boundary_failure",
    "known_negative_boundary_ids"
  ])) {
    return fail("PILOT_BLOCKED_REASON_REGISTRY_SHAPE_INVALID", "$.s45_negative_boundary_failure_mapping", "Invalid negative boundary mapping shape.");
  }

  return pass();
}

function validateClosedWorldReasons(registry) {
  const ids = registry.blocked_reasons.map((entry) => entry.blocked_reason_id);
  const unique = assertUniqueStrings(ids, "$.blocked_reasons[].blocked_reason_id");
  if (!unique.ok) return unique;

  const actual = [...ids].sort();
  const expected = [...REQUIRED_BLOCKED_REASON_IDS].sort();

  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    return fail(
      REQUIRED_S46_FAILURE_TOKENS.registryClosedWorld,
      "$.blocked_reasons",
      `Blocked reason IDs must match the required closed set. expected=${JSON.stringify(expected)} actual=${JSON.stringify(actual)}`
    );
  }

  for (let i = 0; i < registry.blocked_reasons.length; i++) {
    const entry = registry.blocked_reasons[i];

    if (!exactKeys(entry, [
      "blocked_reason_id",
      "category",
      "operator_meaning",
      "allowed_for_final_status"
    ])) {
      return fail("PILOT_BLOCKED_REASON_ENTRY_SHAPE_INVALID", `$.blocked_reasons[${i}]`, "Blocked reason entry contains missing or extra fields.");
    }

    if (!REQUIRED_BLOCKED_REASON_IDS.includes(entry.blocked_reason_id)) {
      return fail(REQUIRED_S46_FAILURE_TOKENS.unknownBlockedReason, `$.blocked_reasons[${i}].blocked_reason_id`, `Unknown blocked reason '${entry.blocked_reason_id}'.`);
    }

    if (typeof entry.category !== "string" || entry.category.length < 1) {
      return fail("PILOT_BLOCKED_REASON_ENTRY_SHAPE_INVALID", `$.blocked_reasons[${i}].category`, "category must be a non-empty string.");
    }

    if (typeof entry.operator_meaning !== "string" || entry.operator_meaning.length < 1) {
      return fail("PILOT_BLOCKED_REASON_ENTRY_SHAPE_INVALID", `$.blocked_reasons[${i}].operator_meaning`, "operator_meaning must be a non-empty string.");
    }

    if (JSON.stringify(entry.allowed_for_final_status) !== JSON.stringify(["blocked"])) {
      return fail("PILOT_BLOCKED_REASON_ENTRY_SHAPE_INVALID", `$.blocked_reasons[${i}].allowed_for_final_status`, "Blocked reasons may only be allowed for blocked final status.");
    }
  }

  return pass();
}

function validateReadinessCoverage(registry) {
  const knownReasons = new Set(registry.blocked_reasons.map((entry) => entry.blocked_reason_id));
  const seenReadiness = new Set();

  for (let i = 0; i < registry.s45_readiness_item_mappings.length; i++) {
    const mapping = registry.s45_readiness_item_mappings[i];

    if (!exactKeys(mapping, ["s45_readiness_item_id", "blocked_reason_ids"])) {
      return fail("PILOT_BLOCKED_REASON_READINESS_MAPPING_SHAPE_INVALID", `$.s45_readiness_item_mappings[${i}]`, "Mapping contains missing or extra fields.");
    }

    if (typeof mapping.s45_readiness_item_id !== "string" || mapping.s45_readiness_item_id.length < 1) {
      return fail("PILOT_BLOCKED_REASON_READINESS_MAPPING_SHAPE_INVALID", `$.s45_readiness_item_mappings[${i}].s45_readiness_item_id`, "s45_readiness_item_id must be a non-empty string.");
    }

    if (seenReadiness.has(mapping.s45_readiness_item_id)) {
      return fail("PILOT_BLOCKED_REASON_READINESS_MAPPING_DUPLICATE", `$.s45_readiness_item_mappings[${i}].s45_readiness_item_id`, `Duplicate readiness item mapping '${mapping.s45_readiness_item_id}'.`);
    }

    seenReadiness.add(mapping.s45_readiness_item_id);

    if (!Array.isArray(mapping.blocked_reason_ids) || mapping.blocked_reason_ids.length < 1) {
      return fail(REQUIRED_S46_FAILURE_TOKENS.readinessCoverageMissing, `$.s45_readiness_item_mappings[${i}].blocked_reason_ids`, "Each readiness item must map to at least one blocked reason.");
    }

    for (const reasonId of mapping.blocked_reason_ids) {
      if (!knownReasons.has(reasonId)) {
        return fail(REQUIRED_S46_FAILURE_TOKENS.unknownBlockedReason, `$.s45_readiness_item_mappings[${i}].blocked_reason_ids`, `Unknown blocked reason '${reasonId}'.`);
      }
    }
  }

  for (const readinessId of REQUIRED_S45_READINESS_ITEM_IDS) {
    if (!seenReadiness.has(readinessId)) {
      return fail(REQUIRED_S46_FAILURE_TOKENS.readinessCoverageMissing, "$.s45_readiness_item_mappings", `Missing mapping for S45 readiness item '${readinessId}'.`);
    }
  }

  return pass();
}

function validateNegativeBoundaryMapping(registry) {
  const mapping = registry.s45_negative_boundary_failure_mapping;

  if (mapping.blocked_reason_id !== "forbidden_surface_exposed") {
    return fail(REQUIRED_S46_FAILURE_TOKENS.negativeBoundaryMappingInvalid, "$.s45_negative_boundary_failure_mapping.blocked_reason_id", "Every S45 negative boundary failure must map to forbidden_surface_exposed.");
  }

  if (mapping.applies_to_every_negative_boundary_failure !== true) {
    return fail(REQUIRED_S46_FAILURE_TOKENS.negativeBoundaryMappingInvalid, "$.s45_negative_boundary_failure_mapping.applies_to_every_negative_boundary_failure", "Mapping must apply to every negative boundary failure.");
  }

  if (!Array.isArray(mapping.known_negative_boundary_ids) || mapping.known_negative_boundary_ids.length < 1) {
    return fail(REQUIRED_S46_FAILURE_TOKENS.negativeBoundaryMappingInvalid, "$.s45_negative_boundary_failure_mapping.known_negative_boundary_ids", "known_negative_boundary_ids must be non-empty.");
  }

  const unique = assertUniqueStrings(mapping.known_negative_boundary_ids, "$.s45_negative_boundary_failure_mapping.known_negative_boundary_ids");
  if (!unique.ok) return unique;

  return pass();
}

function validateSignoffBlockedReasons(registry, signoff) {
  const knownReasons = new Set(registry.blocked_reasons.map((entry) => entry.blocked_reason_id));

  if (!["coach_ready", "blocked"].includes(signoff.final_status)) {
    return fail("PILOT_BLOCKED_REASON_SIGNOFF_STATUS_INVALID", "$.final_status", "Unknown final_status.");
  }

  if (!Array.isArray(signoff.blocked_reasons)) {
    return fail("PILOT_BLOCKED_REASON_SIGNOFF_SHAPE_INVALID", "$.blocked_reasons", "blocked_reasons must be an array.");
  }

  if (signoff.final_status === "blocked" && signoff.blocked_reasons.length < 1) {
    return fail(REQUIRED_S46_FAILURE_TOKENS.blockedEmpty, "$.blocked_reasons", "Blocked final_status requires at least one blocked reason.");
  }

  if (signoff.final_status === "coach_ready" && signoff.blocked_reasons.length > 0) {
    return fail(REQUIRED_S46_FAILURE_TOKENS.coachReadyHasReasons, "$.blocked_reasons", "Coach Ready must not include blocked reasons.");
  }

  for (const reasonId of signoff.blocked_reasons) {
    if (!knownReasons.has(reasonId)) {
      return fail(REQUIRED_S46_FAILURE_TOKENS.unknownBlockedReason, "$.blocked_reasons", `Unknown blocked reason '${reasonId}'.`);
    }
  }

  return pass();
}

function discoverS45ReadinessIds() {
  const discovered = new Set();

  const candidatePaths = [
    path.join(repoRoot, "docs", "pilot-acceptance"),
    path.join(repoRoot, "docs", "pilot-readiness"),
    path.join(repoRoot, "docs", "coach-ready"),
    path.join(repoRoot, "docs")
  ];

  for (const candidatePath of candidatePaths) {
    if (!fs.existsSync(candidatePath)) continue;

    const stack = [candidatePath];

    while (stack.length > 0) {
      const current = stack.pop();
      const stat = fs.statSync(current);

      if (stat.isDirectory()) {
        for (const child of fs.readdirSync(current)) {
          const full = path.join(current, child);
          if (full.includes(`${path.sep}node_modules${path.sep}`)) continue;
          if (full.includes(`${path.sep}.git${path.sep}`)) continue;
          stack.push(full);
        }
        continue;
      }

      if (!/\.(json|md)$/i.test(current)) continue;

      const basename = path.basename(current).toLowerCase();
      const text = fs.readFileSync(current, "utf8");

      if (
        !basename.includes("s45") &&
        !basename.includes("coach") &&
        !basename.includes("pilot") &&
        !text.includes("S45") &&
        !text.includes("coach_ready")
      ) {
        continue;
      }

      for (const match of text.matchAll(/"item_id"\s*:\s*"([^"]+)"/g)) {
        discovered.add(match[1]);
      }

      for (const match of text.matchAll(/"readiness_item_id"\s*:\s*"([^"]+)"/g)) {
        discovered.add(match[1]);
      }

      for (const match of text.matchAll(/s45_readiness_item_id["`]*\s*[:=]\s*["`]([a-z0-9_\-]+)["`]/gi)) {
        discovered.add(match[1]);
      }
    }
  }

  return [...discovered].filter((id) => REQUIRED_S45_READINESS_ITEM_IDS.includes(id)).sort();
}

function validateDiscoveredS45Coverage(registry) {
  const discovered = discoverS45ReadinessIds();

  if (discovered.length === 0) {
    return {
      ok: true,
      discovered: [],
      note: "No parseable S45 readiness IDs discovered; required S47 readiness coverage set was used."
    };
  }

  const mapped = new Set(registry.s45_readiness_item_mappings.map((mapping) => mapping.s45_readiness_item_id));
  const missing = discovered.filter((id) => !mapped.has(id));

  if (missing.length > 0) {
    return {
      ok: false,
      token: REQUIRED_S46_FAILURE_TOKENS.readinessCoverageMissing,
      path: "$.s45_readiness_item_mappings",
      message: `Discovered S45 readiness IDs missing mappings: ${missing.join(", ")}`
    };
  }

  return {
    ok: true,
    discovered,
    note: "Discovered S45 readiness IDs are mapped."
  };
}

function runNegativeAcceptanceTests(registry) {
  const tests = [
    {
      name: "unknown_blocked_reason_fails",
      signoff: { final_status: "blocked", blocked_reasons: ["not_a_real_reason"] },
      expectedToken: REQUIRED_S46_FAILURE_TOKENS.unknownBlockedReason
    },
    {
      name: "empty_blocked_reason_list_fails_when_blocked",
      signoff: { final_status: "blocked", blocked_reasons: [] },
      expectedToken: REQUIRED_S46_FAILURE_TOKENS.blockedEmpty
    },
    {
      name: "coach_ready_cannot_include_blocked_reasons",
      signoff: { final_status: "coach_ready", blocked_reasons: ["payment_missing"] },
      expectedToken: REQUIRED_S46_FAILURE_TOKENS.coachReadyHasReasons
    },
    {
      name: "valid_blocked_signoff_passes",
      signoff: { final_status: "blocked", blocked_reasons: ["payment_missing"] },
      expectedToken: null
    },
    {
      name: "valid_coach_ready_signoff_passes",
      signoff: { final_status: "coach_ready", blocked_reasons: [] },
      expectedToken: null
    }
  ];

  const results = [];

  for (const test of tests) {
    const result = validateSignoffBlockedReasons(registry, test.signoff);

    const ok = test.expectedToken === null
      ? result.ok === true
      : result.ok === false && result.token === test.expectedToken;

    results.push({
      name: test.name,
      ok,
      expectedToken: test.expectedToken,
      actualToken: result.token ?? null,
      path: result.path ?? null
    });

    if (!ok) {
      return fail(
        "PILOT_BLOCKED_REASON_ACCEPTANCE_TEST_FAILED",
        "$",
        `Acceptance test failed: ${JSON.stringify({ test, result }, null, 2)}`
      );
    }
  }

  return { ok: true, results };
}

function assertS46IntegrationFilesExist() {
  const checked = [];

  for (const filePath of [s46TestsPath, s46RunnerPath]) {
    if (!fs.existsSync(filePath)) {
      return fail("PILOT_BLOCKED_REASON_S46_INTEGRATION_MISSING", path.relative(repoRoot, filePath), "S46 integration file missing.");
    }

    checked.push(path.relative(repoRoot, filePath));
  }

  return { ok: true, checked };
}

function run() {
  const registry = readJson(registryPath);

  const checks = [
    validateRegistryShape(registry),
    validateClosedWorldReasons(registry),
    validateReadinessCoverage(registry),
    validateNegativeBoundaryMapping(registry),
    assertS46IntegrationFilesExist()
  ];

  for (const check of checks) {
    if (!check.ok) {
      process.stderr.write(JSON.stringify(check, null, 2) + "\n");
      process.exit(1);
    }
  }

  const discovered = validateDiscoveredS45Coverage(registry);
  if (!discovered.ok) {
    process.stderr.write(JSON.stringify(discovered, null, 2) + "\n");
    process.exit(1);
  }

  const acceptance = runNegativeAcceptanceTests(registry);
  if (!acceptance.ok) {
    process.stderr.write(JSON.stringify(acceptance, null, 2) + "\n");
    process.exit(1);
  }

  process.stdout.write(JSON.stringify({
    ok: true,
    guard_id: "pilot_blocked_reason_registry_guard",
    guard_version: "1.0.0",
    checked_files: [
      path.relative(repoRoot, registryPath),
      path.relative(repoRoot, s46TestsPath),
      path.relative(repoRoot, s46RunnerPath)
    ],
    blocked_reason_count: registry.blocked_reasons.length,
    readiness_mapping_count: registry.s45_readiness_item_mappings.length,
    negative_boundary_mapping: registry.s45_negative_boundary_failure_mapping.blocked_reason_id,
    discovered_s45_readiness_ids: discovered.discovered,
    acceptance_results: acceptance.results
  }, null, 2) + "\n");
}

run();