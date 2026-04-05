import fs from "node:fs";
import path from "node:path";

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function makeFailure(token, file, pathValue, details) {
  return {
    token,
    file,
    path: pathValue,
    details
  };
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

export function runMinimalCoachOnboardingPackLint({
  registryPath,
  surfaceMapPath,
  copySurfacePath
}) {
  const failures = [];

  const registryDoc = readJson(registryPath);
  const surfaceMapDoc = readJson(surfaceMapPath);
  const copySurfaceDoc = readJson(copySurfacePath);

  const steps = Array.isArray(registryDoc.steps) ? registryDoc.steps : [];
  const forbiddenPatterns = Array.isArray(registryDoc.forbidden_prompt_patterns)
    ? registryDoc.forbidden_prompt_patterns.map((rule) => ({
        ...rule,
        compiled: new RegExp(rule.regex, "i")
      }))
    : [];

  const allowedLive = new Set(
    (surfaceMapDoc.allowed_live_surfaces || []).map((entry) => entry.surface_id)
  );
  const allowedManual = new Set(
    (surfaceMapDoc.allowed_manual_operator_steps || []).map((entry) => entry.surface_id)
  );

  const stepToSurface = new Map();
  for (let i = 0; i < (surfaceMapDoc.step_to_surface_map || []).length; i += 1) {
    const entry = surfaceMapDoc.step_to_surface_map[i];
    const mapPath = `step_to_surface_map[${i}]`;

    if (!isNonEmptyString(entry.step_id)) {
      failures.push(makeFailure("CI_REGISTRY_STRUCTURE_INVALID", surfaceMapPath, `${mapPath}.step_id`, "step_id must be a non-empty string."));
      continue;
    }

    if (stepToSurface.has(entry.step_id)) {
      failures.push(makeFailure("CI_REGISTRY_STRUCTURE_INVALID", surfaceMapPath, `${mapPath}.step_id`, `Duplicate step_to_surface_map entry for '${entry.step_id}'.`));
    }
    stepToSurface.set(entry.step_id, entry);

    if (entry.surface_type === "live_surface") {
      if (!allowedLive.has(entry.surface_id)) {
        failures.push(makeFailure("CI_FOREIGN_KEY_FAILURE", surfaceMapPath, `${mapPath}.surface_id`, `Unknown live surface '${entry.surface_id}'.`));
      }
    } else if (entry.surface_type === "manual_operator_step") {
      if (!allowedManual.has(entry.surface_id)) {
        failures.push(makeFailure("CI_FOREIGN_KEY_FAILURE", surfaceMapPath, `${mapPath}.surface_id`, `Unknown manual operator step '${entry.surface_id}'.`));
      }
    } else {
      failures.push(makeFailure("CI_REGISTRY_STRUCTURE_INVALID", surfaceMapPath, `${mapPath}.surface_type`, `surface_type must be 'live_surface' or 'manual_operator_step'.`));
    }
  }

  const expectedStepIds = [
    "accept_platform_legal_gate",
    "create_coach_platform_identity",
    "apply_coach_role",
    "apply_coach_16_entitlement",
    "create_explicit_coach_athlete_link",
    "confirm_live_coach_surface",
    "enter_first_lawful_coach_managed_run"
  ];

  if (steps.length !== expectedStepIds.length) {
    failures.push(makeFailure("CI_CONSTRAINT_UNUSED", registryPath, "steps", `Expected exactly ${expectedStepIds.length} onboarding steps. Found ${steps.length}.`));
  }

  const seenIds = new Set();
  const seenOrders = new Set();
  let totalLivePrompts = 0;

  for (let i = 0; i < steps.length; i += 1) {
    const step = steps[i];
    const stepPath = `steps[${i}]`;

    if (!isNonEmptyString(step.step_id)) {
      failures.push(makeFailure("CI_REGISTRY_STRUCTURE_INVALID", registryPath, `${stepPath}.step_id`, "step_id must be a non-empty string."));
      continue;
    }

    if (seenIds.has(step.step_id)) {
      failures.push(makeFailure("CI_REGISTRY_STRUCTURE_INVALID", registryPath, `${stepPath}.step_id`, `Duplicate step_id '${step.step_id}'.`));
    }
    seenIds.add(step.step_id);

    if (expectedStepIds[i] !== step.step_id) {
      failures.push(makeFailure("CI_CONSTRAINT_UNUSED", registryPath, `${stepPath}.step_id`, `Unexpected step order. Expected '${expectedStepIds[i]}', found '${step.step_id}'.`));
    }

    if (step.step_order !== i + 1) {
      failures.push(makeFailure("CI_REGISTRY_STRUCTURE_INVALID", registryPath, `${stepPath}.step_order`, `step_order must be ${i + 1}.`));
    }

    if (seenOrders.has(step.step_order)) {
      failures.push(makeFailure("CI_REGISTRY_STRUCTURE_INVALID", registryPath, `${stepPath}.step_order`, `Duplicate step_order '${step.step_order}'.`));
    }
    seenOrders.add(step.step_order);

    if (step.status !== "allowed") {
      failures.push(makeFailure("CI_REGISTRY_STRUCTURE_INVALID", registryPath, `${stepPath}.status`, `Only 'allowed' steps are supported by this slice. Found '${step.status}'.`));
    }

    if (step.step_type !== "live_surface" && step.step_type !== "manual_operator_step") {
      failures.push(makeFailure("CI_REGISTRY_STRUCTURE_INVALID", registryPath, `${stepPath}.step_type`, `step_type must be 'live_surface' or 'manual_operator_step'.`));
    }

    if (!stepToSurface.has(step.step_id)) {
      failures.push(makeFailure("CI_FOREIGN_KEY_FAILURE", registryPath, `${stepPath}.step_id`, `Step '${step.step_id}' has no mapped surface.`));
    } else {
      const mapped = stepToSurface.get(step.step_id);
      if (mapped.surface_id !== step.surface_id) {
        failures.push(makeFailure("CI_FOREIGN_KEY_FAILURE", registryPath, `${stepPath}.surface_id`, `Step '${step.step_id}' surface_id '${step.surface_id}' does not match mapped surface '${mapped.surface_id}'.`));
      }
      if (mapped.surface_type !== step.step_type) {
        failures.push(makeFailure("CI_FOREIGN_KEY_FAILURE", registryPath, `${stepPath}.step_type`, `Step '${step.step_id}' step_type '${step.step_type}' does not match mapped surface type '${mapped.surface_type}'.`));
      }
    }

    if (!Array.isArray(step.required_fields) || step.required_fields.length === 0) {
      failures.push(makeFailure("CI_REGISTRY_STRUCTURE_INVALID", registryPath, `${stepPath}.required_fields`, `Step '${step.step_id}' must declare non-empty required_fields.`));
    }

    if (!Array.isArray(step.prompts)) {
      failures.push(makeFailure("CI_REGISTRY_STRUCTURE_INVALID", registryPath, `${stepPath}.prompts`, `Step '${step.step_id}' prompts must be an array.`));
      continue;
    }

    if (step.step_type === "live_surface") {
      totalLivePrompts += step.prompts.length;
      if (step.prompts.length > 3) {
        failures.push(makeFailure("CI_CONSTRAINT_UNUSED", registryPath, `${stepPath}.prompts`, `Live step '${step.step_id}' exceeds three prompts.`));
      }
    } else if (step.prompts.length !== 0) {
      failures.push(makeFailure("CI_CONSTRAINT_UNUSED", registryPath, `${stepPath}.prompts`, `Manual operator step '${step.step_id}' must not define prompts.`));
    }

    for (let j = 0; j < step.prompts.length; j += 1) {
      const prompt = step.prompts[j];
      const promptPath = `${stepPath}.prompts[${j}]`;

      if (!isNonEmptyString(prompt)) {
        failures.push(makeFailure("CI_REGISTRY_STRUCTURE_INVALID", registryPath, promptPath, "Prompt must be a non-empty string."));
        continue;
      }

      for (const rule of forbiddenPatterns) {
        if (rule.compiled.test(prompt)) {
          failures.push(makeFailure(rule.token || "CI_LINT_FORBIDDEN_LANGUAGE_FOUND", registryPath, promptPath, `Prompt '${prompt}' matches forbidden onboarding pattern '${rule.pattern_id}'.`));
        }
      }
    }
  }

  if (totalLivePrompts > 8) {
    failures.push(makeFailure("CI_CONSTRAINT_UNUSED", registryPath, "steps", `Total live prompts must be <= 8. Found ${totalLivePrompts}.`));
  }

  const copyPhrases = Array.isArray(copySurfaceDoc.phrases) ? copySurfaceDoc.phrases : [];
  const allowedCopyPhrases = new Set([
    "Create coach access.",
    "Assign coach role.",
    "Apply coach_16 access.",
    "Link coach to athlete explicitly.",
    "Confirm current coach surfaces.",
    "Start first lawful coach-managed run.",
    "Assign within system limits.",
    "View factual execution artefacts.",
    "Write non-binding coach notes."
  ]);

  const copySeen = new Set();
  for (let i = 0; i < copyPhrases.length; i += 1) {
    const phrase = copyPhrases[i];
    const phrasePath = `phrases[${i}]`;

    if (!isNonEmptyString(phrase)) {
      failures.push(makeFailure("CI_REGISTRY_STRUCTURE_INVALID", copySurfacePath, phrasePath, "Copy phrase must be a non-empty string."));
      continue;
    }

    if (copySeen.has(phrase)) {
      failures.push(makeFailure("CI_REGISTRY_STRUCTURE_INVALID", copySurfacePath, phrasePath, `Duplicate copy phrase '${phrase}'.`));
    }
    copySeen.add(phrase);

    for (const rule of forbiddenPatterns) {
      if (rule.compiled.test(phrase)) {
        failures.push(makeFailure(rule.token || "CI_LINT_FORBIDDEN_LANGUAGE_FOUND", copySurfacePath, phrasePath, `Copy phrase '${phrase}' matches forbidden onboarding pattern '${rule.pattern_id}'.`));
      }
    }

    if (!allowedCopyPhrases.has(phrase)) {
      failures.push(makeFailure("CI_LINT_COPY_INLINE_STRING", copySurfacePath, phrasePath, `Copy phrase '${phrase}' is not in the allowed onboarding copy set.`));
    }
  }

  return {
    ok: failures.length === 0,
    failures
  };
}

function main() {
  const repoRoot = process.cwd();

  const registryPath = process.argv[2] || path.join(repoRoot, "docs/commercial/MINIMAL_COACH_ONBOARDING_STEP_REGISTRY.json");
  const surfaceMapPath = process.argv[3] || path.join(repoRoot, "docs/commercial/MINIMAL_COACH_ONBOARDING_SURFACE_MAP.json");
  const copySurfacePath = process.argv[4] || path.join(repoRoot, "docs/commercial/MINIMAL_COACH_ONBOARDING_COPY_SURFACE.json");

  const report = runMinimalCoachOnboardingPackLint({
    registryPath,
    surfaceMapPath,
    copySurfacePath
  });

  const output = JSON.stringify(report, null, 2);
  if (!report.ok) {
    process.stderr.write(output + "\n");
    process.exit(1);
  }

  process.stdout.write(output + "\n");
}

if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main();
}