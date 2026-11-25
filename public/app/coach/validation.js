import { elements } from "../core/elements.js";
import { state } from "../core/state.js";
import { withSetPlanPayload } from "./draft.js";
import { programmeActivationIssues } from "./programmes.js";

function templateDraftValidationRecord() {
  const draft = state.templateDraft;
  if (!draft) return null;

  return {
    template_id: String(draft.template_id ?? ""),
    template_family_id: String(draft.template_family_id ?? ""),
    template_version: Number(draft.template_version ?? 1),
    template_status: String(draft.template_status ?? "draft"),
    template_name: String(draft.template_name ?? ""),
    description: String(draft.description ?? ""),
    activity_id: String(draft.activity_id ?? ""),
    event_plan: draft.event_plan ?? null,
    event_compile_summary: draft.event_compile_summary ?? null,
    template_structure: {
      blocks: (Array.isArray(draft.blocks) ? draft.blocks : []).map(
        (block, blockIndex) => ({
          block_id: String(block?.block_id ?? ""),
          order_index: blockIndex + 1,
          name: String(block?.name ?? ""),
          description: String(block?.description ?? ""),
          block_type: String(block?.block_type ?? ""),
          week_count: Array.isArray(block?.weeks) ? block.weeks.length : 0,
          weeks: (Array.isArray(block?.weeks) ? block.weeks : []).map(
            (week, weekIndex) => ({
              week_id: String(week?.week_id ?? ""),
              order_index: weekIndex + 1,
              calendar_start_date: String(week?.calendar_start_date ?? ""),
              calendar_end_date: String(week?.calendar_end_date ?? ""),
              days_until_event_at_week_start:
                Number.isInteger(week?.days_until_event_at_week_start)
                  ? Number(week.days_until_event_at_week_start)
                  : null,
              partial_week: week?.partial_week === true,
              days: (Array.isArray(week?.sessions) ? week.sessions : []).map(
                (session, sessionIndex) => ({
                  day_id: "",
                  order_index: sessionIndex + 1,
                  sessions: [{
                    session_id: String(session?.session_id ?? ""),
                    order_index: 1,
                    title: String(session?.title ?? ""),
                    coaching_notes: String(session?.coaching_notes ?? ""),
                    work_items: (
                      Array.isArray(session?.work_items)
                        ? session.work_items
                        : []
                    ).map((workItem, workItemIndex) => withSetPlanPayload(workItem, {
                      work_item_id: String(workItem?.work_item_id ?? ""),
                      order_index: workItemIndex + 1,
                      exercise_id: String(workItem?.exercise_id ?? ""),
                      planned_sets: Number(workItem?.planned_sets),
                      prescription_mode: String(workItem?.prescription_mode ?? "reps"),
                      rep_mode: String(workItem?.rep_mode ?? ""),
                      planned_reps: Number(workItem?.planned_reps),
                      rep_min: Number(workItem?.rep_min),
                      rep_max: Number(workItem?.rep_max),
                      tempo: String(workItem?.tempo ?? ""),
                      duration_mode: String(workItem?.duration_mode ?? "fixed"),
                      planned_duration_seconds: Number(workItem?.planned_duration_seconds),
                      duration_min_seconds: Number(workItem?.duration_min_seconds),
                      duration_max_seconds: Number(workItem?.duration_max_seconds),
                      distance_mode: String(workItem?.distance_mode ?? "fixed"),
                      distance_unit: String(workItem?.distance_unit ?? "meters"),
                      planned_distance_value: Number(workItem?.planned_distance_value),
                      distance_min_value: Number(workItem?.distance_min_value),
                      distance_max_value: Number(workItem?.distance_max_value),
                      load_mode: String(workItem?.load_mode ?? ""),
                      percent_1rm: Number(workItem?.percent_1rm),
                      weight_value: Number(workItem?.weight_value),
                      set_mode: workItem?.set_mode === "range" ? "range" : "fixed",
                      planned_sets_max: Number(workItem?.planned_sets_max ?? workItem?.planned_sets),
                      load_range_mode: workItem?.load_range_mode === "range" ? "range" : "fixed",
                      percent_1rm_max: Number(workItem?.percent_1rm_max ?? workItem?.percent_1rm),
                      weight_value_max: Number(workItem?.weight_value_max ?? workItem?.weight_value),
                      weight_unit: String(workItem?.weight_unit ?? ""),
                      rpe_value: Number(workItem?.rpe_value),
                      borg_value: Number(workItem?.borg_value),
                      cr10_value: Number(workItem?.cr10_value),
                      rest_seconds: Number(workItem?.rest_seconds),
                      role: String(workItem?.role ?? ""),
                      coaching_notes: String(workItem?.coaching_notes ?? ""),
                      segment: String(workItem?.segment ?? "working"),
                      group_id: String(workItem?.group_id ?? ""),
                      group_type: String(workItem?.group_type ?? "straight")
                    }))
                  }]
                })
              )
            })
          )
        })
      )
    }
  };
}

export function currentTemplateBuilderIssues() {
  const record = templateDraftValidationRecord();
  // A non-draft record's only possible "issue" is the permanent, never-
  // resolvable "only_draft_can_complete" (the save-complete button is
  // already hidden entirely once status isn't draft) - treat it as
  // clean here so the outer wrapper doesn't show a stale "warning" state
  // for an already-completed/activated programme. See
  // CoachProgrammeBuilderValidationList.tsx's matching guard.
  if (!record || record.template_status !== "draft") return [];
  return programmeActivationIssues(record);
}

function templateValidationSelector(issue) {
  const code = String(issue?.code ?? "");
  const path = String(issue?.path ?? "");
  const message = String(issue?.message ?? "").toLowerCase();

  if (path === "programme name") return "#templateName";
  if (path === "activity") return "#templateActivity";
  if (path === "event date") return "#templateEventDate";

  if (path === "event calendar") {
    if (message.includes("event name")) return "#templateEventName";
    if (message.includes("timezone")) return "#templateEventTimezone";
    if (message.includes("start date")) return "#templateProgrammeStartDate";
    return "#templateEventDate";
  }

  if (path === "blocks" || path === "weeks") {
    return "#addTemplateBlockButton";
  }

  const blockMatch = /Block (\d+)/u.exec(path);
  const weekMatch = /week (\d+)/u.exec(path);
  const sessionMatch = /session (\d+)/u.exec(path);
  const exerciseMatch = /exercise (\d+)/u.exec(path);

  const blockIndex = blockMatch ? Number(blockMatch[1]) - 1 : null;
  const weekIndex = weekMatch ? Number(weekMatch[1]) - 1 : null;
  const sessionIndex = sessionMatch ? Number(sessionMatch[1]) - 1 : null;
  let workItemIndex = exerciseMatch ? Number(exerciseMatch[1]) - 1 : null;

  if (
    workItemIndex === null &&
    (
      code === "duplicate_exercise_in_session" ||
      code === "exercise_required" ||
      code === "exercise_not_in_active_registry"
    ) &&
    sessionIndex !== null
  ) {
    workItemIndex = 0;
  }

  if (blockIndex === null) return "#templateName";

  const attributes = [
    `[data-block-index="${blockIndex}"]`
  ];

  if (weekIndex !== null) {
    attributes.push(`[data-week-index="${weekIndex}"]`);
  }

  if (sessionIndex !== null) {
    attributes.push(`[data-session-index="${sessionIndex}"]`);
  }

  if (workItemIndex !== null) {
    attributes.push(`[data-work-item-index="${workItemIndex}"]`);
  }

  let field = "";

  if (
    code === "exercise_required" ||
    code === "exercise_not_in_active_registry" ||
    code === "duplicate_exercise_in_session"
  ) {
    field = "exercise_id";
  }
  else if (code === "role_invalid") {
    field = "role";
  }
  else if (code === "planned_sets_invalid") {
    field = "planned_sets";
  }
  else if (code === "planned_reps_invalid") {
    field = "planned_reps";
  }
  else if (code === "rep_range_min_invalid") {
    field = "rep_min";
  }
  else if (code === "set_range_max_invalid" || code === "set_range_order_invalid") {
    field = "planned_sets_max";
  }
  else if (code === "percent_1rm_max_invalid" || code === "percent_1rm_range_order_invalid") {
    field = "percent_1rm_max";
  }
  else if (code === "weight_value_max_invalid" || code === "weight_range_order_invalid") {
    field = "weight_value_max";
  }
  else if (
    code === "rep_range_max_invalid" ||
    code === "rep_range_order_invalid"
  ) {
    field = "rep_max";
  }
  else if (code === "prescription_mode_invalid") {
    field = "prescription_mode";
  }
  else if (code === "work_item_tempo_invalid") {
    field = "tempo";
  }
  else if (code === "duration_mode_invalid") {
    field = "duration_mode";
  }
  else if (code === "planned_duration_seconds_invalid") {
    field = "planned_duration_seconds";
  }
  else if (code === "duration_range_min_invalid") {
    field = "duration_min_seconds";
  }
  else if (
    code === "duration_range_max_invalid" ||
    code === "duration_range_order_invalid"
  ) {
    field = "duration_max_seconds";
  }
  else if (code === "distance_mode_invalid") {
    field = "distance_mode";
  }
  else if (code === "distance_unit_invalid") {
    field = "distance_unit";
  }
  else if (code === "planned_distance_value_invalid") {
    field = "planned_distance_value";
  }
  else if (code === "distance_range_min_invalid") {
    field = "distance_min_value";
  }
  else if (
    code === "distance_range_max_invalid" ||
    code === "distance_range_order_invalid"
  ) {
    field = "distance_max_value";
  }
  else if (code === "load_mode_invalid") {
    field = "load_mode";
  }
  else if (code === "percent_1rm_invalid") {
    field = "percent_1rm";
  }
  else if (code === "weight_value_invalid") {
    field = "weight_value";
  }
  else if (code === "weight_unit_invalid") {
    field = "weight_unit";
  }
  else if (code === "rpe_value_invalid") {
    field = "rpe_value";
  }
  else if (code === "borg_value_invalid") {
    field = "borg_value";
  }
  else if (code === "cr10_value_invalid") {
    field = "cr10_value";
  }
  else if (code === "rest_seconds_invalid") {
    field = "rest_seconds";
  }
  else if (code === "block_type_invalid") {
    field = "block_type";
  }
  else if (code === "week_count_per_block_invalid") {
    field = "week_count";
  }
  else if (
    code === "session_count_per_week_invalid" ||
    code === "session_work_item_count_invalid"
  ) {
    field = "title";
  }
  else if (code === "session_coaching_notes_too_long") {
    field = "coaching_notes";
  }
  else if (code === "work_item_coaching_notes_too_long") {
    field = "coaching_notes";
  }
  else if (code === "work_item_segment_invalid") {
    field = "segment";
  }
  else if (
    code === "work_item_group_type_invalid" ||
    code === "work_item_group_type_requires_group" ||
    code === "work_item_group_too_small" ||
    code === "work_item_group_not_contiguous" ||
    code === "work_item_group_type_mismatch"
  ) {
    field = "group_type";
  }

  const kind =
    workItemIndex !== null
      ? "work-item"
      : sessionIndex !== null
        ? "session"
        : "block";

  const fieldSelector = field
    ? `[data-field="${field}"]`
    : "";

  return (
    `[data-template-kind="${kind}"]` +
    attributes.join("") +
    fieldSelector
  );
}

export function focusTemplateValidationIssue(issueIndex) {
  const issues = currentTemplateBuilderIssues();
  const issue = issues[Number(issueIndex)];
  if (!issue) return false;

  const selector = templateValidationSelector(issue);
  const target = document.querySelector(selector);

  if (!target) {
    elements.templateBuilderValidation.scrollIntoView({
      block: "center",
      behavior: "smooth"
    });
    return false;
  }

  // It may be inside a closed block, week, session or exercise: open them, outermost first.
  const closed = [];
  for (let node = target.parentElement; node && node.id !== "templateBuilderView"; node = node.parentElement) {
    if (node.matches("details:not([open])")) node.open = true;
    if (node.dataset.open === "false") closed.unshift(node);
  }
  for (const node of closed) {
    [...node.querySelectorAll("[aria-expanded='false']")].find((button) => button.closest("[data-open]") === node)?.click();
  }

  const show = () => focusIssueTarget(target);
  if (closed.length) setTimeout(show, 0);
  else show();

  return true;
}

function focusIssueTarget(target) {
  const focusTarget =
    target.matches("input, select, textarea, button")
      ? target
      : target.querySelector("input, select, textarea, button") ?? target;

  const highlight =
    focusTarget.closest(
      ".field, .template-block, .template-week, .template-session"
    ) ?? focusTarget;

  highlight.classList.add("builder-validation-target");

  if (!focusTarget.hasAttribute("tabindex") && !focusTarget.matches(
    "input, select, textarea, button, a[href]"
  )) {
    focusTarget.setAttribute("tabindex", "-1");
  }

  focusTarget.scrollIntoView({
    block: "center",
    behavior: "smooth"
  });

  focusTarget.focus({
    preventScroll: true
  });

  setTimeout(() => {
    highlight.classList.remove("builder-validation-target");
  }, 1800);
}
