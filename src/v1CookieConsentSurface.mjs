import { createHash } from "node:crypto";

// DEV NOTE: S-V1-L-04 is a controlled-launch cookie and consent presentation
// surface only. It records legal/presentation consent state and renders a
// consent view model. It must not import engine code, read declaration truth,
// alter training flow, change compile output, or activate external scripts.

export const S_V1_L_04_COOKIE_CONSENT_SURFACE_VERSION = "1.0.0";
export const COOKIE_CONSENT_SURFACE_ID = "cookie_consent_surface";

export const COOKIE_CONSENT_ALLOWED_ACTOR_TYPES = Object.freeze([
  "anonymous",
  "athlete",
  "coach"
]);

export const COOKIE_CONSENT_ALLOWED_STATES = Object.freeze([
  "notice_acknowledged",
  "necessary_only",
  "necessary_and_preferences",
  "withdrawn_to_necessary"
]);

export const COOKIE_CONSENT_ALLOWED_CATEGORIES = Object.freeze([
  "strictly_necessary",
  "preference_storage"
]);

export const COOKIE_CONSENT_REQUIRED_CATEGORY = "strictly_necessary";

export const COOKIE_CONSENT_INPUT_KEYS = Object.freeze([
  "request_id",
  "actor_user_id",
  "actor_type",
  "requested_at",
  "consent_state",
  "selected_categories",
  "deterministic_probe"
]);

export const COOKIE_CONSENT_VIEW_INPUT_KEYS = Object.freeze([
  "request_id",
  "actor_user_id",
  "actor_type",
  "requested_at",
  "route",
  "deterministic_probe"
]);

export const COOKIE_CONSENT_COPY_IDS = Object.freeze([
  "cookie_consent.title",
  "cookie_consent.notice",
  "cookie_consent.necessary_only",
  "cookie_consent.preferences",
  "cookie_consent.no_engine_change",
  "cookie_consent.saved"
]);

export const COOKIE_CONSENT_BOUNDARY = Object.freeze({
  legal_presentation_state_only: true,
  consent_state_recorded: true,
  renderable_surface: true,
  engine_visible: false,
  engine_truth_changed: false,
  compile_output_changed: false,
  training_flow_changed: false,
  declaration_truth_changed: false,
  phase1_declaration_changed: false,
  external_script_activation: false,
  provider_call_performed: false,
  coaching_correctness_claim: false,
  training_value_claim: false
});

export const COOKIE_CONSENT_CATEGORY_REGISTRY = Object.freeze({
  strictly_necessary: Object.freeze({
    category_id: "strictly_necessary",
    label_copy_id: "cookie_consent.necessary_only",
    required_for_service: true,
    can_be_disabled: false,
    engine_visible: false,
    declaration_truth_visible: false
  }),
  preference_storage: Object.freeze({
    category_id: "preference_storage",
    label_copy_id: "cookie_consent.preferences",
    required_for_service: false,
    can_be_disabled: true,
    engine_visible: false,
    declaration_truth_visible: false
  })
});

const allowedActorTypeSet = new Set(COOKIE_CONSENT_ALLOWED_ACTOR_TYPES);
const allowedConsentStateSet = new Set(COOKIE_CONSENT_ALLOWED_STATES);
const allowedCategorySet = new Set(COOKIE_CONSENT_ALLOWED_CATEGORIES);
const inputKeySet = new Set(COOKIE_CONSENT_INPUT_KEYS);
const viewInputKeySet = new Set(COOKIE_CONSENT_VIEW_INPUT_KEYS);

const blockedPayloadKeySet = new Set([
  "compile_output",
  "compile_output_changed",
  "declaration_truth",
  "declaration_truth_changed",
  "engine_decision",
  "engine_input",
  "engine_output",
  "engine_truth",
  "engine_truth_changed",
  "external_script_activation",
  "phase1_declaration",
  "phase1_declaration_changed",
  "phase1_payload",
  "provider_call_performed",
  "session_plan",
  "substitution_selection",
  "training_flow",
  "training_flow_changed"
]);

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function stableValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => stableValue(item));
  }

  if (isPlainObject(value)) {
    const output = {};
    for (const key of Object.keys(value).sort()) {
      output[key] = stableValue(value[key]);
    }
    return output;
  }

  return value;
}

export function stableCookieConsentJson(value) {
  return JSON.stringify(stableValue(value));
}

export function hashCookieConsentValue(value) {
  return createHash("sha256")
    .update(stableCookieConsentJson(value))
    .digest("hex");
}

function errorResult(code, details = {}) {
  return stableValue({
    ok: false,
    surface_id: COOKIE_CONSENT_SURFACE_ID,
    version: S_V1_L_04_COOKIE_CONSENT_SURFACE_VERSION,
    code,
    details,
    copy_id: "cookie_consent.notice",
    consent_state_recorded: false,
    renderable: false,
    engine_visible: false,
    engine_truth_changed: false,
    compile_output_changed: false,
    training_flow_changed: false,
    declaration_truth_changed: false,
    phase1_declaration_changed: false,
    external_script_activation: false,
    provider_call_performed: false,
    legal_presentation_state_only: true
  });
}

function assertStringField(input, field) {
  if (typeof input[field] !== "string" || input[field].trim() === "") {
    return errorResult("cookie_consent_required_string_missing", { field });
  }

  return null;
}

function findUnknownInputKey(input, allowedKeys) {
  for (const key of Object.keys(input)) {
    if (!allowedKeys.has(key)) {
      return key;
    }
  }

  return null;
}

export function findBlockedCookieConsentPayloadKey(value, path = "$") {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const nested = findBlockedCookieConsentPayloadKey(value[index], path + "[" + index + "]");
      if (nested !== null) {
        return nested;
      }
    }

    return null;
  }

  if (!isPlainObject(value)) {
    return null;
  }

  for (const key of Object.keys(value)) {
    if (blockedPayloadKeySet.has(key)) {
      return { key, path: path + "." + key };
    }

    const nested = findBlockedCookieConsentPayloadKey(value[key], path + "." + key);
    if (nested !== null) {
      return nested;
    }
  }

  return null;
}

function normaliseSelectedCategories(input) {
  if (!Array.isArray(input.selected_categories)) {
    return errorResult("cookie_consent_selected_categories_array_required");
  }

  const categories = [...new Set(input.selected_categories)];

  for (const category of categories) {
    if (typeof category !== "string" || !allowedCategorySet.has(category)) {
      return errorResult("cookie_consent_category_not_allowed", {
        category
      });
    }
  }

  if (!categories.includes(COOKIE_CONSENT_REQUIRED_CATEGORY)) {
    return errorResult("cookie_consent_required_category_missing", {
      category: COOKIE_CONSENT_REQUIRED_CATEGORY
    });
  }

  categories.sort();

  return {
    ok: true,
    categories
  };
}

function assertStateMatchesCategories(consentState, categories) {
  const hasPreferenceStorage = categories.includes("preference_storage");

  if (consentState === "necessary_and_preferences" && hasPreferenceStorage !== true) {
    return errorResult("cookie_consent_preference_category_required_for_state", {
      consent_state: consentState
    });
  }

  if (consentState !== "necessary_and_preferences" && hasPreferenceStorage === true) {
    return errorResult("cookie_consent_preference_category_not_allowed_for_state", {
      consent_state: consentState
    });
  }

  return null;
}

function buildCategoryRows(selectedCategories) {
  return COOKIE_CONSENT_ALLOWED_CATEGORIES.map((categoryId) => {
    const registry = COOKIE_CONSENT_CATEGORY_REGISTRY[categoryId];

    return stableValue({
      category_id: categoryId,
      label_copy_id: registry.label_copy_id,
      selected: selectedCategories.includes(categoryId),
      required_for_service: registry.required_for_service,
      can_be_disabled: registry.can_be_disabled,
      engine_visible: false,
      declaration_truth_visible: false
    });
  });
}

function buildBoundaryPayload(deterministicProbe) {
  return stableValue({
    boundary: COOKIE_CONSENT_BOUNDARY,
    deterministic_probe_hash:
      deterministicProbe === undefined ? null : hashCookieConsentValue(deterministicProbe),
    engine_visible: false,
    engine_truth_changed: false,
    compile_output_changed: false,
    training_flow_changed: false,
    declaration_truth_changed: false,
    phase1_declaration_changed: false,
    external_script_activation: false,
    provider_call_performed: false,
    legal_presentation_state_only: true
  });
}

export function renderCookieConsentSurface(input = {}) {
  if (!isPlainObject(input)) {
    return errorResult("cookie_consent_view_input_object_required");
  }

  const blocked = findBlockedCookieConsentPayloadKey(input);
  if (blocked !== null) {
    return errorResult("cookie_consent_blocked_payload_key", blocked);
  }

  const unknownKey = findUnknownInputKey(input, viewInputKeySet);
  if (unknownKey !== null) {
    return errorResult("cookie_consent_unknown_view_input_key", { key: unknownKey });
  }

  const actorType = input.actor_type ?? "anonymous";
  if (!allowedActorTypeSet.has(actorType)) {
    return errorResult("cookie_consent_actor_type_not_allowed", { actor_type: actorType });
  }

  const route = input.route ?? "/legal/cookies";

  if (route !== "/legal/cookies" && route !== "/consent/cookies") {
    return errorResult("cookie_consent_route_not_allowed", { route });
  }

  return stableValue({
    ok: true,
    surface_id: COOKIE_CONSENT_SURFACE_ID,
    version: S_V1_L_04_COOKIE_CONSENT_SURFACE_VERSION,
    route,
    renderable: true,
    document_class: "cookie_consent",
    title_copy_id: "cookie_consent.title",
    notice_copy_id: "cookie_consent.notice",
    default_consent_state: "necessary_only",
    available_consent_states: COOKIE_CONSENT_ALLOWED_STATES,
    categories: buildCategoryRows([COOKIE_CONSENT_REQUIRED_CATEGORY]),
    copy_ids: COOKIE_CONSENT_COPY_IDS,
    ...buildBoundaryPayload(input.deterministic_probe)
  });
}

export function createCookieConsentState(input) {
  if (!isPlainObject(input)) {
    return errorResult("cookie_consent_input_object_required");
  }

  const blocked = findBlockedCookieConsentPayloadKey(input);
  if (blocked !== null) {
    return errorResult("cookie_consent_blocked_payload_key", blocked);
  }

  const unknownKey = findUnknownInputKey(input, inputKeySet);
  if (unknownKey !== null) {
    return errorResult("cookie_consent_unknown_input_key", { key: unknownKey });
  }

  for (const field of [
    "request_id",
    "actor_user_id",
    "actor_type",
    "requested_at",
    "consent_state"
  ]) {
    const missing = assertStringField(input, field);
    if (missing !== null) {
      return missing;
    }
  }

  if (!allowedActorTypeSet.has(input.actor_type)) {
    return errorResult("cookie_consent_actor_type_not_allowed", {
      actor_type: input.actor_type
    });
  }

  if (!allowedConsentStateSet.has(input.consent_state)) {
    return errorResult("cookie_consent_state_not_allowed", {
      consent_state: input.consent_state
    });
  }

  const selectedCategories = normaliseSelectedCategories(input);
  if (selectedCategories.ok !== true) {
    return selectedCategories;
  }

  const stateMismatch = assertStateMatchesCategories(input.consent_state, selectedCategories.categories);
  if (stateMismatch !== null) {
    return stateMismatch;
  }

  const boundaryPayload = buildBoundaryPayload(input.deterministic_probe);
  const statePayload = stableValue({
    surface_id: COOKIE_CONSENT_SURFACE_ID,
    version: S_V1_L_04_COOKIE_CONSENT_SURFACE_VERSION,
    request: {
      request_id: input.request_id,
      actor_user_id: input.actor_user_id,
      actor_type: input.actor_type,
      requested_at: input.requested_at
    },
    consent_state: input.consent_state,
    selected_categories: selectedCategories.categories,
    category_records: buildCategoryRows(selectedCategories.categories),
    consent_state_recorded: true,
    copy_id: "cookie_consent.saved",
    copy_notice_id: "cookie_consent.no_engine_change",
    ...boundaryPayload
  });

  const consentHash = hashCookieConsentValue(statePayload);

  return stableValue({
    ok: true,
    consent_record_id: "cookie_consent_" + consentHash.slice(0, 16),
    consent_hash: consentHash,
    ...statePayload
  });
}

export function assertCookieConsentDoesNotAlterEngine(result) {
  if (!isPlainObject(result)) {
    return {
      ok: false,
      code: "cookie_consent_result_object_required"
    };
  }

  const checks = {
    engine_visible: result.engine_visible === false,
    engine_truth_changed: result.engine_truth_changed === false,
    compile_output_changed: result.compile_output_changed === false,
    training_flow_changed: result.training_flow_changed === false,
    declaration_truth_changed: result.declaration_truth_changed === false,
    phase1_declaration_changed: result.phase1_declaration_changed === false,
    external_script_activation: result.external_script_activation === false,
    provider_call_performed: result.provider_call_performed === false,
    legal_presentation_state_only: result.legal_presentation_state_only === true
  };

  return stableValue({
    ok: Object.values(checks).every(Boolean),
    checks
  });
}

export function serializeCookieConsentSurface(value) {
  return stableCookieConsentJson(value);
}