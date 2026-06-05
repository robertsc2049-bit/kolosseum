/**
 * DEV NOTE:
 * Purpose: Serves factual session artefact views without creating new engine truth.
 * Boundary: Viewing artefacts must not mutate sessions, runtime events, replay state, or proof state.
 * Determinism: The same stored artefact reference must resolve to the same factual view state.
 * Failure: Missing or unauthorised artefact references must fail without fallback fabrication.
 */
export type ViewerActorType = "athlete" | "coach";

export type ViewerActorContext = {
  actor_type: ViewerActorType;
  user_id: string;
};

export type CoachAthleteLinkStatus =
  | "invited"
  | "accepted"
  | "revoked"
  | "expired"
  | "rejected";

export type CoachAthleteLink = {
  link_id: string;
  coach_user_id: string;
  athlete_user_id: string;
  status: CoachAthleteLinkStatus;
};

export type SessionStatus =
  | "planned"
  | "in_progress"
  | "completed"
  | "stopped"
  | "partial";

export type ExecutionScope = "individual" | "coach_managed";

export type QuantityUnit = "kg" | "lb" | "bodyweight" | "none";

export type FactualQuantity = {
  sets?: number;
  reps?: number;
  load_value?: number;
  load_unit?: QuantityUnit;
  duration_seconds?: number;
  distance_meters?: number;
};

export type SessionArtefactWorkItem = {
  work_item_id: string;
  display_order: number;
  exercise_token_id: string;
  planned_quantity: FactualQuantity;
};

export type SessionArtefactFactualEventType =
  | "work_completed"
  | "work_skipped"
  | "work_partial";

export type SessionArtefactFactualEvent = {
  event_id: string;
  event_type: SessionArtefactFactualEventType;
  work_item_id: string;
  occurred_at_iso8601: string;
  recorded_at_iso8601: string;
  factual_quantity: FactualQuantity;
};

export type SessionArtefactRecord = {
  artefact_id: string;
  session_id: string;
  athlete_user_id: string;
  session_status: SessionStatus;
  work_items: SessionArtefactWorkItem[];
  factual_events: SessionArtefactFactualEvent[];
  source_declaration_hash: string;
  activity_id: string;
  execution_scope: ExecutionScope;
  created_at_iso8601: string;
  updated_at_iso8601: string;
};

export type SessionArtefactViewerCopyId =
  | "SESSION_ARTEFACT_VIEWER_TITLE"
  | "SESSION_STATUS_LABEL"
  | "WORK_ITEMS_LABEL"
  | "FACTUAL_EVENTS_LABEL"
  | "TIMESTAMPS_LABEL"
  | "SOURCE_DECLARATION_HASH_LABEL"
  | "ACTIVITY_ID_LABEL"
  | "EXECUTION_SCOPE_LABEL"
  | "VIEWER_READ_ONLY";

export type SessionArtefactViewerResponse = {
  artefact_id: string;
  session_id: string;
  athlete_user_id: string;
  session_status: SessionStatus;
  work_items: SessionArtefactWorkItem[];
  factual_events: SessionArtefactFactualEvent[];
  source_declaration_hash: string;
  activity_id: string;
  execution_scope: ExecutionScope;
  created_at_iso8601: string;
  updated_at_iso8601: string;
  read_only: true;
  copy_ids: SessionArtefactViewerCopyId[];
};

export type SessionArtefactApiError =
  | {
      error: "access_denied";
      copy_id: "ARTEFACT_ACCESS_DENIED";
    }
  | {
      error: "artefact_not_found";
      copy_id: "ARTEFACT_NOT_FOUND";
    }
  | {
      error: "viewer_read_only";
      copy_id: "VIEWER_READ_ONLY";
    }
  | {
      error: "invalid_request";
      copy_id: "ARTEFACT_ACCESS_DENIED";
    };

export type ApiResult<T> =
  | {
      status: 200;
      body: T;
    }
  | {
      status: 403 | 404 | 405 | 400;
      body: SessionArtefactApiError;
    };

export type SessionArtefactViewerStore = {
  artefacts: readonly SessionArtefactRecord[];
  coach_athlete_links: readonly CoachAthleteLink[];
};

export type SessionArtefactApiRequest = {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  actor: ViewerActorContext;
};

const VIEWER_COPY_IDS: SessionArtefactViewerCopyId[] = [
  "SESSION_ARTEFACT_VIEWER_TITLE",
  "SESSION_STATUS_LABEL",
  "WORK_ITEMS_LABEL",
  "FACTUAL_EVENTS_LABEL",
  "TIMESTAMPS_LABEL",
  "SOURCE_DECLARATION_HASH_LABEL",
  "ACTIVITY_ID_LABEL",
  "EXECUTION_SCOPE_LABEL",
  "VIEWER_READ_ONLY"
];

const ALLOWED_VIEWER_RESPONSE_KEYS = [
  "artefact_id",
  "session_id",
  "athlete_user_id",
  "session_status",
  "work_items",
  "factual_events",
  "source_declaration_hash",
  "activity_id",
  "execution_scope",
  "created_at_iso8601",
  "updated_at_iso8601",
  "read_only",
  "copy_ids"
];

export function canViewSessionArtefact(
  actor: ViewerActorContext,
  artefact: SessionArtefactRecord,
  links: readonly CoachAthleteLink[]
): boolean {
  if (actor.actor_type === "athlete") {
    return actor.user_id === artefact.athlete_user_id;
  }

  if (actor.actor_type === "coach") {
    return links.some((link) =>
      link.coach_user_id === actor.user_id &&
      link.athlete_user_id === artefact.athlete_user_id &&
      link.status === "accepted"
    );
  }

  return false;
}

export function getSessionArtefactViewer(
  actor: ViewerActorContext,
  artefact_id: string,
  store: SessionArtefactViewerStore
): ApiResult<SessionArtefactViewerResponse> {
  const artefact = store.artefacts.find((candidate) => candidate.artefact_id === artefact_id);

  if (!artefact) {
    return {
      status: 404,
      body: {
        error: "artefact_not_found",
        copy_id: "ARTEFACT_NOT_FOUND"
      }
    };
  }

  if (!canViewSessionArtefact(actor, artefact, store.coach_athlete_links)) {
    return {
      status: 403,
      body: {
        error: "access_denied",
        copy_id: "ARTEFACT_ACCESS_DENIED"
      }
    };
  }

  return {
    status: 200,
    body: toViewerResponse(artefact)
  };
}

export function handleSessionArtefactViewerRequest(
  request: SessionArtefactApiRequest,
  store: SessionArtefactViewerStore
): ApiResult<SessionArtefactViewerResponse> {
  const artefactId = parseArtefactIdFromPath(request.path);

  if (!artefactId) {
    return {
      status: 400,
      body: {
        error: "invalid_request",
        copy_id: "ARTEFACT_ACCESS_DENIED"
      }
    };
  }

  if (request.method !== "GET") {
    return {
      status: 405,
      body: {
        error: "viewer_read_only",
        copy_id: "VIEWER_READ_ONLY"
      }
    };
  }

  return getSessionArtefactViewer(request.actor, artefactId, store);
}

export function parseArtefactIdFromPath(path: string): string | null {
  const match = /^\/v0\/session-artefacts\/([^/]+)(?:\/.*)?$/.exec(path);
  if (!match) return null;
  return decodeURIComponent(match[1]);
}

export function toViewerResponse(
  artefact: SessionArtefactRecord
): SessionArtefactViewerResponse {
  return {
    artefact_id: artefact.artefact_id,
    session_id: artefact.session_id,
    athlete_user_id: artefact.athlete_user_id,
    session_status: artefact.session_status,
    work_items: artefact.work_items.map((item) => ({
      work_item_id: item.work_item_id,
      display_order: item.display_order,
      exercise_token_id: item.exercise_token_id,
      planned_quantity: { ...item.planned_quantity }
    })),
    factual_events: artefact.factual_events.map((event) => ({
      event_id: event.event_id,
      event_type: event.event_type,
      work_item_id: event.work_item_id,
      occurred_at_iso8601: event.occurred_at_iso8601,
      recorded_at_iso8601: event.recorded_at_iso8601,
      factual_quantity: { ...event.factual_quantity }
    })),
    source_declaration_hash: artefact.source_declaration_hash,
    activity_id: artefact.activity_id,
    execution_scope: artefact.execution_scope,
    created_at_iso8601: artefact.created_at_iso8601,
    updated_at_iso8601: artefact.updated_at_iso8601,
    read_only: true,
    copy_ids: [...VIEWER_COPY_IDS]
  };
}

export function assertViewerResponseFactualOnly(
  response: SessionArtefactViewerResponse
): true {
  for (const key of Object.keys(response)) {
    if (!ALLOWED_VIEWER_RESPONSE_KEYS.includes(key)) {
      throw new Error(`Unexpected viewer response key: ${key}`);
    }
  }

  if (response.read_only !== true) {
    throw new Error("Viewer response must be read-only.");
  }

  return true;
}