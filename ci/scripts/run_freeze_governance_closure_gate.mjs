import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const DEFAULT_COMPONENTS = Object.freeze({
  proof_index: "docs/releases/V1_FREEZE_PROOF_INDEX.json",
  proof_chain: "docs/releases/V1_FREEZE_PROOF_CHAIN.json",
  drift_status: "docs/releases/V1_FREEZE_DRIFT_STATUS.json",
  packet_integrity: "docs/releases/V1_OPERATOR_FREEZE_BUNDLE_PRESERVATION.json",
  cleanliness: "docs/releases/V1_FREEZE_PACK_REBUILD_CLEANLINESS.json",
  exit_criteria: "docs/releases/V1_FREEZE_EXIT_CRITERIA.json",
  promotion_readiness: "docs/releases/V1_PROMOTION_READINESS.json"
});

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function fail(token, component, details, pathValue = null) {
  const failure = {
    token,
    component,
    details
  };

  if (pathValue !== null) {
    failure.path = pathValue;
  }

  return {
    ok: false,
    failures: [failure]
  };
}

function validateComponentMap(componentPaths) {
  const required = [
    "proof_index",
    "proof_chain",
    "drift_status",
    "packet_integrity",
    "cleanliness",
    "exit_criteria",
    "promotion_readiness"
  ];

  for (const key of required) {
    if (!(key in componentPaths)) {
      return fail("CI_MANIFEST_MISMATCH", key, `Missing required closure component mapping '${key}'.`);
    }

    if (typeof componentPaths[key] !== "string" || componentPaths[key].trim().length === 0) {
      return fail("CI_MANIFEST_MISMATCH", key, `Closure component mapping '${key}' must be a non-empty string.`);
    }
  }

  return { ok: true };
}

function readJsonObject(component, filePath) {
  if (!fs.existsSync(filePath)) {
    return fail("missing_closure_component", component, "Required closure component is missing.", filePath);
  }

  let raw;
  try {
    raw = fs.readFileSync(filePath, "utf8");
  } catch (error) {
    return fail("CI_MANIFEST_MISMATCH", component, `Unable to read closure component: ${error.message}`, filePath);
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return fail("CI_MANIFEST_MISMATCH", component, `Closure component contains invalid JSON: ${error.message}`, filePath);
  }

  if (!isPlainObject(parsed)) {
    return fail("CI_MANIFEST_MISMATCH", component, "Closure component must be a JSON object.", filePath);
  }

  return {
    ok: true,
    parsed
  };
}

function requireBooleanOk(component, parsed, filePath) {
  if (typeof parsed.ok !== "boolean") {
    return fail("CI_MANIFEST_MISMATCH", component, "Closure component must expose boolean 'ok'.", filePath);
  }

  if (parsed.ok !== true) {
    return fail("governance_gap_open", component, "Closure component reports ok=false.", filePath);
  }

  return { ok: true };
}

function resolveProofIndexEntries(parsed) {
  const candidateKeys = ["entries", "proofs", "items", "artefacts", "artifacts", "proof_entries"];

  for (const key of candidateKeys) {
    if (Array.isArray(parsed[key])) {
      return {
        ok: true,
        key,
        value: parsed[key]
      };
    }
  }

  return {
    ok: false,
    keys: Object.keys(parsed).sort()
  };
}

function resolveProofChainEntries(parsed) {
  const candidateKeys = ["chain", "freeze_proof_chain", "proof_chain", "chain_entries", "proof_chain_entries", "proof_steps"];

  for (const key of candidateKeys) {
    if (Array.isArray(parsed[key])) {
      return {
        ok: true,
        key,
        value: parsed[key]
      };
    }
  }

  return {
    ok: false,
    keys: Object.keys(parsed).sort()
  };
}

function resolvePromotionReadinessPayload(parsed) {
  if (isPlainObject(parsed.prerequisites)) {
    return { ok: true, kind: "prerequisites" };
  }

  if (Array.isArray(parsed.checks)) {
    return { ok: true, kind: "checks" };
  }

  if (Array.isArray(parsed.required_checks)) {
    return { ok: true, kind: "required_checks" };
  }

  if (Array.isArray(parsed.artifacts)) {
    return { ok: true, kind: "artifacts" };
  }

  if (Array.isArray(parsed.artefacts)) {
    return { ok: true, kind: "artefacts" };
  }

  if (typeof parsed.status === "string" && parsed.status.trim().length > 0) {
    return { ok: true, kind: "status" };
  }

  if (Array.isArray(parsed.required_reports) && parsed.required_reports.length > 0) {
    return { ok: true, kind: "required_reports" };
  }

  if (isPlainObject(parsed.required_reports) && Object.keys(parsed.required_reports).length > 0) {
    return { ok: true, kind: "required_reports_object" };
  }

  return {
    ok: false,
    keys: Object.keys(parsed).sort()
  };
}

export function verifyFreezeGovernanceClosure(componentPaths = DEFAULT_COMPONENTS) {
  const mappingValidation = validateComponentMap(componentPaths);
  if (!mappingValidation.ok) {
    return mappingValidation;
  }

  const proofIndexResult = readJsonObject("proof_index", componentPaths.proof_index);
  if (!proofIndexResult.ok) {
    return proofIndexResult;
  }

  const proofChainResult = readJsonObject("proof_chain", componentPaths.proof_chain);
  if (!proofChainResult.ok) {
    return proofChainResult;
  }

  const driftStatusResult = readJsonObject("drift_status", componentPaths.drift_status);
  if (!driftStatusResult.ok) {
    return driftStatusResult;
  }

  const packetIntegrityResult = readJsonObject("packet_integrity", componentPaths.packet_integrity);
  if (!packetIntegrityResult.ok) {
    return packetIntegrityResult;
  }

  const cleanlinessResult = readJsonObject("cleanliness", componentPaths.cleanliness);
  if (!cleanlinessResult.ok) {
    return cleanlinessResult;
  }

  const exitCriteriaResult = readJsonObject("exit_criteria", componentPaths.exit_criteria);
  if (!exitCriteriaResult.ok) {
    return exitCriteriaResult;
  }

  const promotionReadinessResult = readJsonObject("promotion_readiness", componentPaths.promotion_readiness);
  if (!promotionReadinessResult.ok) {
    return promotionReadinessResult;
  }

  const proofEntriesResolution = resolveProofIndexEntries(proofIndexResult.parsed);
  if (!proofEntriesResolution.ok) {
    return fail(
      "CI_MANIFEST_MISMATCH",
      "proof_index",
      `Closure component must expose an array under one of: entries, proofs, items, artefacts, artifacts, proof_entries. Found keys: ${proofEntriesResolution.keys.join(", ")}.`,
      componentPaths.proof_index
    );
  }

  if (proofEntriesResolution.value.length === 0) {
    return fail(
      "governance_gap_open",
      "proof_index",
      `Proof index array '${proofEntriesResolution.key}' must not be empty.`,
      componentPaths.proof_index
    );
  }

  const proofChainResolution = resolveProofChainEntries(proofChainResult.parsed);
  if (!proofChainResolution.ok) {
    return fail(
      "CI_MANIFEST_MISMATCH",
      "proof_chain",
      `Closure component must expose an array under one of: chain, freeze_proof_chain, proof_chain, chain_entries, proof_chain_entries, proof_steps. Found keys: ${proofChainResolution.keys.join(", ")}.`,
      componentPaths.proof_chain
    );
  }

  if (proofChainResolution.value.length === 0) {
    return fail(
      "governance_gap_open",
      "proof_chain",
      `Proof chain array '${proofChainResolution.key}' must not be empty.`,
      componentPaths.proof_chain
    );
  }

  const driftOk = requireBooleanOk("drift_status", driftStatusResult.parsed, componentPaths.drift_status);
  if (!driftOk.ok) {
    return driftOk;
  }

  const packetOk = requireBooleanOk("packet_integrity", packetIntegrityResult.parsed, componentPaths.packet_integrity);
  if (!packetOk.ok) {
    return packetOk;
  }

  const cleanlinessOk = requireBooleanOk("cleanliness", cleanlinessResult.parsed, componentPaths.cleanliness);
  if (!cleanlinessOk.ok) {
    return cleanlinessOk;
  }

  const exitOk = requireBooleanOk("exit_criteria", exitCriteriaResult.parsed, componentPaths.exit_criteria);
  if (!exitOk.ok) {
    return exitOk;
  }

  const promotionOk = requireBooleanOk("promotion_readiness", promotionReadinessResult.parsed, componentPaths.promotion_readiness);
  if (!promotionOk.ok) {
    return promotionOk;
  }

  const promotionPayload = resolvePromotionReadinessPayload(promotionReadinessResult.parsed);
  if (!promotionPayload.ok) {
    return fail(
      "CI_MANIFEST_MISMATCH",
      "promotion_readiness",
      "Closure component must expose one of: prerequisites(object), checks(array), required_checks(array), artifacts(array), artefacts(array), status(string), required_reports(array|object). " +
        `Found keys: ${promotionPayload.keys.join(", ")}.`,
      componentPaths.promotion_readiness
    );
  }

  const proofIndexId =
    proofIndexResult.parsed.proof_index_id ??
    proofIndexResult.parsed.component_id ??
    proofIndexResult.parsed.id ??
    proofIndexResult.parsed.verifier_id ??
    null;

  const proofChainIndexRef =
    proofChainResult.parsed.proof_index_id ??
    proofChainResult.parsed.proof_index_ref ??
    proofChainResult.parsed.proof_index ??
    proofChainResult.parsed.freeze_proof_index ??
    null;

  if (proofIndexId !== null && proofChainIndexRef !== null && proofIndexId !== proofChainIndexRef) {
    return fail(
      "governance_gap_open",
      "proof_chain",
      `Proof chain does not bind to proof index: proof_index=${proofIndexId} proof_chain_ref=${proofChainIndexRef}.`,
      componentPaths.proof_chain
    );
  }

  return {
    ok: true,
    closure_components: {
      cleanliness: componentPaths.cleanliness,
      drift_status: componentPaths.drift_status,
      exit_criteria: componentPaths.exit_criteria,
      packet_integrity: componentPaths.packet_integrity,
      proof_chain: componentPaths.proof_chain,
      proof_index: componentPaths.proof_index,
      promotion_readiness: componentPaths.promotion_readiness
    },
    closure_count: 7,
    promotion_payload_kind: promotionPayload.kind,
    promotion_safe: true
  };
}

function parseArgs(argv) {
  const args = {
    componentPaths: { ...DEFAULT_COMPONENTS }
  };

  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];

    if (token === "--proof-index") {
      args.componentPaths.proof_index = next;
      index += 1;
      continue;
    }

    if (token === "--proof-chain") {
      args.componentPaths.proof_chain = next;
      index += 1;
      continue;
    }

    if (token === "--drift-status") {
      args.componentPaths.drift_status = next;
      index += 1;
      continue;
    }

    if (token === "--packet-integrity") {
      args.componentPaths.packet_integrity = next;
      index += 1;
      continue;
    }

    if (token === "--cleanliness") {
      args.componentPaths.cleanliness = next;
      index += 1;
      continue;
    }

    if (token === "--exit-criteria") {
      args.componentPaths.exit_criteria = next;
      index += 1;
      continue;
    }

    if (token === "--promotion-readiness") {
      args.componentPaths.promotion_readiness = next;
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${token}`);
  }

  return args;
}

export function runCli(argv = process.argv) {
  let args;
  try {
    args = parseArgs(argv);
  } catch (error) {
    const result = fail("CI_MANIFEST_MISMATCH", "cli", error.message, "cli");
    process.stderr.write(JSON.stringify(result, null, 2) + "`n");
    return 1;
  }

  const result = verifyFreezeGovernanceClosure(args.componentPaths);
  if (!result.ok) {
    process.stderr.write(JSON.stringify(result, null, 2) + "`n");
    return 1;
  }

  process.stdout.write(JSON.stringify(result, null, 2) + "`n");
  return 0;
}

const entrypointPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
const modulePath = path.resolve(fileURLToPath(import.meta.url));
if (entrypointPath === modulePath) {
  process.exit(runCli(process.argv));
}
