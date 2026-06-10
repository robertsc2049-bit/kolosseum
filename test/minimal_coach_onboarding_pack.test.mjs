import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runMinimalCoachOnboardingPackLint } from "../ci/scripts/run_minimal_coach_onboarding_pack_lint.mjs";

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n", "utf8");
}

function makeTempCase({ registry, surfaceMap, copySurface }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "minimal-coach-onboarding-pack-"));
  const registryPath = path.join(dir, "registry.json");
  const surfaceMapPath = path.join(dir, "surface-map.json");
  const copySurfacePath = path.join(dir, "copy-surface.json");

  writeJson(registryPath, registry);
  writeJson(surfaceMapPath, surfaceMap);
  writeJson(copySurfacePath, copySurface);

  return { registryPath, surfaceMapPath, copySurfacePath };
}

function baseRegistry() {
  return {
    schema_version: "kolosseum.minimal_coach_onboarding_step_registry.v1.0.0",
    scope: "active_v0_only",
    tier_id: "coach_16",
    steps: [
      {
        step_id: "accept_platform_legal_gate",
        step_order: 1,
        step_title: "Accept platform legal gate.",
        step_type: "manual_operator_step",
        surface_id: "legal_gate_acceptance_recorded",
        goal: "Record legal gate acceptance.",
        prompts: [],
        required_fields: ["coach_id", "accepted_at"],
        forbidden_semantics: [],
        status: "allowed"
      },
      {
        step_id: "create_coach_platform_identity",
        step_order: 2,
        step_title: "Create coach platform identity.",
        step_type: "live_surface",
        surface_id: "coach_account_create",
        goal: "Create coach account.",
        prompts: ["First name.", "Last name.", "Email address."],
        required_fields: ["first_name", "last_name", "email"],
        forbidden_semantics: [],
        status: "allowed"
      },
      {
        step_id: "apply_coach_role",
        step_order: 3,
        step_title: "Apply coach role.",
        step_type: "manual_operator_step",
        surface_id: "coach_role_assignment",
        goal: "Assign coach role.",
        prompts: [],
        required_fields: ["coach_id", "role_id"],
        forbidden_semantics: [],
        status: "allowed"
      },
      {
        step_id: "apply_coach_16_entitlement",
        step_order: 4,
        step_title: "Apply coach_16 entitlement.",
        step_type: "manual_operator_step",
        surface_id: "coach_16_entitlement_assignment",
        goal: "Assign coach_16.",
        prompts: [],
        required_fields: ["coach_id", "tier_id"],
        forbidden_semantics: [],
        status: "allowed"
      },
      {
        step_id: "create_explicit_coach_athlete_link",
        step_order: 5,
        step_title: "Create explicit coach-athlete link.",
        step_type: "manual_operator_step",
        surface_id: "coach_athlete_link_create",
        goal: "Create link.",
        prompts: [],
        required_fields: ["coach_id", "athlete_id", "link_state"],
        forbidden_semantics: [],
        status: "allowed"
      },
      {
        step_id: "confirm_live_coach_surface",
        step_order: 6,
        step_title: "Confirm live coach surface.",
        step_type: "live_surface",
        surface_id: "coach_surface_confirmation",
        goal: "Confirm coach surface.",
        prompts: ["Assign within system limits.", "View factual execution artefacts."],
        required_fields: ["coach_id"],
        forbidden_semantics: [],
        status: "allowed"
      },
      {
        step_id: "enter_first_lawful_coach_managed_run",
        step_order: 7,
        step_title: "Enter first lawful coach-managed run.",
        step_type: "live_surface",
        surface_id: "phase1_onboarding_form",
        goal: "Enter first run.",
        prompts: ["Select athlete.", "Select activity.", "Select location type."],
        required_fields: ["actor_type", "execution_scope", "governing_authority_id", "subject_id", "activity_id", "location_type"],
        forbidden_semantics: [],
        status: "allowed"
      }
    ],
    forbidden_prompt_patterns: [
      {
        pattern_id: "forbidden_medical_safety",
        regex: "\\b(injur(?:y|ies)|diagnos(?:is|es)|treat(?:ment)?|therapy|rehab(?:ilit(?:ation)?)?|medical|clinical|safe|safer|safety|risk|prevent(?:ion)?|protect(?:ion)?)\\b",
        token: "CI_LINT_FORBIDDEN_LANGUAGE_FOUND"
      },
      {
        pattern_id: "forbidden_future_scope",
        regex: "\\b(replay|evidence|analytics|dashboard|messaging|organisation|team setup|unit setup)\\b",
        token: "CI_PRODUCT_BEHAVIOUR_LEAK"
      }
    ]
  };
}

function baseSurfaceMap() {
  return {
    schema_version: "kolosseum.minimal_coach_onboarding_surface_map.v1.0.0",
    scope: "active_v0_only",
    allowed_live_surfaces: [
      { surface_id: "coach_account_create", surface_type: "live_surface", summary: "Create coach account." },
      { surface_id: "coach_surface_confirmation", surface_type: "live_surface", summary: "Confirm coach surface." },
      { surface_id: "phase1_onboarding_form", surface_type: "live_surface", summary: "Phase 1 onboarding form." }
    ],
    allowed_manual_operator_steps: [
      { surface_id: "legal_gate_acceptance_recorded", surface_type: "manual_operator_step", summary: "Legal gate recorded." },
      { surface_id: "coach_role_assignment", surface_type: "manual_operator_step", summary: "Role assignment." },
      { surface_id: "coach_16_entitlement_assignment", surface_type: "manual_operator_step", summary: "Entitlement assignment." },
      { surface_id: "coach_athlete_link_create", surface_type: "manual_operator_step", summary: "Coach-athlete link create." }
    ],
    step_to_surface_map: [
      { step_id: "accept_platform_legal_gate", surface_id: "legal_gate_acceptance_recorded", surface_type: "manual_operator_step" },
      { step_id: "create_coach_platform_identity", surface_id: "coach_account_create", surface_type: "live_surface" },
      { step_id: "apply_coach_role", surface_id: "coach_role_assignment", surface_type: "manual_operator_step" },
      { step_id: "apply_coach_16_entitlement", surface_id: "coach_16_entitlement_assignment", surface_type: "manual_operator_step" },
      { step_id: "create_explicit_coach_athlete_link", surface_id: "coach_athlete_link_create", surface_type: "manual_operator_step" },
      { step_id: "confirm_live_coach_surface", surface_id: "coach_surface_confirmation", surface_type: "live_surface" },
      { step_id: "enter_first_lawful_coach_managed_run", surface_id: "phase1_onboarding_form", surface_type: "live_surface" }
    ]
  };
}

function baseCopySurface() {
  return {
    schema_version: "kolosseum.minimal_coach_onboarding_copy_surface.v1.0.0",
    scope: "active_v0_only",
    phrases: [
      "Create coach access.",
      "Assign coach role.",
      "Apply coach_16 access.",
      "Link coach to athlete explicitly.",
      "Confirm current coach surfaces.",
      "Start first lawful coach-managed run.",
      "Assign within system limits.",
      "View factual execution artefacts.",
      "Write non-binding coach notes."
    ]
  };
}

test("passes on the repo minimal coach onboarding pack slice", () => {
  const report = runMinimalCoachOnboardingPackLint({
    registryPath: path.resolve("docs/commercial/MINIMAL_COACH_ONBOARDING_STEP_REGISTRY.json"),
    surfaceMapPath: path.resolve("docs/commercial/MINIMAL_COACH_ONBOARDING_SURFACE_MAP.json"),
    copySurfacePath: path.resolve("docs/commercial/MINIMAL_COACH_ONBOARDING_COPY_SURFACE.json")
  });

  assert.equal(report.ok, true, JSON.stringify(report, null, 2));
  assert.equal(report.failures.length, 0, JSON.stringify(report, null, 2));
});

test("fails when a live onboarding step is bloated with too many prompts", () => {
  const registry = baseRegistry();
  registry.steps[1].prompts.push("Phone number.");

  const files = makeTempCase({
    registry,
    surfaceMap: baseSurfaceMap(),
    copySurface: baseCopySurface()
  });

  const report = runMinimalCoachOnboardingPackLint(files);

  assert.equal(report.ok, false);
  assert.ok(report.failures.some((failure) => failure.token === "CI_CONSTRAINT_UNUSED"), JSON.stringify(report, null, 2));
});

test("fails when a prompt introduces medical language", () => {
  const registry = baseRegistry();
  registry.steps[6].prompts[0] = "Describe injury history.";

  const files = makeTempCase({
    registry,
    surfaceMap: baseSurfaceMap(),
    copySurface: baseCopySurface()
  });

  const report = runMinimalCoachOnboardingPackLint(files);

  assert.equal(report.ok, false);
  assert.ok(report.failures.some((failure) => failure.token === "CI_LINT_FORBIDDEN_LANGUAGE_FOUND"), JSON.stringify(report, null, 2));
});

test("fails when a step has no mapped current surface", () => {
  const registry = baseRegistry();
  registry.steps[4].surface_id = "coach_athlete_link_live_magic";

  const files = makeTempCase({
    registry,
    surfaceMap: baseSurfaceMap(),
    copySurface: baseCopySurface()
  });

  const report = runMinimalCoachOnboardingPackLint(files);

  assert.equal(report.ok, false);
  assert.ok(report.failures.some((failure) => failure.token === "CI_FOREIGN_KEY_FAILURE"), JSON.stringify(report, null, 2));
});

test("fails when copy surface introduces future-scope language", () => {
  const copySurface = baseCopySurface();
  copySurface.phrases.push("Open replay evidence dashboard.");

  const files = makeTempCase({
    registry: baseRegistry(),
    surfaceMap: baseSurfaceMap(),
    copySurface
  });

  const report = runMinimalCoachOnboardingPackLint(files);

  assert.equal(report.ok, false);
  assert.ok(report.failures.some((failure) => failure.token === "CI_PRODUCT_BEHAVIOUR_LEAK"), JSON.stringify(report, null, 2));
});