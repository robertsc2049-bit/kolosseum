import { api } from "../core/api.js";
import { elements } from "../core/elements.js";
import { formatDate, nowIso, titleCase } from "../core/format.js";
import { catchWithViewRetry, handleError, hideBusy, showBusy, showNotice } from "../core/notices.js";
import { setView } from "../core/shell.js";
import { saveState, state } from "../core/state.js";
import { loadTemplateExercises, refreshTemplates } from "./programmes.js";

// FULL-UI-04A factual coach–athlete directory and relationship lifecycle.

function mapCoachAthleteDirectoryRow(raw, existing = null) {
  const userId = String(
    raw?.athlete_user_id ??
    existing?.userId ??
    ""
  );

  const relationship =
    raw?.relationship &&
    typeof raw.relationship === "object"
      ? raw.relationship
      : existing?.relationship ?? null;

  return {
    userId,
    displayName: String(
      raw?.display_name ??
      existing?.displayName ??
      userId
    ),
    email: String(
      raw?.email ??
      existing?.email ??
      ""
    ),
    activityId: String(
      raw?.activity_id ??
      existing?.activityId ??
      ""
    ),
    relationship,
    relationshipState: String(
      raw?.relationship_state ??
      relationship?.relationship_state ??
      "unknown"
    ),
    relationshipExpired:
      raw?.relationship_expired === true
  };
}

async function refreshCoachRelationships(
  options = {}
) {
  if (
    state.role !== "coach" ||
    !state.profile?.coachUserId
  ) {
    return [];
  }

  if (!options.quiet) {
    showBusy(
      "Loading athlete relationships…"
    );
  }

  try {
    const response =
      await api(
        "GET",
        `/coach-workspace/relationships?coach_user_id=${encodeURIComponent(state.profile.coachUserId)}`
      );

    const currentRelationships =
      Array.isArray(state.coachRelationships)
        ? state.coachRelationships
        : [];

    const existingById =
      new Map(
        currentRelationships.map(
          (entry) => [
            entry.userId,
            entry
          ]
        )
      );

    state.coachRelationships =
      (
        Array.isArray(
          response.relationships
        )
          ? response.relationships
          : []
      )
        .map((entry) => {
          const userId = String(
            entry?.athlete_user_id ??
            ""
          );

          return mapCoachAthleteDirectoryRow(
            entry,
            existingById.get(userId)
          );
        })
        .filter(
          (entry) => entry.userId
        );

    saveState();
    renderCoachAthleteDirectory();

    return state.coachRelationships;
  }
  finally {
    if (!options.quiet) {
      hideBusy();
    }
  }
}

// NOTE: the athlete directory (relationship counts, search/filter,
// roster list) moved to React - see
// public/app-src/screens/coach/AthleteDirectoryPanel.tsx, mounted into
// #athlete-directory-root. It independently fetches its own data and
// refetches whenever this event fires - every call site below that used
// to call this function to re-render the directory after a relationship/
// assignment/unread-count change still does, just to notify the React
// panel instead of writing innerHTML directly.
function renderCoachAthleteDirectory() {
  document.dispatchEvent(
    new CustomEvent("kolosseum:athlete-directory-changed")
  );
}

// DEV NOTE: the "Relationship audit" panel (open/close/revoke/cancel) moved
// to React - see public/app-src/screens/coach/AthleteRelationshipDetailPanel.
// tsx and useAthleteRelationshipDetail.ts, mounted into
// #athlete-relationship-detail-root. The global data-relationship-action=
// 'audit' click delegation below still calls this trimmed function
// unchanged (it isn't scoped to legacy-rendered DOM, so it works the same
// against the already-React AthleteDirectoryPanel.tsx's "View audit"
// button); it now just dispatches the open-request bridge event instead of
// writing innerHTML, and still hides the still-legacy athlete
// training-profile panel to preserve the original mutual-exclusion
// behaviour (opening the audit panel hides the profile panel, and vice
// versa - see openAthleteProfile()'s call to closeAthleteRelationshipDetail
// below).
function closeAthleteRelationshipDetail() {
  document.dispatchEvent(
    new CustomEvent("kolosseum:close-relationship-audit")
  );
}

function openAthleteRelationshipDetail(athleteUserId) {
  if (elements.athleteProfilePanel) {
    elements.athleteProfilePanel.hidden = true;
  }
  document.dispatchEvent(
    new CustomEvent("kolosseum:open-relationship-audit-request", {
      detail: { athlete_user_id: athleteUserId }
    })
  );
}

// DEV NOTE: the coach directory's unread-message badge (coachMessageUnreadCountFor/
// refreshCoachMessageUnreadCounts) moved to React with the directory itself
// - see useAthleteDirectory.ts, which independently fetches
// loadCoachMessageUnreadCounts() from the same GET /messages/coach/threads
// route via public/app-src/api/coachWorkspaceClient.ts.
export async function refreshCoachAthletes(options = {}) {
  if (state.role !== "coach") return [];

  if (!options.quiet) {
    showBusy(
      "Loading connected athletes…"
    );
  }

  try {
    const [acceptedResponse] =
      await Promise.all([
        api(
          "GET",
          `/coach-workspace/athletes?coach_user_id=${encodeURIComponent(state.profile.coachUserId)}`
        ),
        refreshCoachRelationships({
          quiet: true
        })
      ]);

    const existingById =
      new Map(
        state.coachAthletes.map(
          (athlete) => [
            athlete.userId,
            athlete
          ]
        )
      );

    state.coachAthletes =
      (
        Array.isArray(
          acceptedResponse.athletes
        )
          ? acceptedResponse.athletes
          : []
      )
        .map((athlete) => {
          const userId = String(
            athlete.athlete_user_id ??
            ""
          );

          return mapCoachAthleteDirectoryRow(
            athlete,
            existingById.get(userId)
          );
        })
        .filter(
          (athlete) => athlete.userId
        );

    saveState();
    renderCoachAthleteDirectory();

    return state.coachAthletes;
  }
  finally {
    if (!options.quiet) {
      hideBusy();
    }
  }
}

export async function refreshCoachAssignments(options = {}) {
  // No coach id yet (mid sign-in): never ask with an empty coach_user_id.
  if (state.role !== "coach" || !state.profile?.coachUserId) return [];

  if (!options.quiet) showBusy("Loading programme assignments…");

  try {
    const response = await api(
      "GET",
      `/coach-workspace/assignments?coach_user_id=${encodeURIComponent(state.profile.coachUserId)}`
    );

    state.coachAssignments = (Array.isArray(response.assignments) ? response.assignments : [])
      .map((assignment) => {
        const template = state.coachTemplates.find(
          (entry) => String(entry.template_id ?? "") === String(assignment.template_id ?? "")
        );

        return {
          assignmentId: String(assignment.assignment_id ?? ""),
          athleteUserId: String(assignment.assigned_athlete_id ?? ""),
          templateId: String(assignment.template_id ?? ""),
          templateVersion: Number(
            assignment.template_version ??
            template?.template_version ??
            0
          ),
          templateName: String(
            assignment.template_name ??
            template?.template_name ??
            assignment.template_id ??
            "Programme"
          ),
          activityId: String(assignment.activity_id ?? ""),
          assignmentStatus: String(
            assignment.lifecycle_status ??
            assignment.assignment_status ??
            "assigned"
          ),
          isCurrent: assignment.is_current === true,
          replacesAssignmentId: String(assignment.replaces_assignment_id ?? ""),
          cancelsAssignmentId: String(assignment.cancels_assignment_id ?? ""),
          eventId: String(assignment.event_id ?? ""),
          preservedSessionCount: Number(assignment.preserved_session_count ?? 0),
          recordedAt: String(assignment.requested_at_iso8601 ?? ""),
          record: assignment
        };
      })
      .filter((assignment) => assignment.assignmentId);

    saveState();
    return state.coachAssignments;
  }
  finally {
    if (!options.quiet) hideBusy();
  }
}

// DEV NOTE: the invite-by-email form (FULL-UI-24), broadcast form and
// manual "Add athlete" connect form all moved to React - see
// public/app-src/screens/coach/InviteAthleteByEmailPanel.tsx/
// CoachBroadcastPanel.tsx/ConnectAthletePanel.tsx, mounted into
// #invite-athlete-root/#coach-broadcast-root/#connect-athlete-root. Each
// hook dispatches kolosseum:coach-relationship-mutated (invite/connect) or
// posts directly with no relationship-state side effect (broadcast), so
// this one listener replaces every refreshCoachAthletes()/
// refreshCoachAssignments()/renderCoachWorkspace()/renderCoachDashboard()
// call the three removed functions used to make themselves - state.
// coachAthletes/state.coachRelationships stay populated for the still-
// legacy athlete training-profile panel and Coach Dashboard, which read
// them directly.
document.addEventListener("kolosseum:coach-relationship-mutated", () => {
  Promise.all([
    refreshCoachAthletes({ quiet: true }),
    refreshCoachAssignments({ quiet: true })
  ])
    .then(() => {
      renderCoachWorkspace();
      renderCoachDashboard();
    })
    .catch(handleError);
});

function profileRecordToDraft(profile, athlete) {
  return {
    coach_user_id: state.profile?.coachUserId ?? "",
    athlete_user_id: athlete.userId,
    expected_current_record_sha256:
      typeof profile?.record_sha256 === "string"
        ? profile.record_sha256
        : null,
    preferred_weight_unit: profile?.preferred_weight_unit === "lb" ? "lb" : "kg",
    load_rounding_increment: Number(
      profile?.load_rounding_increment ??
      (profile?.preferred_weight_unit === "lb" ? 5 : 2.5)
    ),
    bodyweight: profile?.bodyweight === null || typeof profile?.bodyweight === "undefined"
      ? ""
      : Number(profile.bodyweight),
    bodyweight_unit: profile?.bodyweight_unit === "lb" ? "lb" : "kg",
    strength_reference_lifecycle:
      profile?.strength_reference_lifecycle ??
      null,
    benchmarks: Array.isArray(profile?.benchmarks)
      ? profile.benchmarks.map((benchmark) => ({
          benchmark_id: String(benchmark.benchmark_id ?? ""),
          exercise_id: String(benchmark.exercise_id ?? ""),
          value: Number(benchmark.value ?? 0),
          unit: benchmark.unit === "lb" ? "lb" : "kg",
          basis: ["tested_1rm", "estimated_1rm", "training_max"].includes(benchmark.basis)
            ? benchmark.basis
            : "tested_1rm",
          effective_date: String(benchmark.effective_date ?? new Date().toISOString().slice(0, 10)),
          source_note: String(benchmark.source_note ?? ""),
          replaces_reference_id:
            String(
              benchmark.replaces_reference_id ??
              ""
            ),
          persisted: true
        }))
      : []
  };
}

function renderAthleteProfileEditor() {
  const athlete = state.coachAthletes.find(
    (entry) => entry.userId === state.selectedCoachAthleteId
  );
  const draft = state.athleteProfileDraft;

  if (!athlete || !draft) {
    elements.athleteProfilePanel.hidden = true;
    return;
  }

  elements.athleteProfilePanel.hidden = false;
  elements.athleteProfileHeading.textContent = athlete.displayName;
  elements.athleteProfileActivity.textContent = athlete.activityId ? titleCase(athlete.activityId) : "Sport not set";
  // NOTE: the preferred-unit/rounding/bodyweight/benchmark editor and the
  // assignment-from-profile form below this header are both React-owned
  // now (public/app-src/screens/coach/AthleteStrengthProfilePanel.tsx/
  // AthleteProfileAssignmentPanel.tsx, mounted into
  // #athlete-profile-editor-root/#athlete-profile-assignment-root) - each
  // independently fetches and saves its own data. See openAthleteProfile's
  // kolosseum:coach-athlete-profile-opened dispatch and this file's
  // kolosseum:coach-athlete-profile-updated listener for the two-way bridge.
  renderAthleteDetail();
  elements.athleteProfilePanel.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function loadAthleteProfile(athleteUserId, options = {}) {
  const athlete = state.coachAthletes.find((entry) => entry.userId === athleteUserId);
  if (!athlete) throw new Error("Select a connected athlete.");

  if (!options.quiet) showBusy("Loading athlete profile…");

  try {
    const response = await api(
      "GET",
      `/coach-workspace/athlete-strength-profile?coach_user_id=${encodeURIComponent(state.profile.coachUserId)}&athlete_user_id=${encodeURIComponent(athleteUserId)}`
    );

    if (response.profile) {
      state.athleteProfiles[athleteUserId] = response.profile;
    }
    else {
      delete state.athleteProfiles[athleteUserId];
    }

    saveState();
    return response.profile ?? null;
  }
  finally {
    if (!options.quiet) hideBusy();
  }
}

// FULL-UI-04B factual athlete detail and history.
// Records are server-authoritative and read-only except for explicit,
// non-binding coach-note creation.

function athleteDetailFor(
  athleteUserId
) {
  const detail =
    state.athleteDetails?.[
      athleteUserId
    ];

  return (
    detail &&
    typeof detail === "object"
  )
    ? detail
    : null;
}

function renderAthleteDetail() {
  const athleteUserId =
    state.selectedCoachAthleteId;

  const athlete =
    state.coachAthletes.find(
      (entry) =>
        entry.userId === athleteUserId
    );

  const detail =
    athleteDetailFor(
      athleteUserId
    );

  if (
    !athlete ||
    !detail ||
    !elements.athleteDetailHistoryPanel
  ) {
    if (
      elements.athleteDetailHistoryPanel
    ) {
      elements
        .athleteDetailHistoryPanel
        .hidden = true;
    }

    return;
  }

  elements.athleteDetailHistoryPanel
    .hidden = false;

  const assignments =
    Array.isArray(
      detail.assignment_history
    )
      ? detail.assignment_history
      : [];

  const strengthProfiles =
    Array.isArray(
      detail.strength_profile_history
    )
      ? detail.strength_profile_history
      : [];

  const bodyweights =
    Array.isArray(
      detail.bodyweight_history
    )
      ? detail.bodyweight_history
      : [];

  const eventLinks =
    Array.isArray(
      detail.event_link_history
    )
      ? detail.event_link_history
      : [];

  const sessions =
    Array.isArray(
      detail.session_history
    )
      ? detail.session_history
      : [];

  const notes =
    Array.isArray(
      detail.note_history
    )
      ? detail.note_history
      : [];

  elements.athleteDetailAssignmentCount
    .textContent =
      String(assignments.length);

  elements.athleteDetailStrengthCount
    .textContent =
      String(strengthProfiles.length);

  elements.athleteDetailBodyweightCount
    .textContent =
      String(bodyweights.length);

  elements.athleteDetailEventCount
    .textContent =
      String(eventLinks.length);

  elements.athleteDetailSessionCount
    .textContent =
      String(sessions.length);

  elements.athleteDetailNoteCount
    .textContent =
      String(notes.length);

  // NOTE: current-programme, current-event, and the assignment/strength/
  // bodyweight/event-link/session history lists moved to React (see
  // public/app-src/screens/coach/AthleteHistoryPanels.tsx, mounted into
  // #athlete-history-current-programme-root,
  // #athlete-history-current-event-root, #athlete-history-assignment-root,
  // #athlete-history-strength-root, #athlete-history-bodyweight-root,
  // #athlete-history-event-link-root and #athlete-history-session-root) -
  // each independently fetches GET /coach-workspace/athlete-detail and
  // reads out only its own field(s). `assignments`/`strengthProfiles`/
  // `bodyweights`/`eventLinks`/`sessions`/`notes` above are still used for
  // the metric-card counts and the status line just below. Session
  // history's "Review" action dispatches kolosseum:open-session-review -
  // see this file's listener for that event for how it replicates the
  // legacy bindAthleteDetailActions() behaviour that button used to
  // trigger. Its "Add note" action dispatches
  // kolosseum:open-session-note-form, which React now owns end to end
  // (see useAthleteCoachNotes.ts) - no listener for it lives in this file.

  // NOTE: the coach-notes history list AND creation form both moved to
  // React (AthleteCoachNotesPanel.tsx/useAthleteCoachNotes.ts, mounted
  // into #athlete-coach-notes-root) - the list independently fetches GET
  // /coach-workspace/athlete-detail and reads out only note_history.
  // `notes` (from detail.note_history above) is still used for the status
  // line's count just below.

  elements.athleteDetailStatus
    .textContent =
      `${sessions.length} session${sessions.length === 1 ? "" : "s"} · ${notes.length} note${notes.length === 1 ? "" : "s"}`;
}

async function refreshAthleteDetail(
  athleteUserId,
  options = {}
) {
  if (
    !athleteUserId ||
    !state.profile?.coachUserId
  ) {
    return null;
  }

  if (!options.quiet) {
    showBusy(
      "Loading athlete detail…"
    );
  }

  if (
    elements.athleteDetailStatus
  ) {
    elements.athleteDetailStatus
      .textContent =
        "Loading persisted athlete records…";
  }

  try {
    const response =
      await api(
        "GET",
        `/coach-workspace/athlete-detail?coach_user_id=${encodeURIComponent(
          state.profile.coachUserId
        )}&athlete_user_id=${encodeURIComponent(
          athleteUserId
        )}`
      );

    state.athleteDetails ??= {};
    state.athleteDetails[
      athleteUserId
    ] = response.detail ?? null;

    saveState();
    renderAthleteDetail();

    if (!options.quiet) {
      showNotice(
        "Athlete detail refreshed."
      );
    }

    return response.detail ?? null;
  }
  catch (error) {
    if (
      elements.athleteDetailStatus
    ) {
      elements.athleteDetailStatus
        .textContent =
          "Athlete detail could not be loaded.";
    }

    throw error;
  }
  finally {
    if (!options.quiet) {
      hideBusy();
    }
  }
}

// DEV NOTE: the athlete's own progress-photo upload/history/compare panel
// moved to React (AthleteSelfProgressPhotosPanel.tsx into
// #athlete-self-progress-photos-root - see useAthleteProgressPhotosSelf.ts,
// which independently fetches GET /progress-photos and POSTs uploads to
// the same route via a one-off multipart fetch in
// athleteProgressPhotosClient.ts, since api/transport.ts's request()
// helper is JSON-only). Compare-selection moved from the shared,
// localStorage-persisted state.progressPhotoCompareIds to local React
// state, matching the simplification the coach mirror already made.

// NOTE: the coach-side progress-photos mirror (read-only grid + two-photo
// compare) moved to React (AthleteProgressPhotosPanel.tsx, mounted into
// #athlete-progress-photos-root) - it independently fetches
// GET /progress-photos/coach/:athlete_user_id and owns its own compare
// selection as local component state, rather than a shared state[stateKey]
// array. No coach-facing upload/delete route exists anywhere in this file.

// DEV NOTE: the athlete's own body-measurement log form/history
// (AthleteSelfBodyMetricsPanel.tsx) and nutrition log form/summary
// (AthleteSelfNutritionPanel.tsx) both moved to React, each independently
// fetching its own GET /body-metrics rather than sharing the old
// refreshBodyMetrics()/state.bodyMetricEntries plumbing - see
// useAthleteBodyMetricsSelf.ts and useAthleteNutritionSelf.ts.
// BODY_METRIC_TYPE_LABELS/NUTRITION_METRIC_TYPES/METRIC_UNIT_SUFFIX moved
// to public/app-src/utils/format.ts (already shared with the coach mirrors
// below), since nutrition was the last app.js consumer of the app.js
// copies.

// NOTE: the coach-side body-metric history + log form and the nutrition
// summary both moved to React (AthleteBodyMetricsPanel.tsx into
// #athlete-body-metrics-root, AthleteNutritionPanel.tsx into
// #athlete-nutrition-root) - they independently fetch
// GET /body-metrics/coach/:athlete_user_id, and the body-metrics panel
// POSTs new entries to the same route. No reverse-bridge event is needed:
// nothing else in legacy read state.coachAthleteBodyMetricEntries besides
// the rendering this replaced.

// DEV NOTE: both the athlete's own habit create/complete/archive panel
// (AthleteSelfHabitsPanel.tsx into #athlete-self-habits-root, see
// useAthleteHabitsSelf.ts) and the coach's read-only mirror
// (AthleteHabitsPanel.tsx into #athlete-habits-root, see
// useAthleteHabits.ts) moved to React. Habit streak counts
// (current_streak_length/longest_streak_length/total_completions) arrive
// pre-computed on every habit record from GET /habits -
// computeHabitStreak() runs server-side only (see
// bodyMetricsAndHabitsLifecycle.mjs) and was never ported; both panels
// just render the integers verbatim, same as this file used to.

// A goal's current_value/progress_percentage/is_goal_met are computed
// server-side on every request from the athlete's own body-metric entries
// - nothing here is stored. status changes only via an explicit resolve
// call from the athlete; it is never inferred from computed progress.
// NOTE: FULL-UI-37 the athlete's own goal-setting panel is React-owned now
// (see public/app-src/screens/athlete/AthleteSelfGoalsPanel.tsx, mounted
// into athlete-self-goals-root) - it independently fetches
// GET /athlete-goals and calls POST /athlete-goals|:goal_id/resolve itself
// with its own CSRF token, so it needs no reverse bridge.
// NOTE: the coach-side goals mirror moved to React (AthleteGoalsPanel.tsx,
// mounted into #athlete-goals-root) - it independently fetches
// GET /athlete-goals/coach/:athlete_user_id. Read-only, so no event bridge
// back into legacy state.

// NOTE: FULL-UI-64 the athlete's own weekly check-in form is React-owned
// now (see public/app-src/screens/athlete/AthleteSelfWeeklyCheckinsPanel.tsx,
// mounted into athlete-self-weekly-checkins-root) - it independently
// fetches GET/POST /weekly-checkins and listens for
// kolosseum:history-changed, so it needs no reverse bridge.
// NOTE: the coach-side weekly-checkins mirror moved to React
// (AthleteWeeklyCheckinsPanel.tsx, mounted into
// #athlete-weekly-checkins-root) - it independently fetches
// GET /weekly-checkins/coach/:athlete_user_id. Read-only, like the
// progress-insights mirror, so no event bridge back into legacy state.

// NOTE: FULL-UI-36 the athlete's own progress insights panel is React-owned
// now (see public/app-src/screens/athlete/AthleteSelfProgressInsightsPanel
// .tsx, mounted into athlete-self-progress-insights-root) - it
// independently fetches GET /progress-insights and listens for
// kolosseum:history-changed, so it needs no reverse bridge.
// NOTE: the coach-side progress-insights mirror moved to React
// (AthleteProgressInsightsPanel.tsx, mounted into
// #athlete-progress-insights-root) - it independently fetches
// GET /progress-insights/coach/:athlete_user_id. This panel is read-only
// (no coach write path), so unlike the strength-profile editor it needs no
// event bridge back into legacy state.

// NOTE: FULL-UI-31 the athlete's own device sync panel is React-owned now
// (see public/app-src/screens/athlete/AthleteSelfDeviceSyncPanel.tsx,
// mounted into athlete-self-device-sync-root) - it independently fetches
// GET /device-sync/connections and /device-sync/metrics, and calls
// POST /device-sync/connect|disconnect itself with its own CSRF token, so
// it needs no reverse bridge.
// NOTE: the coach-side device-sync mirror moved to React
// (AthleteDeviceSyncPanel.tsx, mounted into #athlete-device-sync-root) - it
// independently fetches GET /device-sync/connections/coach/:athlete_user_id
// and GET /device-sync/metrics/coach/:athlete_user_id. Read-only (device
// connect/disconnect are athlete-self only), so no event bridge back into
// legacy state, and its card never renders a Disconnect control since a
// coach has no route to take that action.

// DEV NOTE: the "Message this athlete" 1:1 widget (refreshCoachAthleteMessages/
// renderCoachAthleteMessages/openComposeAthleteMessagePanel/
// closeComposeAthleteMessagePanel/confirmSendAthleteMessage) moved to React -
// see CoachAthleteMessagePanel.tsx/useCoachAthleteMessages.ts, mounted into
// #coach-athlete-message-root. handleMessagingSocketPayload()'s coach
// branch above now dispatches kolosseum:coach-athlete-message-received
// instead of calling the removed renderCoachAthleteMessages() directly.

async function openAthleteProfile(athleteUserId) {
  await loadTemplateExercises();

  const athlete =
    state.coachAthletes.find(
      (entry) =>
        entry.userId === athleteUserId
    );

  if (!athlete) {
    throw new Error(
      "Select an accepted connected athlete."
    );
  }

  // Reset the athlete-detail tab group to its default tab whenever a
  // profile is opened, so reviewing several athletes in a row always
  // starts from the same view instead of inheriting whichever tab the
  // previously-viewed athlete was left on.
  document
    .querySelector('.section-tabs[data-tab-group="athlete-detail"] .section-tab[data-tab-target="training-log"]')
    ?.click();

  closeAthleteRelationshipDetail();

  const profile =
    await loadAthleteProfile(
      athleteUserId
    );

  state.selectedCoachAthleteId =
    athleteUserId;

  state.athleteProfileDraft =
    profileRecordToDraft(
      profile,
      athlete
    );

  // NOTE: React's strength-profile editor (AthleteStrengthProfilePanel.tsx)
  // fetches independently of the legacy refreshes below - dispatch this as
  // early as possible so both fetches run in parallel.
  document.dispatchEvent(
    new CustomEvent("kolosseum:coach-athlete-profile-opened", {
      detail: { athlete_user_id: athleteUserId }
    })
  );

  await refreshAthleteDetail(
    athleteUserId,
    {
      quiet: true
    }
  );

  saveState();
  renderAthleteProfileEditor();
}

export function closeAthleteProfile() {
  document.dispatchEvent(new CustomEvent("kolosseum:coach-athlete-profile-closed"));
  state.selectedCoachAthleteId = "";
  state.athleteProfileDraft = null;
  state.coachAthleteProgressPhotos = [];
  state.coachAthleteBodyMetricEntries = [];
  saveState();
  elements.athleteProfilePanel.hidden = true;

  if (
    elements.athleteDetailHistoryPanel
  ) {
    elements.athleteDetailHistoryPanel
      .hidden = true;
  }
}

// NOTE: benchmark add/remove/save moved to React
// (AthleteStrengthProfilePanel.tsx) - see the
// kolosseum:coach-athlete-profile-updated listener below for how this
// legacy module learns about a React-driven save.

// DEV NOTE: the standalone, unreachable #view-assign view (no nav button,
// no route, no data-view="assign" trigger anywhere) and everything that
// exclusively rendered into it - requiredOneRmExerciseIds/
// renderAssignmentEventSummary/renderAssignmentRequirements/
// refreshAssignmentAthleteProfile/renderAssignmentTemplateOptions/
// renderCoachSelectors/recordAssignment/cancelAssignmentForAthlete - are
// gone. The live profile-embedded assignment form (React,
// AthleteProfileAssignmentPanel.tsx/useAthleteProfileAssignment.ts) already
// covers the same feature; it reuses the shared
// compareProgrammeStrengthRequirements from strengthReferenceLifecycle.mjs
// rather than requiredOneRmExerciseIds. exerciseDisplayName() (formerly
// here, used by the programme-builder preview) moved to programmeDraft.ts
// once the preview itself moved to CoachProgrammePreviewPanel.tsx - it had
// zero remaining callers here.
// assignmentRecordsForAthlete/currentAssignmentForAthlete/
// assignmentTemplateRecord/assignmentTemplateName/Version/
// assignmentStateBadge/assignmentHistoryCards/renderAssignmentCurrent/
// renderAssignmentLifecycleSurfaces are gone too - refreshCoachAssignments()
// was their only remaining live caller and no longer calls them;
// state.coachAssignments (which it still populates) is read directly by
// the React AthleteProfileAssignmentPanel and by the Coach Dashboard.

// FULL-UI-03 factual coach dashboard.
// Dashboard records are derived from server-authoritative coach,
// assignment, event and artefact responses. No readiness,
// recommendation, ranking or engine mutation is produced.

function bindCoachDashboardActions() {
  for (
    const button of
    document.querySelectorAll(
      "[data-dashboard-action]"
    )
  ) {
    button.addEventListener(
      "click",
      async () => {
        const action =
          button.dataset.dashboardAction;

        const athleteUserId =
          button.dataset.athleteId ?? "";

        if (action === "open-athlete") {
          setView("athletes");

          await openAthleteProfile(
            athleteUserId
          );

          return;
        }

        if (action === "open-programmes") {
          setView("templates");
        }
      }
    );
  }
}

// DEV NOTE: FULL-UI-03 Coach Overview dashboard - all five record-list
// panels (Connected athletes, Action queue, Open sessions, Completed since
// review, Upcoming events) AND the metric-count strip above them are React
// now - see CoachOverviewAthletesPanel.tsx/CoachOverviewAssignmentsPanel.tsx/
// CoachOverviewSessionReviewPanel.tsx/CoachOverviewEventsPanel.tsx/
// CoachOverviewMetricsPanel.tsx (mounted into #coach-overview-athletes-root/
// #coach-overview-assignments-root/#coach-overview-open-sessions-root/
// #coach-overview-review-queue-root/#coach-overview-events-root/
// #coach-overview-metrics-root). Each independently fetches its own data
// and refetches on the kolosseum:coach-overview-changed dispatch below.
// Only the dashboard status line (elements.coachDashboardStatus, driven by
// state.coachDashboardFailures/coachDashboardUpdatedAt) stays legacy - see
// refreshCoachDashboard()'s own artefact-fan-out failure tracking below,
// which this function's status-line branch still reads.
export function renderCoachDashboard() {
  document.dispatchEvent(
    new CustomEvent("kolosseum:coach-overview-changed")
  );

  bindCoachDashboardActions();

  const failures =
    Array.isArray(
      state.coachDashboardFailures
    )
      ? state.coachDashboardFailures
      : [];

  if (failures.length > 0) {
    elements.coachDashboardStatus.textContent =
      `Dashboard refreshed with ${failures.length} unavailable athlete record set${failures.length === 1 ? "" : "s"}. Available factual records are shown.`;

    elements.coachDashboardStatus.classList.add(
      "dashboard-status-warning"
    );
  }
  else if (state.coachDashboardUpdatedAt) {
    elements.coachDashboardStatus.textContent =
      `Dashboard refreshed ${formatDate(state.coachDashboardUpdatedAt)}.`;

    elements.coachDashboardStatus.classList.remove(
      "dashboard-status-warning"
    );
  }
}

export async function refreshCoachDashboard(
  options = {}
) {
  if (
    state.role !== "coach" ||
    !state.profile?.coachUserId
  ) {
    return;
  }

  if (!options.quiet) {
    showBusy(
      "Refreshing coach dashboard…"
    );
  }

  elements.coachDashboardStatus.textContent =
    "Refreshing factual coach records…";

  try {
    const refreshers = [];

    if (
      typeof refreshCoachAthletes ===
      "function"
    ) {
      refreshers.push(
        refreshCoachAthletes({
          quiet: true
        })
      );
    }

    if (
      typeof refreshCoachAssignments ===
      "function"
    ) {
      refreshers.push(
        refreshCoachAssignments({
          quiet: true
        })
      );
    }

    if (
      typeof refreshCoachEvents ===
      "function"
    ) {
      refreshers.push(
        refreshCoachEvents({
          quiet: true
        })
      );
    }

    if (
      typeof refreshTemplates ===
      "function"
    ) {
      refreshers.push(
        refreshTemplates({
          quiet: true
        })
      );
    }

    await Promise.all(refreshers);

    // No per-athlete fan-out: this used to POST /sessions/beta-coach-artefacts
    // once per connected athlete (about 3 times per page load) only to count
    // "unavailable" records for this status line - 149 requests and ~11s of
    // server time for a coach with 50 athletes (walkthrough 16). Each
    // Overview panel fetches its own data in one request and shows its own
    // error, so the line just says when the dashboard was refreshed.
    state.coachDashboardFailures = [];

    state.coachDashboardUpdatedAt =
      nowIso();

    saveState();
    renderCoachDashboard();

    if (!options.quiet) {
      showNotice(
        "Coach dashboard refreshed."
      );
    }
  }
  finally {
    if (!options.quiet) {
      hideBusy();
    }
  }
}

// DEV NOTE: the dashboard metric strip this function used to write
// (coachAthleteCount/coachAssignmentCount/coachArtefactCount) is React now
// too - see CoachOverviewMetricsPanel.tsx, which refetches on the
// kolosseum:coach-overview-changed dispatch below like everything else in
// this function's caller chain.
export function renderCoachWorkspace() {
  renderCoachAthleteDirectory();

  // NOTE: the "Connected athletes" dashboard panel is React now (see
  // public/app-src/screens/coach/CoachOverviewAthletesPanel.tsx) - notify
  // it the same way renderCoachDashboard() does, since this function is
  // also called after a relationship mutation and after an athlete
  // strength-profile save (kolosseum:coach-athlete-profile-updated), both
  // of which can change what that panel shows.
  document.dispatchEvent(
    new CustomEvent("kolosseum:coach-overview-changed")
  );

  if (
    state.selectedCoachAthleteId &&
    state.athleteProfileDraft
  ) {
    renderAthleteProfileEditor();
  }
}
export async function refreshCoachEvents(options = {}) {
  if (state.role !== "coach" || !state.profile?.coachUserId) return [];
  if (!options.quiet) showBusy("Loading events…");

  try {
    const response = await api(
      "GET",
      `/coach-workspace/events?coach_user_id=${encodeURIComponent(state.profile.coachUserId)}`
    );

    state.coachEvents = Array.isArray(response.events) ? response.events : [];
    saveState();
    renderCoachEvents();

    return state.coachEvents;
  }
  finally {
    if (!options.quiet) hideBusy();
  }
}

// NOTE: the event library (metric counts + event card list) AND the
// create-event form moved to React - see
// public/app-src/screens/coach/CoachEventsLibraryPanel.tsx/
// CoachEventCreatePanel.tsx, mounted into #coach-events-metrics-root,
// #coach-events-list-root and #coach-event-create-root. All three
// independently fetch GET /coach-workspace/events and refetch on the
// kolosseum:coach-events-changed dispatch just below.
export function renderCoachEvents() {
  document.dispatchEvent(
    new CustomEvent("kolosseum:coach-events-changed")
  );
}

elements.coachDashboardRefreshButton.addEventListener("click", () => {
  refreshCoachDashboard().catch(handleError);
});

elements.refreshEventsButton.addEventListener("click", () => {
  refreshCoachEvents().catch(handleError);
});

elements.closeAthleteProfileButton.addEventListener("click", closeAthleteProfile);

// DEV NOTE: React owns the strength-profile editor now (see
// public/app-src/screens/coach/AthleteStrengthProfilePanel.tsx) - this
// bridge keeps the still-legacy assignment-eligibility and athlete-detail
// sub-panels (siblings within #athleteProfilePanel) in sync after a
// React-driven save, mirroring the old saveOpenAthleteProfile's post-save
// side effects.
document.addEventListener(
  "kolosseum:coach-athlete-profile-updated",
  (event) => {
    const athleteUserId = event.detail?.athlete_user_id;
    const profile = event.detail?.profile;
    const athlete = state.coachAthletes.find((entry) => entry.userId === athleteUserId);
    if (!athlete || !profile) return;

    state.athleteProfiles[athleteUserId] = profile;
    state.athleteProfileDraft = profileRecordToDraft(profile, athlete);
    saveState();

    refreshAthleteDetail(athleteUserId, { quiet: true }).then(() => {
      renderAthleteProfileEditor();
      renderCoachWorkspace();
    }).catch(handleError);
  }
);

// DEV NOTE: React owns the session-history list now (see
// public/app-src/screens/coach/AthleteHistoryPanels.tsx's
// AthleteSessionHistoryList) - its "Review" button reaches into legacy-only
// navigation (setView), so it dispatches this event instead of the
// data-athlete-detail-action delegation bindAthleteDetailActions() used to
// provide. Behaviour is otherwise unchanged from what that removed
// function did. Its "Add note" button dispatches
// kolosseum:open-session-note-form too, but that one's no longer heard
// here - React owns the whole compose form now (see
// useAthleteCoachNotes.ts, which listens for it directly).
//
// kolosseum:open-session-review's own athlete-filter/data-loading half
// moved to React too (CoachReviewPanel.tsx/useCoachReview.ts, which
// listens for this same event independently) - this listener now only
// owns navigation, which stays legacy.
document.addEventListener(
  "kolosseum:open-session-review",
  (event) => {
    const athleteUserId = event.detail?.athlete_user_id;
    if (!athleteUserId) return;

    setView("review");
  }
);

// DEV NOTE: React owns the athlete directory now (see
// public/app-src/screens/coach/AthleteDirectoryPanel.tsx) - its "Open
// profile" button can't reuse the old bindCoachAthleteActions() (a
// function that bound listeners imperatively after each legacy render and
// never re-ran against React output, since fully removed once the
// dashboard's "Connected athletes" card - its last remaining consumer -
// also moved to React), so it dispatches this event instead. Behaviour is
// otherwise identical to what that binder's click handler used to do.
// CoachOverviewAssignmentsPanel.tsx's "Open profile" button
// (the dashboard's action-queue card) dispatches this same event with an
// extra focus_assignment flag, preserving the scroll-to-assignment-panel
// nicety bindCoachDashboardActions()'s removed "open-assignment" branch
// used to provide - default behaviour (no scroll) is unchanged for every
// other dispatcher.
document.addEventListener(
  "kolosseum:open-athlete-profile-request",
  (event) => {
    const athleteUserId = event.detail?.athlete_user_id;
    if (!athleteUserId) return;

    setView("athletes");
    openAthleteProfile(athleteUserId)
      .then(() => {
        if (!event.detail?.focus_assignment) return;

        document.getElementById("athlete-profile-assignment-root")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      })
      .catch(handleError);
  }
);

// FULL-UI-04A relationship directory event wiring.
elements.refreshAthleteDirectoryButton
  ?.addEventListener(
    "click",
    () => {
      refreshCoachAthletes()
        .catch(
          catchWithViewRetry(
            elements.athleteDirectoryStatus,
            () => refreshCoachAthletes(),
            "Athlete directory could not be loaded."
          )
        );
    }
  );

// The "View audit" button lives in the already-React AthleteDirectoryPanel.
// tsx and the "Open training profile"/revoke/cancel controls live in the
// also-React AthleteRelationshipDetailPanel.tsx now - this global click
// delegation (not scoped to legacy-rendered DOM) is what lets a
// data-relationship-action='audit' button rendered by either stack open
// the audit panel unchanged.
document.addEventListener(
  "click",
  (event) => {
    const button =
      event.target.closest(
        "[data-relationship-action='audit']"
      );

    if (!button) return;

    openAthleteRelationshipDetail(
      button.dataset.relationshipAthleteId
    );
  }
);

// FULL-UI-04B athlete-detail controls.
elements.athleteDetailRefreshButton
  ?.addEventListener(
    "click",
    () => {
      refreshAthleteDetail(
        state.selectedCoachAthleteId
      ).catch(handleError);
    }
  );
