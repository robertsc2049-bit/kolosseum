// @law: Repo Governance
// @severity: high
// @scope: app
// DEV NOTE: BETA-16 app path, Copy Registry and Phase 1-6 integration guard.

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
    `CI_BETA_16_APP_PATH_PHASE1_6::FAIL::${message}`
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
    "src/api/beta16_app_path_service.ts",
  sessionHandlers:
    "src/api/sessions.handlers.ts",
  sessionRoutes:
    "src/api/sessions.routes.ts",
  blocksHandler:
    "src/api/blocks.handlers.ts",
  html:
    "public/v0-session-runner.html",
  browser:
    "public/v0-session-runner.js",
  copy:
    "copy/beta_16_app_path_phase1_6_copy.json",
  publicCopy:
    "public/beta_16_app_path_phase1_6_copy.json",
  test:
    "test/beta_16_app_path_phase1_6.test.mjs",
  runner:
    "ci/scripts/run_beta_16_app_path_phase1_6_tests.mjs",
  fixture:
    "test/fixtures/beta_16_app_path_phase1_6/clean_individual_user.json",
  manifest:
    "test/fixtures/beta_16_app_path_phase1_6/manifest.json",
  doc:
    "docs/runtime/BETA_16_APP_PATH_PHASE1_6.md",
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
  "beta16_app_path_phase1_6",
  "createBeta16AuthRecord",
  "createBeta16AcknowledgementRecord",
  "createBeta16Phase1DeclarationRecord",
  "assertBeta16CompileAdmission",
  "product_auth_state_only: true",
  "engine_visible: false",
  "execution_only_ui: true",
  "factual_counts_only: true",
  "extended_phase_ui: false",
  "aggregate_reporting: false"
]) {
  if (!source.service.includes(token)) {
    fail(`service_token_missing::${token}`);
  }
}

for (const forbidden of [
  "crypto.randomUUID",
  "Math.random",
  "Date.now",
  "fetch(",
  "process.env"
]) {
  if (source.service.includes(forbidden)) {
    fail(`service_forbidden_token::${forbidden}`);
  }
}

for (const route of [
  '"/beta-auth"',
  '"/beta-acknowledgement"',
  '"/beta-declaration"'
]) {
  if (!source.sessionRoutes.includes(route)) {
    fail(`session_route_missing::${route}`);
  }
}

for (const token of [
  "createBeta16Auth",
  "createBeta16Acknowledgement",
  "createBeta16Declaration"
]) {
  if (!source.sessionHandlers.includes(token)) {
    fail(`session_handler_missing::${token}`);
  }
}

for (const token of [
  "beta_path_requested",
  "assertBeta16CompileAdmission",
  "BETA16_APP_PATH_ADMISSION_FAILED",
  "payload.beta_path",
  "beta16AppPathContract"
]) {
  if (!source.blocksHandler.includes(token)) {
    fail(`compile_path_missing::${token}`);
  }
}

if (
  source.copy !== source.publicCopy
) {
  fail("copy_registry_public_mirror_mismatch");
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
        "beta16_app_path_phase1_6"
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
      /BETA16_COPY_[A-Z0-9_]+/gu
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

for (const forbidden of [
  "dashboard",
  "analytics",
  "readiness",
  "recommendation",
  "recommended",
  "performance",
  "safety score",
  "risk score",
  "optimal",
  "% complete",
  "phase 7",
  "phase 8"
]) {
  const combined =
    `${source.copy}\n${source.html}\n${source.browser}`
      .toLowerCase();

  if (combined.includes(forbidden)) {
    fail(
      `user_surface_forbidden_term::${forbidden}`
    );
  }
}

for (const removedInline of [
  "Kolosseum v0 Session Runner",
  "Minimal browser runner",
  "Compile + Create Session",
  "No completed exercises yet."
]) {
  if (
    source.html.includes(removedInline) ||
    source.browser.includes(removedInline)
  ) {
    fail(
      `legacy_inline_copy_present::${removedInline}`
    );
  }
}

for (const marker of [
  'data-copy-id="BETA16_COPY_PAGE_TITLE"',
  'data-copy-id="BETA16_COPY_AUTH_HEADING"',
  'data-copy-id="BETA16_COPY_ACKNOWLEDGEMENT_HEADING"',
  'data-copy-id="BETA16_COPY_DECLARATION_HEADING"',
  'data-copy-id="BETA16_COPY_COMPILE_HEADING"',
  'data-copy-id="BETA16_COPY_SESSION_CONTROLS_HEADING"',
  'data-copy-id="BETA16_COPY_SUMMARY_HEADING"',
  'data-copy-id="BETA16_COPY_HISTORY_HEADING"'
]) {
  if (!source.html.includes(marker)) {
    fail(`html_copy_marker_missing::${marker}`);
  }
}

for (const route of [
  "/sessions/beta-auth",
  "/sessions/beta-acknowledgement",
  "/sessions/beta-declaration",
  "/blocks/compile?create_session=true&beta_path=true",
  "/start",
  "/events",
  "/state"
]) {
  if (!source.browser.includes(route)) {
    fail(`browser_route_missing::${route}`);
  }
}

for (const eventType of [
  "COMPLETE_STEP",
  "SPLIT_SESSION",
  "RETURN_CONTINUE",
  "RETURN_SKIP"
]) {
  if (!source.browser.includes(eventType)) {
    fail(`browser_event_missing::${eventType}`);
  }
}

for (const requiredTest of [
  "clean beta user records auth acknowledgement and Phase 1 declaration",
  "clean Phase 1 input materialises a Phase 6 session",
  "Phase 6 execution completes through factual runtime events",
  "split and return continue preserve execution",
  "split and return skip expose factual partial counts",
  "all referenced browser copy IDs exist in Copy Registry",
  "v0 scope compatibility keeps the app service actively scanned"
]) {
  if (!source.test.includes(requiredTest)) {
    fail(`test_contract_missing::${requiredTest}`);
  }
}

for (const runnerToken of [
  "npm run build",
  "beta_16_app_path_phase1_6.test.mjs"
]) {
  if (!source.runner.includes(runnerToken)) {
    fail(`runner_token_missing::${runnerToken}`);
  }
}

for (const packageToken of [
  '"proof:beta-16"',
  "run_beta_16_app_path_phase1_6_tests.mjs",
  "beta_16_app_path_phase1_6_guard.mjs",
  "npm run proof:beta-16"
]) {
  if (!source.package.includes(packageToken)) {
    fail(`package_entrypoint_missing::${packageToken}`);
  }
}

if (
  !source.entrypoints.includes(
    '"proof:beta-16"'
  )
) {
  fail("declared_entrypoint_missing");
}

for (const docToken of [
  "existing controlled-beta application surfaces",
  "product/auth-record model",
  "Copy Registry",
  "factual partial classification",
  "adds no Phase 7 UI",
  "adds no dashboard"
]) {
  if (!source.doc.includes(docToken)) {
    fail(`documentation_token_missing::${docToken}`);
  }
}

const manifest =
  readJson(files.manifest);

const fixture =
  readJson(files.fixture);

if (
  !manifest ||
  manifest.slice_id !== "BETA-16" ||
  !Array.isArray(manifest.fixtures) ||
  manifest.fixtures.length !== 1
) {
  fail("fixture_manifest_invalid");
}
else {
  const entry = manifest.fixtures[0];

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
    "beta16_clean_individual_user"
) {
  fail("fixture_invalid");
}

if (!failed) {
  const runtimePath = path.join(
    root,
    "dist",
    "src",
    "api",
    "beta16_app_path_service.js"
  );

  if (!fs.existsSync(runtimePath)) {
    fail("compiled_service_missing");
  }
  else {
    const runtime = await import(
      pathToFileURL(runtimePath).href
    );

    const auth =
      runtime.createBeta16AuthRecord(
        fixture.auth_input
      );

    const acknowledgement =
      runtime
        .createBeta16AcknowledgementRecord(
          fixture.acknowledgement_input
        );

    const declaration =
      runtime
        .createBeta16Phase1DeclarationRecord(
          fixture.declaration_input
        );

    if (
      auth.status !== 201 ||
      acknowledgement.status !== 201 ||
      declaration.status !== 201
    ) {
      fail("compiled_clean_path_failed");
    }
    else {
      const admission =
        runtime.assertBeta16CompileAdmission(
          {
            auth_record:
              auth.body.auth_record,
            acknowledgement_record:
              acknowledgement.body
                .acknowledgement_record,
            declaration_record:
              declaration.body
                .declaration_record
          },
          fixture.declaration_input
            .phase1_input
        );

      if (
        admission.admitted !== true ||
        admission.phase_range !== "1-6"
      ) {
        fail("compiled_admission_failed");
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
      guard: "BETA-16",
      token:
        "CI_BETA_16_APP_PATH_PHASE1_6",
      copy_entry_count:
        registeredCopyIds.size,
      referenced_copy_id_count:
        referencedCopyIds.size,
      message:
        "App path Phase 1-6 and Copy Registry boundary passed."
    })
  );
}
