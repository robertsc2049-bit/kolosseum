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

// DEV NOTE: the coach-notes history list moved to React - see
// public/app-src/screens/coach/AthleteCoachNotesPanel.tsx and its
// __tests__ file for its behavioral coverage. Note *creation*
// (recordAthleteDetailNote, #athleteDetailNoteForm) stays legacy - see
// that component's own DEV NOTE for why.
const athleteCoachNotesPanel =
  read("public/app-src/screens/coach/AthleteCoachNotesPanel.tsx");

// DEV NOTE: current-programme, current-event, and the assignment/
// strength/bodyweight/event-link/session history lists also moved to
// React - see public/app-src/screens/coach/AthleteHistoryPanels.tsx,
// useAthleteHistory.ts and their __tests__ file. Session history's own
// bespoke pain/skip/substitution/RPE/split-return facts are covered
// below, now checked against AthleteHistoryPanels.tsx instead of app.js.
// The metric-card counts, status line and overall panel hide/show stay
// legacy-owned.
const athleteHistoryPanels =
  read("public/app-src/screens/coach/AthleteHistoryPanels.tsx");

test(
  "FULL-UI-04B exposes the complete athlete-detail surface",
  () => {
    for (const id of [
      "athleteDetailHistoryPanel",
      "athleteDetailRefreshButton",
      "athleteDetailStatus",
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

    for (const id of [
      "athlete-coach-notes-root",
      "athlete-history-current-programme-root",
      "athlete-history-current-event-root",
      "athlete-history-assignment-root",
      "athlete-history-strength-root",
      "athlete-history-bodyweight-root",
      "athlete-history-event-link-root",
      "athlete-history-session-root"
    ]) {
      assert.match(
        html,
        new RegExp(`id="${id}"`, "u")
      );
    }

    assert.doesNotMatch(html, /id="athleteDetailCurrentProgramme"/u);
    assert.doesNotMatch(html, /id="athleteDetailCurrentEvent"/u);
    assert.doesNotMatch(html, /id="athleteDetailAssignmentHistory"/u);
    assert.doesNotMatch(html, /id="athleteDetailStrengthHistory"/u);
    assert.doesNotMatch(html, /id="athleteDetailBodyweightHistory"/u);
    assert.doesNotMatch(html, /id="athleteDetailEventHistory"/u);
    assert.doesNotMatch(html, /id="athleteDetailSessionHistory"/u);

    assert.match(athleteCoachNotesPanel, /useAthleteCoachNotes/u);
    assert.match(athleteHistoryPanels, /useAthleteHistory/u);
    assert.match(athleteHistoryPanels, /AthleteSessionHistoryList/u);
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
  "FULL-UI-04B event_link_history is actually read and rendered, not just derived and stored",
  () => {
    // Same phantom-field bug class as PR #877 (notification_payload): the
    // service has derived, persisted and returned event_link_history since
    // FULL-UI-09C, but until now nothing in the UI ever read it - every
    // sibling history array (assignments, strength, bodyweight, sessions,
    // notes) had a renderer and a container, and this one had neither. The
    // renderer/container now live in AthleteHistoryPanels.tsx (see that
    // file's DEV NOTE); the count badge stays legacy.
    assert.match(
      athleteHistoryPanels,
      /event_link_history/u
    );

    assert.match(
      athleteHistoryPanels,
      /AthleteEventLinkHistoryList/u
    );

    assert.match(
      application,
      /elements\.athleteDetailEventCount/u
    );

    assert.match(
      html,
      /id="athleteDetailEventCount"/u
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
      athleteHistoryPanels,
      /session\.pain_reported/u
    );
    assert.match(
      athleteHistoryPanels,
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
      athleteHistoryPanels,
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
      athleteHistoryPanels,
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
      athleteHistoryPanels,
      /session\.split_entered/u
    );
    assert.match(
      athleteHistoryPanels,
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
      "recordAthleteDetailNote"
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

    // "Open programme"/"Open event" moved to React (current-programme/
    // current-event cards and the assignment-history list's "Open"
    // button) - they navigate the same way legacy's
    // bindAthleteDetailActions() used to (set location.hash, then click
    // the legacy nav button for that view), just without the
    // data-athlete-detail-action delegation legacy used, since these
    // buttons now live in a React-owned root bindAthleteDetailActions()
    // no longer needs to reach into.
    assert.doesNotMatch(
      application,
      /data-athlete-detail-action="programme"|data-athlete-detail-action="event"/u
    );
    assert.match(
      athleteHistoryPanels,
      /#\/coach\/programmes\//u
    );
    assert.match(
      athleteHistoryPanels,
      /#\/coach\/events\//u
    );
    assert.match(
      athleteHistoryPanels,
      /data-view="templates"/u
    );
    assert.match(
      athleteHistoryPanels,
      /data-view="events"/u
    );

    // "Review"/"Add note" (session history) also moved to React and no
    // longer exist as data-athlete-detail-action-carrying legacy DOM -
    // bindAthleteDetailActions() itself is retired, replaced by two
    // reverse-bridge custom events app.js listens for, since both actions
    // reach into legacy-only state/DOM (the Review view's athlete
    // selector, the note-creation form).
    assert.doesNotMatch(
      application,
      /data-athlete-detail-action="review"|data-athlete-detail-action="note"|function bindAthleteDetailActions/u
    );
    assert.match(
      athleteHistoryPanels,
      /kolosseum:open-session-review/u
    );
    assert.match(
      athleteHistoryPanels,
      /kolosseum:open-session-note-form/u
    );
    assert.match(
      application,
      /kolosseum:open-session-review/u
    );
    assert.match(
      application,
      /kolosseum:open-session-note-form/u
    );
    assert.match(
      application,
      /elements\.reviewAthlete\.value = athleteUserId/u
    );
    assert.match(
      application,
      /elements\.athleteDetailNoteForm\.hidden = false/u
    );

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
