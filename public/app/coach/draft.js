import { normaliseSetPlan } from "../core/state.js";

// The item's current single load value in its load mode, to start a plan from.
export function workItemLoadValue(workItem) {
  if (workItem.load_mode === "fixed_weight") return Number(workItem.weight_value);
  if (workItem.load_mode === "rpe") return Number(workItem.rpe_value);
  if (workItem.load_mode === "bodyweight") return 0;
  return Number(workItem.percent_1rm);
}

// A set-by-set item as the server takes it: the plan, the total sets, and the
// first line's reps and value in the single fields (they must stay valid).
export function withSetPlanPayload(workItem, payload) {
  if (workItem?.set_mode !== "per_set") return payload;
  const lines = normaliseSetPlan(workItem.set_plan);
  const bodyweight = workItem.load_mode === "bodyweight";
  const first = lines[0] ?? { sets: 1, reps: 1, value: 0 };
  const out = {
    ...payload,
    set_mode: "fixed",
    prescription_mode: "reps",
    rep_mode: "fixed",
    load_range_mode: "fixed",
    planned_sets: lines.reduce((sum, line) => sum + line.sets, 0),
    planned_reps: first.reps,
    rep_min: first.reps,
    rep_max: first.reps,
    set_plan: lines.map((line) => ({ sets: line.sets, reps: line.reps, ...(bodyweight ? {} : { value: line.value }), ...(line.amrap ? { amrap: true } : {}) }))
  };
  if (workItem.load_mode === "fixed_weight") out.weight_value = first.value;
  else if (workItem.load_mode === "rpe") out.rpe_value = first.value;
  else if (!bodyweight) out.percent_1rm = first.value;
  return out;
}

// A new row starts with no exercise chosen ("Choose an exercise"): the coach
// picks it. It used to take the library's exercise at the same position,
// which - with the library sorted A-Z - filled every new programme with
// sprint drills loaded at % of 1RM.
export function newTemplateWorkItem(index) {
  return {
    work_item_id: "",
    order_index: index + 1,
    exercise_id: "",
    planned_sets: 3,
    prescription_mode: "reps",
    rep_mode: "fixed",
    planned_reps: index === 0 ? 5 : 8,
    rep_min: index === 0 ? 4 : 8,
    rep_max: index === 0 ? 6 : 12,
    tempo: "",
    duration_mode: "fixed",
    planned_duration_seconds: 30,
    duration_min_seconds: 20,
    duration_max_seconds: 40,
    distance_mode: "fixed",
    distance_unit: "meters",
    planned_distance_value: 20,
    distance_min_value: 10,
    distance_max_value: 30,
    load_mode: "percent_1rm",
    percent_1rm: index === 0 ? 75 : 65,
    weight_value: index === 0 ? 100 : 20,
    weight_unit: "kg",
    set_mode: "fixed",
    planned_sets_max: 4,
    set_plan: [],
    load_range_mode: "fixed",
    percent_1rm_max: index === 0 ? 80 : 70,
    weight_value_max: index === 0 ? 110 : 30,
    rest_seconds: index === 0 ? 180 : 120,
    role: index === 0 ? "primary" : "accessory",
    coaching_notes: "",
    segment: "working",
    group_id: "",
    group_type: "straight"
  };
}

export function newTemplateSession(orderIndex) {
  return {
    session_id: "",
    order_index: orderIndex,
    title: `Session ${orderIndex}`,
    coaching_notes: "",
    // One exercise row to start; the coach adds more as the session needs.
    work_items: [newTemplateWorkItem(0)]
  };
}

export function newTemplateWeek(orderIndex) {
  return {
    week_id: "",
    order_index: orderIndex,
    calendar_start_date: "",
    calendar_end_date: "",
    days_until_event_at_week_start: null,
    partial_week: false,
    sessions: [newTemplateSession(1)]
  };
}

export function newTemplateBlock(orderIndex) {
  return {
    block_id: "",
    order_index: orderIndex,
    name: `Block ${orderIndex}`,
    description: "",
    block_type: "general",
    week_count: 1,
    weeks: [newTemplateWeek(1)]
  };
}

export function newTemplateDraft() {
  return {
    template_id: "",
    template_family_id: "",
    template_version: 1,
    template_status: "draft",
    template_name: "",
    description: "",
    activity_id: "powerlifting",
    adjust_for_breaks: false,
    event_plan: null,
    event_compile_summary: null,
    bound_event_id: "",
    bound_event_record_sha256: "",
    blocks: [newTemplateBlock(1)]
  };
}

function storedWorkItemToDraft(workItem, workItemIndex) {
  const repPrescription = workItem?.rep_prescription &&
    typeof workItem.rep_prescription === "object"
    ? workItem.rep_prescription
    : {};

  const durationPrescription = workItem?.duration_prescription &&
    typeof workItem.duration_prescription === "object"
    ? workItem.duration_prescription
    : {};

  const distancePrescription = workItem?.distance_prescription &&
    typeof workItem.distance_prescription === "object"
    ? workItem.distance_prescription
    : {};

  const loadingReference = workItem?.loading_reference &&
    typeof workItem.loading_reference === "object"
    ? workItem.loading_reference
    : {};

  const repMode = repPrescription.type === "range" ? "range" : "fixed";
  const durationMode = durationPrescription.type === "range" ? "range" : "fixed";
  const distanceMode = distancePrescription.type === "range" ? "range" : "fixed";
  const loadMode = loadingReference.type === "load"
    ? "fixed_weight"
    : loadingReference.type === "bodyweight"
      ? "bodyweight"
      : loadingReference.type === "rpe"
        ? "rpe"
        : loadingReference.type === "borg"
          ? "borg"
          : loadingReference.type === "cr10"
            ? "cr10"
            : "percent_1rm";
  const fallbackReps = Number(workItem?.planned_reps ?? 5);
  const fallbackDuration = Number(workItem?.planned_duration_seconds ?? 30);
  const fallbackDistance = Number(workItem?.planned_distance_value ?? 20);

  return {
    work_item_id: String(workItem?.work_item_id ?? ""),
    order_index: Number(workItem?.order_index ?? workItemIndex + 1),
    exercise_id: String(workItem?.exercise_id ?? ""),
    planned_sets: Number(workItem?.planned_sets ?? 3),
    prescription_mode: ["duration", "distance"].includes(workItem?.prescription_mode)
      ? workItem.prescription_mode
      : "reps",
    rep_mode: repMode,
    planned_reps: Number(repPrescription.value ?? fallbackReps),
    rep_min: Number(repPrescription.minimum ?? fallbackReps),
    rep_max: Number(repPrescription.maximum ?? fallbackReps),
    tempo: String(workItem?.tempo ?? ""),
    duration_mode: durationMode,
    planned_duration_seconds: Number(durationPrescription.value ?? fallbackDuration),
    duration_min_seconds: Number(durationPrescription.minimum ?? fallbackDuration),
    duration_max_seconds: Number(durationPrescription.maximum ?? fallbackDuration),
    distance_mode: distanceMode,
    distance_unit: distancePrescription.unit === "feet" ? "feet" : "meters",
    planned_distance_value: Number(distancePrescription.value ?? fallbackDistance),
    distance_min_value: Number(distancePrescription.minimum ?? fallbackDistance),
    distance_max_value: Number(distancePrescription.maximum ?? fallbackDistance),
    load_mode: loadMode,
    percent_1rm: loadingReference.type === "percent_1rm"
      ? Number(loadingReference.value ?? 75)
      : 75,
    weight_value: loadingReference.type === "load"
      ? Number(loadingReference.value ?? 20)
      : 20,
    weight_unit: loadingReference.unit === "lb" ? "lb" : "kg",
    set_mode: Array.isArray(workItem?.set_plan) && workItem.set_plan.length
      ? "per_set"
      : workItem?.set_prescription?.type === "range" && Number(workItem.set_prescription.maximum) > Number(workItem?.planned_sets ?? 3) ? "range" : "fixed",
    set_plan: normaliseSetPlan(workItem?.set_plan),
    planned_sets_max: workItem?.set_prescription?.type === "range" ? Number(workItem.set_prescription.maximum) : Number(workItem?.planned_sets ?? 3) + 1,
    load_range_mode: Number(loadingReference.maximum) > Number(loadingReference.value) ? "range" : "fixed",
    percent_1rm_max: loadingReference.type === "percent_1rm" ? Number(loadingReference.maximum ?? Number(loadingReference.value ?? 75) + 5) : 80,
    weight_value_max: loadingReference.type === "load" ? Number(loadingReference.maximum ?? Number(loadingReference.value ?? 20) + 10) : 30,
    rpe_value: loadingReference.type === "rpe"
      ? Number(loadingReference.value ?? 8)
      : 8,
    borg_value: loadingReference.type === "borg"
      ? Number(loadingReference.value ?? 13)
      : 13,
    cr10_value: loadingReference.type === "cr10"
      ? Number(loadingReference.value ?? 5)
      : 5,
    rest_seconds: Number(workItem?.rest_seconds ?? 120),
    role: workItem?.role === "primary" ? "primary" : "accessory",
    coaching_notes: String(workItem?.coaching_notes ?? ""),
    segment: ["warm_up", "cool_down"].includes(workItem?.segment) ? workItem.segment : "working",
    group_id: String(workItem?.group_id ?? ""),
    group_type: ["superset", "circuit"].includes(workItem?.group_type) ? workItem.group_type : "straight"
  };
}

export function templateRecordToDraft(template) {
  const structure = template?.template_structure && typeof template.template_structure === "object"
    ? template.template_structure
    : {};
  const rawBlocks = Array.isArray(structure.blocks) ? structure.blocks : [];

  const blocks = rawBlocks
    .slice()
    .sort((left, right) => Number(left.order_index) - Number(right.order_index))
    .map((block, blockIndex) => {
      const rawWeeks = Array.isArray(block?.weeks) ? block.weeks : [];

      return {
        block_id: String(block?.block_id ?? ""),
        order_index: Number(block?.order_index ?? blockIndex + 1),
        name: String(block?.name ?? `Block ${blockIndex + 1}`),
        description: String(block?.description ?? ""),
        block_type: ["general", "volume", "strength", "peak", "deload", "custom"].includes(block?.block_type)
          ? block.block_type
          : "general",
        week_count: Number(block?.week_count ?? rawWeeks.length ?? 1),
        calendar_start_date: String(block?.calendar_start_date ?? ""),
        calendar_end_date: String(block?.calendar_end_date ?? ""),
        weeks: rawWeeks
          .slice()
          .sort((left, right) => Number(left.order_index) - Number(right.order_index))
          .map((week, weekIndex) => {
            const days = Array.isArray(week?.days) ? week.days : [];
            const sessions = days
              .slice()
              .sort((left, right) => Number(left.order_index) - Number(right.order_index))
              .flatMap((day) => {
                const daySessions = Array.isArray(day?.sessions) ? day.sessions : [];
                return daySessions
                  .slice()
                  .sort((left, right) => Number(left.order_index) - Number(right.order_index))
                  .map((session, sessionIndex) => ({
                    session_id: String(session?.session_id ?? ""),
                    order_index: Number(day?.order_index ?? session?.order_index ?? sessionIndex + 1),
                    title: String(session?.title ?? `Session ${sessionIndex + 1}`),
                    coaching_notes: String(session?.coaching_notes ?? ""),
                    work_items: (Array.isArray(session?.work_items) ? session.work_items : [])
                      .slice()
                      .sort((left, right) => Number(left.order_index) - Number(right.order_index))
                      .map(storedWorkItemToDraft)
                  }));
              });

            return {
              week_id: String(week?.week_id ?? ""),
              order_index: Number(week?.order_index ?? weekIndex + 1),
              calendar_start_date: String(week?.calendar_start_date ?? ""),
              calendar_end_date: String(week?.calendar_end_date ?? ""),
              days_until_event_at_week_start: Number.isInteger(week?.days_until_event_at_week_start)
                ? Number(week.days_until_event_at_week_start)
                : null,
              partial_week: week?.partial_week === true,
              sessions: sessions.length ? sessions : [newTemplateSession(1)]
            };
          })
      };
    });

  return {
    template_id: String(template?.template_id ?? ""),
    template_family_id: String(template?.template_family_id ?? ""),
    template_version: Number(template?.template_version ?? 1),
    template_status: String(template?.template_status ?? "draft"),
    template_name: String(template?.template_name ?? ""),
    description: String(template?.description ?? ""),
    activity_id: String(template?.activity_id ?? "powerlifting"),
    // A programme saved before this tick existed adjusts for breaks.
    adjust_for_breaks: template?.adjust_for_breaks !== false,
    event_plan: template?.event_plan && typeof template.event_plan === "object"
      ? {
          event_plan_id: String(template.event_plan.event_plan_id ?? ""),
          event_name: String(template.event_plan.event_name ?? ""),
          event_type: String(template.event_plan.event_type ?? ""),
          event_date: String(template.event_plan.event_date ?? ""),
          programme_start_date: String(template.event_plan.programme_start_date ?? ""),
          location: String(template.event_plan.location ?? ""),
          timezone: String(template.event_plan.timezone ?? "Europe/London"),
          notes: String(template.event_plan.notes ?? "")
        }
      : null,
    event_compile_summary: template?.event_compile_summary && typeof template.event_compile_summary === "object"
      ? template.event_compile_summary
      : null,
    bound_event_id: String(template?.bound_event_id ?? ""),
    bound_event_record_sha256: String(template?.bound_event_record_sha256 ?? ""),
    blocks: blocks.length ? blocks : [newTemplateBlock(1)]
  };
}
