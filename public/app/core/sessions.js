import { loadAthleteOnboardingState, loadCurrentAthleteDeclaration } from "../account_ui.js";
import { api } from "./api.js";
import { elements } from "./elements.js";
import { nowIso } from "./format.js";
import { handleError, hideBusy, showBusy, showNotice } from "./notices.js";
import { setView } from "./shell.js";
import { saveState, state } from "./state.js";

function countsFromSession(sessionState) {
  return {
    completed: Array.isArray(sessionState?.completed_exercises) ? sessionState.completed_exercises : [],
    remaining: Array.isArray(sessionState?.remaining_exercises) ? sessionState.remaining_exercises : [],
    dropped: Array.isArray(sessionState?.dropped_exercises) ? sessionState.dropped_exercises : []
  };
}

function upsertLocalSession(sessionId, patch = {}) {
  const existingIndex = state.localSessions.findIndex((session) => session.session_id === sessionId);
  const existing = existingIndex >= 0 ? state.localSessions[existingIndex] : {
    session_id: sessionId,
    block_id: "",
    status: "planned",
    assignment_id: null,
    runtime_event_count: 0,
    created_at: nowIso(),
    updated_at: nowIso()
  };

  const next = {
    ...existing,
    ...patch,
    session_id: sessionId,
    updated_at: patch.updated_at ?? nowIso()
  };

  if (existingIndex >= 0) state.localSessions.splice(existingIndex, 1, next);
  else state.localSessions.push(next);

  saveState();
  return next;
}

function sessionClassification(sessionState) {
  const counts = countsFromSession(sessionState);
  const total = counts.completed.length + counts.remaining.length + counts.dropped.length;

  if (sessionState?.current_step?.type === "RETURN_DECISION") {
    return { label: "Return decision", className: "active", key: "return" };
  }

  if (total > 0 && counts.remaining.length === 0 && counts.dropped.length > 0) {
    return { label: "Partially completed", className: "partial", key: "partial" };
  }

  if (total > 0 && counts.remaining.length === 0) {
    return { label: "Completed", className: "complete", key: "complete" };
  }

  if (sessionState?.started === true) {
    return { label: "In progress", className: "active", key: "active" };
  }

  return { label: "Planned", className: "neutral", key: "planned" };
}

// Session creation must compile against the athlete's CURRENT declaration,
// not the one cached at bootstrap - a same-tab activity change (see
// useAthleteOnboarding.ts's changeActivity()) never re-runs
// bootstrapApplication(), so without this the next session was silently
// built for the previous sport.
async function declaredCompetitionEvent() {
  try {
    const onboarding = await loadAthleteOnboardingState();
    return onboarding?.current_effective_declaration?.fields?.competition_event ?? null;
  }
  catch {
    return null;
  }
}

async function refreshAthleteDeclaration() {
  const current = await loadCurrentAthleteDeclaration();

  state.declarationRecord =
    current.declaration_record ??
    state.declarationRecord;

  state.phase1Input =
    current.phase1_input ??
    state.phase1Input;

  state.profile.activityId =
    state.phase1Input?.activity_id ??
    null;

  saveState();
}

async function createSession(options = {}) {
  showBusy("Checking your declaration…");

  try {
    await refreshAthleteDeclaration();
  }
  finally {
    hideBusy();
  }

  // A missing/activity-less phase1Input is a real, supported state (sport
  // is optional at signup, declarable later) - but compile's own rejection
  // of it surfaces only as a generic "request could not be completed"
  // error, with no hint that the fix is to declare an activity. Check
  // proactively instead of letting a doomed compile call be the first
  // sign anything is wrong.
  if (!state.phase1Input?.activity_id) {
    showNotice(
      "Declare a training activity before starting a session.",
      "error"
    );
    document.getElementById("athleteOnboardingNav")?.click();
    return;
  }

  // Training level is required (no silent default): athletes who onboarded
  // before levels existed declare it once, via Edit preferences, before their
  // next session - the declared level selects their programme.
  if (!state.phase1Input?.experience_level) {
    showNotice(
      "Choose your training level (Beginner, Amateur or Pro) in Edit preferences before starting a session.",
      "error"
    );
    document.getElementById("athleteOnboardingNav")?.click();
    return;
  }

  // Powerlifters also declare their competition event, which selects the
  // programme (full power, bench only, deadlift only, push-pull, squat only).
  // "Not competing" is declared but never reaches the engine (they get the
  // full power programme), so check the declaration itself before refusing.
  if (state.phase1Input?.activity_id === "powerlifting" && !state.phase1Input?.competition_event &&
      !(await declaredCompetitionEvent())) {
    showNotice(
      "Choose your competition event (Full power, Bench only, Deadlift only, Push-pull, Squat only or Not competing) in Edit preferences before starting a session.",
      "error"
    );
    document.getElementById("athleteOnboardingNav")?.click();
    return;
  }

  showBusy("Creating session…");

  try {
    // A freshly-resolved coach id from the server-authoritative Today state
    // always wins over the older, potentially-stale coachCode cache - this
    // is what actually decides whose assignment the next session comes from.
    const coachUserId = state.athleteToday?.coach_user_id || state.coachCode;

    const body = coachUserId
      ? {
          phase1_input: state.phase1Input,
          beta_user_id: state.profile.userId,
          beta_coach_user_id: coachUserId
        }
      : {
          phase1_input: state.phase1Input,
          beta_path_context: {
            auth_record: state.authRecord,
            acknowledgement_record: state.acknowledgementRecord,
            declaration_record: state.declarationRecord
          },
          // A self-coached athlete with no week: what they chose to train today.
          ...(Array.isArray(options.todays_exercises) ? { todays_exercises: options.todays_exercises } : {})
        };

    let response;
    try {
      response = await api(
        "POST",
        "/blocks/compile?create_session=true&beta_path=true",
        body
      );
    }
    catch (error) {
      // Self-directed sessions are periodised from the athlete's training plan;
      // athletes who onboarded before plans existed declare one first.
      if (error?.payload?.error === "training_plan_required") {
        showNotice(
          "Set your training plan (days per week, and your season or competition dates) in Edit preferences before starting a session.",
          "error"
        );
        document.getElementById("athleteOnboardingNav")?.click();
        return;
      }
      // The athlete chooses their own exercise for every open slot of the
      // programme (only competition lifts are named); a session never starts
      // with a default in an empty slot.
      const phase4Token = error?.payload?.details?.failure_token;
      if (phase4Token === "exercise_selection_required" || phase4Token === "exercise_selection_invalid") {
        showNotice(
          "Choose your exercises for this session in Your programme exercises before starting it.",
          "error"
        );
        document.getElementById("athleteOnboardingNav")?.click();
        return;
      }
      // An open pain flag is never trained through silently: the athlete
      // answers "how is it now?" before a session that loads the same area.
      // Kolosseum programmes suit this athlete: they choose one before training.
      if (error?.payload?.error === "programme_required") {
        showNotice("Choose your programme to start training - it's under Your programme.", "error");
        document.getElementById("athleteOnboardingNav")?.click();
        return;
      }
      // The athlete has finished their Kolosseum programme: choose the next one.
      if (error?.payload?.error === "programme_complete") {
        showNotice(`You've finished ${error.payload.details?.programme_title || "your programme"} - choose your next programme in Your programme.`, "error");
        document.getElementById("athleteOnboardingNav")?.click();
        return;
      }
      if (error?.payload?.details?.failure_token === "todays_exercises_invalid") {
        showNotice("Choose an exercise for every row, with 1-8 sets and 1-30 reps, and each exercise once.", "error");
        return;
      }
      if (phase4Token === "pain_check_in_required") {
        showNotice("You reported pain last time. Check in on how it is now before this session.", "error");
        document.getElementById("athleteOnboardingNav")?.click();
        // The check-in sits well down that page on a phone: take them to it
        // once it has loaded (it fetches its own pain flags).
        let tries = 0;
        const scrollToCheckIn = () => {
          const card = document.querySelector('[data-testid="pain-check-in"]');
          if (card) {
            window.scrollTo({ top: Math.max(0, card.getBoundingClientRect().top + window.scrollY - 80), behavior: "smooth" });
            return;
          }
          tries += 1;
          if (tries < 20) window.setTimeout(scrollToCheckIn, 200);
        };
        window.setTimeout(scrollToCheckIn, 300);
        return;
      }
      if (phase4Token === "medical_stand_down") {
        const until = error?.payload?.details?.details?.until_date ?? "";
        if (error?.payload?.details?.details?.reason === "head_injury") {
          showNotice("You're stood down after a head injury: no sessions until a medical professional has cleared you. Once they have, confirm it in Training details, under Medical stand-down.", "error");
          return;
        }
        showNotice(`You are stood down from training${until ? ` until ${until}` : ""}. Follow your medical professional's return-to-play plan.`, "error");
        return;
      }
      if (phase4Token === "injury_out") {
        const details = error?.payload?.details?.details ?? {};
        showNotice(`You're out of training with your ${details.injury || "injury"}${details.expected_return ? ` (expected back around ${details.expected_return})` : ""}. Follow your physio's plan - your sessions start again when they move you on.`, "error");
        return;
      }
      if (phase4Token === "sport_load_rest") {
        showNotice("After your match, everything in this session is jumps or heavy leg work - rest today and pick it up tomorrow.", "error");
        return;
      }
      if (phase4Token === "match_day_rest") {
        showNotice("Your match is today or tomorrow and this session is all heavy leg work - rest it, or train on another day.", "error");
        return;
      }
      if (phase4Token === "pain_session_empty") {
        showNotice("Every exercise in this session loads the area that is still sore. Rest it today, or check in pain-free if it has settled.", "error");
        document.getElementById("athleteOnboardingNav")?.click();
        return;
      }
      throw error;
    }

    state.activeSessionId = response.session_id ?? null;
    state.activeSessionState = null;

    if (state.activeSessionId) {
      upsertLocalSession(state.activeSessionId, {
        block_id: response.block_id ?? "",
        status: "planned",
        assignment_id: response.beta_path?.assignment_id ?? null,
        template_id: response.beta_path?.template_id ?? null,
        template_session_title: response.beta_path?.template_session_title ?? null,
        template_session_coaching_notes: response.beta_path?.template_session_coaching_notes ?? null,
        event_plan: response.beta_path?.event_plan ?? null,
        event_compile_summary: response.beta_path?.event_compile_summary ?? null,
        runtime_event_count: 0
      });
    }

    saveState();

    if (!state.activeSessionId) {
      throw new Error("The server did not return a session.");
    }

    await loadSessionState();
    await loadAthleteToday();
    setView("session");
    showNotice("Session created.");
  }
  finally {
    hideBusy();
  }
}

// DEV NOTE: FULL-UI-15C session execution moved to React (see
// public/app-src/screens/athlete/AthleteSessionExecutionPanel.tsx/
// useAthleteSessionExecution.ts) - it independently fetches this same
// /state endpoint and performs its own start/complete/skip/pain/RPE/
// substitution/split/return/video mutations, so postSessionEvent() and
// startSession() (the legacy mutation path) are fully retired. This
// function is trimmed to just the fetch + local-cache/notify side effects
// still needed elsewhere: loadAthleteToday() calls it directly to hydrate
// state.activeSessionState for the Today "recent activity" preview, and
// setView()'s session-view-entry branch still calls it (see below) so a
// direct navigation/deep-link to Session always has fresh data cached
// before React's own independent fetch resolves. The
// kolosseum:athlete-session-mutated listener below calls this same
// function after every React-side mutation to keep this cache in sync,
// replacing the render() call this function used to make itself.
export async function loadSessionState() {
  if (!state.activeSessionId) {
    state.activeSessionState = null;
    return null;
  }

  const sessionState = await api(
    "GET",
    `/sessions/${encodeURIComponent(state.activeSessionId)}/state`
  );

  state.activeSessionState = sessionState;

  const classification = sessionClassification(sessionState);
  upsertLocalSession(state.activeSessionId, {
    status: classification.key
  });

  saveState();
  notifyTodayChanged();
  return sessionState;
}

document.addEventListener("kolosseum:athlete-session-mutated", (event) => {
  const { session_id: sessionId, refreshHistory: shouldRefreshHistory } = event.detail ?? {};
  if (sessionId && sessionId === state.activeSessionId) {
    const local = state.localSessions.find((session) => session.session_id === sessionId);
    upsertLocalSession(sessionId, {
      runtime_event_count: Number(local?.runtime_event_count ?? 0) + 1
    });
  }
  loadSessionState().catch(handleError);
  if (shouldRefreshHistory) refreshHistory({ quiet: true }).catch(handleError);
});

// DEV NOTE: FULL-UI-15C session execution rendering/action-panel/rest-
// timer logic (hideAllActionPanels/openSkipReasonPanel family/
// confirmSkipWithReason family/renderSubstitutionResult/checkSubstitution/
// applySubstitution/openVideoFeedbackPanel/validateVideoFeedbackClientSide/
// uploadExerciseVideo/formatRestClock/playRestCompleteCue/stopRestTimer/
// startRestTimer/maybeStartRestTimer/renderExerciseFocus/
// renderExerciseQueue/renderAthleteSession/renderSessionCompletionSummary)
// all moved to React - see
// public/app-src/screens/athlete/AthleteSessionExecutionPanel.tsx and
// useAthleteSessionExecution.ts.

// DEV NOTE: FULL-UI-16C/FULL-UI-14C both the full session list/filters/
// detail (AthleteHistoryPanel.tsx, athlete-history-root) and the Today
// screen's "Recent activity" preview
// (AthleteTodayRecentActivityPanel.tsx/useAthleteTodayRecentActivity.ts,
// today-history-count-root/today-recent-activity-root) are React-owned now -
// both independently fetch beta-athlete-history themselves, so this
// function no longer needs to fetch or cache anything itself. It's kept
// only to dispatch kolosseum:history-changed, the shared signal both of
// those hooks refetch on, and to show the manual-refresh-button notice.
export async function refreshHistory(options = {}) {
  if (state.role !== "athlete") return;

  document.dispatchEvent(new CustomEvent("kolosseum:history-changed"));

  if (!options.quiet) showNotice("Training history refreshed.");
}

async function exportHistory() {
  if (state.role !== "athlete") return;

  showBusy("Preparing export…");
  try {
    const result = await api("POST", "/sessions/beta-athlete-history-export", {
      athlete_user_id: state.profile.userId
    });

    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${result.export_id || "athlete-history-export"}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    showNotice("Training history export generated.");
  }
  finally {
    hideBusy();
  }
}

// DEV NOTE: FULL-UI-14C Today screen is fully React-owned now (see
// public/app-src/screens/athlete/AthleteTodayPanel.tsx/
// AthleteTodayRecentActivityPanel.tsx, mounted into
// athlete-today-session-root/athlete-today-event-root/
// athlete-today-create-session-root/today-history-count-root/
// today-recent-activity-root) - it independently fetches beta-athlete-today,
// this session's /state and beta-athlete-history, so it needs no reverse
// bridge for reads. loadAthleteToday()/loadSessionState() below still run
// unchanged (they own state.activeSessionId, which the still-legacy Session
// screen needs) - this function is trimmed to just the dispatch those React
// panels refetch on.
function notifyTodayChanged() {
  document.dispatchEvent(new CustomEvent("kolosseum:today-changed"));
}

// Fetches the athlete's single, server-authoritative Today state. This is
// the only thing allowed to decide which session is current - it must be
// re-run on every load/refresh, never inferred from cached localStorage
// state, and its session_id always wins over whatever was last cached.
export async function loadAthleteToday() {
  if (state.role !== "athlete" || !state.profile?.userId) return null;

  try {
    const response = await api("POST", "/sessions/beta-athlete-today", {
      athlete_user_id: state.profile.userId
    });
    state.athleteToday = response;
  }
  catch {
    state.athleteToday = { state: "service_unavailable" };
  }

  const serverSessionId = state.athleteToday?.session?.session_id ?? null;

  if (serverSessionId) {
    if (state.activeSessionId !== serverSessionId) {
      state.activeSessionId = serverSessionId;
      state.activeSessionState = null;
    }
    saveState();
    if (!state.activeSessionState) {
      try {
        await loadSessionState();
      }
      catch {
        // Today can still render from the server-reported facts above even
        // if the deeper session-state fetch fails; the session view itself
        // will retry when opened.
      }
    }
  }
  else {
    // No session to continue right now - a leftover cached session id must
    // never be allowed to drive Today's next-action decision.
    state.activeSessionId = null;
    state.activeSessionState = null;
    saveState();
  }

  notifyTodayChanged();
  return state.athleteToday;
}

// DEV NOTE: the assignment-from-profile form (selectedAthleteProfileTemplate/
// Event, renderAthleteProfileAssignmentRequirements,
// renderAthleteProfileAssignment, recordAthleteProfileAssignment) moved to
// React - see public/app-src/screens/coach/AthleteProfileAssignmentPanel.tsx
// and useAthleteProfileAssignment.ts, mounted into
// #athlete-profile-assignment-root.

// FULL-UI-24: a coach invites an athlete by email, never by the athlete's
// internal user_id; the athlete accepts here by clicking a real button, never
// by typing any id.
// DEV NOTE: FULL-UI-24/25 pending coach invitations, the athlete's own
// relationships + coach messaging, org membership context (coach side),
// and the athlete's own org-owner messaging all moved to React - see
// public/app-src/screens/account/AccountCoachInvitationsPanel.tsx,
// AccountCoachRelationshipPanel.tsx, AccountOrgContextPanel.tsx and
// AccountOrgMessagesPanel.tsx (mounted into #view-account, replacing the
// five panels this file used to splice in dynamically via
// insertAdjacentElement("afterend", ...) on .two-column). Each fetches
// independently and performs its own mutations. refreshPendingRelationshipInvitations()/
// refreshAthleteRelationships() (which used to keep
// state.pendingRelationshipInvitations/state.athleteRelationships fresh
// solely for the notification bell's now-deleted notificationCoachName()
// resolver) were deleted outright once that moved to React too (see
// useNotifications.ts's own DEV NOTE, which fetches this same data
// independently) - only loadAthleteToday() remains below, since gaining
// or losing a coach can change Today's current assignment.
document.addEventListener("kolosseum:athlete-relationship-changed", () => {
  loadAthleteToday().catch(handleError);
});
document.addEventListener("kolosseum:create-session", (event) => createSession(event?.detail ?? {}).catch(handleError));
elements.refreshHistoryButton.addEventListener("click", () => refreshHistory().catch(handleError));
elements.exportHistoryButton.addEventListener("click", () => exportHistory().catch(handleError));
