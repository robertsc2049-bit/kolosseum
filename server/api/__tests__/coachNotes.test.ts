
// DEV NOTE: API boundary surface. This file may expose or transport engine results, but must
// not bypass engine package boundaries, infer hidden truth, or let UI/product state mutate
// deterministic engine behaviour.

import assert from "node:assert/strict";
import test from "node:test";
import {
  canonicalJson,
  compileIgnoringCoachNotes,
  createCoachNote,
  getCoachNotesForSession,
  projectArtefactWithoutCoachNotes,
  resetCoachNoteIdSequenceForTests,
  softDeleteCoachNote,
  updateCoachNote,
  type CoachAthleteLink,
  type CoachNoteStore
} from "../coachNotes";

function acceptedLink(): CoachAthleteLink {
  return {
    link_id: "link_1",
    coach_user_id: "coach_1",
    athlete_user_id: "athlete_1",
    status: "accepted"
  };
}

function storeFixture(links: CoachAthleteLink[] = [acceptedLink()]): CoachNoteStore {
  return {
    notes: [],
    coach_athlete_links: links
  };
}

function createValidNote(store: CoachNoteStore = storeFixture()) {
  return createCoachNote(
    { actor_type: "coach", user_id: "coach_1" },
    {
      athlete_user_id: "athlete_1",
      session_id: "session_1",
      artefact_id: "artefact_1",
      note_text: "Observed bar path difference on final set.",
      visibility: "athlete_visible"
    },
    store
  );
}

test("accepted linked coach can create non-binding note", () => {
  resetCoachNoteIdSequenceForTests();
  const store = storeFixture();

  const result = createValidNote(store);

  assert.equal(result.status, 201);
  if (result.status !== 201) return;

  assert.equal(result.body.note_id, "coach_note_000001");
  assert.equal(result.body.coach_user_id, "coach_1");
  assert.equal(result.body.athlete_user_id, "athlete_1");
  assert.equal(result.body.session_id, "session_1");
  assert.equal(result.body.artefact_id, "artefact_1");
  assert.equal(result.body.note_text, "Observed bar path difference on final set.");
  assert.equal(result.body.visibility, "athlete_visible");
  assert.equal(result.body.non_binding, true);
  assert.equal(store.notes.length, 1);
});

test("unlinked coach cannot create note", () => {
  resetCoachNoteIdSequenceForTests();
  const store = storeFixture([]);

  const result = createValidNote(store);

  assert.equal(result.status, 403);
  assert.equal(store.notes.length, 0);
});

test("revoked link blocks note creation", () => {
  resetCoachNoteIdSequenceForTests();
  const store = storeFixture([
    {
      link_id: "link_1",
      coach_user_id: "coach_1",
      athlete_user_id: "athlete_1",
      status: "revoked"
    }
  ]);

  const result = createValidNote(store);

  assert.equal(result.status, 403);
  assert.equal(store.notes.length, 0);
});

test("invited rejected and expired links block note creation", () => {
  const statuses = ["invited", "rejected", "expired"] as const;

  for (const status of statuses) {
    resetCoachNoteIdSequenceForTests();
    const store = storeFixture([
      {
        link_id: `link_${status}`,
        coach_user_id: "coach_1",
        athlete_user_id: "athlete_1",
        status
      }
    ]);

    const result = createValidNote(store);

    assert.equal(result.status, 403);
    assert.equal(store.notes.length, 0);
  }
});

test("coach linked to another athlete cannot create note", () => {
  resetCoachNoteIdSequenceForTests();
  const store = storeFixture([
    {
      link_id: "link_1",
      coach_user_id: "coach_1",
      athlete_user_id: "athlete_2",
      status: "accepted"
    }
  ]);

  const result = createValidNote(store);

  assert.equal(result.status, 403);
  assert.equal(store.notes.length, 0);
});

test("athlete cannot create coach note", () => {
  resetCoachNoteIdSequenceForTests();
  const store = storeFixture();

  const result = createCoachNote(
    { actor_type: "athlete", user_id: "athlete_1" },
    {
      athlete_user_id: "athlete_1",
      session_id: "session_1",
      artefact_id: "artefact_1",
      note_text: "Athlete text",
      visibility: "athlete_visible"
    },
    store
  );

  assert.equal(result.status, 403);
  assert.equal(store.notes.length, 0);
});

test("note creation does not change engine output", () => {
  resetCoachNoteIdSequenceForTests();
  const store = storeFixture();

  const phase1 = {
    actor_type: "athlete",
    execution_scope: "coach_managed",
    activity_id: "powerlifting",
    consent_granted: true
  };

  const beforeCompile = compileIgnoringCoachNotes(phase1, []);

  const result = createValidNote(store);
  assert.equal(result.status, 201);

  const afterCompile = compileIgnoringCoachNotes(phase1, store.notes);

  assert.equal(afterCompile, beforeCompile);
});

test("note creation does not change session artefact", () => {
  resetCoachNoteIdSequenceForTests();
  const store = storeFixture();

  const artefact = {
    artefact_id: "artefact_1",
    session_id: "session_1",
    athlete_user_id: "athlete_1",
    factual_events: [
      {
        event_id: "event_1",
        event_type: "work_completed"
      }
    ]
  };

  const before = canonicalJson(projectArtefactWithoutCoachNotes(artefact, []));

  const result = createValidNote(store);
  assert.equal(result.status, 201);

  const after = canonicalJson(projectArtefactWithoutCoachNotes(artefact, store.notes));

  assert.equal(after, before);
});

test("non_binding is always true and cannot be created as false", () => {
  resetCoachNoteIdSequenceForTests();
  const store = storeFixture();

  const result = createCoachNote(
    { actor_type: "coach", user_id: "coach_1" },
    {
      athlete_user_id: "athlete_1",
      session_id: "session_1",
      artefact_id: "artefact_1",
      note_text: "Stored note",
      visibility: "athlete_visible",
      non_binding: false
    },
    store
  );

  assert.equal(result.status, 400);
  assert.equal(store.notes.length, 0);
});

test("non_binding cannot be changed by update", () => {
  resetCoachNoteIdSequenceForTests();
  const store = storeFixture();

  const created = createValidNote(store);
  assert.equal(created.status, 201);
  if (created.status !== 201) return;

  const blocked = updateCoachNote(
    { actor_type: "coach", user_id: "coach_1" },
    created.body.note_id,
    {
      non_binding: false
    },
    store
  );

  assert.equal(blocked.status, 400);

  const updated = updateCoachNote(
    { actor_type: "coach", user_id: "coach_1" },
    created.body.note_id,
    {
      note_text: "Updated note text",
      visibility: "coach_private"
    },
    store
  );

  assert.equal(updated.status, 200);
  if (updated.status !== 200) return;

  assert.equal(updated.body.non_binding, true);
  assert.equal(updated.body.note_text, "Updated note text");
  assert.equal(updated.body.visibility, "coach_private");
});

test("notes are returned separately from factual artefacts", () => {
  resetCoachNoteIdSequenceForTests();
  const store = storeFixture();

  const created = createValidNote(store);
  assert.equal(created.status, 201);

  const result = getCoachNotesForSession(
    { actor_type: "coach", user_id: "coach_1" },
    "athlete_1",
    "session_1",
    store
  );

  assert.equal(result.status, 200);
  if (result.status !== 200) return;

  assert.equal(result.body.separated_from_factual_artefacts, true);
  assert.equal(result.body.notes.length, 1);
  assert.equal(result.body.notes[0].non_binding, true);
  assert.ok(result.body.copy_ids.includes("COACH_NOTE_NON_BINDING_LABEL"));
  assert.ok(result.body.copy_ids.includes("COACH_NOTE_STORED_SEPARATELY"));
});

test("user-entered note text is stored exactly and not interpreted", () => {
  resetCoachNoteIdSequenceForTests();
  const store = storeFixture();

  const rawText = "Set 2 looked slower than set 1. Ask athlete what they noticed.";

  const result = createCoachNote(
    { actor_type: "coach", user_id: "coach_1" },
    {
      athlete_user_id: "athlete_1",
      session_id: "session_1",
      artefact_id: "artefact_1",
      note_text: rawText,
      visibility: "coach_private"
    },
    store
  );

  assert.equal(result.status, 201);
  if (result.status !== 201) return;

  assert.equal(result.body.note_text, rawText);

  const serialised = JSON.stringify(result.body);
  assert.equal(serialised.includes("score"), false);
  assert.equal(serialised.includes("classification"), false);
  assert.equal(serialised.includes("computed"), false);
});

test("athlete can read athlete visible notes for own session only", () => {
  resetCoachNoteIdSequenceForTests();
  const store = storeFixture();

  const created = createValidNote(store);
  assert.equal(created.status, 201);

  const visible = getCoachNotesForSession(
    { actor_type: "athlete", user_id: "athlete_1" },
    "athlete_1",
    "session_1",
    store
  );

  assert.equal(visible.status, 200);
  if (visible.status !== 200) return;

  assert.equal(visible.body.notes.length, 1);

  const denied = getCoachNotesForSession(
    { actor_type: "athlete", user_id: "athlete_2" },
    "athlete_1",
    "session_1",
    store
  );

  assert.equal(denied.status, 403);
});

test("soft delete sets deleted_at and does not delete artefact truth", () => {
  resetCoachNoteIdSequenceForTests();
  const store = storeFixture();

  const created = createValidNote(store);
  assert.equal(created.status, 201);
  if (created.status !== 201) return;

  const result = softDeleteCoachNote(
    { actor_type: "coach", user_id: "coach_1" },
    created.body.note_id,
    store
  );

  assert.equal(result.status, 200);
  if (result.status !== 200) return;

  assert.equal(result.body.non_binding, true);
  assert.notEqual(result.body.deleted_at, null);

  const panel = getCoachNotesForSession(
    { actor_type: "coach", user_id: "coach_1" },
    "athlete_1",
    "session_1",
    store
  );

  assert.equal(panel.status, 200);
  if (panel.status !== 200) return;
  assert.equal(panel.body.notes.length, 0);
});

test("revoked link blocks future note visibility", () => {
  resetCoachNoteIdSequenceForTests();
  const store = storeFixture();

  const created = createValidNote(store);
  assert.equal(created.status, 201);

  store.coach_athlete_links = [
    {
      link_id: "link_1",
      coach_user_id: "coach_1",
      athlete_user_id: "athlete_1",
      status: "revoked"
    }
  ];

  const result = getCoachNotesForSession(
    { actor_type: "coach", user_id: "coach_1" },
    "athlete_1",
    "session_1",
    store
  );

  assert.equal(result.status, 403);
});
