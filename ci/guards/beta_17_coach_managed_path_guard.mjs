// @law: Repo Governance
// @severity: high
// @scope: app
// DEV NOTE: BETA-17 coach-managed permission, note isolation and Copy Registry guard.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  pathToFileURL
} from "node:url";

const root = process.cwd();
let failed = false;

function fail(message) {
  failed = true;

  console.error(
    `CI_BETA_17_COACH_MANAGED_PATH::FAIL::${message}`
  );
}

function read(relativePath) {
  const absolutePath = path.join(
    root,
    relativePath
  );

  if (!fs.existsSync(absolutePath)) {
    fail(`missing::${relativePath}`);
    return "";
  }

  return fs.readFileSync(
    absolutePath,
    "utf8"
  );
}

function readJson(relativePath) {
  const content = read(relativePath);

  if (!content) {
    return null;
  }

  try {
    return JSON.parse(content);
  }
  catch (error) {
    fail(
      `invalid_json::${relativePath}::${String(error?.message ?? error)}`
    );

    return null;
  }
}

function sha256(content) {
  return crypto
    .createHash("sha256")
    .update(content, "utf8")
    .digest("hex");
}

const files = {
  service:
    "src/api/beta17_coach_managed_service.ts",
  handlers:
    "src/api/sessions.handlers.ts",
  routes:
    "src/api/sessions.routes.ts",
  html:
    "public/v0-session-runner.html",
  browser:
    "public/beta17-coach-managed.js",
  copy:
    "copy/beta_17_coach_managed_path_copy.json",
  publicCopy:
    "public/beta_17_coach_managed_path_copy.json",
  test:
    "test/beta_17_coach_managed_path.test.mjs",
  runner:
    "ci/scripts/run_beta_17_coach_managed_path_tests.mjs",
  fixture:
    "test/fixtures/beta_17_coach_managed_path/clean_coach_managed_path.json",
  manifest:
    "test/fixtures/beta_17_coach_managed_path/manifest.json",
  doc:
    "docs/runtime/BETA_17_COACH_MANAGED_PATH.md",
  package:
    "package.json",
  entrypoints:
    "ci/guards/_entrypoints.json"
};

const source = {};

for (
  const [name, relativePath]
  of Object.entries(files)
) {
  source[name] = read(relativePath);
}

for (const token of [
  "beta17_coach_managed_path",
  "createBeta17CoachProfileRecord",
  "createBeta17RelationshipRecord",
  "createBeta17AssignmentRecord",
  "buildBeta17CoachArtefactView",
  "createBeta17CoachNoteRecord",
  "notes_non_binding: true",
  "assignment_mutates_engine_truth: false",
  "coach_state_engine_visible: false",
  "can_edit_athlete_declaration:",
  "can_alter_registries:",
  "can_override_engine_decisions:"
]) {
  if (!source.service.includes(token)) {
    fail(`service_token_missing::${token}`);
  }
}

for (const forbiddenImport of [
  "@kolosseum/engine",
  "engine/src/",
  "from \"../../engine",
  "from \"../engine"
]) {
  if (
    source.service.includes(
      forbiddenImport
    )
  ) {
    fail(
      `service_engine_import::${forbiddenImport}`
    );
  }
}

for (const forbiddenField of [
  '"phase1_input"',
  '"phase1_declaration"',
  '"registry_bundle"',
  '"registry_index"',
  '"engine_override"',
  '"decision_override"'
]) {
  if (
    !source.service.includes(
      forbiddenField
    )
  ) {
    fail(
      `service_forbidden_field_gate_missing::${forbiddenField}`
    );
  }
}

const coachManagedRoutes = [
  {
    router:
      '"/beta-coach-profile"',
    browser:
      '"/sessions/beta-coach-profile"'
  },
  {
    router:
      '"/beta-coach-relationship"',
    browser:
      '"/sessions/beta-coach-relationship"'
  },
  {
    router:
      '"/beta-coach-assignment"',
    browser:
      '"/sessions/beta-coach-assignment"'
  },
  {
    router:
      '"/beta-coach-artefacts"',
    browser:
      '"/sessions/beta-coach-artefacts"'
  },
  {
    router:
      '"/beta-coach-notes"',
    browser:
      '"/sessions/beta-coach-notes"'
  }
];

for (
  const route
  of coachManagedRoutes
) {
  if (
    !source.routes.includes(
      route.router
    )
  ) {
    fail(
      `route_missing::${route.router}`
    );
  }

  if (
    !source.browser.includes(
      route.browser
    )
  ) {
    fail(
      `browser_route_missing::${route.browser}`
    );
  }
}

for (const handler of [
  "createBeta17CoachProfile",
  "createBeta17Relationship",
  "createBeta17Assignment",
  "getBeta17CoachArtefacts",
  "createBeta17CoachNote"
]) {
  if (!source.handlers.includes(handler)) {
    fail(`handler_missing::${handler}`);
  }
}

if (
  !source.html.includes(
    'id="beta17CoachManagedPath"'
  )
) {
  fail("existing_screen_extension_missing");
}

if (
  !source.html.includes(
    "/ui/beta17-coach-managed.js"
  )
) {
  fail("browser_module_missing");
}

if (source.copy !== source.publicCopy) {
  fail("copy_registry_mirror_mismatch");
}

const copyEntries =
  readJson(files.copy);

const registeredCopyIds = new Set();

if (!Array.isArray(copyEntries)) {
  fail("copy_registry_invalid");
}
else {
  for (const entry of copyEntries) {
    if (
      !entry ||
      typeof entry.copy_id !== "string" ||
      typeof entry.text !== "string" ||
      entry.surface_id !==
        "beta17_coach_managed_path"
    ) {
      fail("copy_registry_entry_invalid");
      continue;
    }

    if (
      registeredCopyIds.has(
        entry.copy_id
      )
    ) {
      fail(
        `copy_registry_duplicate::${entry.copy_id}`
      );
    }

    registeredCopyIds.add(
      entry.copy_id
    );
  }
}

const referencedCopyIds = new Set();

for (const text of [
  source.service,
  source.html,
  source.browser
]) {
  for (
    const match of text.matchAll(
      /BETA17_COPY_[A-Z0-9_]+/gu
    )
  ) {
    referencedCopyIds.add(match[0]);
  }
}

for (const copyId of referencedCopyIds) {
  if (!registeredCopyIds.has(copyId)) {
    fail(
      `copy_id_unregistered::${copyId}`
    );
  }
}

const copyLower =
  source.copy.toLowerCase();

for (const forbidden of [
  "recommendation",
  "recommended",
  "readiness",
  "optimal",
  "optimise",
  "optimize",
  "performance score",
  "safety score",
  "risk score",
  "diagnose",
  "prescribe"
]) {
  if (copyLower.includes(forbidden)) {
    fail(
      `copy_forbidden_term::${forbidden}`
    );
  }
}

for (const requiredTest of [
  "accepted coach can record assignment trigger",
  "accepted coach can view factual artefact records",
  "accepted coach can record exact non-binding note",
  "revoked relationship blocks all future coach access",
  "coach cannot submit declaration registry or engine override state",
  "coach notes do not alter actual Phase 1-6 output",
  "relationship state does not alter actual Phase 1-6 output"
]) {
  if (!source.test.includes(requiredTest)) {
    fail(
      `test_contract_missing::${requiredTest}`
    );
  }
}

for (const token of [
  "npm run build",
  "beta_17_coach_managed_path.test.mjs"
]) {
  if (!source.runner.includes(token)) {
    fail(`runner_token_missing::${token}`);
  }
}

for (const token of [
  '"proof:beta-17"',
  "run_beta_17_coach_managed_path_tests.mjs",
  "beta_17_coach_managed_path_guard.mjs",
  "npm run proof:beta-17"
]) {
  if (!source.package.includes(token)) {
    fail(
      `package_entrypoint_missing::${token}`
    );
  }
}

if (
  !source.entrypoints.includes(
    '"proof:beta-17"'
  )
) {
  fail("declared_entrypoint_missing");
}

for (const token of [
  "active coach product profile",
  "Invited and revoked relationships fail closed",
  "does not alter Phase 1",
  "stored separately from factual artefacts",
  "unable to change Phase 1\u20136 output",
  "Copy Registry"
]) {
  if (!source.doc.includes(token)) {
    fail(
      `documentation_token_missing::${token}`
    );
  }
}

const manifest =
  readJson(files.manifest);

const fixture =
  readJson(files.fixture);

if (
  !manifest ||
  manifest.slice_id !== "BETA-17" ||
  !Array.isArray(manifest.fixtures) ||
  manifest.fixtures.length !== 1
) {
  fail("fixture_manifest_invalid");
}
else {
  const entry =
    manifest.fixtures[0];

  if (
    sha256(source.fixture) !==
    entry.sha256
  ) {
    fail("fixture_hash_mismatch");
  }
}

if (
  !fixture ||
  fixture.fixture_id !==
    "beta17_clean_coach_managed_path"
) {
  fail("fixture_invalid");
}

if (!failed) {
  const runtimePath = path.join(
    root,
    "dist",
    "src",
    "api",
    "beta17_coach_managed_service.js"
  );

  if (!fs.existsSync(runtimePath)) {
    fail("compiled_service_missing");
  }
  else {
    const runtime = await import(
      pathToFileURL(runtimePath).href
    );

    const profile =
      runtime
        .createBeta17CoachProfileRecord(
          fixture.coach_profile_input
        );

    const relationship =
      runtime
        .createBeta17RelationshipRecord(
          fixture
            .accepted_relationship_input
        );

    if (
      profile.status !== 201 ||
      relationship.status !== 201
    ) {
      fail("compiled_profile_relationship_failed");
    }
    else {
      const assignment =
        runtime
          .createBeta17AssignmentRecord({
            ...fixture.assignment_input,
            coach_profile:
              profile.body.coach_profile,
            relationship:
              relationship.body.relationship
          });

      const note =
        runtime
          .createBeta17CoachNoteRecord({
            ...fixture.note_input,
            coach_profile:
              profile.body.coach_profile,
            relationship:
              relationship.body.relationship
          });

      if (
        assignment.status !== 201 ||
        note.status !== 201 ||
        note.body.coach_note
          .non_binding !== true ||
        note.body.coach_note
          .engine_visible !== false
      ) {
        fail("compiled_coach_path_failed");
      }

      const revoked =
        runtime
          .createBeta17RelationshipRecord(
            fixture
              .revoked_relationship_input
          );

      const denied =
        runtime
          .createBeta17CoachNoteRecord({
            ...fixture.note_input,
            coach_profile:
              profile.body.coach_profile,
            relationship:
              revoked.body.relationship
          });

      if (denied.status !== 403) {
        fail("compiled_revoked_access_not_denied");
      }
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
      guard: "BETA-17",
      token:
        "CI_BETA_17_COACH_MANAGED_PATH",
      copy_entry_count:
        registeredCopyIds.size,
      referenced_copy_id_count:
        referencedCopyIds.size,
      message:
        "Coach-managed permissions, factual artefacts and note isolation passed."
    })
  );
}
