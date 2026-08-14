process.env.DATABASE_URL ??= "postgresql://direct-proof:direct-proof@127.0.0.1:1/direct-proof";

import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  PRODUCT_ROUTE_MAP,
  actorCanAccessRoute,
  parseProductRoute,
  routeForView,
  serializeProductRoute
} from "../public/app/route_bootstrap.js";

const service = await import(
  "../dist/src/api/athlete_onboarding_service.js"
);

const ui = fs.readFileSync(
  new URL("../public/app/athlete_onboarding_ui.js", import.meta.url),
  "utf8"
);
const routes = fs.readFileSync(
  new URL("../src/api/athlete_onboarding.routes.ts", import.meta.url),
  "utf8"
);
const server = fs.readFileSync(
  new URL("../src/server.ts", import.meta.url),
  "utf8"
);
const css = fs.readFileSync(
  new URL("../public/app/styles.css", import.meta.url),
  "utf8"
);
const functionManifest = JSON.parse(
  fs.readFileSync(
    new URL("../product/ui/function_manifest.json", import.meta.url),
    "utf8"
  )
);

const closure = JSON.parse(
  fs.readFileSync(
    new URL("../product/ui/full_ui_03c_athlete_onboarding_closure.json", import.meta.url),
    "utf8"
  )
);

test("FULL-UI-03C exposes a direct athlete onboarding route", () => {
  const route = parseProductRoute("#/athlete/onboarding");
  assert.equal(route?.route_id, "athlete_onboarding");
  assert.equal(route?.view, "onboarding");
  assert.equal(actorCanAccessRoute("athlete", route), true);
  assert.equal(actorCanAccessRoute("coach", route), false);
  assert.equal(serializeProductRoute("athlete_onboarding"), "#/athlete/onboarding");
  assert.equal(routeForView("athlete", "onboarding"), "#/athlete/onboarding");
  assert.equal(
    PRODUCT_ROUTE_MAP.filter((entry) => entry.route_id === "athlete_onboarding").length,
    1
  );
});

test("FULL-UI-03C validates every declaration field directly", () => {
  assert.equal(service.validateAthleteActivityId("powerlifting"), "powerlifting");
  assert.equal(service.validateAthleteExecutionScope("coach_managed"), "coach_managed");
  assert.equal(service.validateAthleteJurisdiction("scotland"), "scotland");
  assert.equal(service.validateAthleteInstructionDensity("minimal"), "minimal");
  assert.deepEqual(
    service.validateAthleteAccessibilityPreferences({
      reduced_motion: true,
      high_contrast: false,
      larger_text: true,
      screen_reader_optimised: false
    }),
    {
      reduced_motion: true,
      high_contrast: false,
      larger_text: true,
      screen_reader_optimised: false
    }
  );

  for (const [functionName, value, field] of [
    ["validateAthleteActivityId", "boxing", "activity_id"],
    ["validateAthleteExecutionScope", "inferred", "execution_scope"],
    ["validateAthleteJurisdiction", "auto_detect", "jurisdiction_code"],
    ["validateAthleteInstructionDensity", "maximum", "instruction_density"]
  ]) {
    assert.throws(
      () => service[functionName](value),
      (error) => {
        assert.equal(error.code, "athlete_onboarding_validation_failed");
        assert.ok(error.field_errors[field]);
        return true;
      }
    );
  }
});

test("FULL-UI-03C validates progression review and inference boundaries", () => {
  const accessibility = {
    reduced_motion: false,
    high_contrast: false,
    larger_text: false,
    screen_reader_optimised: true
  };
  const complete = {
    activity_id: "general_strength",
    execution_scope: "individual",
    product_acknowledged: true,
    jurisdiction_code: "england_wales",
    jurisdiction_acknowledged: true,
    accessibility_preferences: accessibility,
    instruction_density: "detailed"
  };

  assert.deepEqual(
    service.validateAthleteOnboardingDraftInput({
      current_stage: "review",
      fields: complete
    }).fields,
    complete
  );
  assert.equal(
    service.validateAthleteOnboardingConfirmation({ review_confirmed: true }),
    true
  );
  assert.deepEqual(service.validateCompleteAthleteDeclaration(complete), complete);

  assert.throws(
    () => service.validateAthleteOnboardingDraftInput({
      current_stage: "execution_scope",
      fields: {}
    }),
    (error) => Boolean(error.field_errors.activity_id)
  );
  assert.throws(
    () => service.validateAthleteOnboardingDraftInput({
      current_stage: "activity",
      fields: { readiness: "ready" }
    }),
    (error) => error.code === "athlete_onboarding_inference_field_prohibited"
  );
  assert.throws(
    () => service.validateAthleteOnboardingConfirmation({ review_confirmed: false }),
    (error) => Boolean(error.field_errors.review_confirmed)
  );
});

test("FULL-UI-03C UI distinguishes all required product states", () => {
  for (const token of [
    "Incomplete onboarding",
    "Validation failure",
    "Saved draft state",
    "Completed onboarding",
    "Current declaration",
    "Superseded declaration",
    "Unavailable service state",
    "Only accessibility and instruction-density preferences can be changed after confirmation",
    "does not infer ability, safety, readiness, suitability"
  ]) {
    assert.match(ui, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
  }

  for (const endpoint of [
    "/account/onboarding/",
    "/account/onboarding/draft",
    "/account/onboarding/confirm",
    "/account/onboarding/preferences"
  ]) {
    assert.match(ui, new RegExp(endpoint.replaceAll("/", "\\/"), "u"));
  }

  assert.doesNotMatch(ui, /localStorage\.setItem\([^)]*onboarding/iu);
});

test("FULL-UI-03C declared accessibility preferences are actually applied to the page", () => {
  // Same bug class as PR #865 (session-level coaching notes): a declared,
  // validated, stored preference with no downstream effect. This one is
  // applied via data attributes on <html>, not another server field, so the
  // proof lives entirely in the UI source + stylesheet, not an API response.
  assert.match(ui, /function applyAccessibilityPreferences/u);
  assert.match(ui, /root\.dataset\.a11yReducedMotion/u);
  assert.match(ui, /root\.dataset\.a11yHighContrast/u);
  assert.match(ui, /root\.dataset\.a11yLargerText/u);
  assert.match(ui, /root\.dataset\.a11yScreenReaderOptimised/u);

  // Applied on every athlete route resolution (covers page load and normal
  // navigation), not only inside the onboarding view itself.
  const gateFunction = ui.slice(
    ui.indexOf("export async function resolveAthleteOnboardingGate"),
    ui.indexOf("export function installAthleteOnboardingUi")
  );
  assert.match(gateFunction, /applyAccessibilityPreferences\(/u);

  // Applied immediately after both write paths that can change the
  // declared preferences - first confirmation and the post-confirmation
  // editor - so the effect is visible without a reload.
  const confirmFunction = ui.slice(ui.indexOf("async function confirm()"), ui.indexOf("function preferenceEditor"));
  assert.match(confirmFunction, /applyAccessibilityPreferences\(/u);
  const saveFunction = ui.slice(ui.indexOf("async function savePreferences()"), ui.indexOf("function unavailable"));
  assert.match(saveFunction, /applyAccessibilityPreferences\(/u);

  // Each declared preference has a real, non-empty CSS effect keyed off the
  // exact data attribute the UI sets - not just a declared-but-empty rule.
  for (const [attribute, mustContain] of [
    ["data-a11y-reduced-motion", "animation-duration"],
    ["data-a11y-high-contrast", "--stone"],
    ["data-a11y-larger-text", "font-size"],
    ["data-a11y-screen-reader-optimised", "--stone-dim"]
  ]) {
    const selector = `html[${attribute}="true"]`;
    const start = css.indexOf(selector);
    assert.ok(start >= 0, `Expected a CSS rule for ${selector}`);
    const block = css.slice(start, css.indexOf("}", start) + 1);
    assert.match(block, new RegExp(mustContain.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
  }
});

test("FULL-UI-03C declared instruction-density preference is actually applied to the page", () => {
  // instruction_density is a required onboarding field validated and stored
  // right alongside accessibility_preferences, editable through the same
  // /account/onboarding/preferences route, but applyAccessibilityPreferences
  // only read fields.accessibility_preferences - the declared density choice
  // had no downstream reader anywhere. Same phantom-field bug class as the
  // accessibility preferences fix above, and PR #865 before it.
  assert.match(ui, /function applyAccessibilityPreferences/u);
  assert.match(ui, /root\.dataset\.instructionDensity/u);
  assert.match(ui, /\["minimal",\s*"standard",\s*"detailed"\]/u);

  // Applied on every athlete route resolution, and immediately after both
  // write paths that can change the declared preference - same three call
  // sites already proven for the accessibility preferences above.
  const gateFunction = ui.slice(
    ui.indexOf("export async function resolveAthleteOnboardingGate"),
    ui.indexOf("export function installAthleteOnboardingUi")
  );
  assert.match(gateFunction, /applyAccessibilityPreferences\(/u);
  const confirmFunction = ui.slice(ui.indexOf("async function confirm()"), ui.indexOf("function preferenceEditor"));
  assert.match(confirmFunction, /applyAccessibilityPreferences\(/u);
  const saveFunction = ui.slice(ui.indexOf("async function savePreferences()"), ui.indexOf("function unavailable"));
  assert.match(saveFunction, /applyAccessibilityPreferences\(/u);

  // An invalid or missing stored value falls back to "standard" rather than
  // leaving the attribute unset or crashing the page.
  assert.match(ui, /INSTRUCTION_DENSITIES\.includes\(fields\?\.instruction_density\)\s*\n?\s*\?\s*fields\.instruction_density\s*\n?\s*:\s*"standard"/u);
});

test("FULL-UI-03C mounts authenticated CSRF-protected HTTP routes", () => {
  for (const route of ['"/"', '"/draft"', '"/confirm"', '"/preferences"']) {
    assert.match(routes, new RegExp(route.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
  }
  assert.match(routes, /resolveProductSession/u);
  assert.match(routes, /assertProductCsrf/u);
  assert.match(routes, /athlete_onboarding_athlete_required/u);
  assert.match(server, /app\.use\("\/account\/onboarding", athleteOnboardingRouter\);/u);
});

test("FULL-UI-03C manifest and closure contain no partial or missing onboarding function", () => {
  const areas = Array.isArray(functionManifest.areas)
    ? functionManifest.areas
    : Object.values(functionManifest).find((value) =>
        Array.isArray(value) && value.some((entry) => entry?.area_id === "athlete_onboarding")
      );
  const onboarding = areas?.find((entry) => entry?.area_id === "athlete_onboarding");
  assert.ok(onboarding, "athlete_onboarding area is required");
  assert.equal(onboarding.state, "implemented");
  assert.equal(onboarding.functions.length, 9);
  assert.equal(onboarding.functions.every((entry) => entry.state === "implemented"), true);
  assert.equal(JSON.stringify(onboarding).includes('"partial"'), false);
  assert.equal(JSON.stringify(onboarding).includes('"missing"'), false);

  assert.equal(closure.area_id, "athlete_onboarding");
  assert.equal(closure.state, "implemented");
  assert.equal(closure.route.state, "implemented");
  assert.equal(closure.functions.length, 9);
  assert.equal(Object.values(closure.coverage).every((value) => value === "covered"), true);
});
