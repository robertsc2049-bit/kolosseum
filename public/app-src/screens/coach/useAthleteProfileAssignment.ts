import { useCallback, useEffect, useMemo, useState } from "react";

import { loadAccountDetail } from "../../api/client";
import {
  cancelAthleteAssignment,
  createAthleteAssignment,
  loadAthleteEventLinks,
  loadAthleteStrengthProfile,
  loadCoachAssignments,
  loadCoachEventsList,
  loadCoachRelationships,
  loadCoachTemplates,
  loadTemplateExercises,
  replaceAthleteAssignment
} from "../../api/coachWorkspaceClient";
import { type JsonRecord } from "../../api/transport";
// DEV NOTE: reused verbatim rather than re-derived - the same canonical
// required/available/missing 1RM-reference classification the backend
// applies, exactly as AthleteStrengthProfilePanel.tsx already reuses
// projectStrengthReferenceLifecycle from the same module. Re-deriving this
// by hand (as app.js's requiredOneRmExerciseIds()/currentProfileBenchmarks()
// do) would risk silently drifting from that law over time.
// eslint-disable-next-line import/no-unresolved
import { compareProgrammeStrengthRequirements } from "../../../../shared/strength-reference/strengthReferenceLifecycle.mjs";
import { titleCase } from "../../utils/format";
import { PROFILE_UPDATED_EVENT } from "./useAthleteStrengthProfile";

// DEV NOTE: ported from app.js's (removed) selectedAthleteProfileTemplate()/
// selectedAthleteProfileEvent()/renderAthleteProfileAssignmentRequirements()/
// renderAthleteProfileAssignment()/recordAthleteProfileAssignment() - the
// "Assign from athlete profile" panel. The standalone, unreachable twin of
// this same form (#view-assign) and the shared render helpers only it and
// this panel's now-removed legacy predecessor used (assignmentHistoryCards/
// renderAssignmentCurrent/renderAssignmentLifecycleSurfaces and friends)
// are gone from app.js too - refreshCoachAssignments() still populates
// state.coachAssignments, which this hook (via loadCoachAssignments) and
// the Coach Dashboard both read directly.
const OPENED_EVENT = "kolosseum:coach-athlete-profile-opened";
const CLOSED_EVENT = "kolosseum:coach-athlete-profile-closed";

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function newRequestId(prefix: string): string {
  const id = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  return `${prefix}_${id}`;
}

// Ported verbatim from app.js's programmeFamilyId/programmeVersionNumber/
// programmeFamilyVersions/programmeDisplayState/activeCoachTemplates - a
// template is only assignable once its own version-family supersession
// state resolves to "active" (a later published version of the same
// family takes precedence over an earlier one).
function programmeFamilyId(template: JsonRecord): string {
  return String(template.template_family_id ?? template.template_id ?? "");
}

function programmeVersionNumber(template: JsonRecord): number {
  const version = Number(template.template_version ?? 0);
  return Number.isInteger(version) && version > 0 ? version : 1;
}

function programmeFamilyVersions(templates: JsonRecord[], template: JsonRecord): JsonRecord[] {
  const familyId = programmeFamilyId(template);
  return templates
    .filter((candidate) => programmeFamilyId(candidate) === familyId)
    .sort((left, right) => (
      programmeVersionNumber(left) - programmeVersionNumber(right) ||
      String(left.updated_at_iso8601 ?? "").localeCompare(String(right.updated_at_iso8601 ?? ""))
    ));
}

function programmeDisplayState(templates: JsonRecord[], template: JsonRecord): string {
  const storedState = String(template.template_status ?? "draft");
  if (storedState === "draft") return "draft";

  const version = programmeVersionNumber(template);
  const laterPublishedVersion = programmeFamilyVersions(templates, template).some(
    (candidate) => programmeVersionNumber(candidate) > version && ["active", "archived"].includes(String(candidate.template_status ?? ""))
  );

  if (laterPublishedVersion) return "superseded";
  if (storedState === "archived") return "archived";
  if (storedState === "complete") return "complete";
  return "active";
}

function activeTemplatesForActivity(templates: JsonRecord[], activityId: string): JsonRecord[] {
  return templates.filter((template) => programmeDisplayState(templates, template) === "active" && template.activity_id === activityId);
}

function coachEventPlan(eventRecord: JsonRecord | undefined): JsonRecord | null {
  return eventRecord?.event_plan && typeof eventRecord.event_plan === "object" ? (eventRecord.event_plan as JsonRecord) : null;
}

function coachEventCompile(eventRecord: JsonRecord | undefined): JsonRecord | null {
  return eventRecord?.event_compile_summary && typeof eventRecord.event_compile_summary === "object" ? (eventRecord.event_compile_summary as JsonRecord) : null;
}

function exerciseDisplayName(exercises: JsonRecord[], exerciseId: string): string {
  const match = exercises.find((exercise) => exercise.exercise_id === exerciseId);
  return typeof match?.display_name === "string" ? match.display_name : titleCase(exerciseId);
}

export type AssignmentEntry = {
  assignmentId: string;
  templateId: string;
  templateVersion: number;
  templateName: string;
  activityId: string;
  assignmentStatus: string;
  isCurrent: boolean;
  eventId: string;
  preservedSessionCount: number;
  recordedAt: string;
};

function normaliseAssignment(raw: JsonRecord, templates: JsonRecord[]): AssignmentEntry {
  const template = templates.find((entry) => String(entry.template_id ?? "") === String(raw.template_id ?? ""));
  return {
    assignmentId: String(raw.assignment_id ?? ""),
    templateId: String(raw.template_id ?? ""),
    templateVersion: Number(raw.template_version ?? template?.template_version ?? 0),
    templateName: String(raw.template_name ?? template?.template_name ?? raw.template_id ?? "Programme"),
    activityId: String(raw.activity_id ?? ""),
    assignmentStatus: String(raw.lifecycle_status ?? raw.assignment_status ?? "assigned"),
    isCurrent: raw.is_current === true,
    eventId: String(raw.event_id ?? ""),
    preservedSessionCount: Number(raw.preserved_session_count ?? 0),
    recordedAt: String(raw.requested_at_iso8601 ?? "")
  };
}

// Matches legacy's currentAssignmentForAthlete: records sorted by
// recordedAt descending, prefer one flagged is_current, else fall back to
// the most recent still-"assigned" record.
function currentAssignmentOf(assignments: AssignmentEntry[]): AssignmentEntry | null {
  const sorted = [...assignments].sort((left, right) => right.recordedAt.localeCompare(left.recordedAt));
  return sorted.find((entry) => entry.isCurrent) ?? (sorted[0]?.assignmentStatus === "assigned" ? sorted[0] : null);
}

export type AssignmentRequirements = {
  className: "neutral" | "warning" | "complete";
  message: string;
  canSubmit: boolean;
};

function computeRequirements(
  template: JsonRecord | null,
  eventRecord: JsonRecord | null,
  activityId: string,
  strengthProfile: JsonRecord | null,
  exercises: JsonRecord[]
): AssignmentRequirements {
  if (!template) {
    return { className: "neutral", message: "Select an active programme.", canSubmit: false };
  }

  if (template.activity_id !== activityId) {
    return { className: "warning", message: "The programme activity does not match this athlete.", canSubmit: false };
  }

  if (eventRecord && eventRecord.activity_id !== activityId) {
    return { className: "warning", message: "The event activity does not match this athlete.", canSubmit: false };
  }

  if (eventRecord) {
    const compile = coachEventCompile(eventRecord) ?? {};
    if (Number(template.week_count) !== Number(compile.required_week_count)) {
      return {
        className: "warning",
        message: `Programme has ${Number(template.week_count ?? 0)} weeks; this event calendar requires ${Number(compile.required_week_count ?? 0)} weeks.`,
        canSubmit: false
      };
    }
  }

  const comparison = compareProgrammeStrengthRequirements(template, strengthProfile) as {
    missing: string[];
    complete: boolean;
  };

  if (!comparison.complete) {
    const names = comparison.missing.map((exerciseId) => exerciseDisplayName(exercises, exerciseId)).join(", ");
    return { className: "warning", message: `Missing current strength references: ${names}.`, canSubmit: false };
  }

  const eventPlan = coachEventPlan(eventRecord ?? undefined);
  return {
    className: "complete",
    message: eventRecord
      ? `Ready to assign ${String(template.template_name)} and link ${String(eventPlan?.event_name ?? "the event")}.`
      : `Ready to assign ${String(template.template_name)} without an event link.`,
    canSubmit: true
  };
}

export type AthleteProfileAssignmentState = {
  loading: boolean;
  error: string | null;
  athleteActivityId: string;
  templates: JsonRecord[];
  events: JsonRecord[];
  assignments: AssignmentEntry[];
  eventLinks: JsonRecord[];
  strengthProfile: JsonRecord | null;
  exercises: JsonRecord[];
  submitting: boolean;
  resultMessage: string | null;
};

const initialState: AthleteProfileAssignmentState = {
  loading: true,
  error: null,
  athleteActivityId: "",
  templates: [],
  events: [],
  assignments: [],
  eventLinks: [],
  strengthProfile: null,
  exercises: [],
  submitting: false,
  resultMessage: null
};

export function useAthleteProfileAssignment() {
  const [athleteUserId, setAthleteUserId] = useState<string | null>(null);
  const [state, setState] = useState<AthleteProfileAssignmentState>(initialState);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [selectedEventId, setSelectedEventId] = useState("");

  const refresh = useCallback(async (id: string) => {
    setState((current) => ({ ...current, loading: true, error: null, resultMessage: null }));
    try {
      const account = await loadAccountDetail();
      const coachUserId = String((account.account as JsonRecord | undefined)?.user_id ?? "");

      const [relationships, templates, events, rawAssignments, eventLinks, strengthProfileResponse, exercises] = await Promise.all([
        loadCoachRelationships(""),
        // Unlike every other route here, getCoachTemplates resolves
        // coach_user_id from this query param, not the session - a legacy
        // route predating the authenticatedCoach(request, ...) convention.
        loadCoachTemplates(coachUserId),
        loadCoachEventsList(""),
        loadCoachAssignments(""),
        loadAthleteEventLinks(id),
        loadAthleteStrengthProfile(id),
        loadTemplateExercises()
      ]);

      const entry = relationships.find((candidate) => String(candidate.athlete_user_id ?? "") === id);
      const athleteActivityId = String(entry?.activity_id ?? "powerlifting");

      const assignments = rawAssignments
        .filter((raw) => String(raw.assigned_athlete_id ?? "") === id)
        .map((raw) => normaliseAssignment(raw, templates));

      const strengthProfile = isRecord(strengthProfileResponse.profile) ? strengthProfileResponse.profile : null;

      setState({
        loading: false,
        error: null,
        athleteActivityId,
        templates,
        events,
        assignments,
        eventLinks,
        strengthProfile,
        exercises,
        submitting: false,
        resultMessage: null
      });
    }
    catch {
      setState((current) => ({ ...current, loading: false, error: "Athlete assignment records could not be loaded. Check your connection and try again." }));
    }
  }, []);

  useEffect(() => {
    function handleOpened(event: Event) {
      const detail = (event as CustomEvent).detail as { athlete_user_id?: string } | undefined;
      if (detail?.athlete_user_id) setAthleteUserId(detail.athlete_user_id);
    }
    function handleClosed() {
      setAthleteUserId(null);
    }
    document.addEventListener(OPENED_EVENT, handleOpened);
    document.addEventListener(CLOSED_EVENT, handleClosed);
    return () => {
      document.removeEventListener(OPENED_EVENT, handleOpened);
      document.removeEventListener(CLOSED_EVENT, handleClosed);
    };
  }, []);

  useEffect(() => {
    if (athleteUserId) {
      setSelectedTemplateId("");
      setSelectedEventId("");
      refresh(athleteUserId);
    }
    else {
      setState(initialState);
    }
  }, [athleteUserId, refresh]);

  // A strength-profile save from the sibling React editor
  // (AthleteStrengthProfilePanel.tsx) changes the 1RM references this
  // panel's requirements check reads - refetch so it reflects the update
  // without the coach having to close and reopen the profile.
  useEffect(() => {
    function handleProfileUpdated(event: Event) {
      const detail = (event as CustomEvent).detail as { athlete_user_id?: string } | undefined;
      if (athleteUserId && detail?.athlete_user_id === athleteUserId) refresh(athleteUserId);
    }
    document.addEventListener(PROFILE_UPDATED_EVENT, handleProfileUpdated);
    return () => document.removeEventListener(PROFILE_UPDATED_EVENT, handleProfileUpdated);
  }, [athleteUserId, refresh]);

  const activeTemplates = useMemo(
    () => activeTemplatesForActivity(state.templates, state.athleteActivityId),
    [state.templates, state.athleteActivityId]
  );

  const activeEvents = useMemo(
    () => state.events.filter((eventRecord) => eventRecord.event_status === "active" && eventRecord.activity_id === state.athleteActivityId),
    [state.events, state.athleteActivityId]
  );

  const selectedTemplate = useMemo(
    () => activeTemplates.find((template) => String(template.template_id ?? "") === selectedTemplateId) ?? null,
    [activeTemplates, selectedTemplateId]
  );

  const selectedEvent = useMemo(
    () => activeEvents.find((eventRecord) => String(eventRecord.event_id ?? "") === selectedEventId) ?? null,
    [activeEvents, selectedEventId]
  );

  const currentAssignment = useMemo(() => currentAssignmentOf(state.assignments), [state.assignments]);

  const requirements = useMemo(
    () => computeRequirements(selectedTemplate, selectedEvent, state.athleteActivityId, state.strengthProfile, state.exercises),
    [selectedTemplate, selectedEvent, state.athleteActivityId, state.strengthProfile, state.exercises]
  );

  const assign = useCallback(async () => {
    if (!athleteUserId || !selectedTemplate || !requirements.canSubmit) return false;

    setState((current) => ({ ...current, submitting: true }));
    try {
      const account = await loadAccountDetail();
      const coachUserId = String((account.account as JsonRecord | undefined)?.user_id ?? "");
      const csrfToken = typeof account.csrf_token === "string" ? account.csrf_token : "";
      const requestedAt = new Date().toISOString();

      const payload = {
        request_id: newRequestId("assignment"),
        requested_at_iso8601: requestedAt,
        coach_user_id: coachUserId,
        athlete_user_id: athleteUserId,
        template_id: selectedTemplate.template_id,
        activity_id: state.athleteActivityId,
        event_id: selectedEvent?.event_id ?? ""
      };

      const response = currentAssignment
        ? await replaceAthleteAssignment(currentAssignment.assignmentId, payload, csrfToken)
        : await createAthleteAssignment(payload, csrfToken);

      const preservedCount = Number(response.preserved_session_count ?? 0);
      const templateName = String(selectedTemplate.template_name);
      const templateVersion = Number(selectedTemplate.template_version);
      const eventPlan = coachEventPlan(selectedEvent ?? undefined);

      await refresh(athleteUserId);
      setState((current) => ({
        ...current,
        resultMessage: currentAssignment
          ? `${templateName} version ${templateVersion} replaced the current assignment. ${preservedCount} existing session${preservedCount === 1 ? "" : "s"} remain attached to the earlier assignment.`
          : response.event_link
            ? `${templateName} version ${templateVersion} assigned and linked to ${String(eventPlan?.event_name ?? "the event")}.`
            : `${templateName} version ${templateVersion} assigned without an event link.`
      }));
      document.dispatchEvent(new CustomEvent("kolosseum:coach-relationship-mutated"));
      return true;
    }
    catch {
      setState((current) => ({ ...current, submitting: false }));
      return false;
    }
  }, [athleteUserId, selectedTemplate, selectedEvent, currentAssignment, requirements.canSubmit, state.athleteActivityId, refresh]);

  const cancel = useCallback(async () => {
    if (!athleteUserId || !currentAssignment) return false;

    setState((current) => ({ ...current, submitting: true }));
    try {
      const account = await loadAccountDetail();
      const coachUserId = String((account.account as JsonRecord | undefined)?.user_id ?? "");
      const csrfToken = typeof account.csrf_token === "string" ? account.csrf_token : "";
      const requestedAt = new Date().toISOString();

      const response = await cancelAthleteAssignment(
        currentAssignment.assignmentId,
        { request_id: newRequestId("assignment_cancel"), requested_at_iso8601: requestedAt, coach_user_id: coachUserId, athlete_user_id: athleteUserId },
        csrfToken
      );

      const preserved = Number(response.preserved_session_count ?? 0);
      await refresh(athleteUserId);
      setState((current) => ({
        ...current,
        resultMessage: `Assignment cancelled for future session creation. ${preserved} existing session${preserved === 1 ? "" : "s"} remain preserved.`
      }));
      document.dispatchEvent(new CustomEvent("kolosseum:coach-relationship-mutated"));
      return true;
    }
    catch {
      setState((current) => ({ ...current, submitting: false }));
      return false;
    }
  }, [athleteUserId, currentAssignment, refresh]);

  return {
    athleteUserId,
    ...state,
    activeTemplates,
    activeEvents,
    currentAssignment,
    requirements,
    selectedTemplateId,
    setSelectedTemplateId,
    selectedEventId,
    setSelectedEventId,
    assign,
    cancel
  };
}
