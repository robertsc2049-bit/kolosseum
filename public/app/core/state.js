export const STORAGE_KEY = "kolosseum.product.app.v1";

const DEFAULT_STATE = Object.freeze({
  version: 1,
  role: null,
  profile: null,
  coachProfile: null,
  authRecord: null,
  acknowledgementRecord: null,
  declarationRecord: null,
  phase1Input: null,
  activeSessionId: null,
  activeSessionState: null,
  localSessions: [],
  view: "today",
  coachAthletes: [],
  coachRelationships: [],
  coachAssignments: [],
  coachEvents: [],
  templateEventBindingStatus: null,
  athleteToday: null,
  coachTemplates: [],
  selectedTemplateId: "",
  templateExercises: [],
  templateDraft: null,
  templateDraftSavedSnapshot: "",
  templateDraftSavedAt: "",
  templateDraftWasOpen: false,
  templateDraftOwnerUserId: "",
  templateDraftRecovered: false,
  templateDraftDirty: false,
  athleteProfiles: {},
  athleteProfileDraft: null,
  selectedCoachAthleteId: "",
  coachDashboardFailures: [],
  coachDashboardUpdatedAt: "",
  coachReviewSearch: "",
  coachReviewFilter: "awaiting",
  coachReviewUpdatedAt: "",
  selectedCoachReviewSessionId: "",
  coachAthleteProgressPhotoCompareIds: [],
  athleteDetails: {},
  coachCode: "",
  csrfToken: "",
  serverAccount: null,
  accountDetail: null,
  athleteOrgMessageThreads: [],
  athleteOrgContexts: [],
  coachOrgContexts: []
});

export const state = loadState();

export function cloneDefaultState() {
  return JSON.parse(JSON.stringify(DEFAULT_STATE));
}

export function normalisePersistedTemplateDraft(draft) {
  if (!draft || typeof draft !== "object") return null;

  const rawBlocks = Array.isArray(draft.blocks)
    ? draft.blocks
    : Array.isArray(draft.weeks)
      ? [{
          block_id: "",
          order_index: 1,
          name: "Block 1",
          description: "",
          block_type: "general",
          week_count: draft.weeks.length,
          weeks: draft.weeks
        }]
      : [];

  const normaliseWorkItem = (workItem, workItemIndex) => {
    const fallbackReps = Number(workItem?.planned_reps ?? 5);
    const fallbackDuration = Number(workItem?.planned_duration_seconds ?? 30);
    const fallbackDistance = Number(workItem?.planned_distance_value ?? 20);
    const loadMode = ["fixed_weight", "bodyweight", "rpe", "borg", "cr10"].includes(workItem?.load_mode)
      ? workItem.load_mode
      : "percent_1rm";

    return {
      work_item_id: String(workItem?.work_item_id ?? ""),
      order_index: workItemIndex + 1,
      exercise_id: String(workItem?.exercise_id ?? ""),
      planned_sets: Number(workItem?.planned_sets ?? 3),
      prescription_mode: ["duration", "distance"].includes(workItem?.prescription_mode)
        ? workItem.prescription_mode
        : "reps",
      rep_mode: workItem?.rep_mode === "range" ? "range" : "fixed",
      planned_reps: fallbackReps,
      rep_min: Number(workItem?.rep_min ?? fallbackReps),
      rep_max: Number(workItem?.rep_max ?? fallbackReps),
      tempo: String(workItem?.tempo ?? ""),
      duration_mode: workItem?.duration_mode === "range" ? "range" : "fixed",
      planned_duration_seconds: fallbackDuration,
      duration_min_seconds: Number(workItem?.duration_min_seconds ?? fallbackDuration),
      duration_max_seconds: Number(workItem?.duration_max_seconds ?? fallbackDuration),
      distance_mode: workItem?.distance_mode === "range" ? "range" : "fixed",
      distance_unit: workItem?.distance_unit === "feet" ? "feet" : "meters",
      planned_distance_value: fallbackDistance,
      distance_min_value: Number(workItem?.distance_min_value ?? fallbackDistance),
      distance_max_value: Number(workItem?.distance_max_value ?? fallbackDistance),
      load_mode: loadMode,
      percent_1rm: Number(workItem?.percent_1rm ?? 75),
      weight_value: Number(workItem?.weight_value ?? 20),
      weight_unit: workItem?.weight_unit === "lb" ? "lb" : "kg",
      set_mode: ["range", "per_set"].includes(workItem?.set_mode) ? workItem.set_mode : "fixed",
      planned_sets_max: Number(workItem?.planned_sets_max ?? Number(workItem?.planned_sets ?? 3) + 1),
      set_plan: normaliseSetPlan(workItem?.set_plan),
      load_range_mode: workItem?.load_range_mode === "range" ? "range" : "fixed",
      percent_1rm_max: Number(workItem?.percent_1rm_max ?? Number(workItem?.percent_1rm ?? 75) + 5),
      weight_value_max: Number(workItem?.weight_value_max ?? Number(workItem?.weight_value ?? 20) + 10),
      rpe_value: Number(workItem?.rpe_value ?? 8),
      borg_value: Number(workItem?.borg_value ?? 13),
      cr10_value: Number(workItem?.cr10_value ?? 5),
      rest_seconds: Number(workItem?.rest_seconds ?? 120),
      role: workItem?.role === "primary" ? "primary" : "accessory",
      coaching_notes: String(workItem?.coaching_notes ?? ""),
      segment: ["warm_up", "cool_down"].includes(workItem?.segment) ? workItem.segment : "working",
      group_id: String(workItem?.group_id ?? ""),
      group_type: ["superset", "circuit"].includes(workItem?.group_type) ? workItem.group_type : "straight"
    };
  };

  const blocks = rawBlocks.map((block, blockIndex) => ({
    block_id: String(block?.block_id ?? ""),
    order_index: blockIndex + 1,
    name: String(block?.name ?? `Block ${blockIndex + 1}`),
    description: String(block?.description ?? ""),
    block_type: ["general", "volume", "strength", "peak", "deload", "custom"].includes(block?.block_type)
      ? block.block_type
      : "general",
    week_count: Number(block?.week_count ?? (Array.isArray(block?.weeks) ? block.weeks.length : 1)),
    calendar_start_date: String(block?.calendar_start_date ?? ""),
    calendar_end_date: String(block?.calendar_end_date ?? ""),
    weeks: Array.isArray(block?.weeks)
      ? block.weeks.map((week, weekIndex) => ({
          week_id: String(week?.week_id ?? ""),
          order_index: weekIndex + 1,
          calendar_start_date: String(week?.calendar_start_date ?? ""),
          calendar_end_date: String(week?.calendar_end_date ?? ""),
          days_until_event_at_week_start: Number.isInteger(week?.days_until_event_at_week_start)
            ? Number(week.days_until_event_at_week_start)
            : null,
          partial_week: week?.partial_week === true,
          sessions: Array.isArray(week?.sessions)
            ? week.sessions.map((session, sessionIndex) => ({
                session_id: String(session?.session_id ?? ""),
                order_index: sessionIndex + 1,
                title: String(session?.title ?? `Session ${sessionIndex + 1}`),
                coaching_notes: String(session?.coaching_notes ?? ""),
                work_items: Array.isArray(session?.work_items)
                  ? session.work_items.map(normaliseWorkItem)
                  : []
              }))
            : []
        }))
      : []
  }));

  const eventPlan = draft.event_plan && typeof draft.event_plan === "object"
    ? {
        event_plan_id: String(draft.event_plan.event_plan_id ?? ""),
        event_name: String(draft.event_plan.event_name ?? ""),
        event_type: String(draft.event_plan.event_type ?? ""),
        event_date: String(draft.event_plan.event_date ?? ""),
        programme_start_date: String(draft.event_plan.programme_start_date ?? ""),
        location: String(draft.event_plan.location ?? ""),
        timezone: String(draft.event_plan.timezone ?? "Europe/London"),
        notes: String(draft.event_plan.notes ?? "")
      }
    : null;

  return {
    ...draft,
    adjust_for_breaks: typeof draft.adjust_for_breaks === "boolean" ? draft.adjust_for_breaks : Boolean(draft.template_id),
    event_plan: eventPlan,
    event_compile_summary: draft.event_compile_summary && typeof draft.event_compile_summary === "object"
      ? draft.event_compile_summary
      : null,
    bound_event_id: String(draft.bound_event_id ?? ""),
    bound_event_record_sha256: String(draft.bound_event_record_sha256 ?? ""),
    blocks
  };
}

function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (!parsed || parsed.version !== 1) {
      return cloneDefaultState();
    }

    return {
      ...cloneDefaultState(),
      ...parsed,
      coachAthletes: Array.isArray(parsed.coachAthletes) ? parsed.coachAthletes : [],
      coachAssignments: Array.isArray(parsed.coachAssignments) ? parsed.coachAssignments : [],
      coachEvents: Array.isArray(parsed.coachEvents) ? parsed.coachEvents : [],
      coachAthleteProgressPhotoCompareIds: Array.isArray(parsed.coachAthleteProgressPhotoCompareIds)
        ? parsed.coachAthleteProgressPhotoCompareIds.slice(0, 2)
        : [],
      coachTemplates: Array.isArray(parsed.coachTemplates) ? parsed.coachTemplates : [],
      selectedTemplateId: String(parsed.selectedTemplateId ?? ""),
      templateExercises: Array.isArray(parsed.templateExercises) ? parsed.templateExercises : [],
      templateDraft: normalisePersistedTemplateDraft(parsed.templateDraft),
      templateDraftOwnerUserId: String(parsed.templateDraftOwnerUserId ?? ""),
      athleteProfiles: parsed.athleteProfiles && typeof parsed.athleteProfiles === "object"
        ? parsed.athleteProfiles
        : {},
      athleteProfileDraft: parsed.athleteProfileDraft && typeof parsed.athleteProfileDraft === "object"
        ? parsed.athleteProfileDraft
        : null,
      selectedCoachAthleteId: String(parsed.selectedCoachAthleteId ?? ""),
      localSessions: Array.isArray(parsed.localSessions) ? parsed.localSessions : []
    };
  }
  catch {
    return cloneDefaultState();
  }
}

// Large server lists the app always fetches again - a coach with the 55
// Kolosseum programme drafts pushed the saved copy past the browser's ~5 MB
// localStorage quota, and the throw blocked signing in. Unsaved builder
// drafts, offline sessions and the small session fields stay saved.
const UNSAVED_STATE_KEYS = ["coachTemplates", "templateExercises"];

export function saveState() {
  const saved = { ...state };
  for (const key of UNSAVED_STATE_KEYS) delete saved[key];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  }
  catch (error) {
    // Storage full or unavailable (private mode): never let that break the
    // action in progress. The app still works; it just won't restore this
    // browser state after a reload.
    console.warn("Kolosseum could not save its state in this browser.", error);
  }
}

// DEV NOTE: FULL-UI-17 review queue (reviewList/coachNoteForm) and
// FULL-UI-32 coach video-feedback queue both moved to React
// (CoachReviewPanel.tsx/useCoachReview.ts into #coach-review-root,
// CoachVideoFeedbackQueuePanel.tsx into #coach-video-feedback-queue-root -
// see useCoachVideoFeedbackQueue.ts) - both independently fetch their own
// data on mount. reviewAthleteForRecord()/reviewAthleteName() and the
// trimmed refreshCoachReviewQueue() (FULL-UI-07) are gone too - their only
// remaining caller was renderCoachDashboard()'s own review-derived stat
// card, itself removed now that the dashboard metric strip is React (see
// CoachOverviewMetricsPanel.tsx/useCoachOverviewMetrics.ts, which fetches
// GET /coach-workspace/reviews directly for the same counts).

// DEV NOTE: FULL-UI-05B the builder tree (block/week/session/exercise,
// including templateExerciseOptions()/templateWorkItemAttributes()/
// renderTemplateRepControls()/DurationControls()/DistanceControls()/
// PrescriptionControls()/LoadControls()/renderTemplateWorkItem()/
// renderTemplateSession()/renderTemplateWeek()/renderTemplateBlocks())
// moved to React - see CoachProgrammeBuilderTree.tsx, mounted directly
// into the still-legacy #templateBlocks (kept, not replaced, so its
// three delegated listeners - input/change/click - keep firing on real
// interaction, driving the exact same untouched mutation functions
// below). See CoachProgrammeBuilderTree.tsx's own DEV NOTE.

// Set by set ("5 @ 50%, 4 @ 60%, 2 x 3 @ 70%"): a work item's set_plan, one
// line per group of sets with their own reps and load value (in the item's
// load mode; none for bodyweight) and whether the line's last set is as many
// reps as they can. In the draft set_mode is "per_set".
export function normaliseSetPlan(plan) {
  return (Array.isArray(plan) ? plan : []).map((line) => ({
    sets: Number(line?.sets ?? 1),
    reps: Number(line?.reps ?? 5),
    value: Number(line?.value ?? 0),
    amrap: line?.amrap === true
  }));
}

export function currentTemplateDraftOwnerUserId() {
  return state.role === "coach"
    ? String(state.profile?.coachUserId ?? "")
    : "";
}

export function dropTemplateDraft() {
  state.templateDraft = null;
  state.templateDraftSavedSnapshot = "";
  state.templateDraftSavedAt = "";
  state.templateDraftWasOpen = false;
  state.templateDraftOwnerUserId = "";
  state.templateDraftRecovered = false;
  state.templateDraftDirty = false;
}
