// DEV NOTE: Application readback contract surface for S-V1-39. This module
// binds session state and runtime event readback to explicit coach-athlete
// permission checks only. It must not mutate session state, append runtime
// events, call engine internals, create analytics surfaces, or infer authority
// from missing relationship data.

import crypto from "node:crypto";
import { canCoachAthleteAccess } from "./relationshipPermissionGuards.mjs";

export const sessionStateEventsReadbackContract = Object.freeze({
  surface_id: "v1_session_state_events_readback",
  slice_id: "S-V1-39",
  version: "1.0.0",
  permission_surface_id: "session_readback",
  readback_types: Object.freeze(["state", "events"]),
  access_policy: "athlete_own_or_assigned_coach_only",
  mutation_policy: "read_only",
  stability_policy: "stable_json_bytes_for_same_explicit_input",
  forbidden_scope: Object.freeze([
    "coach_intervention",
    "broad_analytics",
    "judgement_language",
    "engine_mutation"
  ])
});

export const sessionStateEventsReadbackFailureCode =
  "session_state_events_readback_permission_denied";

export class SessionStateEventsReadbackError extends Error {
  constructor(reason, details = {}) {
    super(`${sessionStateEventsReadbackFailureCode}:${reason}`);
    this.name = "SessionStateEventsReadbackError";
    this.code = sessionStateEventsReadbackFailureCode;
    this.reason = reason;
    this.product_auth_failure = true;
    this.product_permission_state_only = true;
    this.engine_decision = false;
    this.engine_visible = false;
    this.details = Object.freeze({ ...details });
  }
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function fail(reason, details = {}) {
  throw new SessionStateEventsReadbackError(reason, details);
}

function stableValue(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => stableValue(entry));
  }

  if (!isRecord(value)) {
    return value;
  }

  const output = {};
  for (const key of Object.keys(value).sort()) {
    output[key] = stableValue(value[key]);
  }
  return output;
}

export function stableSessionReadbackJson(value) {
  return JSON.stringify(stableValue(value));
}

function cloneStable(value) {
  return JSON.parse(stableSessionReadbackJson(value));
}

function sha256Hex(value) {
  return crypto.createHash("sha256").update(stableSessionReadbackJson(value), "utf8").digest("hex");
}

function assertReadbackInput(input) {
  if (!isRecord(input)) {
    fail("readback_input_invalid");
  }

  if (!isRecord(input.actor)) {
    fail("readback_actor_required");
  }

  if (!isRecord(input.session)) {
    fail("readback_session_required");
  }

  const sessionId = cleanString(input.session.session_id);
  const athleteUserId = cleanString(
    input.session.athlete_user_id ??
    input.session.athlete_id ??
    input.session.owner_athlete_user_id
  );

  if (sessionId.length === 0) {
    fail("readback_session_id_required");
  }

  if (athleteUserId.length === 0) {
    fail("readback_session_athlete_required", { session_id: sessionId });
  }

  if (!Array.isArray(input.relationships)) {
    fail("readback_relationships_array_required");
  }

  return {
    sessionId,
    athleteUserId
  };
}

export function decideSessionReadbackAccess(input) {
  const { sessionId, athleteUserId } = assertReadbackInput(input);

  const decision = canCoachAthleteAccess({
    actor: input.actor,
    target_athlete_user_id: athleteUserId,
    surface_id: sessionStateEventsReadbackContract.permission_surface_id,
    relationships: input.relationships
  });

  return Object.freeze({
    ...decision,
    readback_surface_id: sessionStateEventsReadbackContract.surface_id,
    session_id: sessionId,
    target_athlete_user_id: athleteUserId
  });
}

export function assertSessionReadbackAccess(input) {
  const decision = decideSessionReadbackAccess(input);

  if (decision.allowed !== true) {
    fail(decision.reason || "readback_access_denied", {
      session_id: decision.session_id,
      actor_type: input?.actor?.actor_type ?? null,
      target_athlete_user_id: decision.target_athlete_user_id,
      requested_surface_id: decision.requested_surface_id ?? sessionStateEventsReadbackContract.permission_surface_id
    });
  }

  return decision;
}

function buildReadbackEnvelope(input, readbackType, payloadKey) {
  const access = assertSessionReadbackAccess(input);
  const payload = isRecord(input[payloadKey]) || Array.isArray(input[payloadKey])
    ? cloneStable(input[payloadKey])
    : input[payloadKey];

  const envelope = Object.freeze({
    surface_id: sessionStateEventsReadbackContract.surface_id,
    slice_id: sessionStateEventsReadbackContract.slice_id,
    version: sessionStateEventsReadbackContract.version,
    readback_type: readbackType,
    session_id: access.session_id,
    access: Object.freeze({
      allowed: true,
      reason: access.reason,
      actor_type: access.actor_type,
      requested_surface_id: access.requested_surface_id,
      relationship_id: access.relationship_id ?? null,
      product_permission_state_only: true,
      engine_decision: false,
      engine_visible: false
    }),
    payload,
    payload_sha256: sha256Hex(payload),
    mutation_contract: Object.freeze({
      read_only: true,
      appends_runtime_event: false,
      mutates_session_state: false,
      calls_engine: false
    })
  });

  return cloneStable(envelope);
}

export function buildSessionStateReadback(input) {
  return buildReadbackEnvelope(input, "state", "state_payload");
}

export function buildSessionEventsReadback(input) {
  const result = buildReadbackEnvelope(input, "events", "events_payload");

  if (!isRecord(result.payload) || !Array.isArray(result.payload.events)) {
    fail("readback_events_payload_invalid", { session_id: result.session_id });
  }

  const sorted = [...result.payload.events].sort((a, b) => {
    const left = Number.isSafeInteger(a?.seq) ? a.seq : Number.POSITIVE_INFINITY;
    const right = Number.isSafeInteger(b?.seq) ? b.seq : Number.POSITIVE_INFINITY;
    return left - right;
  });

  if (stableSessionReadbackJson(sorted) !== stableSessionReadbackJson(result.payload.events)) {
    fail("readback_events_not_seq_ordered", { session_id: result.session_id });
  }

  return result;
}
