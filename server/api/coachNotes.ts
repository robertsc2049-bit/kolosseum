/**
 * DEV NOTE:
 * Purpose: Keeps coach notes as product records for factual coach review surfaces.
 * Boundary: Coach notes must not enter engine input, replay input, canonical hashes, or proof artefacts.
 * Determinism: Note storage and retrieval must not change deterministic engine output.
 * Failure: Rejects or avoids paths that would couple notes to engine-bound payloads.
 */
export type CoachNoteActorType = "coach" | "athlete";

export type CoachNoteActorContext = {
  actor_type: CoachNoteActorType;
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

export type CoachNoteVisibility =
  | "coach_private"
  | "athlete_visible";

export type CoachNoteRecord = {
  note_id: string;
  coach_user_id: string;
  athlete_user_id: string;
  session_id: string;
  artefact_id: string | null;
  note_text: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  visibility: CoachNoteVisibility;
  non_binding: true;
};

export type CoachNoteCreateRequest = {
  athlete_user_id: string;
  session_id: string;
  artefact_id?: string | null;
  note_text: string;
  visibility: CoachNoteVisibility;
  non_binding?: unknown;
};

export type CoachNoteUpdateRequest = {
  note_text?: string;
  visibility?: CoachNoteVisibility;
  non_binding?: unknown;
};

export type CoachNoteStore = {
  notes: CoachNoteRecord[];
  coach_athlete_links: readonly CoachAthleteLink[];
};

export type CoachNoteCopyId =
  | "COACH_NOTES_PANEL_TITLE"
  | "COACH_NOTE_NON_BINDING_LABEL"
  | "COACH_NOTE_PLATFORM_METADATA_LABEL"
  | "COACH_NOTE_STORED_SEPARATELY"
  | "COACH_NOTE_NOT_ENGINE_INPUT";

export type CoachNoteApiError =
  | {
      error: "coach_note_access_denied";
      copy_id: "COACH_NOTE_ACCESS_DENIED";
    }
  | {
      error: "coach_note_invalid_request";
      copy_id: "COACH_NOTE_INVALID_REQUEST";
    }
  | {
      error: "coach_note_not_found";
      copy_id: "COACH_NOTE_NOT_FOUND";
    };

export type CoachNoteResponse = CoachNoteRecord & {
  copy_ids: CoachNoteCopyId[];
};

export type CoachNotesPanelResponse = {
  notes: CoachNoteResponse[];
  separated_from_factual_artefacts: true;
  copy_ids: CoachNoteCopyId[];
};

export type ApiResult<T> =
  | {
      status: 200 | 201;
      body: T;
    }
  | {
      status: 400 | 403 | 404;
      body: CoachNoteApiError;
    };

const COACH_NOTE_COPY_IDS: CoachNoteCopyId[] = [
  "COACH_NOTES_PANEL_TITLE",
  "COACH_NOTE_NON_BINDING_LABEL",
  "COACH_NOTE_PLATFORM_METADATA_LABEL",
  "COACH_NOTE_STORED_SEPARATELY",
  "COACH_NOTE_NOT_ENGINE_INPUT"
];

let deterministicNoteSequence = 0;

export function resetCoachNoteIdSequenceForTests(): void {
  deterministicNoteSequence = 0;
}

function nextNoteId(): string {
  deterministicNoteSequence += 1;
  return `coach_note_${String(deterministicNoteSequence).padStart(6, "0")}`;
}

function nowIso(): string {
  return "2026-05-20T00:00:00.000Z";
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isVisibility(value: unknown): value is CoachNoteVisibility {
  return value === "coach_private" || value === "athlete_visible";
}

export function hasAcceptedCoachAthleteLink(
  coach_user_id: string,
  athlete_user_id: string,
  links: readonly CoachAthleteLink[]
): boolean {
  return links.some((link) =>
    link.coach_user_id === coach_user_id &&
    link.athlete_user_id === athlete_user_id &&
    link.status === "accepted"
  );
}

export function createCoachNote(
  actor: CoachNoteActorContext,
  request: CoachNoteCreateRequest,
  store: CoachNoteStore
): ApiResult<CoachNoteResponse> {
  if (actor.actor_type !== "coach") {
    return accessDenied();
  }

  if (!isValidCreateRequest(request)) {
    return invalidRequest();
  }

  if ("non_binding" in request && request.non_binding !== undefined && request.non_binding !== true) {
    return invalidRequest();
  }

  if (!hasAcceptedCoachAthleteLink(actor.user_id, request.athlete_user_id, store.coach_athlete_links)) {
    return accessDenied();
  }

  const timestamp = nowIso();
  const note: CoachNoteRecord = {
    note_id: nextNoteId(),
    coach_user_id: actor.user_id,
    athlete_user_id: request.athlete_user_id,
    session_id: request.session_id,
    artefact_id: request.artefact_id ?? null,
    note_text: request.note_text,
    created_at: timestamp,
    updated_at: timestamp,
    deleted_at: null,
    visibility: request.visibility,
    non_binding: true
  };

  store.notes.push(note);

  return {
    status: 201,
    body: toNoteResponse(note)
  };
}

export function updateCoachNote(
  actor: CoachNoteActorContext,
  note_id: string,
  request: CoachNoteUpdateRequest,
  store: CoachNoteStore
): ApiResult<CoachNoteResponse> {
  const note = store.notes.find((candidate) => candidate.note_id === note_id && candidate.deleted_at === null);

  if (!note) {
    return {
      status: 404,
      body: {
        error: "coach_note_not_found",
        copy_id: "COACH_NOTE_NOT_FOUND"
      }
    };
  }

  if (actor.actor_type !== "coach" || actor.user_id !== note.coach_user_id) {
    return accessDenied();
  }

  if (!hasAcceptedCoachAthleteLink(actor.user_id, note.athlete_user_id, store.coach_athlete_links)) {
    return accessDenied();
  }

  if ("non_binding" in request && request.non_binding !== undefined && request.non_binding !== true) {
    return invalidRequest();
  }

  if (request.note_text !== undefined) {
    if (!isNonEmptyString(request.note_text)) return invalidRequest();
    note.note_text = request.note_text;
  }

  if (request.visibility !== undefined) {
    if (!isVisibility(request.visibility)) return invalidRequest();
    note.visibility = request.visibility;
  }

  note.non_binding = true;
  note.updated_at = nowIso();

  return {
    status: 200,
    body: toNoteResponse(note)
  };
}

export function softDeleteCoachNote(
  actor: CoachNoteActorContext,
  note_id: string,
  store: CoachNoteStore
): ApiResult<CoachNoteResponse> {
  const note = store.notes.find((candidate) => candidate.note_id === note_id && candidate.deleted_at === null);

  if (!note) {
    return {
      status: 404,
      body: {
        error: "coach_note_not_found",
        copy_id: "COACH_NOTE_NOT_FOUND"
      }
    };
  }

  if (actor.actor_type !== "coach" || actor.user_id !== note.coach_user_id) {
    return accessDenied();
  }

  if (!hasAcceptedCoachAthleteLink(actor.user_id, note.athlete_user_id, store.coach_athlete_links)) {
    return accessDenied();
  }

  note.deleted_at = nowIso();
  note.updated_at = nowIso();
  note.non_binding = true;

  return {
    status: 200,
    body: toNoteResponse(note)
  };
}

export function getCoachNotesForSession(
  actor: CoachNoteActorContext,
  athlete_user_id: string,
  session_id: string,
  store: CoachNoteStore
): ApiResult<CoachNotesPanelResponse> {
  if (actor.actor_type === "coach") {
    if (!hasAcceptedCoachAthleteLink(actor.user_id, athlete_user_id, store.coach_athlete_links)) {
      return accessDenied();
    }

    return {
      status: 200,
      body: toPanelResponse(store.notes.filter((note) =>
        note.athlete_user_id === athlete_user_id &&
        note.session_id === session_id &&
        note.deleted_at === null &&
        note.coach_user_id === actor.user_id
      ))
    };
  }

  if (actor.actor_type === "athlete" && actor.user_id === athlete_user_id) {
    return {
      status: 200,
      body: toPanelResponse(store.notes.filter((note) =>
        note.athlete_user_id === athlete_user_id &&
        note.session_id === session_id &&
        note.deleted_at === null &&
        note.visibility === "athlete_visible"
      ))
    };
  }

  return accessDenied();
}

export function compileIgnoringCoachNotes(
  phase1CanonicalInput: unknown,
  coachNotes: readonly CoachNoteRecord[]
): string {
  void coachNotes;
  return canonicalJson({
    compile_scope: "v0_phase1_to_phase6",
    phase1_canonical_input: phase1CanonicalInput
  });
}

export function projectArtefactWithoutCoachNotes<T extends Record<string, unknown>>(
  artefact: T,
  coachNotes: readonly CoachNoteRecord[]
): T {
  void coachNotes;
  return cloneJson(artefact);
}

export function toNoteResponse(note: CoachNoteRecord): CoachNoteResponse {
  return {
    ...cloneJson(note),
    non_binding: true,
    copy_ids: [...COACH_NOTE_COPY_IDS]
  };
}

export function toPanelResponse(notes: CoachNoteRecord[]): CoachNotesPanelResponse {
  return {
    notes: notes.map(toNoteResponse),
    separated_from_factual_artefacts: true,
    copy_ids: [...COACH_NOTE_COPY_IDS]
  };
}

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }

  const objectValue = value as Record<string, unknown>;
  return `{${Object.keys(objectValue)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(objectValue[key])}`)
    .join(",")}}`;
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isValidCreateRequest(request: CoachNoteCreateRequest): boolean {
  return (
    isNonEmptyString(request.athlete_user_id) &&
    isNonEmptyString(request.session_id) &&
    (request.artefact_id === undefined || request.artefact_id === null || isNonEmptyString(request.artefact_id)) &&
    isNonEmptyString(request.note_text) &&
    isVisibility(request.visibility)
  );
}

function accessDenied(): ApiResult<never> {
  return {
    status: 403,
    body: {
      error: "coach_note_access_denied",
      copy_id: "COACH_NOTE_ACCESS_DENIED"
    }
  };
}

function invalidRequest(): ApiResult<never> {
  return {
    status: 400,
    body: {
      error: "coach_note_invalid_request",
      copy_id: "COACH_NOTE_INVALID_REQUEST"
    }
  };
}