import fs from "node:fs";
import path from "node:path";

function fail(message) {
  throw new Error(message);
}

function readUtf8(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function readJson(filePath) {
  return JSON.parse(readUtf8(filePath));
}

function assertFileExists(filePath, label) {
  if (!fs.existsSync(filePath)) {
    fail(`${label} missing: ${filePath}`);
  }
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

function extractOperatorLanguageSections(runbook) {
  const sections = [];

  const allowedMarker = "## 3. Allowed Operator Recovery Language";
  const orderMarker = "## 4. Deterministic Recovery Order";
  const stopMarker = "## 6. Terminal Stop Script";
  const proofMarker = "## 7. Proof Requirements";

  const allowedStart = runbook.indexOf(allowedMarker);
  const orderStart = runbook.indexOf(orderMarker);
  const stopStart = runbook.indexOf(stopMarker);
  const proofStart = runbook.indexOf(proofMarker);

  if (allowedStart !== -1 && orderStart !== -1 && orderStart > allowedStart) {
    const allowedSection = runbook.slice(allowedStart, orderStart);
    const allowedOnly = allowedSection.split("Forbidden:").shift();
    sections.push(allowedOnly);
  }

  if (stopStart !== -1 && proofStart !== -1 && proofStart > stopStart) {
    sections.push(runbook.slice(stopStart, proofStart));
  }

  const extracted = sections.join("\n").trim();

  if (extracted.length > 0) {
    return extracted;
  }

  return runbook;
}

function main() {
  const repoRoot = process.cwd();

  const runbookPath = path.join(repoRoot, "docs/demo/P171_LIVE_DEMO_FAILURE_RECOVERY_RUNBOOK.md");
  const manifestPath = path.join(repoRoot, "docs/demo/P171_LIVE_DEMO_FAILURE_RECOVERY_MANIFEST.json");

  assertFileExists(runbookPath, "runbook");
  assertFileExists(manifestPath, "manifest");

  const runbook = readUtf8(runbookPath);
  const manifest = readJson(manifestPath);

  assert(manifest.schema_version === "kolosseum.demo_recovery_manifest.v1", "manifest schema_version mismatch");
  assert(manifest.engine_compatibility === "EB2-1.0.0", "manifest engine_compatibility mismatch");
  assert(manifest.release_scope === "v0", "manifest release_scope must be v0");
  assert(Array.isArray(manifest.steps), "manifest steps must be an array");
  assert(manifest.steps.length > 0, "manifest steps must not be empty");

  const operatorLanguage = extractOperatorLanguageSections(runbook);

  const bannedRunbookPhrases = [
    /\bbest effort\b/i,
    /\bgraceful\b/i,
    /\btry anyway\b/i,
    /\bclosest match\b/i,
    /\bgracefully falls? back\b/i,
    /\bfix(?:es|ed|ing)? itself\b/i,
    /\busually\b/i,
    /\bshould still work\b/i,
    /\bprobably\b/i
  ];

  for (const pattern of bannedRunbookPhrases) {
    assert(!pattern.test(operatorLanguage), `runbook contains banned recovery language: ${pattern}`);
  }

  const forbiddenSurfaceTerms = [
    /phase[-_ ]?7/i,
    /phase[-_ ]?8/i,
    /(^|[^a-z0-9])evidence([^a-z0-9]|$)/i,
    /(^|[^a-z0-9])export([^a-z0-9]|$)/i,
    /dashboard/i,
    /analytics/i,
    /ranking/i,
    /messaging/i,
    /team[-_ ]runtime/i,
    /unit[-_ ]runtime/i,
    /gym[-_ ]runtime/i,
    /org[-_ ]runtime/i,
    /truth[-_ ]projection/i,
    /freeze/i,
    /audit/i
  ];

  const allowedTypes = new Set(["ui_surface", "factual_artefact", "proof_doc", "stop"]);
  const seenStepIds = new Set();
  const seenTriggerIds = new Set();
  const seenIndexes = new Set();

  for (const step of manifest.steps) {
    assert(typeof step.step_id === "string" && step.step_id.length > 0, "each step_id must be a non-empty string");
    assert(!seenStepIds.has(step.step_id), `duplicate step_id: ${step.step_id}`);
    seenStepIds.add(step.step_id);

    assert(typeof step.fallback_order_index === "number", `fallback_order_index missing for ${step.step_id}`);
    assert(!seenIndexes.has(step.fallback_order_index), `duplicate fallback_order_index: ${step.fallback_order_index}`);
    seenIndexes.add(step.fallback_order_index);

    assert(typeof step.trigger_surface_id === "string" && step.trigger_surface_id.length > 0, `trigger_surface_id missing for ${step.step_id}`);
    assert(!seenTriggerIds.has(step.trigger_surface_id), `duplicate trigger_surface_id: ${step.trigger_surface_id}`);
    seenTriggerIds.add(step.trigger_surface_id);

    assert(typeof step.target_artefact_id === "string" && step.target_artefact_id.length > 0, `target_artefact_id missing for ${step.step_id}`);
    assert(allowedTypes.has(step.target_surface_type), `invalid target_surface_type for ${step.step_id}: ${step.target_surface_type}`);
    assert(step.allowed_in_v0 === true, `allowed_in_v0 must be true for ${step.step_id}`);
    assert(step.live_required === true, `live_required must be true for ${step.step_id}`);
    assert(step.notes === null, `notes must be null for ${step.step_id}`);

    if (step.terminal === true) {
      assert(step.next_step_id === null, `terminal step must have next_step_id null: ${step.step_id}`);
      assert(step.target_surface_type === "stop", `terminal step must have target_surface_type 'stop': ${step.step_id}`);
    } else {
      assert(typeof step.next_step_id === "string" && step.next_step_id.length > 0, `non-terminal step must have next_step_id: ${step.step_id}`);
    }

    for (const pattern of forbiddenSurfaceTerms) {
      assert(!pattern.test(step.target_artefact_id), `forbidden target scope in ${step.step_id}: ${step.target_artefact_id}`);
    }

    const resolvedTarget = path.join(repoRoot, step.target_artefact_id);
    assertFileExists(resolvedTarget, `target artefact for ${step.step_id}`);
  }

  const sortedIndexes = [...seenIndexes].sort((a, b) => a - b);
  for (let i = 0; i < sortedIndexes.length; i++) {
    const expected = i + 1;
    assert(sortedIndexes[i] === expected, `fallback_order_index must be contiguous from 1; expected ${expected}, got ${sortedIndexes[i]}`);
  }

  const stepById = new Map(manifest.steps.map((step) => [step.step_id, step]));
  for (const step of manifest.steps) {
    if (step.next_step_id !== null) {
      assert(stepById.has(step.next_step_id), `next_step_id does not resolve for ${step.step_id}: ${step.next_step_id}`);
    }
  }

  const terminalSteps = manifest.steps.filter((step) => step.terminal === true);
  assert(terminalSteps.length === 1, `exactly one terminal step is required; found ${terminalSteps.length}`);
  assert(terminalSteps[0].fallback_order_index === manifest.steps.length, "terminal step must be last in fallback order");

  const requiredRunbookLines = [
    "No improvising product claims during recovery.",
    "No engine retry, no hidden alternate logic, no mutation, no recovery code path.",
    "If a live demo misbehaves, the operator may only route to already-live v0 proof surfaces or stop.",
    "\"This surface is not the one I am using to prove the flow. I am moving to the corresponding factual artefact.\"",
    "\"I am staying inside the proven v0 path.\"",
    "\"I am not making claims beyond what this artefact shows.\""
  ];

  for (const line of requiredRunbookLines) {
    assert(runbook.includes(line), `runbook missing required line: ${line}`);
  }

  console.log(JSON.stringify({
    ok: true,
    checked_steps: manifest.steps.length,
    terminal_step_id: terminalSteps[0].step_id
  }, null, 2));
}

main();