import { api } from "../core/api.js";
import { elements } from "../core/elements.js";
import { addDateOnlyDays, countdownLabel, dateOnlyDifference, nowIso, todayDateOnly } from "../core/format.js";
import { hideBusy, showBusy, showNotice } from "../core/notices.js";
import { normalisePersistedTemplateDraft, saveState, state } from "../core/state.js";
import { openTemplateBuilder, rerenderTemplateBuilder, saveTemplateDraft, templateCounts, templateDraftSnapshot } from "./builder.js";
import { reindexTemplateDraft } from "./builderEdits.js";
import { templateRecordToDraft } from "./draft.js";
import { refreshProgrammeLibrary } from "./programmes.js";

const EVENT_TYPES_BY_ACTIVITY = Object.freeze({
  powerlifting: [
    ["powerlifting_meet", "Powerlifting meet"],
    ["strength_event", "Strength event"],
    ["test_day", "Test day"],
    ["other", "Other event"]
  ],
  general_strength: [
    ["strength_event", "Strength event"],
    ["test_day", "Test day"],
    ["other", "Other event"]
  ],
  rugby_union: [
    ["rugby_match", "Rugby match"],
    ["rugby_tournament", "Rugby tournament"],
    ["test_day", "Test day"],
    ["other", "Other event"]
  ],
  strongman: [
    ["strongman_competition", "Strongman competition"],
    ["strength_event", "Strength event"],
    ["test_day", "Test day"],
    ["other", "Other event"]
  ],
  hyrox: [
    ["hyrox_race", "Hyrox race"],
    ["hyrox_simulation", "Hyrox simulation"],
    ["test_day", "Test day"],
    ["other", "Other event"]
  ],
  crossfit: [
    ["crossfit_competition", "CrossFit competition"],
    ["wod_event", "WOD event"],
    ["test_day", "Test day"],
    ["other", "Other event"]
  ],
  football_soccer: [
    ["football_soccer_match", "Football match"],
    ["football_soccer_tournament", "Football tournament"],
    ["test_day", "Test day"],
    ["other", "Other event"]
  ],
  netball: [
    ["netball_match", "Netball match"],
    ["netball_tournament", "Netball tournament"],
    ["test_day", "Test day"],
    ["other", "Other event"]
  ],
  basketball: [
    ["basketball_match", "Basketball match"],
    ["basketball_tournament", "Basketball tournament"],
    ["test_day", "Test day"],
    ["other", "Other event"]
  ],
  rugby_sevens: [
    ["rugby_sevens_match", "Rugby sevens match"],
    ["rugby_sevens_tournament", "Rugby sevens tournament"],
    ["test_day", "Test day"],
    ["other", "Other event"]
  ],
  field_hockey: [
    ["field_hockey_match", "Field hockey match"],
    ["field_hockey_tournament", "Field hockey tournament"],
    ["test_day", "Test day"],
    ["other", "Other event"]
  ],
  ice_hockey: [
    ["ice_hockey_match", "Ice hockey match"],
    ["ice_hockey_tournament", "Ice hockey tournament"],
    ["test_day", "Test day"],
    ["other", "Other event"]
  ],
  volleyball: [
    ["volleyball_match", "Volleyball match"],
    ["volleyball_tournament", "Volleyball tournament"],
    ["test_day", "Test day"],
    ["other", "Other event"]
  ],
  cricket: [
    ["cricket_match", "Cricket match"],
    ["cricket_tournament", "Cricket tournament"],
    ["test_day", "Test day"],
    ["other", "Other event"]
  ],
  american_football: [
    ["american_football_match", "American football match"],
    ["american_football_tournament", "American football tournament"],
    ["test_day", "Test day"],
    ["other", "Other event"]
  ],
  athletics: [
    ["athletics_competition", "Athletics competition"],
    ["test_day", "Test day"],
    ["other", "Other event"]
  ],
  swimming: [
    ["swimming_competition", "Swimming competition"],
    ["test_day", "Test day"],
    ["other", "Other event"]
  ],
  olympic_weightlifting: [
    ["olympic_weightlifting_competition", "Olympic weightlifting competition"],
    ["test_day", "Test day"],
    ["other", "Other event"]
  ],
  cycling: [
    ["cycling_competition", "Cycling competition"],
    ["test_day", "Test day"],
    ["other", "Other event"]
  ],
  rowing: [
    ["rowing_competition", "Rowing competition"],
    ["test_day", "Test day"],
    ["other", "Other event"]
  ],
  kayaking: [
    ["kayaking_competition", "Kayaking competition"],
    ["test_day", "Test day"],
    ["other", "Other event"]
  ],
  boxing: [
    ["boxing_competition", "Boxing competition"],
    ["test_day", "Test day"],
    ["other", "Other event"]
  ],
  wrestling: [
    ["wrestling_competition", "Wrestling competition"],
    ["test_day", "Test day"],
    ["other", "Other event"]
  ],
  judo: [
    ["judo_competition", "Judo competition"],
    ["test_day", "Test day"],
    ["other", "Other event"]
  ],
  brazilian_jiu_jitsu: [
    ["brazilian_jiu_jitsu_competition", "Brazilian jiu-jitsu competition"],
    ["test_day", "Test day"],
    ["other", "Other event"]
  ],
  muay_thai: [
    ["muay_thai_competition", "Muay Thai competition"],
    ["test_day", "Test day"],
    ["other", "Other event"]
  ],
  mma: [
    ["mma_competition", "MMA competition"],
    ["test_day", "Test day"],
    ["other", "Other event"]
  ],
  tennis: [
    ["tennis_competition", "Tennis competition"],
    ["test_day", "Test day"],
    ["other", "Other event"]
  ],
  triathlon: [
    ["triathlon_competition", "Triathlon competition"],
    ["test_day", "Test day"],
    ["other", "Other event"]
  ],
  rugby_league: [
    ["rugby_league_match", "Rugby league match"],
    ["rugby_league_tournament", "Rugby league tournament"],
    ["test_day", "Test day"],
    ["other", "Other event"]
  ],
  street_lifting: [
    ["street_lifting_competition", "Street lifting competition"],
    ["strength_event", "Strength event"],
    ["test_day", "Test day"],
    ["other", "Other event"]
  ],
  grip_sport: [
    ["grip_sport_competition", "Grip sport competition"],
    ["strength_event", "Strength event"],
    ["test_day", "Test day"],
    ["other", "Other event"]
  ]
});

function eventTypesForActivity(activityId) {
  return EVENT_TYPES_BY_ACTIVITY[activityId] ?? EVENT_TYPES_BY_ACTIVITY.general_strength;
}

function defaultEventType(activityId) {
  return eventTypesForActivity(activityId)[0][0];
}

export function ensureDraftEventPlan() {
  const draft = state.templateDraft;
  if (!draft) return null;

  if (!draft.event_plan) {
    const startDate = todayDateOnly();
    draft.event_plan = {
      event_plan_id: "",
      event_name: "",
      event_type: defaultEventType(draft.activity_id),
      event_date: addDateOnlyDays(startDate, 84),
      programme_start_date: startDate,
      location: "",
      timezone: "Europe/London",
      notes: ""
    };
  }

  const allowedTypes = eventTypesForActivity(draft.activity_id).map(([value]) => value);
  if (!allowedTypes.includes(draft.event_plan.event_type)) {
    draft.event_plan.event_type = defaultEventType(draft.activity_id);
  }

  return draft.event_plan;
}

export function localEventCompileSummary(draft) {
  const eventPlan = draft?.event_plan;
  if (!eventPlan) return null;

  if (!eventPlan.event_name.trim()) {
    return {
      valid: false,
      reason: "Enter an event name."
    };
  }

  if (!eventTypesForActivity(draft.activity_id).some(([value]) => value === eventPlan.event_type)) {
    return {
      valid: false,
      reason: "Choose an event type supported by this activity."
    };
  }

  if (!eventPlan.timezone.trim() || !/^[A-Za-z0-9_+\-/]+$/u.test(eventPlan.timezone.trim())) {
    return {
      valid: false,
      reason: "Enter a valid timezone such as Europe/London."
    };
  }

  const trainingDays = dateOnlyDifference(
    eventPlan.programme_start_date,
    eventPlan.event_date
  );

  if (trainingDays === null || trainingDays < 1) {
    return {
      valid: false,
      reason: "Event date must be after the programme start date."
    };
  }

  const requiredWeeks = Math.ceil(trainingDays / 7);
  if (requiredWeeks < 1 || requiredWeeks > 104) {
    return {
      valid: false,
      reason: "The event calendar must contain between 1 and 104 training weeks."
    };
  }

  const allocatedWeeks = draft.blocks.reduce(
    (total, block) => total + Number(block.weeks?.length ?? block.week_count ?? 0),
    0
  );
  const weekDelta = requiredWeeks - allocatedWeeks;
  let offset = 0;
  const weekSchedules = [];
  const blockSchedules = draft.blocks.map((block) => {
    const weekCount = Number(block.weeks?.length ?? block.week_count ?? 0);
    const startDate = addDateOnlyDays(eventPlan.programme_start_date, offset * 7);
    const theoreticalEnd = addDateOnlyDays(startDate, weekCount * 7 - 1);
    const finalTrainingDate = addDateOnlyDays(eventPlan.event_date, -1);
    const endDate = theoreticalEnd && finalTrainingDate && theoreticalEnd > finalTrainingDate
      ? finalTrainingDate
      : theoreticalEnd;
    const startWeekIndex = offset + 1;

    for (let weekOffset = 0; weekOffset < weekCount; weekOffset += 1) {
      const weekStart = addDateOnlyDays(eventPlan.programme_start_date, (offset + weekOffset) * 7);
      const theoreticalWeekEnd = addDateOnlyDays(weekStart, 6);
      const weekEnd = theoreticalWeekEnd && finalTrainingDate && theoreticalWeekEnd > finalTrainingDate
        ? finalTrainingDate
        : theoreticalWeekEnd;
      const daysAtStart = dateOnlyDifference(weekStart, eventPlan.event_date);

      weekSchedules.push({
        start_date: weekStart,
        end_date: weekEnd,
        days_until_event_at_week_start: daysAtStart,
        partial_week: dateOnlyDifference(weekStart, weekEnd) !== 6
      });
    }

    offset += weekCount;

    return {
      start_date: startDate,
      end_date: endDate,
      start_week_index: startWeekIndex,
      end_week_index: offset
    };
  });

  return {
    valid: true,
    training_day_count: trainingDays,
    required_week_count: requiredWeeks,
    allocated_week_count: allocatedWeeks,
    week_delta: weekDelta,
    allocation_state: weekDelta === 0
      ? "balanced"
      : weekDelta > 0
        ? "under_allocated"
        : "over_allocated",
    partial_final_week_days: trainingDays - ((requiredWeeks - 1) * 7),
    blockSchedules,
    weekSchedules
  };
}

// DEV NOTE: FULL-UI-05B the event-plan detail fields moved to React - see
// CoachProgrammeEventFields.tsx, mounted at
// #template-event-fields-root. This replaces the old per-element
// syncTemplateEventFields() (once bound directly to
// elements.templateEventName/templateEventType/etc, captured at
// bootstrap before this React bundle's script tag runs) with a delegated
// handler keyed off each control's data-template-kind="event"/data-field
// attribute - see the two new elements.templateEventFieldsRoot listeners
// below, mirroring updateTemplateIdentityField()'s identical pattern for
// the identity fields.
export function updateTemplateEventField(control) {
  const draft = state.templateDraft;
  if (!draft || !draft.event_plan) return;

  const field = control.dataset.field;
  if (!field) return;

  draft.event_plan[field] = control.value;
  draft.event_compile_summary = null;
  saveState();
}

// DEV NOTE: FULL-UI-05B/FULL-UI-12C the event-plan detail fields (name/
// type/programme start date/event date/location/timezone/notes) and the
// event-binding picker (select/bind-button/status banner, formerly
// renderEventBindingPicker() here) both moved to React - see
// CoachProgrammeEventFields.tsx (#template-event-fields-root) and
// CoachProgrammeEventBindingPicker.tsx (#template-event-binding-root).
// The binding picker's own data comes from an independent fetch in
// useCoachProgrammeEventBinding.ts (GET /coach-workspace/events/library,
// GET /templates/:id/event-binding) - state.templateEventBindingStatus
// below is a SEPARATE legacy-owned copy of the same binding-status GET,
// kept because this function's own activation-gating logic (bottom of
// this function) still reads it. bindSelectedEventToTemplate() (the
// actual bind mutation) also stays legacy, unchanged, now reached via a
// kolosseum:bind-template-event bridge event the React button dispatches
// instead of a direct click listener. Everything else this function does
// - the enabled/hidden toggle, the countdown/allocation summary display,
// the calendar-date mutation this function still applies to
// draft.blocks[]/weeks[] - stays legacy; the calendar math/mutation is a
// deeper entanglement (render-triggered state mutation) than a clean
// render-only port could easily separate out in this slice.
export function renderEventCompiler() {
  const draft = state.templateDraft;
  if (!draft) return;

  const bound = Boolean(draft.bound_event_id);
  elements.templateEventEnabled.disabled = bound;

  const enabled = Boolean(draft.event_plan);
  elements.templateEventEnabled.checked = enabled;
  elements.templateEventFields.hidden = !enabled;
  if (enabled || bound) document.getElementById("templateEventSection").open = true;

  if (!enabled) {
    elements.saveCompleteTemplateButton.disabled = false;
    return;
  }

  const eventPlan = ensureDraftEventPlan();
  elements.templateEventCountdown.textContent = countdownLabel(eventPlan.event_date);
  elements.compileEventCalendarButton.disabled = bound;

  const summary = localEventCompileSummary(draft);
  const allocated = templateCounts(draft).weeks;
  elements.templateEventAllocatedWeeks.textContent = String(allocated);

  if (!summary?.valid) {
    elements.templateEventRequiredWeeks.textContent = "—";
    elements.templateEventWeekBalance.textContent = "—";
    elements.templateEventAllocationState.className = "assignment-requirements warning";
    elements.templateEventAllocationState.textContent = summary?.reason ?? "Set a start date and event date to compile the calendar.";
    elements.fitFinalBlockButton.disabled = true;
    elements.saveCompleteTemplateButton.disabled = true;
    return;
  }

  let globalWeekIndex = 0;
  draft.blocks.forEach((block, index) => {
    block.calendar_start_date = summary.blockSchedules[index]?.start_date ?? "";
    block.calendar_end_date = summary.blockSchedules[index]?.end_date ?? "";

    block.weeks.forEach((week) => {
      const calendar = summary.weekSchedules[globalWeekIndex] ?? null;
      globalWeekIndex += 1;
      week.calendar_start_date = calendar?.start_date ?? "";
      week.calendar_end_date = calendar?.end_date ?? "";
      week.days_until_event_at_week_start = calendar?.days_until_event_at_week_start ?? null;
      week.partial_week = calendar?.partial_week === true;
    });
  });

  elements.templateEventRequiredWeeks.textContent = String(summary.required_week_count);
  elements.templateEventWeekBalance.textContent = summary.week_delta === 0
    ? "Balanced"
    : summary.week_delta > 0
      ? `${summary.week_delta} remaining`
      : `${Math.abs(summary.week_delta)} over`;

  const balanced = summary.week_delta === 0;
  elements.templateEventAllocationState.className = balanced
    ? "assignment-requirements complete"
    : "assignment-requirements warning";
  elements.templateEventAllocationState.textContent = balanced
    ? `${summary.required_week_count} training weeks are fully allocated. The final training week contains ${summary.partial_final_week_days} day${summary.partial_final_week_days === 1 ? "" : "s"} before the event.`
    : summary.week_delta > 0
      ? `Allocate ${summary.week_delta} more week${summary.week_delta === 1 ? "" : "s"} before activation.`
      : `Remove ${Math.abs(summary.week_delta)} week${Math.abs(summary.week_delta) === 1 ? "" : "s"} before activation.`;

  const precedingWeeks = draft.blocks.slice(0, -1).reduce((total, block) => total + block.weeks.length, 0);
  const finalTarget = summary.required_week_count - precedingWeeks;
  elements.fitFinalBlockButton.disabled = finalTarget < 1 || finalTarget > 52;

  const status = state.templateEventBindingStatus;
  const bindingBlocksActivation = bound && (
    !status ||
    status.event_id !== draft.bound_event_id ||
    !status.accessible ||
    status.event_status !== "active" ||
    !status.is_current
  );

  elements.saveCompleteTemplateButton.disabled =
    !balanced ||
    eventPlan.event_date < todayDateOnly() ||
    bindingBlocksActivation;
}

export async function loadTemplateEventBindingStatusForDraft() {
  const draft = state.templateDraft;
  if (!draft?.template_id || !draft?.bound_event_id) {
    state.templateEventBindingStatus = null;
    return null;
  }

  const coachUserId = state.profile?.coachUserId ?? "";

  try {
    const response = await api(
      "GET",
      `/templates/${encodeURIComponent(draft.template_id)}/event-binding?coach_user_id=${encodeURIComponent(coachUserId)}`
    );
    state.templateEventBindingStatus = response.bound ? response : null;
  }
  catch {
    state.templateEventBindingStatus = null;
  }

  renderEventCompiler();
  return state.templateEventBindingStatus;
}

export async function bindSelectedEventToTemplate(eventId) {
  const draft = state.templateDraft;
  if (!draft) return;

  if (!eventId) return;

  showBusy("Binding to the selected event…");
  try {
    if (!draft.template_id) {
      await saveTemplateDraft({ quiet: true });
    }

    const response = await api(
      "POST",
      `/templates/${encodeURIComponent(state.templateDraft.template_id)}/bind-event`,
      {
        coach_user_id: state.profile.coachUserId,
        event_id: eventId
      }
    );

    const boundDraft = templateRecordToDraft(response.template);
    state.templateDraft = normalisePersistedTemplateDraft(boundDraft);
    state.templateDraftSavedSnapshot = templateDraftSnapshot(state.templateDraft);
    state.templateDraftSavedAt = String(response.template?.updated_at_iso8601 ?? nowIso());
    state.templateDraftDirty = false;
    saveState();

    await loadTemplateEventBindingStatusForDraft();
    await refreshProgrammeLibrary({ quiet: true });

    openTemplateBuilder(state.templateDraft, {
      preserveBaseline: true,
      skipRecoveryCheck: true
    });

    showNotice("Programme bound to the selected event.");
  }
  finally {
    hideBusy();
  }
}

function eventPreviewPayload() {
  const draft = state.templateDraft;
  if (!draft?.event_plan) throw new Error("Enable the event compiler first.");

  reindexTemplateDraft();

  return {
    activity_id: draft.activity_id,
    ...draft.event_plan,
    blocks: draft.blocks.map((block) => ({
      block_id: block.block_id,
      order_index: Number(block.order_index),
      name: block.name,
      block_type: block.block_type,
      week_count: block.weeks.length
    }))
  };
}

export async function previewEventCalendar() {
  showBusy("Compiling event calendar…");
  try {
    const response = await api(
      "POST",
      "/coach-workspace/event-compile-preview",
      eventPreviewPayload()
    );
    state.templateDraft.event_compile_summary = response.compile;
    if (response.compile?.event_plan_id) {
      state.templateDraft.event_plan.event_plan_id = response.compile.event_plan_id;
    }
    saveState();
    rerenderTemplateBuilder();
    showNotice("Event calendar compiled.");
  }
  finally {
    hideBusy();
  }
}
