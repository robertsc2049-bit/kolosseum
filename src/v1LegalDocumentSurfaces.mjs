import { createHash } from "node:crypto";

import {
  buildPaymentNoCouplingProbe
} from "./v1PaymentBoundaryContract.mjs";

/**
 * DEV NOTE: S-V1-L-01 controlled-launch legal document surface.
 * Purpose: creates renderable Terms, Privacy, DPA, and legal index view models.
 * Boundary: document rendering only; no engine imports, no product outcome claims, no provider calls, and no data-request workflow.
 * Determinism: all records and hashes derive from explicit input and fixed document templates.
 * Failure: unknown document keys or routes fail closed without fallback fabrication.
 */
export const S_V1_L_01_LEGAL_DOCUMENT_SURFACES_VERSION = "S-V1-L-01";

export const LEGAL_DOCUMENT_KEYS = Object.freeze([
  "controlled_launch_legal_index",
  "controlled_launch_terms",
  "controlled_launch_privacy",
  "controlled_launch_dpa"
]);

export const LEGAL_DOCUMENT_ROUTES = Object.freeze({
  "/legal": "controlled_launch_legal_index",
  "/legal/terms": "controlled_launch_terms",
  "/legal/privacy": "controlled_launch_privacy",
  "/legal/dpa": "controlled_launch_dpa"
});

export const LEGAL_DOCUMENT_REASON_CODES = Object.freeze({
  RENDERED: "legal_document_surface_rendered",
  INPUT_REQUIRED: "legal_document_surface_input_required",
  DOCUMENT_NOT_PERMITTED: "legal_document_surface_document_not_permitted",
  ROUTE_NOT_PERMITTED: "legal_document_surface_route_not_permitted",
  ROUTE_DOCUMENT_MISMATCH: "legal_document_surface_route_document_mismatch",
  PROBE_REJECTED: "legal_document_surface_probe_rejected",
  ENGINE_MUTATION_REJECTED: "legal_document_surface_engine_mutation_rejected"
});

export const LEGAL_DOCUMENT_FORBIDDEN_EFFECTS = Object.freeze([
  "engine_legality",
  "compile_output",
  "substitution_selection",
  "replay_record",
  "proof_record",
  "factual_history_record"
]);

const INPUT_KEYS = Object.freeze([
  "requested_document_key",
  "requested_route",
  "requesting_actor_id",
  "requested_at",
  "deterministic_probe"
]);

const LEGAL_DOCUMENTS = Object.freeze({
  controlled_launch_legal_index: Object.freeze({
    document_key: "controlled_launch_legal_index",
    route: "/legal",
    title: "Controlled launch legal documents",
    version: "1.0.0",
    effective_from: "2026-06-17",
    document_class: "legal_index",
    sections: Object.freeze([
      Object.freeze({
        section_id: "legal_index_intro",
        heading: "Available documents",
        body: "This page lists the controlled-launch legal documents available for review."
      }),
      Object.freeze({
        section_id: "legal_index_documents",
        heading: "Documents",
        body: "Terms, Privacy, and DPA documents are available from this legal index."
      }),
      Object.freeze({
        section_id: "legal_index_boundary",
        heading: "Boundary",
        body: "These documents are rendered for controlled-launch review and do not change recorded execution records."
      })
    ]),
    linked_documents: Object.freeze([
      "controlled_launch_terms",
      "controlled_launch_privacy",
      "controlled_launch_dpa"
    ])
  }),
  controlled_launch_terms: Object.freeze({
    document_key: "controlled_launch_terms",
    route: "/legal/terms",
    title: "Controlled launch terms",
    version: "1.0.0",
    effective_from: "2026-06-17",
    document_class: "terms",
    sections: Object.freeze([
      Object.freeze({
        section_id: "terms_scope",
        heading: "Scope",
        body: "These terms govern controlled-launch access to Kolosseum product surfaces."
      }),
      Object.freeze({
        section_id: "terms_records",
        heading: "Recorded data",
        body: "Kolosseum records account, declaration, assignment, session, billing, proof, and export facts where a scoped feature permits them."
      }),
      Object.freeze({
        section_id: "terms_boundaries",
        heading: "Product boundaries",
        body: "Kolosseum is a software record and execution product. Human coaching judgement remains outside deterministic engine truth unless stored as an explicit factual product record."
      }),
      Object.freeze({
        section_id: "terms_engine_boundary",
        heading: "Engine boundary",
        body: "Terms acceptance, billing state, and document viewing do not change deterministic engine output."
      })
    ]),
    linked_documents: Object.freeze([
      "controlled_launch_privacy",
      "controlled_launch_dpa"
    ])
  }),
  controlled_launch_privacy: Object.freeze({
    document_key: "controlled_launch_privacy",
    route: "/legal/privacy",
    title: "Controlled launch privacy notice",
    version: "1.0.0",
    effective_from: "2026-06-17",
    document_class: "privacy",
    sections: Object.freeze([
      Object.freeze({
        section_id: "privacy_scope",
        heading: "Scope",
        body: "This notice describes the personal data categories used during controlled launch."
      }),
      Object.freeze({
        section_id: "privacy_categories",
        heading: "Data categories",
        body: "Data categories may include account identifiers, relationship permission records, declarations, programme assignment records, session event records, billing access records, and proof or export records where available."
      }),
      Object.freeze({
        section_id: "privacy_purpose",
        heading: "Purpose",
        body: "Data is used to provide product access, render factual product records, preserve audit trails, and support controlled-launch operation."
      }),
      Object.freeze({
        section_id: "privacy_boundary",
        heading: "Boundary",
        body: "Privacy document viewing does not change coach-athlete relationship truth, billing state, or deterministic engine output."
      })
    ]),
    linked_documents: Object.freeze([
      "controlled_launch_terms",
      "controlled_launch_dpa"
    ])
  }),
  controlled_launch_dpa: Object.freeze({
    document_key: "controlled_launch_dpa",
    route: "/legal/dpa",
    title: "Controlled launch data processing addendum",
    version: "1.0.0",
    effective_from: "2026-06-17",
    document_class: "dpa",
    sections: Object.freeze([
      Object.freeze({
        section_id: "dpa_scope",
        heading: "Scope",
        body: "This DPA records controlled-launch data processing roles and boundaries."
      }),
      Object.freeze({
        section_id: "dpa_roles",
        heading: "Roles",
        body: "The controlled-launch role model identifies the platform operator, product users, and permitted processing purposes for product operation."
      }),
      Object.freeze({
        section_id: "dpa_processing",
        heading: "Processing",
        body: "Processing is limited to product access, factual record rendering, audit trail preservation, billing access state, and support handling."
      }),
      Object.freeze({
        section_id: "dpa_boundary",
        heading: "Boundary",
        body: "The DPA surface does not activate data export handling, account removal handling, enterprise procurement, or deterministic engine behaviour."
      })
    ]),
    linked_documents: Object.freeze([
      "controlled_launch_terms",
      "controlled_launch_privacy"
    ])
  })
});

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function deepFreeze(value) {
  if (!isPlainObject(value) && !Array.isArray(value)) return value;

  Object.freeze(value);

  for (const nested of Object.values(value)) {
    if ((isPlainObject(nested) || Array.isArray(nested)) && !Object.isFrozen(nested)) {
      deepFreeze(nested);
    }
  }

  return value;
}

function canonicalJson(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return "[" + value.map((entry) => canonicalJson(entry)).join(",") + "]";
  }

  return "{" + Object.keys(value).sort().map((key) => {
    return JSON.stringify(key) + ":" + canonicalJson(value[key]);
  }).join(",") + "}";
}

function sha256Hex(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function deterministicSurfaceState() {
  return deepFreeze({
    engine_legality: "not_mutated",
    compile_output: "not_mutated",
    substitution_selection: "not_mutated",
    replay_record: "not_mutated",
    proof_record: "not_mutated",
    factual_history_record: "not_mutated",
    billing_state: "not_read_not_written_not_inferred",
    coach_athlete_relationship_truth: "not_read_not_written_not_inferred",
    relationship_truth_mutation: "not_performed"
  });
}

function fail(reasonCode, details = {}) {
  const material = deepFreeze({
    status: "legal_document_surface_rejected",
    reason_code: reasonCode,
    legal_document_state: "rejected",
    renderable: false,
    provider_call_performed: false,
    engine_decision: false,
    engine_visible: false,
    details: deepFreeze({ ...details }),
    ...deterministicSurfaceState()
  });

  return deepFreeze({
    ok: false,
    ...material,
    record_hash: sha256Hex(canonicalJson(material))
  });
}

function assertExactKeys(value, allowedKeys, reasonCode, field) {
  if (!isPlainObject(value)) {
    return fail(reasonCode, { field });
  }

  const allowed = new Set(allowedKeys);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      return fail(reasonCode, {
        field,
        unknown_key: key
      });
    }
  }

  return null;
}

function assertNonEmptyString(value, reasonCode, field) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return fail(reasonCode, { field });
  }

  return null;
}

function cloneDocument(document) {
  return deepFreeze(JSON.parse(JSON.stringify(document)));
}

export function listLegalDocumentSurfaces() {
  return deepFreeze({
    ok: true,
    document_keys: LEGAL_DOCUMENT_KEYS.slice(),
    routes: { ...LEGAL_DOCUMENT_ROUTES }
  });
}

export function createLegalDocumentSurface(input) {
  if (!isPlainObject(input)) {
    return fail(LEGAL_DOCUMENT_REASON_CODES.INPUT_REQUIRED);
  }

  const keyFailure = assertExactKeys(input, INPUT_KEYS, LEGAL_DOCUMENT_REASON_CODES.INPUT_REQUIRED, "input");
  if (keyFailure) return keyFailure;

  for (const field of [
    "requested_document_key",
    "requested_route",
    "requesting_actor_id",
    "requested_at"
  ]) {
    const failure = assertNonEmptyString(input[field], LEGAL_DOCUMENT_REASON_CODES.INPUT_REQUIRED, field);
    if (failure) return failure;
  }

  if (!LEGAL_DOCUMENT_KEYS.includes(input.requested_document_key)) {
    return fail(LEGAL_DOCUMENT_REASON_CODES.DOCUMENT_NOT_PERMITTED, {
      requested_document_key: input.requested_document_key
    });
  }

  const routeDocumentKey = LEGAL_DOCUMENT_ROUTES[input.requested_route];
  if (!routeDocumentKey) {
    return fail(LEGAL_DOCUMENT_REASON_CODES.ROUTE_NOT_PERMITTED, {
      requested_route: input.requested_route
    });
  }

  if (routeDocumentKey !== input.requested_document_key) {
    return fail(LEGAL_DOCUMENT_REASON_CODES.ROUTE_DOCUMENT_MISMATCH, {
      requested_route: input.requested_route,
      route_document_key: routeDocumentKey,
      requested_document_key: input.requested_document_key
    });
  }

  const probe = buildPaymentNoCouplingProbe(input.deterministic_probe);
  if (!probe.ok) {
    return fail(LEGAL_DOCUMENT_REASON_CODES.PROBE_REJECTED, {
      reason_code: probe.reason_code
    });
  }

  const document = cloneDocument(LEGAL_DOCUMENTS[input.requested_document_key]);

  const material = deepFreeze({
    contract_version: S_V1_L_01_LEGAL_DOCUMENT_SURFACES_VERSION,
    status: "legal_document_surface_rendered",
    reason_code: LEGAL_DOCUMENT_REASON_CODES.RENDERED,
    legal_document_state: "rendered",
    renderable: true,
    requested_document_key: input.requested_document_key,
    requested_route: input.requested_route,
    requesting_actor_id: input.requesting_actor_id,
    requested_at: input.requested_at,
    deterministic_probe_hash: probe.deterministic_probe_hash,
    provider_call_performed: false,
    engine_decision: false,
    engine_visible: false,
    ...deterministicSurfaceState()
  });

  return deepFreeze({
    ok: true,
    ...material,
    document,
    record_hash: sha256Hex(canonicalJson(material))
  });
}

export function assertLegalDocumentSurfaceDoesNotMutateEngine(record) {
  if (!isPlainObject(record)) {
    return fail(LEGAL_DOCUMENT_REASON_CODES.INPUT_REQUIRED, {
      field: "record"
    });
  }

  for (const key of LEGAL_DOCUMENT_FORBIDDEN_EFFECTS) {
    if (record[key] !== "not_mutated") {
      return fail(LEGAL_DOCUMENT_REASON_CODES.ENGINE_MUTATION_REJECTED, {
        field: key,
        value: record[key] ?? null
      });
    }
  }

  if (record.engine_decision !== false || record.engine_visible !== false) {
    return fail(LEGAL_DOCUMENT_REASON_CODES.ENGINE_MUTATION_REJECTED, {
      engine_decision: record.engine_decision ?? null,
      engine_visible: record.engine_visible ?? null
    });
  }

  if (
    record.billing_state !== "not_read_not_written_not_inferred" ||
    record.coach_athlete_relationship_truth !== "not_read_not_written_not_inferred" ||
    record.relationship_truth_mutation !== "not_performed"
  ) {
    return fail(LEGAL_DOCUMENT_REASON_CODES.ENGINE_MUTATION_REJECTED, {
      billing_state: record.billing_state ?? null,
      coach_athlete_relationship_truth: record.coach_athlete_relationship_truth ?? null,
      relationship_truth_mutation: record.relationship_truth_mutation ?? null
    });
  }

  return deepFreeze({
    ok: true,
    status: "legal_document_surface_engine_isolation_asserted",
    record_hash: record.record_hash
  });
}