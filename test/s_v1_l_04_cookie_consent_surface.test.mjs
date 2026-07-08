import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  COOKIE_CONSENT_BOUNDARY,
  assertCookieConsentDoesNotAlterEngine,
  createCookieConsentState,
  hashCookieConsentValue,
  renderCookieConsentSurface,
  serializeCookieConsentSurface
} from "../src/v1CookieConsentSurface.mjs";
import {
  handleCookieConsentSurfaceApiRequest
} from "../src/api/v1CookieConsentSurfaceApi.mjs";

const deterministicProbe = Object.freeze({
  canonical_input_hash: "a".repeat(64),
  compile_output_hash: "b".repeat(64),
  declaration_record_hash: "c".repeat(64)
});

function validConsent(overrides = {}) {
  return {
    request_id: "cookie_consent_req_001",
    actor_user_id: "user_001",
    actor_type: "athlete",
    requested_at: "2026-06-17T14:00:00.000Z",
    consent_state: "necessary_only",
    selected_categories: ["strictly_necessary"],
    deterministic_probe: deterministicProbe,
    ...overrides
  };
}

function assertNoEngineChange(result) {
  assert.equal(result.engine_visible, false);
  assert.equal(result.engine_truth_changed, false);
  assert.equal(result.compile_output_changed, false);
  assert.equal(result.training_flow_changed, false);
  assert.equal(result.declaration_truth_changed, false);
  assert.equal(result.phase1_declaration_changed, false);
  assert.equal(result.external_script_activation, false);
  assert.equal(result.provider_call_performed, false);
  assert.equal(result.legal_presentation_state_only, true);

  const isolation = assertCookieConsentDoesNotAlterEngine(result);
  assert.equal(isolation.ok, true);
}

test("S-V1-L-04 consent render test returns controlled-launch cookie view model", () => {
  const result = renderCookieConsentSurface({
    request_id: "cookie_view_req_001",
    actor_user_id: "anonymous_viewer",
    actor_type: "anonymous",
    requested_at: "2026-06-17T14:00:00.000Z",
    route: "/legal/cookies",
    deterministic_probe: deterministicProbe
  });

  assert.equal(result.ok, true);
  assert.equal(result.surface_id, "cookie_consent_surface");
  assert.equal(result.renderable, true);
  assert.equal(result.document_class, "cookie_consent");
  assert.equal(result.default_consent_state, "necessary_only");
  assert.equal(result.categories.length, 2);
  assert.equal(result.categories.find((row) => row.category_id === "strictly_necessary").selected, true);
  assert.equal(result.categories.find((row) => row.category_id === "preference_storage").selected, false);
  assert.equal(result.deterministic_probe_hash, hashCookieConsentValue(deterministicProbe));

  assertNoEngineChange(result);
});

test("S-V1-L-04 consent state test records necessary-only state without changing engine output", () => {
  const result = createCookieConsentState(validConsent());

  assert.equal(result.ok, true);
  assert.equal(result.consent_state_recorded, true);
  assert.equal(result.consent_state, "necessary_only");
  assert.deepEqual(result.selected_categories, ["strictly_necessary"]);
  assert.match(result.consent_record_id, /^cookie_consent_[a-f0-9]{16}$/);
  assert.match(result.consent_hash, /^[a-f0-9]{64}$/);
  assert.equal(result.copy_id, "cookie_consent.saved");
  assert.equal(result.copy_notice_id, "cookie_consent.no_engine_change");

  assertNoEngineChange(result);
});

test("S-V1-L-04 consent state test records preference storage only when explicitly selected", () => {
  const result = createCookieConsentState(validConsent({
    consent_state: "necessary_and_preferences",
    selected_categories: ["preference_storage", "strictly_necessary"]
  }));

  assert.equal(result.ok, true);
  assert.equal(result.consent_state, "necessary_and_preferences");
  assert.deepEqual(result.selected_categories, ["preference_storage", "strictly_necessary"]);
  assert.equal(result.category_records.find((row) => row.category_id === "preference_storage").selected, true);

  assertNoEngineChange(result);
});

test("S-V1-L-04 consent state rejects invalid category and mismatched preference state", () => {
  const unknown = createCookieConsentState(validConsent({
    selected_categories: ["strictly_necessary", "unknown_cookie_category"]
  }));

  assert.equal(unknown.ok, false);
  assert.equal(unknown.code, "cookie_consent_category_not_allowed");
  assert.equal(unknown.consent_state_recorded, false);
  assertNoEngineChange(unknown);

  const mismatch = createCookieConsentState(validConsent({
    consent_state: "necessary_only",
    selected_categories: ["strictly_necessary", "preference_storage"]
  }));

  assert.equal(mismatch.ok, false);
  assert.equal(mismatch.code, "cookie_consent_preference_category_not_allowed_for_state");
  assert.equal(mismatch.consent_state_recorded, false);
  assertNoEngineChange(mismatch);
});

test("S-V1-L-04 no-coupling test blocks engine training and declaration mutation fields", () => {
  const blocked = createCookieConsentState(validConsent({
    deterministic_probe: {
      canonical_input_hash: "a".repeat(64),
      engine_truth_changed: true
    }
  }));

  assert.equal(blocked.ok, false);
  assert.equal(blocked.code, "cookie_consent_blocked_payload_key");
  assert.equal(blocked.details.key, "engine_truth_changed");
  assertNoEngineChange(blocked);

  const blockedTopLevel = createCookieConsentState({
    ...validConsent(),
    training_flow_changed: true
  });

  assert.equal(blockedTopLevel.ok, false);
  assert.equal(blockedTopLevel.code, "cookie_consent_blocked_payload_key");
  assert.equal(blockedTopLevel.details.key, "training_flow_changed");
  assertNoEngineChange(blockedTopLevel);
});

test("S-V1-L-04 API renders and records cookie consent state", () => {
  const renderResponse = handleCookieConsentSurfaceApiRequest({
    method: "GET",
    path: "/legal/cookies",
    actor_type: "anonymous",
    deterministic_probe: deterministicProbe
  });

  assert.equal(renderResponse.status, 200);
  assert.equal(renderResponse.body.api_surface_id, "cookie_consent_surface_api");
  assert.equal(renderResponse.body.ok, true);
  assert.equal(renderResponse.body.renderable, true);
  assertNoEngineChange(renderResponse.body);

  const stateResponse = handleCookieConsentSurfaceApiRequest({
    method: "POST",
    body: validConsent()
  });

  assert.equal(stateResponse.status, 200);
  assert.equal(stateResponse.body.api_surface_id, "cookie_consent_surface_api");
  assert.equal(stateResponse.body.ok, true);
  assert.equal(stateResponse.body.consent_state_recorded, true);
  assertNoEngineChange(stateResponse.body);

  const blocked = handleCookieConsentSurfaceApiRequest({
    method: "DELETE"
  });

  assert.equal(blocked.status, 405);
  assert.equal(blocked.body.ok, false);
  assert.equal(blocked.body.consent_state_recorded, false);
  assertNoEngineChange(blocked.body);
});

test("S-V1-L-04 serialisation is stable and factual copy stays neutral", () => {
  const result = createCookieConsentState(validConsent());
  const serialised = serializeCookieConsentSurface(result);
  const parsed = JSON.parse(serialised);

  assert.equal(parsed.consent_hash, result.consent_hash);

  const copy = JSON.parse(readFileSync("copy/cookie_consent_surface_copy.json", "utf8"));
  const copyText = JSON.stringify(copy).toLowerCase();

  assert.equal(copy.surface_id, "cookie_consent_surface");
  assert.equal(copy.entries["cookie_consent.title"], "Cookie choices");
  assert.equal(copy.entries["cookie_consent.no_engine_change"], "Cookie choices do not change training output.");

  for (const blocked of [
    "recommend",
    "recommended",
    "optimise",
    "optimize",
    "ready",
    "safe",
    "safety",
    "suitable",
    "approved",
    "cleared",
    "guarantee",
    "risk score",
    "fit for duty"
  ]) {
    assert.equal(copyText.includes(blocked), false, "copy must not include " + blocked);
  }
});

test("S-V1-L-04 boundary object is explicit and closed to engine training and declaration truth", () => {
  assert.equal(COOKIE_CONSENT_BOUNDARY.legal_presentation_state_only, true);
  assert.equal(COOKIE_CONSENT_BOUNDARY.consent_state_recorded, true);
  assert.equal(COOKIE_CONSENT_BOUNDARY.renderable_surface, true);
  assert.equal(COOKIE_CONSENT_BOUNDARY.engine_visible, false);
  assert.equal(COOKIE_CONSENT_BOUNDARY.engine_truth_changed, false);
  assert.equal(COOKIE_CONSENT_BOUNDARY.compile_output_changed, false);
  assert.equal(COOKIE_CONSENT_BOUNDARY.training_flow_changed, false);
  assert.equal(COOKIE_CONSENT_BOUNDARY.declaration_truth_changed, false);
  assert.equal(COOKIE_CONSENT_BOUNDARY.phase1_declaration_changed, false);
  assert.equal(COOKIE_CONSENT_BOUNDARY.external_script_activation, false);
  assert.equal(COOKIE_CONSENT_BOUNDARY.provider_call_performed, false);
});