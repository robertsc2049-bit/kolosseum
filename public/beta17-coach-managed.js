// DEV NOTE: BETA-17 extends the existing session runner.
// All visible prose is resolved from the BETA-17 Copy Registry.
// Coach records remain product state and are never added to engine requests.

const elements = {
  coachId:
    document.getElementById(
      "beta17CoachId"
    ),
  coachEmail:
    document.getElementById(
      "beta17CoachEmail"
    ),
  coachName:
    document.getElementById(
      "beta17CoachName"
    ),
  templateId:
    document.getElementById(
      "beta17TemplateId"
    ),
  noteText:
    document.getElementById(
      "beta17NoteText"
    ),
  noteVisibility:
    document.getElementById(
      "beta17NoteVisibility"
    ),
  output:
    document.getElementById(
      "beta17Output"
    ),
  profileAction:
    document.getElementById(
      "beta17ProfileAction"
    ),
  inviteAction:
    document.getElementById(
      "beta17InviteAction"
    ),
  acceptAction:
    document.getElementById(
      "beta17AcceptAction"
    ),
  revokeAction:
    document.getElementById(
      "beta17RevokeAction"
    ),
  assignmentAction:
    document.getElementById(
      "beta17AssignmentAction"
    ),
  artefactAction:
    document.getElementById(
      "beta17ArtefactAction"
    ),
  noteAction:
    document.getElementById(
      "beta17NoteAction"
    ),
  athleteId:
    document.getElementById(
      "authUserId"
    ),
  activityId:
    document.getElementById(
      "activityId"
    ),
  sessionId:
    document.getElementById(
      "sessionId"
    )
};

const state = {
  copy: new Map(),
  coachProfile: null,
  relationship: null,
  assignment: null,
  artefactView: null,
  coachNote: null
};

function copy(copyId) {
  const value = state.copy.get(copyId);

  if (typeof value !== "string") {
    throw new Error(
      `BETA17_REGISTRY_ID_MISSING:${copyId}`
    );
  }

  return value;
}

async function readJson(response) {
  const text =
    await response.text();

  let json = null;

  try {
    json = text
      ? JSON.parse(text)
      : null;
  }
  catch {
    json = {
      raw: text
    };
  }

  return {
    ok: response.ok,
    status: response.status,
    json
  };
}

async function httpJson(
  method,
  path,
  body
) {
  const response = await fetch(path, {
    method,
    headers: {
      "content-type": "application/json"
    },
    body:
      typeof body === "undefined"
        ? undefined
        : JSON.stringify(body)
  });

  const result =
    await readJson(response);

  if (!result.ok) {
    const error = new Error(
      String(
        result.json?.reason ??
        result.json?.failure_token ??
        result.status
      )
    );

    error.result = result;
    throw error;
  }

  return result.json;
}

function show(copyId, payload = null) {
  elements.output.textContent =
    payload === null
      ? copy(copyId)
      : `${copy(copyId)}\n${JSON.stringify(
          payload,
          null,
          2
        )}`;
}

function athleteUserId() {
  return elements
    .athleteId
    .value
    .trim();
}

function coachUserId() {
  return elements
    .coachId
    .value
    .trim();
}

function relationshipInput(
  relationshipState
) {
  const timestamp =
    new Date().toISOString();

  return {
    relationship_id:
      `beta17_relationship_${coachUserId()}_${athleteUserId()}`,
    coach_user_id:
      coachUserId(),
    athlete_user_id:
      athleteUserId(),
    relationship_state:
      relationshipState,
    relationship_scope:
      "individual_coach_athlete",
    accepted_at_iso8601:
      relationshipState ===
        "accepted" ||
      relationshipState ===
        "revoked"
        ? timestamp
        : null,
    created_at_iso8601:
      timestamp,
    updated_at_iso8601:
      timestamp,
    revoked_at_iso8601:
      relationshipState ===
        "revoked"
        ? timestamp
        : null,
    expires_at_iso8601: null
  };
}

function acceptedRelationship() {
  return (
    state.relationship !== null &&
    state.relationship
      .relationship_state ===
      "accepted" &&
    state.relationship
      .revoked_at_iso8601 === null
  );
}

function updateButtons() {
  elements.inviteAction.disabled =
    state.coachProfile === null;

  elements.acceptAction.disabled =
    state.coachProfile === null;

  elements.revokeAction.disabled =
    state.relationship === null;

  const permitted =
    state.coachProfile !== null &&
    acceptedRelationship();

  elements.assignmentAction.disabled =
    !permitted;

  elements.artefactAction.disabled =
    !permitted ||
    elements.sessionId.value.trim() ===
      "";

  elements.noteAction.disabled =
    !permitted ||
    elements.sessionId.value.trim() ===
      "";
}

async function recordProfile() {
  const result = await httpJson(
    "POST",
    "/sessions/beta-coach-profile",
    {
      coach_user_id:
        coachUserId(),
      email:
        elements.coachEmail.value.trim(),
      display_name:
        elements.coachName.value.trim(),
      account_role: "coach",
      account_state: "active",
      accepted_terms_version:
        "terms_v1",
      created_at_iso8601:
        new Date().toISOString()
    }
  );

  state.coachProfile =
    result.coach_profile;

  show(
    "BETA17_COPY_PROFILE_RECORDED",
    state.coachProfile
  );

  updateButtons();
}

async function recordRelationship(
  relationshipState
) {
  const result = await httpJson(
    "POST",
    "/sessions/beta-coach-relationship",
    relationshipInput(
      relationshipState
    )
  );

  state.relationship =
    result.relationship;

  show(
    state.relationship.copy_id,
    state.relationship
  );

  updateButtons();
}

async function recordAssignment() {
  const result = await httpJson(
    "POST",
    "/sessions/beta-coach-assignment",
    {
      request_id:
        `beta17_request_${coachUserId()}_${athleteUserId()}`,
      requested_at_iso8601:
        new Date().toISOString(),
      coach_profile:
        state.coachProfile,
      relationship:
        state.relationship,
      athlete_user_id:
        athleteUserId(),
      template_id:
        elements.templateId.value.trim(),
      activity_id:
        elements.activityId.value
    }
  );

  state.assignment =
    result.assignment;

  show(
    "BETA17_COPY_ASSIGNMENT_RECORDED",
    state.assignment
  );
}

async function sessionFacts() {
  const sessionId =
    elements.sessionId.value.trim();

  const [stateResponse, eventsResponse] =
    await Promise.all([
      httpJson(
        "GET",
        `/sessions/${encodeURIComponent(
          sessionId
        )}/state`
      ),
      httpJson(
        "GET",
        `/sessions/${encodeURIComponent(
          sessionId
        )}/events`
      )
    ]);

  const events =
    Array.isArray(eventsResponse)
      ? eventsResponse
      : Array.isArray(
          eventsResponse?.events
        )
        ? eventsResponse.events
        : [];

  return {
    artefact_id:
      `beta17_artefact_${sessionId}`,
    session_id: sessionId,
    athlete_user_id:
      athleteUserId(),
    artefact_type:
      "session_runtime_artefact",
    session_status:
      String(
        stateResponse?.status ??
        stateResponse?.classification ??
        "recorded"
      ),
    recorded_at:
      new Date().toISOString(),
    runtime_events: events
  };
}

async function loadArtefact() {
  const artefact =
    await sessionFacts();

  const result = await httpJson(
    "POST",
    "/sessions/beta-coach-artefacts",
    {
      coach_profile:
        state.coachProfile,
      relationship:
        state.relationship,
      athlete_user_id:
        athleteUserId(),
      artefacts: [artefact]
    }
  );

  state.artefactView =
    result.artefact_view;

  show(
    "BETA17_COPY_ARTEFACT_LOADED",
    state.artefactView
  );
}

async function recordNote() {
  const sessionId =
    elements.sessionId.value.trim();

  const result = await httpJson(
    "POST",
    "/sessions/beta-coach-notes",
    {
      coach_profile:
        state.coachProfile,
      relationship:
        state.relationship,
      athlete_user_id:
        athleteUserId(),
      session_id: sessionId,
      artefact_id:
        `beta17_artefact_${sessionId}`,
      note_text:
        elements.noteText.value,
      visibility:
        elements.noteVisibility.value
    }
  );

  state.coachNote =
    result.coach_note;

  show(
    "BETA17_COPY_NOTE_RECORDED",
    state.coachNote
  );
}

async function run(action) {
  try {
    await action();
  }
  catch (error) {
    const denied =
      error?.result?.status === 403;

    show(
      denied
        ? "BETA17_COPY_ACCESS_DENIED"
        : "BETA17_COPY_STATUS_ERROR",
      {
        reason:
          error?.result?.json?.reason ??
          error?.message ??
          "unknown"
      }
    );
  }
}

async function initialise() {
  const response = await fetch(
    "/ui/beta_17_coach_managed_path_copy.json"
  );

  const result =
    await readJson(response);

  if (
    !result.ok ||
    !Array.isArray(result.json)
  ) {
    throw new Error(
      "BETA17_REGISTRY_LOAD_FAILED"
    );
  }

  for (const entry of result.json) {
    state.copy.set(
      entry.copy_id,
      entry.text
    );
  }

  for (
    const node of document.querySelectorAll(
      "[data-copy-id^='BETA17_']"
    )
  ) {
    node.textContent =
      copy(node.dataset.copyId);
  }

  elements.coachId.value =
    "beta_coach_001";

  elements.coachEmail.value =
    "beta.coach@example.com";

  elements.coachName.value =
    "Beta Coach";

  updateButtons();
}

elements.profileAction.addEventListener(
  "click",
  () => run(recordProfile)
);

elements.inviteAction.addEventListener(
  "click",
  () =>
    run(
      () =>
        recordRelationship("invited")
    )
);

elements.acceptAction.addEventListener(
  "click",
  () =>
    run(
      () =>
        recordRelationship("accepted")
    )
);

elements.revokeAction.addEventListener(
  "click",
  () =>
    run(
      () =>
        recordRelationship("revoked")
    )
);

elements.assignmentAction
  .addEventListener(
    "click",
    () => run(recordAssignment)
  );

elements.artefactAction
  .addEventListener(
    "click",
    () => run(loadArtefact)
  );

elements.noteAction.addEventListener(
  "click",
  () => run(recordNote)
);

elements.sessionId.addEventListener(
  "change",
  updateButtons
);

initialise().catch((error) => {
  elements.output.textContent =
    String(
      error?.message ??
      "BETA17_INITIALISATION_FAILED"
    );
});
