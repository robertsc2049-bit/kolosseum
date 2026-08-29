import { titleCase } from "../../utils/format";
import { type JsonRecord } from "../../api/transport";

// DEV NOTE: FULL-UI-05A programme structure conversion + activation
// validation + structure preview formatting (read-only) - ported field-
// for-field from public/app/app.js's templateRecordToDraft()/
// storedWorkItemToDraft()/newTemplateBlock()/newTemplateWeek()/
// newTemplateSession()/programmeActivationIssues()/
// programmePreviewRepetitions()/Duration()/Distance()/Prescription()/
// Load()/exerciseDisplayName(). Pure data transforms with no DOM/legacy-
// state dependency, shared by CoachProgrammeValidationPanel.tsx and
// CoachProgrammePreviewPanel.tsx, both of which need the exact same draft
// shape.
//
// Scope boundary: the event-plan-bound branch of programmeActivationIssues()
// (event_plan_invalid/event_week_allocation_unbalanced/event_date_in_past)
// depends on localEventCompileSummary() and the whole event-calendar-
// binding feature (its own separate manifest area, event_calendar_binding -
// a coach binding a programme to a competition date with computed week
// allocation). That stays entirely legacy/out of scope here; a programme
// with no bound event (the common case) gets the exact same validation
// result as before. See test/full_ui_05a_programme_library.test.mjs's own
// DEV NOTE for how its governing test reflects this boundary.

export type ProgrammeWorkItemDraft = {
  work_item_id: string;
  order_index: number;
  exercise_id: string;
  planned_sets: number;
  prescription_mode: "reps" | "duration" | "distance";
  rep_mode: "fixed" | "range";
  planned_reps: number;
  rep_min: number;
  rep_max: number;
  tempo: string;
  duration_mode: "fixed" | "range";
  planned_duration_seconds: number;
  duration_min_seconds: number;
  duration_max_seconds: number;
  distance_mode: "fixed" | "range";
  distance_unit: "meters" | "feet";
  planned_distance_value: number;
  distance_min_value: number;
  distance_max_value: number;
  load_mode: "percent_1rm" | "fixed_weight" | "bodyweight" | "rpe";
  percent_1rm: number;
  weight_value: number;
  weight_unit: "kg" | "lb";
  rpe_value: number;
  rest_seconds: number;
  role: "primary" | "accessory";
  coaching_notes: string;
  segment: "warm_up" | "working" | "cool_down";
  group_id: string;
  group_type: "straight" | "superset" | "circuit";
};

export type ProgrammeSessionDraft = {
  session_id: string;
  order_index: number;
  title: string;
  coaching_notes: string;
  work_items: ProgrammeWorkItemDraft[];
};

export type ProgrammeWeekDraft = {
  week_id: string;
  order_index: number;
  calendar_start_date: string;
  calendar_end_date: string;
  days_until_event_at_week_start: number | null;
  partial_week: boolean;
  sessions: ProgrammeSessionDraft[];
};

export type ProgrammeBlockDraft = {
  block_id: string;
  order_index: number;
  name: string;
  description: string;
  block_type: "general" | "volume" | "strength" | "peak" | "deload" | "custom";
  week_count: number;
  calendar_start_date: string;
  calendar_end_date: string;
  weeks: ProgrammeWeekDraft[];
};

export type ProgrammeDraft = {
  template_id: string;
  template_family_id: string;
  template_version: number;
  template_status: string;
  template_name: string;
  description: string;
  activity_id: string;
  event_plan: JsonRecord | null;
  event_compile_summary: JsonRecord | null;
  bound_event_id: string;
  bound_event_record_sha256: string;
  blocks: ProgrammeBlockDraft[];
};

// DEV NOTE: ported field-for-field from public/app/app.js's
// templateCounts() - a pure derived-count helper the still-legacy
// programme builder also uses (updateTemplateFacts()) to disable "Add
// training block" past the block/week ceilings. Both copies are kept in
// sync by convention, like newTemplateBlock()/Week()/Session() above.
export type ProgrammeDraftCounts = { blocks: number; weeks: number; sessions: number };

export function templateCounts(draft: ProgrammeDraft | null | undefined): ProgrammeDraftCounts {
  const blocks = Array.isArray(draft?.blocks) ? draft.blocks : [];
  const weeks = blocks.reduce((total, block) => total + block.weeks.length, 0);
  const sessions = blocks.reduce(
    (total, block) => total + block.weeks.reduce((weekTotal, week) => weekTotal + week.sessions.length, 0),
    0
  );
  return { blocks: blocks.length, weeks, sessions };
}

function newTemplateWorkItem(): ProgrammeWorkItemDraft {
  return storedWorkItemToDraft(undefined, 0);
}

export function newTemplateSession(orderIndex: number): ProgrammeSessionDraft {
  return {
    session_id: "",
    order_index: orderIndex,
    title: `Session ${orderIndex}`,
    coaching_notes: "",
    work_items: Array.from({ length: 4 }, () => newTemplateWorkItem())
  };
}

export function newTemplateWeek(orderIndex: number): ProgrammeWeekDraft {
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

export function newTemplateBlock(orderIndex: number): ProgrammeBlockDraft {
  return {
    block_id: "",
    order_index: orderIndex,
    name: `Block ${orderIndex}`,
    description: "",
    block_type: "general",
    week_count: 1,
    calendar_start_date: "",
    calendar_end_date: "",
    weeks: [newTemplateWeek(1)]
  };
}

export function storedWorkItemToDraft(workItem: JsonRecord | undefined, workItemIndex: number): ProgrammeWorkItemDraft {
  const repPrescription = (workItem?.rep_prescription && typeof workItem.rep_prescription === "object" ? workItem.rep_prescription : {}) as JsonRecord;
  const durationPrescription = (workItem?.duration_prescription && typeof workItem.duration_prescription === "object" ? workItem.duration_prescription : {}) as JsonRecord;
  const distancePrescription = (workItem?.distance_prescription && typeof workItem.distance_prescription === "object" ? workItem.distance_prescription : {}) as JsonRecord;
  const loadingReference = (workItem?.loading_reference && typeof workItem.loading_reference === "object" ? workItem.loading_reference : {}) as JsonRecord;

  const repMode = repPrescription.type === "range" ? "range" : "fixed";
  const durationMode = durationPrescription.type === "range" ? "range" : "fixed";
  const distanceMode = distancePrescription.type === "range" ? "range" : "fixed";
  const loadMode = loadingReference.type === "load"
    ? "fixed_weight"
    : loadingReference.type === "bodyweight"
      ? "bodyweight"
      : loadingReference.type === "rpe"
        ? "rpe"
        : "percent_1rm";
  const fallbackReps = Number(workItem?.planned_reps ?? 5);
  const fallbackDuration = Number(workItem?.planned_duration_seconds ?? 30);
  const fallbackDistance = Number(workItem?.planned_distance_value ?? 20);

  return {
    work_item_id: String(workItem?.work_item_id ?? ""),
    order_index: Number(workItem?.order_index ?? workItemIndex + 1),
    exercise_id: String(workItem?.exercise_id ?? ""),
    planned_sets: Number(workItem?.planned_sets ?? 3),
    prescription_mode: ["duration", "distance"].includes(String(workItem?.prescription_mode ?? "")) ? (workItem!.prescription_mode as "duration" | "distance") : "reps",
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
    percent_1rm: loadingReference.type === "percent_1rm" ? Number(loadingReference.value ?? 75) : 75,
    weight_value: loadingReference.type === "load" ? Number(loadingReference.value ?? 20) : 20,
    weight_unit: loadingReference.unit === "lb" ? "lb" : "kg",
    rpe_value: loadingReference.type === "rpe" ? Number(loadingReference.value ?? 8) : 8,
    rest_seconds: Number(workItem?.rest_seconds ?? 120),
    role: workItem?.role === "primary" ? "primary" : "accessory",
    coaching_notes: String(workItem?.coaching_notes ?? ""),
    segment: ["warm_up", "cool_down"].includes(String(workItem?.segment ?? "")) ? (workItem!.segment as "warm_up" | "cool_down") : "working",
    group_id: String(workItem?.group_id ?? ""),
    group_type: ["superset", "circuit"].includes(String(workItem?.group_type ?? "")) ? (workItem!.group_type as "superset" | "circuit") : "straight"
  };
}

export function templateRecordToDraft(template: JsonRecord): ProgrammeDraft {
  const structure = (template?.template_structure && typeof template.template_structure === "object" ? template.template_structure : {}) as JsonRecord;
  const rawBlocks = Array.isArray(structure.blocks) ? structure.blocks as JsonRecord[] : [];

  const blocks = rawBlocks
    .slice()
    .sort((left, right) => Number(left.order_index) - Number(right.order_index))
    .map((block, blockIndex) => {
      const rawWeeks = Array.isArray(block?.weeks) ? block.weeks as JsonRecord[] : [];

      return {
        block_id: String(block?.block_id ?? ""),
        order_index: Number(block?.order_index ?? blockIndex + 1),
        name: String(block?.name ?? `Block ${blockIndex + 1}`),
        description: String(block?.description ?? ""),
        block_type: (["general", "volume", "strength", "peak", "deload", "custom"].includes(String(block?.block_type ?? ""))
          ? block.block_type
          : "general") as ProgrammeBlockDraft["block_type"],
        week_count: Number(block?.week_count ?? rawWeeks.length ?? 1),
        calendar_start_date: String(block?.calendar_start_date ?? ""),
        calendar_end_date: String(block?.calendar_end_date ?? ""),
        weeks: rawWeeks
          .slice()
          .sort((left, right) => Number(left.order_index) - Number(right.order_index))
          .map((week, weekIndex) => {
            const days = Array.isArray(week?.days) ? week.days as JsonRecord[] : [];
            const sessions = days
              .slice()
              .sort((left, right) => Number(left.order_index) - Number(right.order_index))
              .flatMap((day) => {
                const daySessions = Array.isArray(day?.sessions) ? day.sessions as JsonRecord[] : [];
                return daySessions
                  .slice()
                  .sort((left, right) => Number(left.order_index) - Number(right.order_index))
                  .map((session, sessionIndex) => ({
                    session_id: String(session?.session_id ?? ""),
                    order_index: Number(day?.order_index ?? session?.order_index ?? sessionIndex + 1),
                    title: String(session?.title ?? `Session ${sessionIndex + 1}`),
                    coaching_notes: String(session?.coaching_notes ?? ""),
                    work_items: (Array.isArray(session?.work_items) ? session.work_items as JsonRecord[] : [])
                      .slice()
                      .sort((left, right) => Number(left.order_index) - Number(right.order_index))
                      .map((workItem, workItemIndex) => storedWorkItemToDraft(workItem, workItemIndex))
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
    event_plan: template?.event_plan && typeof template.event_plan === "object" ? (template.event_plan as JsonRecord) : null,
    event_compile_summary: template?.event_compile_summary && typeof template.event_compile_summary === "object" ? (template.event_compile_summary as JsonRecord) : null,
    bound_event_id: String(template?.bound_event_id ?? ""),
    bound_event_record_sha256: String(template?.bound_event_record_sha256 ?? ""),
    blocks: blocks.length ? blocks : [newTemplateBlock(1)]
  };
}

export type ProgrammeActivationIssue = {
  code: string;
  message: string;
  path: string;
};

const SUPPORTED_ACTIVITIES = new Set(["powerlifting", "general_strength", "rugby_union"]);
const SUPPORTED_BLOCK_TYPES = new Set(["general", "volume", "strength", "peak", "deload", "custom"]);

// Structural/work-item validation only - the event-plan-bound branch
// (event_plan_invalid/event_week_allocation_unbalanced/event_date_in_past)
// is out of scope here, see this file's own DEV NOTE above. A programme
// with no bound event gets an identical result to the legacy function.
export function programmeActivationIssues(template: JsonRecord, templateExercises: JsonRecord[]): ProgrammeActivationIssue[] {
  const draft = templateRecordToDraft(template);
  const issues: ProgrammeActivationIssue[] = [];
  const registryIds = new Set(templateExercises.map((exercise) => String(exercise.exercise_id ?? "")).filter(Boolean));

  const addIssue = (code: string, message: string, path: string) => {
    issues.push({ code, message, path });
  };

  if (String(template?.template_status ?? "draft") !== "draft") {
    addIssue("only_draft_can_complete", "Only a draft programme can be marked complete.", "programme");
  }

  if (!draft.template_name.trim()) {
    addIssue("template_name_required", "Programme name is required.", "programme name");
  }

  if (!SUPPORTED_ACTIVITIES.has(draft.activity_id)) {
    addIssue("activity_id_invalid", "Choose a supported activity.", "activity");
  }

  const blocks = draft.blocks;

  if (blocks.length < 1 || blocks.length > 12) {
    addIssue("block_count_invalid", "Programme must contain between one and 12 blocks.", "blocks");
  }

  const totalWeeks = blocks.reduce((total, block) => total + block.weeks.length, 0);

  if (totalWeeks < 1 || totalWeeks > 104) {
    addIssue("total_week_count_invalid", "Programme must contain between one and 104 weeks.", "weeks");
  }

  blocks.forEach((block, blockIndex) => {
    const blockPath = `Block ${blockIndex + 1}`;
    const weeks = block.weeks;

    if (!SUPPORTED_BLOCK_TYPES.has(block.block_type)) {
      addIssue("block_type_invalid", `${blockPath} has an unsupported block type.`, blockPath);
    }

    if (weeks.length < 1 || weeks.length > 52) {
      addIssue("week_count_per_block_invalid", `${blockPath} must contain between one and 52 weeks.`, blockPath);
    }

    weeks.forEach((week, weekIndex) => {
      const weekPath = `${blockPath}, week ${weekIndex + 1}`;
      const sessions = week.sessions;

      if (sessions.length < 1 || sessions.length > 7) {
        addIssue("session_count_per_week_invalid", `${weekPath} must contain between one and seven sessions.`, weekPath);
      }

      sessions.forEach((session, sessionIndex) => {
        const sessionPath = `${weekPath}, session ${sessionIndex + 1}`;
        const workItems = session.work_items;

        if (workItems.length < 1 || workItems.length > 12) {
          addIssue("session_work_item_count_invalid", `${sessionPath} must contain between one and 12 exercises.`, sessionPath);
        }

        if (session.coaching_notes.length > 500) {
          addIssue("session_coaching_notes_too_long", `${sessionPath} coaching notes must be 500 characters or fewer.`, sessionPath);
        }

        const exerciseIds = workItems.map((workItem) => workItem.exercise_id).filter(Boolean);

        if (new Set(exerciseIds).size !== exerciseIds.length) {
          addIssue("duplicate_exercise_in_session", `${sessionPath} contains a duplicate exercise.`, sessionPath);
        }

        const groupOrderIndices = new Map<string, number[]>();
        const groupTypes = new Map<string, Set<string>>();
        workItems.forEach((workItem, workItemIndex) => {
          const groupId = workItem.group_id;
          if (!groupId) return;
          const orderIndices = groupOrderIndices.get(groupId) ?? [];
          orderIndices.push(workItemIndex + 1);
          groupOrderIndices.set(groupId, orderIndices);
          groupTypes.set(groupId, groupTypes.get(groupId) ?? new Set());
          groupTypes.get(groupId)!.add(workItem.group_type);
        });

        for (const [, orderIndices] of groupOrderIndices) {
          if (orderIndices.length < 2) {
            addIssue("work_item_group_too_small", `${sessionPath} has a grouped exercise without a partner.`, sessionPath);
          }

          const sorted = [...orderIndices].sort((a, b) => a - b);
          for (let index = 1; index < sorted.length; index += 1) {
            if (sorted[index] !== sorted[index - 1] + 1) {
              addIssue("work_item_group_not_contiguous", `${sessionPath} has a group with non-adjacent exercises.`, sessionPath);
              break;
            }
          }
        }
        for (const [groupId] of groupOrderIndices) {
          if (groupTypes.get(groupId)!.size > 1) {
            addIssue("work_item_group_type_mismatch", `${sessionPath} has a group with mismatched grouping types.`, sessionPath);
          }
        }

        workItems.forEach((workItem, workItemIndex) => {
          const itemPath = `${sessionPath}, exercise ${workItemIndex + 1}`;
          const exerciseId = workItem.exercise_id;

          if (!exerciseId) {
            addIssue("exercise_required", `${itemPath} requires an exercise.`, itemPath);
          }
          else if (registryIds.size > 0 && !registryIds.has(exerciseId)) {
            addIssue("exercise_not_in_active_registry", `${itemPath} is not in the active exercise registry.`, itemPath);
          }

          if (!["primary", "accessory"].includes(workItem.role)) {
            addIssue("role_invalid", `${itemPath} requires a primary or accessory role.`, itemPath);
          }

          if (!["warm_up", "working", "cool_down"].includes(workItem.segment)) {
            addIssue("work_item_segment_invalid", `${itemPath} requires a warm-up, working, or cool-down segment.`, itemPath);
          }

          const groupType = workItem.group_type;
          if (!["straight", "superset", "circuit"].includes(groupType)) {
            addIssue("work_item_group_type_invalid", `${itemPath} has an unsupported grouping type.`, itemPath);
          }
          else if (!workItem.group_id && groupType !== "straight") {
            addIssue("work_item_group_type_requires_group", `${itemPath} has a grouping type without a group.`, itemPath);
          }

          if (workItem.coaching_notes.length > 500) {
            addIssue("work_item_coaching_notes_too_long", `${itemPath} coaching notes must be 500 characters or fewer.`, itemPath);
          }

          const sets = workItem.planned_sets;
          if (!Number.isInteger(sets) || sets < 1 || sets > 20) {
            addIssue("planned_sets_invalid", `${itemPath} sets must be between one and 20.`, itemPath);
          }

          const prescriptionMode = workItem.prescription_mode;

          const tempo = workItem.tempo;
          if (tempo && !/^[0-9Xx]-[0-9Xx]-[0-9Xx]-[0-9Xx]$/u.test(tempo)) {
            addIssue("work_item_tempo_invalid", `${itemPath} tempo must look like 3-1-X-0.`, itemPath);
          }

          if (prescriptionMode === "reps") {
            if (workItem.rep_mode === "range") {
              const minimum = workItem.rep_min;
              const maximum = workItem.rep_max;

              if (!Number.isInteger(minimum) || minimum < 1 || minimum > 100) {
                addIssue("rep_range_min_invalid", `${itemPath} minimum repetitions must be between one and 100.`, itemPath);
              }
              if (!Number.isInteger(maximum) || maximum < 1 || maximum > 100) {
                addIssue("rep_range_max_invalid", `${itemPath} maximum repetitions must be between one and 100.`, itemPath);
              }
              if (Number.isFinite(minimum) && Number.isFinite(maximum) && maximum < minimum) {
                addIssue("rep_range_order_invalid", `${itemPath} maximum repetitions cannot be lower than the minimum.`, itemPath);
              }
            }
            else {
              const repetitions = workItem.planned_reps;
              if (!Number.isInteger(repetitions) || repetitions < 1 || repetitions > 100) {
                addIssue("planned_reps_invalid", `${itemPath} repetitions must be between one and 100.`, itemPath);
              }
            }
          }
          else if (prescriptionMode === "duration") {
            if (!["fixed", "range"].includes(workItem.duration_mode)) {
              addIssue("duration_mode_invalid", `${itemPath} has an unsupported duration mode.`, itemPath);
            }
            else if (workItem.duration_mode === "range") {
              const minimum = workItem.duration_min_seconds;
              const maximum = workItem.duration_max_seconds;

              if (!Number.isInteger(minimum) || minimum < 1 || minimum > 1800) {
                addIssue("duration_range_min_invalid", `${itemPath} minimum hold must be between one and 1,800 seconds.`, itemPath);
              }
              if (!Number.isInteger(maximum) || maximum < 1 || maximum > 1800) {
                addIssue("duration_range_max_invalid", `${itemPath} maximum hold must be between one and 1,800 seconds.`, itemPath);
              }
              if (Number.isFinite(minimum) && Number.isFinite(maximum) && maximum < minimum) {
                addIssue("duration_range_order_invalid", `${itemPath} maximum hold cannot be lower than the minimum.`, itemPath);
              }
            }
            else {
              const duration = workItem.planned_duration_seconds;
              if (!Number.isInteger(duration) || duration < 1 || duration > 1800) {
                addIssue("planned_duration_seconds_invalid", `${itemPath} hold must be between one and 1,800 seconds.`, itemPath);
              }
            }
          }
          else if (prescriptionMode === "distance") {
            if (!["meters", "feet"].includes(workItem.distance_unit)) {
              addIssue("distance_unit_invalid", `${itemPath} requires meters or feet.`, itemPath);
            }

            if (!["fixed", "range"].includes(workItem.distance_mode)) {
              addIssue("distance_mode_invalid", `${itemPath} has an unsupported distance mode.`, itemPath);
            }
            else if (workItem.distance_mode === "range") {
              const minimum = workItem.distance_min_value;
              const maximum = workItem.distance_max_value;

              if (!Number.isFinite(minimum) || minimum < 0.1 || minimum > 10000) {
                addIssue("distance_range_min_invalid", `${itemPath} minimum distance must be between 0.1 and 10,000.`, itemPath);
              }
              if (!Number.isFinite(maximum) || maximum < 0.1 || maximum > 10000) {
                addIssue("distance_range_max_invalid", `${itemPath} maximum distance must be between 0.1 and 10,000.`, itemPath);
              }
              if (Number.isFinite(minimum) && Number.isFinite(maximum) && maximum < minimum) {
                addIssue("distance_range_order_invalid", `${itemPath} maximum distance cannot be lower than the minimum.`, itemPath);
              }
            }
            else {
              const distance = workItem.planned_distance_value;
              if (!Number.isFinite(distance) || distance < 0.1 || distance > 10000) {
                addIssue("planned_distance_value_invalid", `${itemPath} distance must be between 0.1 and 10,000.`, itemPath);
              }
            }
          }

          const loadMode = workItem.load_mode;
          if (!["percent_1rm", "fixed_weight", "bodyweight", "rpe"].includes(loadMode)) {
            addIssue("load_mode_invalid", `${itemPath} has an unsupported loading mode.`, itemPath);
          }
          else if (loadMode === "percent_1rm") {
            const percentage = workItem.percent_1rm;
            if (!Number.isFinite(percentage) || percentage < 1 || percentage > 100) {
              addIssue("percent_1rm_invalid", `${itemPath} percentage must be between one and 100.`, itemPath);
            }
          }
          else if (loadMode === "fixed_weight") {
            const weight = workItem.weight_value;
            if (!Number.isFinite(weight) || weight < 0.25 || weight > 1000) {
              addIssue("weight_value_invalid", `${itemPath} fixed load must be between 0.25 and 1,000.`, itemPath);
            }
            if (!["kg", "lb"].includes(workItem.weight_unit)) {
              addIssue("weight_unit_invalid", `${itemPath} requires kilograms or pounds.`, itemPath);
            }
          }
          else if (loadMode === "rpe") {
            const rpeValue = workItem.rpe_value;
            if (!Number.isInteger(rpeValue) || rpeValue < 1 || rpeValue > 10) {
              addIssue("rpe_value_invalid", `${itemPath} RPE must be a whole number between one and 10.`, itemPath);
            }
          }

          const rest = workItem.rest_seconds;
          if (!Number.isInteger(rest) || rest < 0 || rest > 900) {
            addIssue("rest_seconds_invalid", `${itemPath} rest must be between zero and 900 seconds.`, itemPath);
          }
        });
      });
    });
  });

  return issues;
}

export function programmePreviewRepetitions(workItem: ProgrammeWorkItemDraft): string {
  if (workItem.rep_mode === "range") {
    return `${workItem.rep_min}–${workItem.rep_max} reps`;
  }
  return `${workItem.planned_reps} reps`;
}

export function programmePreviewDuration(workItem: ProgrammeWorkItemDraft): string {
  if (workItem.duration_mode === "range") {
    return `Hold ${workItem.duration_min_seconds}–${workItem.duration_max_seconds}s`;
  }
  return `Hold ${workItem.planned_duration_seconds}s`;
}

export function programmePreviewDistance(workItem: ProgrammeWorkItemDraft): string {
  const unit = workItem.distance_unit === "feet" ? "ft" : "m";
  if (workItem.distance_mode === "range") {
    return `${workItem.distance_min_value}–${workItem.distance_max_value}${unit}`;
  }
  return `${workItem.planned_distance_value}${unit}`;
}

export function programmePreviewPrescription(workItem: ProgrammeWorkItemDraft): string {
  if (workItem.prescription_mode === "duration") return programmePreviewDuration(workItem);
  if (workItem.prescription_mode === "distance") return programmePreviewDistance(workItem);
  return programmePreviewRepetitions(workItem);
}

export function programmePreviewLoad(workItem: ProgrammeWorkItemDraft): string {
  if (workItem.load_mode === "bodyweight") return "Bodyweight";

  if (workItem.load_mode === "fixed_weight") {
    return `${workItem.weight_value} ${workItem.weight_unit}`;
  }

  if (workItem.load_mode === "rpe") {
    return `RPE ${workItem.rpe_value}`;
  }

  return `${workItem.percent_1rm}% 1RM`;
}

export function exerciseDisplayName(exerciseId: string, templateExercises: JsonRecord[]): string {
  const match = templateExercises.find((exercise) => exercise.exercise_id === exerciseId);
  return String(match?.display_name ?? titleCase(exerciseId));
}
