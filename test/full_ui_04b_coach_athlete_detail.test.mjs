// DEV NOTE: FULL-UI-04B athlete-detail and immutable history surface proof.

import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function read(relativePath) {
  return fs.readFileSync(
    new URL(
      `../${relativePath}`,
      import.meta.url
    ),
    "utf8"
  );
}

const application =
  read("public/app/app.js");

const html =
  read("public/app/index.html");

const styles =
  read("public/app/styles.css");

const service =
  read(
    "src/api/beta19_coach_workspace_service.ts"
  );

const handlers =
  read(
    "src/api/coach_workspace.handlers.ts"
  );

const routes =
  read(
    "src/api/coach_workspace.routes.ts"
  );

const coachNoteWriteRoute =
  read(
    "src/api/beta17_coach_note_write.routes.ts"
  );

const schema =
  read("schema.sql");

test(
  "FULL-UI-04B exposes the complete athlete-detail surface",
  () => {
    for (const id of [
      "athleteDetailHistoryPanel",
      "athleteDetailRefreshButton",
      "athleteDetailStatus",
      "athleteDetailCurrentProgramme",
      "athleteDetailCurrentEvent",
      "athleteDetailAssignmentHistory",
      "athleteDetailStrengthHistory",
      "athleteDetailBodyweightHistory",
      "athleteDetailSessionHistory",
      "athleteDetailNoteHistory",
      "athleteDetailNoteForm"
    ]) {
      assert.match(
        html,
        new RegExp(
          `id="${id}"`,
          "u"
        )
      );
    }
  }
);

test(
  "FULL-UI-04B mounts one accepted athlete-detail read route",
  () => {
    assert.match(
      routes,
      /"\/athlete-detail"/u
    );

    assert.match(
      routes,
      /getCoachAthleteDetail/u
    );

    assert.match(
      handlers,
      /loadCoachAthleteDetail/u
    );

    assert.match(
      service,
      /requireCoachAthleteAccess/u
    );
  }
);

test(
  "FULL-UI-04B returns factual programme profile event session and note history",
  () => {
    for (const token of [
      "assignment_history",
      "strength_profile_history",
      "bodyweight_history",
      "event_link_history",
      "session_history",
      "note_history",
      "current_assignment",
      "current_event_link"
    ]) {
      assert.match(
        service,
        new RegExp(token, "u")
      );
    }

    assert.match(
      service,
      /factual_records_only:\s*true/u
    );

    assert.match(
      service,
      /read_only:\s*true/u
    );

    assert.match(
      service,
      /calls_engine:\s*false/u
    );
  }
);

test(
  "FULL-UI-04B session history surfaces the athlete's recorded pain report and skip reason - not just an opaque event count",
  () => {
    // The service used to select and expose only count(re.seq) as
    // runtime_event_count, leaving the reason_code/pain_reported facts an
    // athlete recorded stranded inside runtime_events' JSONB - visible on
    // the athlete's own history surface but never surfaced to the coach.
    assert.match(
      service,
      /session_pain_reported/u
    );
    assert.match(
      service,
      /session_skip_reasons/u
    );
    assert.match(
      service,
      /pain_reported:\s*\n?\s*Boolean/u
    );
    assert.match(
      service,
      /skip_reasons:/u
    );

    assert.match(
      application,
      /session\.pain_reported/u
    );
    assert.match(
      application,
      /session\.skip_reasons/u
    );

    // Same gap for exercise substitutions: the athlete's own history surface
    // already exposes substituted_exercise_id/substitution_edge_id per
    // exercise, but the coach's session history only ever exposed the
    // opaque event count until this fix.
    assert.match(
      service,
      /session_substitutions/u
    );
    assert.match(
      service,
      /substitutions:/u
    );
    assert.match(
      application,
      /session\.substitutions/u
    );

    // Same gap for RPE reports: an athlete's recorded RPE_REPORT was
    // validated and persisted but read back nowhere - not even to the
    // athlete themselves, let alone the coach's session history.
    assert.match(
      service,
      /session_rpe_reports/u
    );
    assert.match(
      service,
      /rpe_reports:/u
    );
    assert.match(
      application,
      /session\.rpe_reports/u
    );

    // Same gap for split/return: the athlete's own history detail already
    // exposes split_entered/split_return_decision/split_return_events, but
    // the coach's session history never surfaced whether an athlete split a
    // session or what they decided on return - not even a badge.
    assert.match(
      service,
      /session_split_entered/u
    );
    assert.match(
      service,
      /split_entered:/u
    );
    assert.match(
      service,
      /split_return_decision:/u
    );
    assert.match(
      application,
      /session\.split_entered/u
    );
    assert.match(
      application,
      /session\.split_return_decision/u
    );
  }
);

test(
  "FULL-UI-04B persists non-binding notes separately from artefacts",
  () => {
    assert.match(
      schema,
      /CREATE TABLE IF NOT EXISTS product_coach_notes/u
    );

    assert.match(
      coachNoteWriteRoute,
      /INSERT INTO product_coach_notes/u
    );

    assert.match(
      coachNoteWriteRoute,
      /ON CONFLICT \(note_id\)/u
    );

    assert.match(
      coachNoteWriteRoute,
      /JSON\.stringify\(note\)/u
    );

    assert.doesNotMatch(
      schema,
      /product_coach_notes[\s\S]{0,800}REFERENCES\s+runtime_events/iu
    );
  }
);

test(
  "FULL-UI-04B provides direct links and note creation",
  () => {
    for (const token of [
      "refreshAthleteDetail",
      "renderAthleteDetail",
      "recordAthleteDetailNote",
      'data-athlete-detail-action="programme"',
      'data-athlete-detail-action="event"',
      'data-athlete-detail-action="review"',
      'data-athlete-detail-action="note"'
    ]) {
      assert.match(
        application,
        new RegExp(
          token.replace(
            /[.*+?^${}()|[\]\\]/gu,
            "\\$&"
          ),
          "u"
        )
      );
    }

    assert.match(
      application,
      /\/coach-workspace\/athlete-detail/u
    );

    assert.match(
      application,
      /\/sessions\/beta-coach-notes/u
    );
  }
);

test(
  "FULL-UI-04B remains factual responsive and engine-inert",
  () => {
    const marker =
      application.indexOf(
        "// FULL-UI-04B factual athlete detail and history."
      );

    const end =
      application.indexOf(
        "async function openAthleteProfile",
        marker
      );

    assert.ok(marker >= 0);
    assert.ok(end > marker);

    const source =
      application.slice(
        marker,
        end
      );

    assert.doesNotMatch(
      source,
      /readiness score|performance score|rank athlete|predict outcome|recommended load|automatic recommendation/iu
    );

    assert.match(
      styles,
      /FULL-UI-04B factual athlete detail/u
    );

    assert.match(
      styles,
      /@media \(max-width: 920px\)/u
    );

    assert.match(
      styles,
      /@media \(max-width: 620px\)/u
    );
  }
);
