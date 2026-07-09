const ALLOWED_AGE_DECLARATIONS = Object.freeze(["adult_18_or_over"]);
const ALLOWED_ACTOR_TYPES = Object.freeze(["individual_user", "coach"]);
const ALLOWED_EXECUTION_SCOPES = Object.freeze(["individual", "coach_managed"]);
const ALLOWED_ACTOR_SCOPE_PAIRS = Object.freeze([
  "individual_user::individual",
  "coach::coach_managed"
]);

export const BETA_06_CL_GATE_DOMAIN = Object.freeze({
  LEGAL_REFUSAL: "controlled_launch_legal_refusal",
  TECHNICAL_FAILURE: "controlled_launch_technical_failure",
  TECHNICAL_SUCCESS: "controlled_launch_technical_success"
});

export const BETA_06_CL_REFUSAL_CODES = Object.freeze({
  DECLARATION_NOT_OBJECT: "cl_refusal_declaration_not_object",
  CONSENT_REQUIRED: "cl_refusal_consent_required",
  JURISDICTION_REQUIRED: "cl_refusal_jurisdiction_required",
  INVALID_AGE_DECLARATION: "cl_refusal_invalid_age_declaration",
  ILLEGAL_ACTOR_SCOPE: "cl_refusal_illegal_actor_scope"
});

export const BETA_06_CL_TECHNICAL_FAILURE_CODES = Object.freeze({
  ENGINE_FAILED: "technical_engine_failed",
  REPLAY_FAILED: "technical_replay_failed",
  EVIDENCE_FAILED: "technical_evidence_failed"
});

export const BETA_06_CL_REFUSAL_COPY = Object.freeze({
  CL_REFUSAL_CONSENT_REQUIRED: "Controlled launch cannot continue until consent is recorded.",
  CL_REFUSAL_JURISDICTION_REQUIRED: "Controlled launch cannot continue until jurisdiction acknowledgement is recorded.",
  CL_REFUSAL_AGE_DECLARATION_REQUIRED: "Controlled launch cannot continue until a supported age declaration is recorded.",
  CL_REFUSAL_ACTOR_SCOPE_NOT_ALLOWED: "Controlled launch cannot continue for the declared actor and scope.",
  CL_TECHNICAL_FAILURE_RECORDED: "Technical execution did not complete."
});

const REFUSAL_COPY_IDS = Object.freeze({
  [BETA_06_CL_REFUSAL_CODES.DECLARATION_NOT_OBJECT]: "CL_REFUSAL_CONSENT_REQUIRED",
  [BETA_06_CL_REFUSAL_CODES.CONSENT_REQUIRED]: "CL_REFUSAL_CONSENT_REQUIRED",
  [BETA_06_CL_REFUSAL_CODES.JURISDICTION_REQUIRED]: "CL_REFUSAL_JURISDICTION_REQUIRED",
  [BETA_06_CL_REFUSAL_CODES.INVALID_AGE_DECLARATION]: "CL_REFUSAL_AGE_DECLARATION_REQUIRED",
  [BETA_06_CL_REFUSAL_CODES.ILLEGAL_ACTOR_SCOPE]: "CL_REFUSAL_ACTOR_SCOPE_NOT_ALLOWED"
});

/**
 * DEV NOTE:
 * Purpose: separates controlled-launch legal permission refusal from technical engine execution.
 * Boundary: legal refusal returns a product/legal refusal result only; it must not create CI tokens,
 * engine artefacts, replay records, evidence envelopes, or proof artefacts.
 * Determinism: all decisions come from explicit declaration fields and fixed beta allow-lists.
 * Failure: refusal happens before any supplied technical callback is called.
 */
export function evaluateControlledLaunchLegalGate(declaration) {
  if (!isPlainObject(declaration)) {
    return legalRefusal(BETA_06_CL_REFUSAL_CODES.DECLARATION_NOT_OBJECT, "phase1_declaration");
  }

  if (declaration.consent_granted !== true) {
    return legalRefusal(BETA_06_CL_REFUSAL_CODES.CONSENT_REQUIRED, "consent_granted");
  }

  if (declaration.jurisdiction_acknowledged !== true) {
    return legalRefusal(BETA_06_CL_REFUSAL_CODES.JURISDICTION_REQUIRED, "jurisdiction_acknowledged");
  }

  if (!ALLOWED_AGE_DECLARATIONS.includes(declaration.age_declaration)) {
    return legalRefusal(BETA_06_CL_REFUSAL_CODES.INVALID_AGE_DECLARATION, "age_declaration");
  }

  if (!isAllowedActorScope(declaration.actor_type, declaration.execution_scope)) {
    return legalRefusal(BETA_06_CL_REFUSAL_CODES.ILLEGAL_ACTOR_SCOPE, "actor_scope");
  }

  return Object.freeze({
    ok: true,
    domain: "controlled_launch_legal_permission",
    copy_ids: []
  });
}

/**
 * DEV NOTE:
 * Purpose: runs controlled-launch legal permission before technical work and preserves failure-domain separation.
 * Boundary: callbacks represent existing engine, replay, and evidence surfaces; this wrapper only orders them.
 * Determinism: legal refusal path is callback-free and returns the same closed refusal object for the same input.
 * Failure: legal refusal is not a CI/runtime failure token and technical failure is not a legal refusal.
 */
export function runControlledLaunchGateSeparated(input = {}) {
  const legal = evaluateControlledLaunchLegalGate(input.declaration);
  if (!legal.ok) {
    return legal;
  }

  const engineResult = callStep(input.runEngine);
  if (!engineResult.ok) {
    return technicalFailure(BETA_06_CL_TECHNICAL_FAILURE_CODES.ENGINE_FAILED, engineResult);
  }

  const replayResult = callStep(input.runReplay);
  if (!replayResult.ok) {
    return technicalFailure(BETA_06_CL_TECHNICAL_FAILURE_CODES.REPLAY_FAILED, replayResult);
  }

  const evidenceResult = callStep(input.createEvidence);
  if (!evidenceResult.ok) {
    return technicalFailure(BETA_06_CL_TECHNICAL_FAILURE_CODES.EVIDENCE_FAILED, evidenceResult);
  }

  return deepFreeze({
    ok: true,
    domain: BETA_06_CL_GATE_DOMAIN.TECHNICAL_SUCCESS,
    engine_artefacts: asArray(engineResult.engine_artefacts),
    replay_records: asArray(replayResult.replay_records),
    evidence_envelopes: asArray(evidenceResult.evidence_envelopes),
    copy_ids: []
  });
}

function isAllowedActorScope(actorType, executionScope) {
  if (!ALLOWED_ACTOR_TYPES.includes(actorType)) return false;
  if (!ALLOWED_EXECUTION_SCOPES.includes(executionScope)) return false;
  return ALLOWED_ACTOR_SCOPE_PAIRS.includes(`${actorType}::${executionScope}`);
}

function legalRefusal(refusalCode, field) {
  return deepFreeze({
    ok: false,
    domain: BETA_06_CL_GATE_DOMAIN.LEGAL_REFUSAL,
    refusal_code: refusalCode,
    refused_field: field,
    copy_ids: [REFUSAL_COPY_IDS[refusalCode]],
    engine_artefacts: [],
    replay_records: [],
    evidence_envelopes: [],
    proof_artefacts: []
  });
}

function technicalFailure(code, result) {
  return deepFreeze({
    ok: false,
    domain: BETA_06_CL_GATE_DOMAIN.TECHNICAL_FAILURE,
    technical_failure_code: code,
    technical_failure_token: typeof result.technical_failure_token === "string" ? result.technical_failure_token : code,
    copy_ids: ["CL_TECHNICAL_FAILURE_RECORDED"],
    engine_artefacts: asArray(result.engine_artefacts),
    replay_records: [],
    evidence_envelopes: [],
    proof_artefacts: []
  });
}

function callStep(fn) {
  if (typeof fn !== "function") {
    return { ok: true };
  }

  const result = fn();
  if (!isPlainObject(result)) {
    return { ok: false, technical_failure_token: "technical_step_invalid_result" };
  }

  return result;
}

function asArray(value) {
  return Array.isArray(value) ? [...value] : [];
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function deepFreeze(value) {
  if (!value || typeof value !== "object") return value;
  for (const nested of Object.values(value)) {
    deepFreeze(nested);
  }
  return Object.freeze(value);
}
