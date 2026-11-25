import { api } from "../core/api.js";
import { elements } from "../core/elements.js";
import { nowIso } from "../core/format.js";
import { hideBusy, showBusy, showNotice } from "../core/notices.js";
import { closedPlace, openedPlace } from "../core/shell.js";
import { currentTemplateDraftOwnerUserId, dropTemplateDraft, normalisePersistedTemplateDraft, saveState, state } from "../core/state.js";
import { reindexTemplateDraft } from "./builderEdits.js";
import { templateRecordToDraft, withSetPlanPayload } from "./draft.js";
import { loadTemplateEventBindingStatusForDraft, renderEventCompiler, updateTemplateEventField } from "./eventPlan.js";
import { activateTemplateById, completeTemplateById, refreshProgrammeLibrary, renderTemplateLibrary } from "./programmes.js";
import { currentTemplateBuilderIssues } from "./validation.js";

export function templateCounts(draft) {
  const blocks = Array.isArray(draft?.blocks) ? draft.blocks : [];
  const weeks = blocks.reduce((total, block) => total + block.weeks.length, 0);
  const sessions = blocks.reduce(
    (total, block) => total + block.weeks.reduce(
      (weekTotal, week) => weekTotal + week.sessions.length,
      0
    ),
    0
  );
  return { blocks: blocks.length, weeks, sessions };
}

// DEV NOTE: FULL-UI-05B the fact counters (Version/Blocks/Weeks/Sessions)
// moved to React - see CoachProgrammeBuilderFactsPanel.tsx/
// useProgrammeBuilderDraft.ts, mounted at #programme-builder-facts-root.
// broadcastProgrammeDraft() (below) tells it what to render; the rest of
// the builder (open/close, tree, edits, event binding, save/complete/
// activate) stays legacy for now. state.templateDraft is mutated in place
// (add/remove/reorder push/splice its own arrays rather than replacing the
// object), so a shallow copy is dispatched each time - React's setState
// bails out on an identical object reference, and every mutating function
// here reuses the same underlying object across the whole builder session.
function broadcastProgrammeDraft() {
  document.dispatchEvent(
    new CustomEvent("kolosseum:programme-draft-changed", {
      detail: {
        draft: state.templateDraft ? { ...state.templateDraft } : null,
        saving: templateBuilderSaving,
        saveError: templateBuilderSaveError,
        dirty: templateDraftIsDirty(),
        recovered: state.templateDraftRecovered === true,
        savedAt: String(state.templateDraftSavedAt ?? "")
      }
    })
  );
}

function updateTemplateFacts() {
  const draft = state.templateDraft;
  const counts = templateCounts(draft);
  elements.addTemplateBlockButton.disabled =
    counts.blocks >= 12 ||
    counts.weeks >= 104;
  renderEventCompiler();
  broadcastProgrammeDraft();
}

export function rerenderTemplateBuilder() {
  reindexTemplateDraft();
  saveState();
  updateTemplateFacts();
  renderTemplateBuilderState();
}

// FULL-UI-05B: programme builder state, recovery, validation links and keyboard support.
// These helpers manage browser presentation state only. They do not call or alter the engine.
export let templateBuilderSaving = false;
let templateBuilderSaveError = "";

export function templateDraftSnapshot(draft) {
  if (!draft || typeof draft !== "object") return "";
  return JSON.stringify(normalisePersistedTemplateDraft(draft));
}

export function templateDraftIsDirty() {
  if (!state.templateDraft || state.templateDraftWasOpen !== true) {
    return false;
  }

  return templateDraftSnapshot(state.templateDraft) !==
    String(state.templateDraftSavedSnapshot ?? "");
}

// A draft is only offered back to the coach who left it - one saved by an
// earlier account in this browser (or before drafts recorded an owner) is
// never shown.
export function hasRecoverableTemplateDraft() {
  const ownerUserId = currentTemplateDraftOwnerUserId();
  return Boolean(
    state.templateDraft &&
    state.templateDraftWasOpen === true &&
    ownerUserId &&
    state.templateDraftOwnerUserId === ownerUserId &&
    templateDraftIsDirty()
  );
}

export function clearTemplateDraftState() {
  dropTemplateDraft();
  templateBuilderSaveError = "";
  broadcastProgrammeDraft();
}

export function confirmTemplateBuilderDeparture() {
  if (!templateDraftIsDirty()) return true;

  return globalThis.confirm(
    "This programme has unsaved changes. Leave the builder and discard those changes?"
  );
}

export function confirmRecoveredTemplateReplacement() {
  if (!hasRecoverableTemplateDraft()) return true;

  if (
    !globalThis.confirm(
      "A recovered programme draft has unsaved changes. Discard it and open another programme?"
    )
  ) {
    return false;
  }

  clearTemplateDraftState();
  saveState();
  return true;
}

// DEV NOTE: FULL-UI-05B the save-state badge and save-detail text moved to
// React - see CoachProgrammeBuilderSaveStatus.tsx's
// CoachProgrammeBuilderSaveBadge()/CoachProgrammeBuilderSaveDetail(),
// mounted at #programme-builder-save-badge-root/
// #programme-builder-save-detail-root, fed by builderSaveStatus() in
// programmeDraft.ts. broadcastProgrammeDraft() now runs unconditionally
// at the top of this function (rather than after the old
// elements.templateBuilderSaveState guard, which no longer exists) so it
// keeps covering the completion validation list and fact counters
// regardless of what's left in this function.
function renderTemplateBuilderState() {
  broadcastProgrammeDraft();

  if (!elements.templateBuilderValidation) {
    return;
  }

  const draft = state.templateDraft;

  if (!draft) {
    elements.templateBuilderValidation.hidden = true;
    return;
  }

  state.templateDraftDirty = templateDraftIsDirty();

  const issues = currentTemplateBuilderIssues();
  // Nothing's wrong with a programme nobody has started writing.
  elements.templateBuilderValidation.hidden =
    issues.length > 0 && !draft.template_id && !state.templateDraftDirty;
  elements.templateBuilderValidation.className = issues.length === 0
    ? "template-builder-validation complete"
    : "template-builder-validation warning";

  elements.saveTemplateButton.disabled = templateBuilderSaving;
  elements.saveCompleteTemplateButton.disabled =
    templateBuilderSaving || issues.length > 0;
  elements.activateTemplateButton.disabled = templateBuilderSaving;
}

export function renderTemplateRecovery() {
  if (!elements.templateDraftRecovery) return;

  const recoverable = hasRecoverableTemplateDraft();
  elements.templateDraftRecovery.hidden = !recoverable;

  if (!recoverable) return;

  const name =
    String(state.templateDraft?.template_name ?? "").trim() ||
    "Untitled programme";

  elements.templateDraftRecoveryTitle.textContent =
    `Recover ${name}`;

  elements.templateDraftRecoveryText.textContent =
    state.templateDraft?.template_id
      ? "Unsaved browser changes were found for this server draft."
      : "An unsaved new programme was found in this browser.";
}

export function resumeRecoveredTemplateDraft() {
  if (!hasRecoverableTemplateDraft()) return false;

  return openTemplateBuilder(
    state.templateDraft,
    {
      preserveBaseline: true,
      recovered: true,
      skipRecoveryCheck: true
    }
  );
}

export function discardRecoveredTemplateDraft() {
  if (!hasRecoverableTemplateDraft()) {
    clearTemplateDraftState();
    saveState();
    renderTemplateRecovery();
    return true;
  }

  if (
    !globalThis.confirm(
      "Discard the recovered programme changes stored in this browser?"
    )
  ) {
    return false;
  }

  clearTemplateDraftState();
  saveState();
  renderTemplateRecovery();
  showNotice("Recovered programme changes discarded.");
  return true;
}

export function scheduleTemplateBuilderStateRefresh() {
  queueMicrotask(() => {
    if (
      !state.templateDraft ||
      elements.templateBuilderView.hidden
    ) {
      return;
    }

    templateBuilderSaveError = "";
    state.templateDraftDirty = templateDraftIsDirty();
    saveState();
    renderTemplateBuilderState();
  });
}

export function openTemplateBuilder(draft, options = {}) {
  if (
    options.skipRecoveryCheck !== true &&
    hasRecoverableTemplateDraft()
  ) {
    if (!confirmRecoveredTemplateReplacement()) {
      return false;
    }
  }

  state.selectedTemplateId = "";
  state.templateDraft = normalisePersistedTemplateDraft(draft);

  if (!state.templateDraft) {
    throw new Error("The programme draft could not be opened.");
  }

  if (options.preserveBaseline !== true) {
    state.templateDraftSavedSnapshot =
      templateDraftSnapshot(state.templateDraft);
    state.templateDraftSavedAt = String(
      state.templateDraft.updated_at_iso8601 ?? ""
    );
  }

  state.templateDraftWasOpen = true;
  state.templateDraftOwnerUserId = currentTemplateDraftOwnerUserId();
  state.templateDraftRecovered = options.recovered === true;
  state.templateDraftDirty = templateDraftIsDirty();
  templateBuilderSaveError = "";

  elements.templateDetailPanel.hidden = true;
  elements.templateLibraryView.hidden = true;
  elements.templateBuilderView.hidden = false;
  elements.templateBuilderTitle.textContent = state.templateDraft.template_id
    ? `Edit ${state.templateDraft.template_name}`
    : "New programme";
  elements.saveTemplateButton.hidden =
    state.templateDraft.template_status !== "draft";
  elements.saveCompleteTemplateButton.hidden =
    state.templateDraft.template_status !== "draft";
  elements.activateTemplateButton.hidden =
    state.templateDraft.template_status !== "complete";

  openedPlace("coach_programme_builder", { draft: state.templateDraft.template_id || "new" });
  saveState();
  rerenderTemplateBuilder();

  loadTemplateEventBindingStatusForDraft();

  if (
    options.recovered === true &&
    elements.templateBuilderSaveBadgeRoot
  ) {
    elements.templateBuilderSaveBadgeRoot.focus({
      preventScroll: true
    });
  }

  return true;
}

export function closeTemplateBuilder(options = {}) {
  if (
    options.force !== true &&
    !confirmTemplateBuilderDeparture()
  ) {
    return false;
  }

  clearTemplateDraftState();
  saveState();

  elements.templateBuilderView.hidden = true;
  elements.templateLibraryView.hidden = false;
  elements.templateDetailPanel.hidden = true;
  renderTemplateLibrary();

  if (options.updateRoute !== false) closedPlace("coach_programme_builder");

  if (options.silent !== true) {
    showNotice("Programme builder closed.");
  }

  return true;
}

function templatePayloadFromDraft() {
  const draft = state.templateDraft;
  if (!draft) throw new Error("No programme is open.");

  reindexTemplateDraft();

  if (!draft.template_name.trim()) {
    throw new Error("Enter a programme name.");
  }

  return {
    coach_user_id: state.profile.coachUserId,
    template_id: draft.template_id,
    template_family_id: draft.template_family_id,
    template_version: Number(draft.template_version),
    template_name: draft.template_name.trim(),
    description: draft.description.trim(),
    activity_id: draft.activity_id,
    ...(typeof draft.adjust_for_breaks === "boolean" ? { adjust_for_breaks: draft.adjust_for_breaks } : {}),
    event_plan: draft.event_plan
      ? {
          event_plan_id: draft.event_plan.event_plan_id,
          event_name: draft.event_plan.event_name.trim(),
          event_type: draft.event_plan.event_type,
          event_date: draft.event_plan.event_date,
          programme_start_date: draft.event_plan.programme_start_date,
          location: draft.event_plan.location.trim(),
          timezone: draft.event_plan.timezone.trim(),
          notes: draft.event_plan.notes.trim()
        }
      : null,
    // Echoed back unchanged: only bindSelectedEventToTemplate() may create or
    // move this binding (see the immutability guard in
    // saveCoachProgrammeTemplate on the server). An ordinary content save can
    // resize blocks/weeks but must never duplicate or drift the event date.
    bound_event_id: draft.bound_event_id || "",
    bound_event_record_sha256: draft.bound_event_record_sha256 || "",
    blocks: draft.blocks.map((block) => ({
      block_id: block.block_id,
      order_index: Number(block.order_index),
      name: block.name.trim(),
      description: block.description.trim(),
      block_type: block.block_type,
      week_count: block.weeks.length,
      weeks: block.weeks.map((week) => ({
        week_id: week.week_id,
        order_index: Number(week.order_index),
        sessions: week.sessions.map((session) => ({
          session_id: session.session_id,
          order_index: Number(session.order_index),
          title: session.title.trim(),
          coaching_notes: (session.coaching_notes ?? "").trim(),
          work_items: session.work_items.map((workItem) => withSetPlanPayload(workItem, {
            work_item_id: workItem.work_item_id,
            order_index: Number(workItem.order_index),
            exercise_id: workItem.exercise_id,
            planned_sets: Number(workItem.planned_sets),
            prescription_mode: workItem.prescription_mode,
            rep_mode: workItem.rep_mode,
            planned_reps: Number(workItem.planned_reps),
            rep_min: Number(workItem.rep_min),
            rep_max: Number(workItem.rep_max),
            tempo: (workItem.tempo ?? "").trim(),
            duration_mode: workItem.duration_mode,
            planned_duration_seconds: Number(workItem.planned_duration_seconds),
            duration_min_seconds: Number(workItem.duration_min_seconds),
            duration_max_seconds: Number(workItem.duration_max_seconds),
            distance_mode: workItem.distance_mode,
            distance_unit: workItem.distance_unit,
            planned_distance_value: Number(workItem.planned_distance_value),
            distance_min_value: Number(workItem.distance_min_value),
            distance_max_value: Number(workItem.distance_max_value),
            load_mode: workItem.load_mode,
            percent_1rm: Number(workItem.percent_1rm),
            weight_value: Number(workItem.weight_value),
            set_mode: workItem.set_mode === "range" ? "range" : "fixed",
            planned_sets_max: Number(workItem.planned_sets_max ?? workItem.planned_sets),
            load_range_mode: workItem.load_range_mode === "range" ? "range" : "fixed",
            percent_1rm_max: Number(workItem.percent_1rm_max ?? workItem.percent_1rm),
            weight_value_max: Number(workItem.weight_value_max ?? workItem.weight_value),
            weight_unit: workItem.weight_unit,
            rpe_value: Number(workItem.rpe_value),
            borg_value: Number(workItem.borg_value),
            cr10_value: Number(workItem.cr10_value),
            rest_seconds: Number(workItem.rest_seconds),
            role: workItem.role,
            coaching_notes: (workItem.coaching_notes ?? "").trim(),
            segment: workItem.segment,
            group_id: workItem.group_id,
            group_type: workItem.group_type
          }))
        }))
      }))
    })),
    updated_at_iso8601: nowIso()
  };
}

export async function saveTemplateDraft(options = {}) {
  if (!state.templateDraft) {
    throw new Error("No programme is open.");
  }

  if (!options.quiet) {
    showBusy("Saving programme draft…");
  }

  templateBuilderSaving = true;
  templateBuilderSaveError = "";
  renderTemplateBuilderState();

  try {
    const payload = templatePayloadFromDraft();
    const response = await api("POST", "/templates", payload);
    const savedDraft = templateRecordToDraft(response.template);

    state.templateDraft = normalisePersistedTemplateDraft(savedDraft);
    state.templateDraftSavedSnapshot =
      templateDraftSnapshot(state.templateDraft);
    state.templateDraftSavedAt = String(
      response.template?.updated_at_iso8601 ??
      payload.updated_at_iso8601 ??
      nowIso()
    );
    state.templateDraftWasOpen = true;
    state.templateDraftOwnerUserId = currentTemplateDraftOwnerUserId();
    state.templateDraftRecovered = false;
    state.templateDraftDirty = false;

    await refreshProgrammeLibrary({ quiet: true });

    openTemplateBuilder(
      state.templateDraft,
      {
        preserveBaseline: true,
        skipRecoveryCheck: true
      }
    );

    if (!options.quiet) {
      showNotice("Programme draft saved.");
    }

    return response.template;
  }
  catch (error) {
    templateBuilderSaveError =
      error instanceof Error
        ? error.message
        : "The programme draft could not be saved.";

    state.templateDraftDirty = templateDraftIsDirty();
    saveState();
    renderTemplateBuilderState();
    throw error;
  }
  finally {
    templateBuilderSaving = false;
    renderTemplateBuilderState();

    if (!options.quiet) {
      hideBusy();
    }
  }
}

export async function completeOpenTemplate() {
  if (!state.templateDraft) return;
  let templateId = state.templateDraft.template_id;
  const saved = await saveTemplateDraft({ quiet: true });
  templateId = String(saved.template_id ?? templateId);
  const completed = await completeTemplateById(templateId);

  if (completed) {
    // preserveBaseline is deliberately omitted here (unlike the other
    // openTemplateBuilder() call sites above): `completed` is a fresh,
    // just-persisted server record with a different template_status than
    // the pre-completion draft snapshot saveTemplateDraft() took a moment
    // earlier, so the baseline must reset to match it - otherwise
    // templateDraftIsDirty() spuriously compares against the stale
    // draft-status snapshot and shows "Unsaved changes" for a template
    // that was just successfully saved and completed.
    openTemplateBuilder(
      templateRecordToDraft(completed),
      {
        skipRecoveryCheck: true
      }
    );
  }
}

export async function activateOpenTemplate() {
  if (!state.templateDraft) return;
  await activateTemplateById(state.templateDraft.template_id);
}

export function handleTemplateEventFieldEvent(event) {
  const control = event.target.closest('[data-template-kind="event"]');
  if (!control) return;
  updateTemplateEventField(control);
  updateTemplateFacts();
}
