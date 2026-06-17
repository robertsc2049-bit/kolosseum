import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  LEGAL_DOCUMENT_REASON_CODES,
  assertLegalDocumentSurfaceDoesNotMutateEngine,
  createLegalDocumentSurface,
  listLegalDocumentSurfaces
} from "../src/v1LegalDocumentSurfaces.mjs";

import {
  handleV1LegalDocumentSurfacesApiRequest
} from "../src/api/v1LegalDocumentSurfacesApi.mjs";

const deterministicProbe = Object.freeze({
  canonical_input_hash: "a".repeat(64),
  compile_output_hash: "b".repeat(64),
  substitution_output_hash: "c".repeat(64),
  replay_record_hash: "d".repeat(64),
  proof_record_hash: "e".repeat(64),
  factual_history_hash: "f".repeat(64)
});

function legalRequest(overrides = {}) {
  return {
    requested_document_key: "controlled_launch_terms",
    requested_route: "/legal/terms",
    requesting_actor_id: "coach_001",
    requested_at: "2026-06-17T11:00:00.000Z",
    deterministic_probe: deterministicProbe,
    ...overrides
  };
}

const blockedClaimTerms = Object.freeze([
  "medical",
  "diagnosis",
  "clinical",
  "treatment",
  "rehab",
  "rehabilitation",
  "injury prevention",
  "prevent injury",
  "safe",
  "safety",
  "suitable",
  "suitability",
  "guarantee",
  "guaranteed",
  "results guaranteed",
  "certified",
  "approved",
  "cleared",
  "readiness",
  "fatigue",
  "risk score",
  "recommended",
  "recommendation",
  "optimal",
  "better",
  "return to play",
  "return-to-play",
  "fit for duty"
]);

function assertNoBlockedClaimText(value) {
  const text = JSON.stringify(value).toLowerCase();

  for (const blocked of blockedClaimTerms) {
    assert.equal(text.includes(blocked), false, `text must not include ${blocked}`);
  }
}

test("S-V1-L-01 legal index route renders linked controlled-launch documents", () => {
  const result = createLegalDocumentSurface(legalRequest({
    requested_document_key: "controlled_launch_legal_index",
    requested_route: "/legal"
  }));

  assert.equal(result.ok, true);
  assert.equal(result.status, "legal_document_surface_rendered");
  assert.equal(result.reason_code, LEGAL_DOCUMENT_REASON_CODES.RENDERED);
  assert.equal(result.document.document_key, "controlled_launch_legal_index");
  assert.deepEqual(result.document.linked_documents, [
    "controlled_launch_terms",
    "controlled_launch_privacy",
    "controlled_launch_dpa"
  ]);
  assert.equal(result.renderable, true);
  assert.equal(result.engine_decision, false);
  assert.equal(result.engine_visible, false);

  const isolation = assertLegalDocumentSurfaceDoesNotMutateEngine(result);
  assert.equal(isolation.ok, true);
});

test("S-V1-L-01 terms route renders without changing engine truth", () => {
  const result = createLegalDocumentSurface(legalRequest());

  assert.equal(result.ok, true);
  assert.equal(result.document.document_key, "controlled_launch_terms");
  assert.equal(result.document.route, "/legal/terms");
  assert.equal(result.document.sections.length > 0, true);
  assert.equal(result.engine_legality, "not_mutated");
  assert.equal(result.compile_output, "not_mutated");
  assert.equal(result.substitution_selection, "not_mutated");
  assert.equal(result.replay_record, "not_mutated");
  assert.equal(result.proof_record, "not_mutated");
  assert.equal(result.factual_history_record, "not_mutated");
  assert.equal(result.billing_state, "not_read_not_written_not_inferred");
  assert.equal(result.coach_athlete_relationship_truth, "not_read_not_written_not_inferred");

  assertNoBlockedClaimText(result.document);
});

test("S-V1-L-01 privacy route renders without billing or relationship truth dependency", () => {
  const result = createLegalDocumentSurface(legalRequest({
    requested_document_key: "controlled_launch_privacy",
    requested_route: "/legal/privacy"
  }));

  assert.equal(result.ok, true);
  assert.equal(result.document.document_key, "controlled_launch_privacy");
  assert.equal(result.document.document_class, "privacy");
  assert.equal(result.billing_state, "not_read_not_written_not_inferred");
  assert.equal(result.coach_athlete_relationship_truth, "not_read_not_written_not_inferred");
  assert.equal(result.relationship_truth_mutation, "not_performed");

  assertNoBlockedClaimText(result.document);
});

test("S-V1-L-01 DPA route renders without data-request workflow activation", () => {
  const result = createLegalDocumentSurface(legalRequest({
    requested_document_key: "controlled_launch_dpa",
    requested_route: "/legal/dpa"
  }));

  assert.equal(result.ok, true);
  assert.equal(result.document.document_key, "controlled_launch_dpa");
  assert.equal(result.document.document_class, "dpa");
  assert.equal(result.provider_call_performed, false);
  assert.equal(result.engine_decision, false);
  assert.equal(result.engine_visible, false);

  assertNoBlockedClaimText(result.document);
});

test("S-V1-L-01 API renders legal routes and rejects unknown routes", () => {
  const termsResponse = handleV1LegalDocumentSurfacesApiRequest({
    method: "GET",
    path: "/legal/terms",
    requesting_actor_id: "coach_001",
    deterministic_probe: deterministicProbe
  });

  assert.equal(termsResponse.statusCode, 200);

  const termsBody = JSON.parse(termsResponse.body);
  assert.equal(termsBody.ok, true);
  assert.equal(termsBody.document.document_key, "controlled_launch_terms");

  const missingResponse = handleV1LegalDocumentSurfacesApiRequest({
    method: "GET",
    path: "/legal/not-found",
    requesting_actor_id: "coach_001",
    deterministic_probe: deterministicProbe
  });

  assert.equal(missingResponse.statusCode, 404);

  const missingBody = JSON.parse(missingResponse.body);
  assert.equal(missingBody.ok, false);
  assert.equal(missingBody.engine_decision, false);
});

test("S-V1-L-01 route and document mismatch fails closed", () => {
  const result = createLegalDocumentSurface(legalRequest({
    requested_document_key: "controlled_launch_privacy",
    requested_route: "/legal/terms"
  }));

  assert.equal(result.ok, false);
  assert.equal(result.reason_code, LEGAL_DOCUMENT_REASON_CODES.ROUTE_DOCUMENT_MISMATCH);
  assert.equal(result.renderable, false);
  assert.equal(result.engine_decision, false);
  assert.equal(result.engine_visible, false);
});

test("S-V1-L-01 legal documents share the same deterministic probe hash without mutating engine surfaces", () => {
  const terms = createLegalDocumentSurface(legalRequest());
  const privacy = createLegalDocumentSurface(legalRequest({
    requested_document_key: "controlled_launch_privacy",
    requested_route: "/legal/privacy"
  }));
  const dpa = createLegalDocumentSurface(legalRequest({
    requested_document_key: "controlled_launch_dpa",
    requested_route: "/legal/dpa"
  }));

  assert.equal(terms.ok, true);
  assert.equal(privacy.ok, true);
  assert.equal(dpa.ok, true);
  assert.equal(terms.deterministic_probe_hash, privacy.deterministic_probe_hash);
  assert.equal(privacy.deterministic_probe_hash, dpa.deterministic_probe_hash);

  for (const result of [terms, privacy, dpa]) {
    const isolation = assertLegalDocumentSurfaceDoesNotMutateEngine(result);
    assert.equal(isolation.ok, true);
  }
});

test("S-V1-L-01 legal copy remains factual and claim-neutral", () => {
  const copy = JSON.parse(fs.readFileSync("copy/legal_document_surfaces_copy.json", "utf8"));
  const registry = listLegalDocumentSurfaces();

  assert.equal(registry.ok, true);
  assert.deepEqual(registry.document_keys, [
    "controlled_launch_legal_index",
    "controlled_launch_terms",
    "controlled_launch_privacy",
    "controlled_launch_dpa"
  ]);

  assertNoBlockedClaimText(copy);

  for (const documentKey of registry.document_keys) {
    const route = Object.entries(registry.routes).find(([, value]) => value === documentKey)?.[0];
    const rendered = createLegalDocumentSurface(legalRequest({
      requested_document_key: documentKey,
      requested_route: route
    }));

    assert.equal(rendered.ok, true);
    assertNoBlockedClaimText(rendered.document);
  }
});