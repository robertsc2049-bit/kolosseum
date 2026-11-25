import { elements } from "../core/elements.js";
import { handleError } from "../core/notices.js";
import { coachNoteDirty } from "../core/shell.js";
import { state } from "../core/state.js";
import { activateOpenTemplate, closeTemplateBuilder, completeOpenTemplate, discardRecoveredTemplateDraft, handleTemplateEventFieldEvent, openTemplateBuilder, rerenderTemplateBuilder, resumeRecoveredTemplateDraft, saveTemplateDraft, scheduleTemplateBuilderStateRefresh, templateBuilderSaving, templateDraftIsDirty } from "./builder.js";
import { addTemplateBlock, addTemplateSession, addTemplateWeek, addTemplateWorkItem, duplicateTemplateBlock, duplicateTemplateSession, duplicateTemplateWeek, duplicateTemplateWorkItem, fitFinalBlockToEvent, groupWorkItemWithNext, moveTemplateBlock, moveTemplateSession, moveTemplateWeek, moveTemplateWorkItem, removeTemplateBlock, removeTemplateSession, removeTemplateWeek, removeTemplateWorkItem, ungroupWorkItem, updateTemplateFieldFromControl, updateTemplateIdentityField } from "./builderEdits.js";
import { newTemplateDraft, workItemLoadValue } from "./draft.js";
import { bindSelectedEventToTemplate, ensureDraftEventPlan, previewEventCalendar } from "./eventPlan.js";
import { loadTemplateExercises } from "./programmes.js";
import { focusTemplateValidationIssue } from "./validation.js";

// FULL-UI-05B builder interaction bindings.
elements.templateDraftRecoveryResumeButton.addEventListener(
  "click",
  resumeRecoveredTemplateDraft
);

elements.templateDraftRecoveryDiscardButton.addEventListener(
  "click",
  discardRecoveredTemplateDraft
);

elements.templateBuilderDiscardButton.addEventListener(
  "click",
  () => closeTemplateBuilder()
);

elements.templateBuilderValidationList.addEventListener(
  "click",
  (event) => {
    const button = event.target.closest(
      "[data-builder-validation-index]"
    );

    if (button) {
      focusTemplateValidationIssue(
        button.dataset.builderValidationIndex
      );
    }
  }
);

for (const eventName of ["input", "change"]) {
  document.addEventListener(eventName, (event) => {
    if (
      !elements.templateBuilderView.hidden &&
      event.target.closest("#templateBuilderView")
    ) {
      scheduleTemplateBuilderStateRefresh();
    }
  });
}

document.addEventListener("click", (event) => {
  if (elements.templateBuilderView.hidden) return;

  const target = event.target.closest(
    "#templateBuilderView button"
  );

  if (!target) return;

  if (
    target.matches(
      "#saveTemplateButton, " +
      "#saveCompleteTemplateButton, " +
      "#activateTemplateButton, " +
      "#backToTemplatesButton, " +
      "#templateBuilderDiscardButton, " +
      ".template-validation-link"
    )
  ) {
    return;
  }

  scheduleTemplateBuilderStateRefresh();
});

document.addEventListener("keydown", (event) => {
  if (elements.templateBuilderView.hidden) return;

  if (
    (event.ctrlKey || event.metaKey) &&
    event.key.toLowerCase() === "s"
  ) {
    event.preventDefault();

    if (!templateBuilderSaving) {
      saveTemplateDraft().catch(handleError);
    }

    return;
  }

  if (event.key === "Escape") {
    event.preventDefault();
    closeTemplateBuilder();
  }
});

globalThis.addEventListener("beforeunload", (event) => {
  if (!templateDraftIsDirty() && !coachNoteDirty) return;

  event.preventDefault();
  event.returnValue = "";
});

elements.newTemplateButton.addEventListener("click", () => {
  loadTemplateExercises()
    .then(() => openTemplateBuilder(newTemplateDraft()))
    .catch(handleError);
});

elements.backToTemplatesButton.addEventListener("click", closeTemplateBuilder);

elements.saveTemplateButton.addEventListener("click", () => {
  saveTemplateDraft().catch(handleError);
});

elements.saveCompleteTemplateButton.addEventListener("click", () => {
  completeOpenTemplate().catch(handleError);
});

elements.activateTemplateButton.addEventListener("click", () => {
  activateOpenTemplate().catch(handleError);
});

elements.addTemplateBlockButton.addEventListener("click", addTemplateBlock);

elements.templateIdentityRoot.addEventListener("input", (event) => {
  const control = event.target.closest('[data-template-kind="header"]');
  if (control) updateTemplateIdentityField(control);
});

elements.templateIdentityRoot.addEventListener("change", (event) => {
  const control = event.target.closest('[data-template-kind="header"]');
  if (!control) return;

  updateTemplateIdentityField(control);

  if (control.dataset.field === "activity_id" && state.templateDraft?.event_plan) {
    ensureDraftEventPlan();
    state.templateDraft.event_compile_summary = null;
    rerenderTemplateBuilder();
  }
});

elements.templateEventEnabled.addEventListener("change", () => {
  if (!state.templateDraft) return;

  if (elements.templateEventEnabled.checked) {
    ensureDraftEventPlan();
  }
  else {
    state.templateDraft.event_plan = null;
    state.templateDraft.event_compile_summary = null;
    for (const block of state.templateDraft.blocks) {
      block.calendar_start_date = "";
      block.calendar_end_date = "";
    }
  }

  rerenderTemplateBuilder();
});

elements.templateEventFieldsRoot.addEventListener("input", handleTemplateEventFieldEvent);
elements.templateEventFieldsRoot.addEventListener("change", handleTemplateEventFieldEvent);

elements.compileEventCalendarButton.addEventListener("click", () => {
  previewEventCalendar().catch(handleError);
});

elements.fitFinalBlockButton.addEventListener("click", () => {
  try {
    fitFinalBlockToEvent();
  }
  catch (error) {
    handleError(error);
  }
});

// The builder's "Progress across weeks" (BlockProgressionPanel.tsx) hands
// back a block's weeks, progressed from week 1 (or put back by Undo).
document.addEventListener("kolosseum:replace-template-block-weeks", (event) => {
  const blockIndex = Number(event.detail?.block_index);
  const weeks = event.detail?.weeks;
  const block = state.templateDraft?.blocks?.[blockIndex];
  if (!block || !Array.isArray(weeks) || weeks.length !== block.weeks.length) return;
  block.weeks = JSON.parse(JSON.stringify(weeks));
  state.templateDraft.event_compile_summary = null;
  rerenderTemplateBuilder();
});

document.addEventListener("kolosseum:bind-template-event", (event) => {
  const eventId = event.detail?.event_id;
  if (eventId) bindSelectedEventToTemplate(eventId).catch(handleError);
});

elements.templateBlocks.addEventListener("input", (event) => {
  const control = event.target.closest("[data-template-kind]");
  if (control) updateTemplateFieldFromControl(control);
});

elements.templateBlocks.addEventListener("change", (event) => {
  const control = event.target.closest("[data-template-kind]");
  if (control) updateTemplateFieldFromControl(control);
});

elements.templateBlocks.addEventListener("click", (event) => {
  const action = event.target.closest("button");
  if (!action) return;

  const blockIndex = Number(action.dataset.blockIndex);
  const weekIndex = Number(action.dataset.weekIndex);
  const sessionIndex = Number(action.dataset.sessionIndex);
  const workItemIndex = Number(action.dataset.workItemIndex);
  const direction = Number(action.dataset.direction);

  if (action.classList.contains("add-set-line") || action.classList.contains("remove-set-line")) {
    const item = state.templateDraft?.blocks[blockIndex]?.weeks[weekIndex]?.sessions[sessionIndex]?.work_items[workItemIndex];
    if (!item) return;
    const lines = Array.isArray(item.set_plan) ? item.set_plan : [];
    if (action.classList.contains("add-set-line")) {
      const last = lines[lines.length - 1];
      if (lines.length < 12) lines.push(last ? { ...last, amrap: false } : { sets: 1, reps: 5, value: workItemLoadValue(item), amrap: false });
    }
    else if (lines.length > 1) lines.splice(Number(action.dataset.lineIndex), 1);
    item.set_plan = lines;
    rerenderTemplateBuilder();
    return;
  }

  if (action.classList.contains("add-template-session")) {
    addTemplateSession(blockIndex, weekIndex);
  }
  else if (action.classList.contains("remove-template-session")) {
    removeTemplateSession(blockIndex, weekIndex, sessionIndex);
  }
  else if (action.classList.contains("duplicate-template-session")) {
    duplicateTemplateSession(blockIndex, weekIndex, sessionIndex);
  }
  else if (action.classList.contains("move-template-session")) {
    moveTemplateSession(blockIndex, weekIndex, sessionIndex, direction);
  }
  else if (action.classList.contains("add-template-work-item")) {
    addTemplateWorkItem(blockIndex, weekIndex, sessionIndex);
  }
  else if (action.classList.contains("remove-template-work-item")) {
    removeTemplateWorkItem(blockIndex, weekIndex, sessionIndex, workItemIndex);
  }
  else if (action.classList.contains("duplicate-template-work-item")) {
    duplicateTemplateWorkItem(blockIndex, weekIndex, sessionIndex, workItemIndex);
  }
  else if (action.classList.contains("move-template-work-item")) {
    moveTemplateWorkItem(blockIndex, weekIndex, sessionIndex, workItemIndex, direction);
  }
  else if (action.classList.contains("group-with-next-work-item")) {
    groupWorkItemWithNext(blockIndex, weekIndex, sessionIndex, workItemIndex);
  }
  else if (action.classList.contains("ungroup-work-item")) {
    ungroupWorkItem(blockIndex, weekIndex, sessionIndex, workItemIndex);
  }
  else if (action.classList.contains("add-template-week")) {
    addTemplateWeek(blockIndex);
  }
  else if (action.classList.contains("remove-template-week")) {
    removeTemplateWeek(blockIndex, weekIndex);
  }
  else if (action.classList.contains("duplicate-template-week")) {
    duplicateTemplateWeek(blockIndex, weekIndex);
  }
  else if (action.classList.contains("move-template-week")) {
    moveTemplateWeek(blockIndex, weekIndex, direction);
  }
  else if (action.classList.contains("remove-template-block")) {
    removeTemplateBlock(blockIndex);
  }
  else if (action.classList.contains("duplicate-template-block")) {
    duplicateTemplateBlock(blockIndex);
  }
  else if (action.classList.contains("move-template-block")) {
    moveTemplateBlock(blockIndex, direction);
  }
});
