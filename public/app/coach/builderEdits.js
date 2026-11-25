import { showNotice } from "../core/notices.js";
import { saveState, state } from "../core/state.js";
import { rerenderTemplateBuilder, templateCounts } from "./builder.js";
import { newTemplateBlock, newTemplateSession, newTemplateWeek, newTemplateWorkItem, workItemLoadValue } from "./draft.js";
import { ensureDraftEventPlan, localEventCompileSummary } from "./eventPlan.js";

function resizeBlockWeeks(blockIndex, requestedCount) {
  const block = state.templateDraft?.blocks[blockIndex];
  if (!block) return;

  const totalWithoutBlock = templateCounts(state.templateDraft).weeks - block.weeks.length;
  const maximum = Math.min(52, 104 - totalWithoutBlock);
  const target = Math.max(1, Math.min(maximum, Math.trunc(Number(requestedCount) || 1)));

  while (block.weeks.length < target) {
    const source = block.weeks[block.weeks.length - 1] ?? newTemplateWeek(1);
    block.weeks.push(cloneTemplateNode(source));
  }

  if (block.weeks.length > target) {
    block.weeks.splice(target);
  }

  block.week_count = block.weeks.length;
  state.templateDraft.event_compile_summary = null;
}

export function fitFinalBlockToEvent() {
  const draft = state.templateDraft;
  const summary = localEventCompileSummary(draft);
  if (!draft?.event_plan || !summary?.valid) {
    throw new Error("Set valid programme and event dates first.");
  }

  const finalIndex = draft.blocks.length - 1;
  const precedingWeeks = draft.blocks.slice(0, finalIndex)
    .reduce((total, block) => total + block.weeks.length, 0);
  const target = summary.required_week_count - precedingWeeks;

  if (target < 1 || target > 52) {
    throw new Error("The final block cannot absorb the remaining weeks. Adjust earlier blocks or add another block.");
  }

  resizeBlockWeeks(finalIndex, target);
  rerenderTemplateBuilder();
  showNotice(`Final block fitted to ${target} week${target === 1 ? "" : "s"}.`);
}

export function reindexTemplateDraft() {
  if (!state.templateDraft) return;

  state.templateDraft.blocks.forEach((block, blockIndex) => {
    block.order_index = blockIndex + 1;
    block.week_count = block.weeks.length;
    block.weeks.forEach((week, weekIndex) => {
      week.order_index = weekIndex + 1;
      week.sessions.forEach((session, sessionIndex) => {
        session.order_index = sessionIndex + 1;
        session.work_items.forEach((workItem, workItemIndex) => {
          workItem.order_index = workItemIndex + 1;
        });
      });
    });
  });
}

// DEV NOTE: FULL-UI-05B the identity fields (name/activity/description)
// moved to React - see CoachProgrammeIdentityFields.tsx, mounted at
// #template-identity-root. The old per-element syncTemplateHeader() (once
// bound directly to elements.templateName/templateActivity/
// templateDescription) is replaced by this delegated handler, keyed off
// each control's data-template-kind="header"/data-field attribute - see
// the two new elements.templateIdentityRoot listeners below for how it's
// wired, mirroring updateTemplateFieldFromControl()'s existing pattern
// for the builder tree.
export function updateTemplateIdentityField(control) {
  const draft = state.templateDraft;
  if (!draft) return;

  const field = control.dataset.field;
  if (!field) return;

  draft[field] = control.type === "checkbox" ? control.checked : control.value;
  if (draft.event_plan) {
    ensureDraftEventPlan();
  }
  saveState();
}

export function updateTemplateFieldFromControl(control) {
  const draft = state.templateDraft;
  if (!draft) return;

  const kind = control.dataset.templateKind;
  const blockIndex = Number(control.dataset.blockIndex);
  const weekIndex = Number(control.dataset.weekIndex);
  const sessionIndex = Number(control.dataset.sessionIndex);
  const workItemIndex = Number(control.dataset.workItemIndex);
  const field = control.dataset.field;
  let target;

  // A set line of a set-by-set item (data-line-index).
  if (kind === "set-line") {
    const item = draft.blocks[blockIndex]?.weeks[weekIndex]?.sessions[sessionIndex]?.work_items[workItemIndex];
    const line = item?.set_plan?.[Number(control.dataset.lineIndex)];
    if (!line || !field) return;
    line[field] = control.type === "checkbox" ? control.checked : Number(control.value);
    saveState();
    return;
  }

  if (kind === "block") {
    target = draft.blocks[blockIndex];
  }
  else if (kind === "session") {
    target = draft.blocks[blockIndex]?.weeks[weekIndex]?.sessions[sessionIndex];
  }
  else if (kind === "work-item") {
    target = draft.blocks[blockIndex]?.weeks[weekIndex]?.sessions[sessionIndex]?.work_items[workItemIndex];
  }

  if (!target || !field) return;

  // Starting set by set: one line from what the item had.
  if (kind === "work-item" && field === "set_mode" && control.value === "per_set" && !(Array.isArray(target.set_plan) && target.set_plan.length)) {
    target.set_plan = [{ sets: Number(target.planned_sets) || 3, reps: Number(target.planned_reps) || 5, value: workItemLoadValue(target), amrap: false }];
  }

  if (kind === "block" && field === "week_count") {
    resizeBlockWeeks(blockIndex, Number(control.value));
    rerenderTemplateBuilder();
    return;
  }

  // FULL-UI-05B: "reps in reserve" is never a persisted field - it's an
  // alternate reading of the same 1-10 effort scale as rpe_value
  // (rir = 10 - rpe), offered so a coach can prescribe in whichever scale
  // they think in. See CoachProgrammeBuilderTree.tsx's RpeLoadField.
  if (kind === "work-item" && field === "rir_value") {
    const rir = Math.max(0, Math.min(9, Math.round(Number(control.value)) || 0));
    target.rpe_value = 10 - rir;
    saveState();
    return;
  }

  target[field] = control.type === "number" ? Number(control.value) : control.value;
  if (kind === "block") {
    state.templateDraft.event_compile_summary = null;
  }

  if (kind === "work-item" && ["rep_mode", "load_mode", "prescription_mode", "duration_mode", "distance_mode", "set_mode", "load_range_mode"].includes(field)) {
    rerenderTemplateBuilder();
    return;
  }

  saveState();
}

function cloneTemplateNode(value) {
  const cloned = JSON.parse(JSON.stringify(value));
  const clearIds = (node) => {
    if (!node || typeof node !== "object") return;
    for (const key of ["block_id", "week_id", "session_id", "work_item_id"]) {
      if (key in node) node[key] = "";
    }
    for (const child of Object.values(node)) {
      if (Array.isArray(child)) child.forEach(clearIds);
      else if (child && typeof child === "object") clearIds(child);
    }
  };
  clearIds(cloned);
  return cloned;
}

export function addTemplateBlock() {
  if (
    !state.templateDraft ||
    state.templateDraft.blocks.length >= 12 ||
    templateCounts(state.templateDraft).weeks >= 104
  ) return;
  state.templateDraft.blocks.push(newTemplateBlock(state.templateDraft.blocks.length + 1));
  rerenderTemplateBuilder();
}

export function removeTemplateBlock(blockIndex) {
  if (!state.templateDraft || state.templateDraft.blocks.length <= 1) return;
  state.templateDraft.blocks.splice(blockIndex, 1);
  rerenderTemplateBuilder();
}

export function duplicateTemplateBlock(blockIndex) {
  if (!state.templateDraft || state.templateDraft.blocks.length >= 12) return;
  const source = state.templateDraft.blocks[blockIndex];
  if (
    !source ||
    templateCounts(state.templateDraft).weeks + source.weeks.length > 104
  ) return;
  const copy = cloneTemplateNode(source);
  copy.name = `${source.name} copy`;
  state.templateDraft.blocks.splice(blockIndex + 1, 0, copy);
  rerenderTemplateBuilder();
}

function moveArrayItem(list, index, direction) {
  const target = index + direction;
  if (target < 0 || target >= list.length) return;
  [list[index], list[target]] = [list[target], list[index]];
}

export function moveTemplateBlock(blockIndex, direction) {
  if (!state.templateDraft) return;
  moveArrayItem(state.templateDraft.blocks, blockIndex, direction);
  rerenderTemplateBuilder();
}

export function addTemplateWeek(blockIndex) {
  const block = state.templateDraft?.blocks[blockIndex];
  if (
    !block ||
    block.weeks.length >= 52 ||
    templateCounts(state.templateDraft).weeks >= 104
  ) return;
  resizeBlockWeeks(blockIndex, block.weeks.length + 1);
  rerenderTemplateBuilder();
}

export function removeTemplateWeek(blockIndex, weekIndex) {
  const block = state.templateDraft?.blocks[blockIndex];
  if (!block || block.weeks.length <= 1) return;
  block.weeks.splice(weekIndex, 1);
  state.templateDraft.event_compile_summary = null;
  rerenderTemplateBuilder();
}

export function duplicateTemplateWeek(blockIndex, weekIndex) {
  const block = state.templateDraft?.blocks[blockIndex];
  if (
    !block ||
    block.weeks.length >= 52 ||
    templateCounts(state.templateDraft).weeks >= 104
  ) return;
  const source = block.weeks[weekIndex];
  if (!source) return;
  block.weeks.splice(weekIndex + 1, 0, cloneTemplateNode(source));
  state.templateDraft.event_compile_summary = null;
  rerenderTemplateBuilder();
}

export function moveTemplateWeek(blockIndex, weekIndex, direction) {
  const block = state.templateDraft?.blocks[blockIndex];
  if (!block) return;
  moveArrayItem(block.weeks, weekIndex, direction);
  rerenderTemplateBuilder();
}

export function addTemplateSession(blockIndex, weekIndex) {
  const week = state.templateDraft?.blocks[blockIndex]?.weeks[weekIndex];
  if (!week || week.sessions.length >= 7) return;
  week.sessions.push(newTemplateSession(week.sessions.length + 1));
  rerenderTemplateBuilder();
}

export function removeTemplateSession(blockIndex, weekIndex, sessionIndex) {
  const week = state.templateDraft?.blocks[blockIndex]?.weeks[weekIndex];
  if (!week || week.sessions.length <= 1) return;
  week.sessions.splice(sessionIndex, 1);
  rerenderTemplateBuilder();
}

export function duplicateTemplateSession(blockIndex, weekIndex, sessionIndex) {
  const week = state.templateDraft?.blocks[blockIndex]?.weeks[weekIndex];
  if (!week || week.sessions.length >= 7) return;
  const source = week.sessions[sessionIndex];
  if (!source) return;
  const copy = cloneTemplateNode(source);
  copy.title = `${source.title} copy`;
  week.sessions.splice(sessionIndex + 1, 0, copy);
  rerenderTemplateBuilder();
}

export function moveTemplateSession(blockIndex, weekIndex, sessionIndex, direction) {
  const week = state.templateDraft?.blocks[blockIndex]?.weeks[weekIndex];
  if (!week) return;
  moveArrayItem(week.sessions, sessionIndex, direction);
  rerenderTemplateBuilder();
}

export function addTemplateWorkItem(blockIndex, weekIndex, sessionIndex) {
  const session = state.templateDraft?.blocks[blockIndex]?.weeks[weekIndex]?.sessions[sessionIndex];
  if (!session || session.work_items.length >= 12) return;
  session.work_items.push(newTemplateWorkItem(session.work_items.length));
  rerenderTemplateBuilder();
}

export function removeTemplateWorkItem(blockIndex, weekIndex, sessionIndex, workItemIndex) {
  const session = state.templateDraft?.blocks[blockIndex]?.weeks[weekIndex]?.sessions[sessionIndex];
  if (!session || session.work_items.length <= 1) return;
  const removed = session.work_items[workItemIndex];
  session.work_items.splice(workItemIndex, 1);
  ungroupIfTooSmall(session, removed?.group_id);
  rerenderTemplateBuilder();
}

export function duplicateTemplateWorkItem(blockIndex, weekIndex, sessionIndex, workItemIndex) {
  const session = state.templateDraft?.blocks[blockIndex]?.weeks[weekIndex]?.sessions[sessionIndex];
  if (!session || session.work_items.length >= 12) return;
  const source = session.work_items[workItemIndex];
  if (!source) return;
  const copy = cloneTemplateNode(source);
  copy.group_id = "";
  copy.group_type = "straight";
  session.work_items.splice(workItemIndex + 1, 0, copy);
  rerenderTemplateBuilder();
}

export function moveTemplateWorkItem(blockIndex, weekIndex, sessionIndex, workItemIndex, direction) {
  const session = state.templateDraft?.blocks[blockIndex]?.weeks[weekIndex]?.sessions[sessionIndex];
  if (!session) return;
  moveArrayItem(session.work_items, workItemIndex, direction);
  rerenderTemplateBuilder();
}

function ungroupIfTooSmall(session, groupId) {
  if (!groupId) return;
  const remaining = session.work_items.filter((item) => item.group_id === groupId);
  if (remaining.length === 1) {
    remaining[0].group_id = "";
    remaining[0].group_type = "straight";
  }
}

export function groupWorkItemWithNext(blockIndex, weekIndex, sessionIndex, workItemIndex) {
  const session = state.templateDraft?.blocks[blockIndex]?.weeks[weekIndex]?.sessions[sessionIndex];
  const current = session?.work_items[workItemIndex];
  const next = session?.work_items[workItemIndex + 1];
  if (!current || !next) return;

  const groupId = current.group_id || `group_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const groupType = current.group_type !== "straight" ? current.group_type : "superset";

  current.group_id = groupId;
  current.group_type = groupType;
  next.group_id = groupId;
  next.group_type = groupType;
  rerenderTemplateBuilder();
}

export function ungroupWorkItem(blockIndex, weekIndex, sessionIndex, workItemIndex) {
  const session = state.templateDraft?.blocks[blockIndex]?.weeks[weekIndex]?.sessions[sessionIndex];
  const item = session?.work_items[workItemIndex];
  if (!item || !item.group_id) return;

  const groupId = item.group_id;
  item.group_id = "";
  item.group_type = "straight";
  ungroupIfTooSmall(session, groupId);
  rerenderTemplateBuilder();
}
