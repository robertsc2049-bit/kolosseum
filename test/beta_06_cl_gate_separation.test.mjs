import assert from "node:assert/strict";
import test from "node:test";

import {
  BETA_06_CL_GATE_DOMAIN,
  BETA_06_CL_REFUSAL_CODES,
  BETA_06_CL_REFUSAL_COPY,
  BETA_06_CL_TECHNICAL_FAILURE_CODES,
  evaluateControlledLaunchLegalGate,
  runControlledLaunchGateSeparated
} from "../src/betaClGateSeparation.mjs";

function validDeclaration() {
  return {
    engine_version: "EB2-1.0.0",
    enum_bundle_version: "EB2-1.0.0",
    phase1_schema_version: "1.0.0",
    consent_granted: true,
    age_declaration: "adult_18_or_over",
    jurisdiction_acknowledged: true,
    actor_type: "individual_user",
    execution_scope: "individual",
    activity_id: "general_strength",
    location_type: "commercial_gym",
    equipment_profile_id: "equipment_profile_beta_general_strength",
    nd_mode: false,
    instruction_density: "standard",
    exposure_prompt_density: "minimal",
    bias_mode: "neutral"
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function legalRefusalCases() {
  return [
    {
      name: "consent false",
      mutate: (value) => { value.consent_granted = false; },
      refusalCode: BETA_06_CL_REFUSAL_CODES.CONSENT_REQUIRED,
      refusedField: "consent_granted"
    },
    {
      name: "consent missing",
      mutate: (value) => { delete value.consent_granted; },
      refusalCode: BETA_06_CL_REFUSAL_CODES.CONSENT_REQUIRED,
      refusedField: "consent_granted"
    },
    {
      name: "jurisdiction false",
      mutate: (value) => { value.jurisdiction_acknowledged = false; },
      refusalCode: BETA_06_CL_REFUSAL_CODES.JURISDICTION_REQUIRED,
      refusedField: "jurisdiction_acknowledged"
    },
    {
      name: "jurisdiction missing",
      mutate: (value) => { delete value.jurisdiction_acknowledged; },
      refusalCode: BETA_06_CL_REFUSAL_CODES.JURISDICTION_REQUIRED,
      refusedField: "jurisdiction_acknowledged"
    },
    {
      name: "invalid age declaration",
      mutate: (value) => { value.age_declaration = "minor_under_18"; },
      refusalCode: BETA_06_CL_REFUSAL_CODES.INVALID_AGE_DECLARATION,
      refusedField: "age_declaration"
    },
    {
      name: "illegal actor",
      mutate: (value) => { value.actor_type = "organisation_admin"; },
      refusalCode: BETA_06_CL_REFUSAL_CODES.ILLEGAL_ACTOR_SCOPE,
      refusedField: "actor_scope"
    },
    {
      name: "illegal scope",
      mutate: (value) => { value.execution_scope = "org_managed"; },
      refusalCode: BETA_06_CL_REFUSAL_CODES.ILLEGAL_ACTOR_SCOPE,
      refusedField: "actor_scope"
    },
    {
      name: "illegal actor scope pair",
      mutate: (value) => {
        value.actor_type = "individual_user";
        value.execution_scope = "coach_managed";
      },
      refusalCode: BETA_06_CL_REFUSAL_CODES.ILLEGAL_ACTOR_SCOPE,
      refusedField: "actor_scope"
    }
  ];
}

function assertNoCiFailureTokenSurface(result) {
  assert.equal(Object.hasOwn(result, "failure_token"), false);
  assert.equal(Object.hasOwn(result, "ci_failure_token"), false);
  assert.equal(Object.hasOwn(result, "technical_failure_token"), false);

  const rendered = JSON.stringify(result);
  assert.equal(rendered.includes("CI_FAIL::"), false);
  assert.equal(/"CI_[A-Z0-9_]+"/.test(rendered), false);
}

test("BETA-06 legal CL refusal happens before engine replay evidence and artefact work", () => {
  for (const item of legalRefusalCases()) {
    const declaration = validDeclaration();
    item.mutate(declaration);

    const calls = {
      engine: 0,
      replay: 0,
      evidence: 0
    };

    const result = runControlledLaunchGateSeparated({
      declaration,
      runEngine: () => {
        calls.engine += 1;
        return { ok: true, engine_artefacts: [{ id: "engine_artefact_should_not_exist" }] };
      },
      runReplay: () => {
        calls.replay += 1;
        return { ok: true, replay_records: [{ id: "replay_should_not_exist" }] };
      },
      createEvidence: () => {
        calls.evidence += 1;
        return { ok: true, evidence_envelopes: [{ id: "evidence_should_not_exist" }] };
      }
    });

    assert.equal(result.ok, false, item.name);
    assert.equal(result.domain, BETA_06_CL_GATE_DOMAIN.LEGAL_REFUSAL, item.name);
    assert.equal(result.refusal_code, item.refusalCode, item.name);
    assert.equal(result.refused_field, item.refusedField, item.name);
    assert.deepEqual(calls, { engine: 0, replay: 0, evidence: 0 }, item.name);
    assert.deepEqual(result.engine_artefacts, [], item.name);
    assert.deepEqual(result.replay_records, [], item.name);
    assert.deepEqual(result.evidence_envelopes, [], item.name);
    assert.deepEqual(result.proof_artefacts, [], item.name);
    assertNoCiFailureTokenSurface(result);
  }
});

test("BETA-06 legal gate accepts only explicit lawful beta actor and scope declarations", () => {
  const individual = evaluateControlledLaunchLegalGate(validDeclaration());
  assert.equal(individual.ok, true);

  const coachManaged = validDeclaration();
  coachManaged.actor_type = "coach";
  coachManaged.execution_scope = "coach_managed";
  coachManaged.governing_authority_id = "coach_authority_beta_001";

  const coach = evaluateControlledLaunchLegalGate(coachManaged);
  assert.equal(coach.ok, true);

  const badPair = clone(coachManaged);
  badPair.actor_type = "individual_user";

  const refused = evaluateControlledLaunchLegalGate(badPair);
  assert.equal(refused.ok, false);
  assert.equal(refused.domain, BETA_06_CL_GATE_DOMAIN.LEGAL_REFUSAL);
  assert.equal(refused.refusal_code, BETA_06_CL_REFUSAL_CODES.ILLEGAL_ACTOR_SCOPE);
});

test("BETA-06 CL refusal and technical failure remain separate domains", () => {
  const legalFailure = runControlledLaunchGateSeparated({
    declaration: {
      ...validDeclaration(),
      consent_granted: false
    },
    runEngine: () => ({ ok: false, technical_failure_token: "phase2_canonicalisation_failed" })
  });

  assert.equal(legalFailure.ok, false);
  assert.equal(legalFailure.domain, BETA_06_CL_GATE_DOMAIN.LEGAL_REFUSAL);
  assert.equal(legalFailure.refusal_code, BETA_06_CL_REFUSAL_CODES.CONSENT_REQUIRED);
  assert.equal(Object.hasOwn(legalFailure, "technical_failure_token"), false);
  assertNoCiFailureTokenSurface(legalFailure);

  const technicalFailure = runControlledLaunchGateSeparated({
    declaration: validDeclaration(),
    runEngine: () => ({
      ok: false,
      technical_failure_token: "phase2_canonicalisation_failed",
      engine_artefacts: []
    }),
    runReplay: () => {
      throw new Error("replay must not run after engine failure");
    },
    createEvidence: () => {
      throw new Error("evidence must not run after engine failure");
    }
  });

  assert.equal(technicalFailure.ok, false);
  assert.equal(technicalFailure.domain, BETA_06_CL_GATE_DOMAIN.TECHNICAL_FAILURE);
  assert.equal(technicalFailure.technical_failure_code, BETA_06_CL_TECHNICAL_FAILURE_CODES.ENGINE_FAILED);
  assert.equal(technicalFailure.technical_failure_token, "phase2_canonicalisation_failed");
  assert.equal(Object.hasOwn(technicalFailure, "refusal_code"), false);
});

test("BETA-06 lawful CL path may run engine replay and evidence in that order", () => {
  const order = [];

  const result = runControlledLaunchGateSeparated({
    declaration: validDeclaration(),
    runEngine: () => {
      order.push("engine");
      return { ok: true, engine_artefacts: [{ artefact_id: "engine_001" }] };
    },
    runReplay: () => {
      order.push("replay");
      return { ok: true, replay_records: [{ replay_id: "replay_001" }] };
    },
    createEvidence: () => {
      order.push("evidence");
      return { ok: true, evidence_envelopes: [{ envelope_id: "evidence_001" }] };
    }
  });

  assert.equal(result.ok, true);
  assert.equal(result.domain, BETA_06_CL_GATE_DOMAIN.TECHNICAL_SUCCESS);
  assert.deepEqual(order, ["engine", "replay", "evidence"]);
  assert.deepEqual(result.engine_artefacts, [{ artefact_id: "engine_001" }]);
  assert.deepEqual(result.replay_records, [{ replay_id: "replay_001" }]);
  assert.deepEqual(result.evidence_envelopes, [{ envelope_id: "evidence_001" }]);
});

test("BETA-06 CL refusal copy identifiers remain neutral and non-claiming", () => {
  const rendered = Object.entries(BETA_06_CL_REFUSAL_COPY)
    .flatMap(([copyId, copy]) => [copyId, copy])
    .join(" ");

  assert.match(rendered, /Controlled launch cannot continue/);
  assert.match(rendered, /Technical execution did not complete/);

  const forbidden = [
    /CI_FAIL::/,
    /CI_[A-Z0-9_]+/,
    /safe/i,
    /suitable/i,
    /ready/i,
    /approved/i,
    /certified/i,
    /recommended/i,
    /effective/i,
    /injury prevention/i
  ];

  for (const pattern of forbidden) {
    assert.equal(pattern.test(rendered), false, `forbidden wording matched ${pattern}`);
  }
});
