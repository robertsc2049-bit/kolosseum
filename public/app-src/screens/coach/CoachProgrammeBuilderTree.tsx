import React from "react";

import { type JsonRecord } from "../../api/transport";
import { formatDate, reserveToRpe, rpeReserveLabel, rpeToReserve, titleCase } from "../../utils/format";
import {
  EXERCISE_CATEGORY_ORDER,
  exerciseCategory,
  templateCounts,
  type ProgrammeBlockDraft,
  type ProgrammeSessionDraft,
  type ProgrammeWeekDraft,
  type ProgrammeWorkItemDraft
} from "./programmeDraft";
import { useProgrammeBuilderDraft } from "./useProgrammeBuilderDraft";

// DEV NOTE: FULL-UI-05B programme builder tree (block -> week -> session ->
// exercise) - ported field-for-field from public/app/app.js's
// renderTemplateBlocks()/renderTemplateWeek()/renderTemplateSession()/
// renderTemplateWorkItem()/renderTemplateRepControls()/
// DurationControls()/DistanceControls()/PrescriptionControls()/
// LoadControls()/templateExerciseOptions()/templateWorkItemAttributes(),
// mounted DIRECTLY into the existing #templateBlocks container (kept, not
// replaced - same technique as CoachProgrammeBuilderValidationList.tsx).
// #templateBlocks already carries THREE delegated listeners from
// bootstrap - input/change (updateTemplateFieldFromControl(), keyed off
// each control's data-template-kind/data-*-index/data-field attributes)
// and click (branching on ~18 button CSS classes: add/remove/duplicate/
// move-template-block/week/session/work-item, group/ungroup-work-item,
// template-work-item-info-toggle). Every control below carries the EXACT
// SAME attributes/classes the legacy markup did, so real user
// interaction bubbles up to those untouched listeners and drives the
// SAME untouched mutation functions (addTemplateBlock, moveTemplateWeek,
// etc.) - zero mutation logic is ported here, only rendering. Every
// number/text/select/textarea below is deliberately UNCONTROLLED
// (defaultValue, no onChange) so the browser's native typing is never
// fought by React; legacy mutates state.templateDraft then calls
// rerenderTemplateBuilder(), which broadcasts the new draft (see
// useProgrammeBuilderDraft.ts) and this component re-renders from that
// external truth, exactly mirroring the full-teardown-and-rebuild legacy
// used to do with innerHTML.
//
// The one exception is .template-work-item-info (the "Exercise info"
// toggle's target) - toggleTemplateWorkItemInfo() in app.js still
// directly flips its hidden/innerHTML imperatively via a live DOM query
// at click time, entirely outside React's reconciliation. This is
// rendered here as a permanently-empty, permanently-hidden placeholder
// div for legacy to find and populate - no different in spirit from
// legacy's own prior behaviour, which also fully discarded this panel's
// content on every unrelated mutation (the whole tree was torn down and
// rebuilt via innerHTML on every change).

function workItemAttrs(blockIndex: number, weekIndex: number, sessionIndex: number, workItemIndex: number, field: string) {
  return {
    "data-template-kind": "work-item",
    "data-block-index": blockIndex,
    "data-week-index": weekIndex,
    "data-session-index": sessionIndex,
    "data-work-item-index": workItemIndex,
    "data-field": field
  };
}

type WorkItemControlProps = {
  workItem: ProgrammeWorkItemDraft;
  blockIndex: number;
  weekIndex: number;
  sessionIndex: number;
  workItemIndex: number;
};

function RepControls({ workItem, blockIndex, weekIndex, sessionIndex, workItemIndex }: WorkItemControlProps) {
  const rangeMode = workItem.rep_mode === "range";
  return (
    <fieldset className="template-prescription-card">
      <legend>Repetitions</legend>
      <div className="template-prescription-fields">
        <label className="template-method-field">
          <span>Method</span>
          <select defaultValue={rangeMode ? "range" : "fixed"} {...workItemAttrs(blockIndex, weekIndex, sessionIndex, workItemIndex, "rep_mode")}>
            <option value="fixed">Fixed reps</option>
            <option value="range">Rep range</option>
          </select>
        </label>
        {rangeMode ? (
          <>
            <label><span>Minimum</span><input type="number" min={1} max={100} step={1} defaultValue={workItem.rep_min} {...workItemAttrs(blockIndex, weekIndex, sessionIndex, workItemIndex, "rep_min")} /></label>
            <label><span>Maximum</span><input type="number" min={1} max={100} step={1} defaultValue={workItem.rep_max} {...workItemAttrs(blockIndex, weekIndex, sessionIndex, workItemIndex, "rep_max")} /></label>
          </>
        ) : (
          <label><span>Reps</span><input type="number" min={1} max={100} step={1} defaultValue={workItem.planned_reps} {...workItemAttrs(blockIndex, weekIndex, sessionIndex, workItemIndex, "planned_reps")} /></label>
        )}
        <label className="template-tempo-field">
          <span>Tempo (optional)</span>
          <input type="text" maxLength={7} placeholder="3-1-X-0" defaultValue={workItem.tempo ?? ""} {...workItemAttrs(blockIndex, weekIndex, sessionIndex, workItemIndex, "tempo")} />
        </label>
      </div>
    </fieldset>
  );
}

function DurationControls({ workItem, blockIndex, weekIndex, sessionIndex, workItemIndex }: WorkItemControlProps) {
  const rangeMode = workItem.duration_mode === "range";
  return (
    <fieldset className="template-prescription-card">
      <legend>Duration</legend>
      <div className="template-prescription-fields">
        <label className="template-method-field">
          <span>Method</span>
          <select defaultValue={rangeMode ? "range" : "fixed"} {...workItemAttrs(blockIndex, weekIndex, sessionIndex, workItemIndex, "duration_mode")}>
            <option value="fixed">Fixed hold</option>
            <option value="range">Hold range</option>
          </select>
        </label>
        {rangeMode ? (
          <>
            <label><span>Minimum (s)</span><input type="number" min={1} max={1800} step={1} defaultValue={workItem.duration_min_seconds} {...workItemAttrs(blockIndex, weekIndex, sessionIndex, workItemIndex, "duration_min_seconds")} /></label>
            <label><span>Maximum (s)</span><input type="number" min={1} max={1800} step={1} defaultValue={workItem.duration_max_seconds} {...workItemAttrs(blockIndex, weekIndex, sessionIndex, workItemIndex, "duration_max_seconds")} /></label>
          </>
        ) : (
          <label><span>Seconds</span><input type="number" min={1} max={1800} step={1} defaultValue={workItem.planned_duration_seconds} {...workItemAttrs(blockIndex, weekIndex, sessionIndex, workItemIndex, "planned_duration_seconds")} /></label>
        )}
      </div>
    </fieldset>
  );
}

function DistanceControls({ workItem, blockIndex, weekIndex, sessionIndex, workItemIndex }: WorkItemControlProps) {
  const rangeMode = workItem.distance_mode === "range";
  return (
    <fieldset className="template-prescription-card">
      <legend>Distance</legend>
      <div className="template-prescription-fields">
        <label className="template-method-field">
          <span>Method</span>
          <select defaultValue={rangeMode ? "range" : "fixed"} {...workItemAttrs(blockIndex, weekIndex, sessionIndex, workItemIndex, "distance_mode")}>
            <option value="fixed">Fixed distance</option>
            <option value="range">Distance range</option>
          </select>
        </label>
        {rangeMode ? (
          <>
            <label><span>Minimum</span><input type="number" min={0.1} max={10000} step={0.1} defaultValue={workItem.distance_min_value} {...workItemAttrs(blockIndex, weekIndex, sessionIndex, workItemIndex, "distance_min_value")} /></label>
            <label><span>Maximum</span><input type="number" min={0.1} max={10000} step={0.1} defaultValue={workItem.distance_max_value} {...workItemAttrs(blockIndex, weekIndex, sessionIndex, workItemIndex, "distance_max_value")} /></label>
          </>
        ) : (
          <label><span>Distance</span><input type="number" min={0.1} max={10000} step={0.1} defaultValue={workItem.planned_distance_value} {...workItemAttrs(blockIndex, weekIndex, sessionIndex, workItemIndex, "planned_distance_value")} /></label>
        )}
        <label>
          <span>Unit</span>
          <select defaultValue={workItem.distance_unit} {...workItemAttrs(blockIndex, weekIndex, sessionIndex, workItemIndex, "distance_unit")}>
            <option value="meters">meters</option>
            <option value="feet">feet</option>
          </select>
        </label>
      </div>
    </fieldset>
  );
}

function PrescriptionControls(props: WorkItemControlProps) {
  const { workItem, blockIndex, weekIndex, sessionIndex, workItemIndex } = props;
  const prescriptionMode = workItem.prescription_mode === "duration" || workItem.prescription_mode === "distance"
    ? workItem.prescription_mode
    : "reps";

  return (
    <>
      <div className="template-prescription-mode-field">
        <label className="template-method-field">
          <span>Prescribe by</span>
          <select defaultValue={prescriptionMode} {...workItemAttrs(blockIndex, weekIndex, sessionIndex, workItemIndex, "prescription_mode")}>
            <option value="reps">Reps</option>
            <option value="duration">Duration</option>
            <option value="distance">Distance</option>
          </select>
        </label>
      </div>
      {prescriptionMode === "duration"
        ? <DurationControls {...props} />
        : prescriptionMode === "distance"
          ? <DistanceControls {...props} />
          : <RepControls {...props} />}
    </>
  );
}

function LoadControls({ workItem, blockIndex, weekIndex, sessionIndex, workItemIndex }: WorkItemControlProps) {
  const loadMode = ["fixed_weight", "bodyweight", "rpe"].includes(workItem.load_mode) ? workItem.load_mode : "percent_1rm";

  return (
    <fieldset className="template-prescription-card">
      <legend>Loading</legend>
      <div className="template-prescription-fields">
        <label className="template-method-field">
          <span>Method</span>
          <select defaultValue={loadMode} {...workItemAttrs(blockIndex, weekIndex, sessionIndex, workItemIndex, "load_mode")}>
            <option value="percent_1rm">% of athlete 1RM</option>
            <option value="fixed_weight">Fixed weight</option>
            <option value="bodyweight">Bodyweight</option>
            <option value="rpe">RPE</option>
          </select>
        </label>
        {loadMode === "percent_1rm" ? (
          <label><span>% 1RM</span><input type="number" min={1} max={100} step={0.5} defaultValue={workItem.percent_1rm} {...workItemAttrs(blockIndex, weekIndex, sessionIndex, workItemIndex, "percent_1rm")} /></label>
        ) : loadMode === "fixed_weight" ? (
          <>
            <label><span>Weight</span><input type="number" min={0.25} max={1000} step={0.25} defaultValue={workItem.weight_value} {...workItemAttrs(blockIndex, weekIndex, sessionIndex, workItemIndex, "weight_value")} /></label>
            <label>
              <span>Unit</span>
              <select defaultValue={workItem.weight_unit} {...workItemAttrs(blockIndex, weekIndex, sessionIndex, workItemIndex, "weight_unit")}>
                <option value="kg">kg</option>
                <option value="lb">lb</option>
              </select>
            </label>
          </>
        ) : loadMode === "rpe" ? (
          <RpeLoadField workItem={workItem} blockIndex={blockIndex} weekIndex={weekIndex} sessionIndex={sessionIndex} workItemIndex={workItemIndex} />
        ) : (
          <div className="template-bodyweight-note">No external load is prescribed.</div>
        )}
      </div>
    </fieldset>
  );
}

// DEV NOTE: RPE and reps-in-reserve (RIR) are the same 1-10 effort scale
// read in opposite directions (rir = 10 - rpe) - this toggle lets a coach
// prescribe in whichever one they think in, but only rpe_value is ever
// stored. Switching the "Enter as" select remounts the number input (via
// `key`) so its defaultValue is freshly derived from the current stored
// rpe_value rather than going stale, matching this tree's deliberately-
// uncontrolled-input convention (see LoadControls' own file-level DEV
// NOTE) for the actual data-mutating field, while the toggle itself and
// the live caption below it are ordinary local React state with no
// connection to the legacy delegated mutation pipeline.
function RpeLoadField({ workItem, blockIndex, weekIndex, sessionIndex, workItemIndex }: WorkItemControlProps) {
  const [entryMode, setEntryMode] = React.useState<"rpe" | "rir">("rpe");
  const storedRpe = Number.isFinite(workItem.rpe_value) ? workItem.rpe_value : 8;
  const [hintRpe, setHintRpe] = React.useState(storedRpe);

  return (
    <>
      <label className="template-method-field">
        <span>Enter as</span>
        <select value={entryMode} onChange={(event) => setEntryMode(event.target.value === "rir" ? "rir" : "rpe")}>
          <option value="rpe">RPE (1-10)</option>
          <option value="rir">Reps in reserve (0-9)</option>
        </select>
      </label>
      {entryMode === "rpe" ? (
        <label>
          <span>RPE</span>
          <input
            key="rpe-input"
            type="number"
            min={1}
            max={10}
            step={1}
            defaultValue={storedRpe}
            onChange={(event) => setHintRpe(Number(event.target.value))}
            {...workItemAttrs(blockIndex, weekIndex, sessionIndex, workItemIndex, "rpe_value")}
          />
        </label>
      ) : (
        <label>
          <span>Reps in reserve</span>
          <input
            key="rir-input"
            type="number"
            min={0}
            max={9}
            step={1}
            defaultValue={rpeToReserve(storedRpe)}
            onChange={(event) => setHintRpe(reserveToRpe(Number(event.target.value)))}
            {...workItemAttrs(blockIndex, weekIndex, sessionIndex, workItemIndex, "rir_value")}
          />
        </label>
      )}
      <p className="muted small">RPE {hintRpe} - {rpeReserveLabel(hintRpe)}</p>
    </>
  );
}

// DEV NOTE: the exercise picker used to be one flat, unlabelled 200+-item
// alphabetical <select> with no indication of what equipment an exercise
// needs - not practical to scan, and gave a coach without (e.g.) a cable
// machine no way to narrow the list. Groups by exerciseCategory() (see
// programmeDraft.ts's own DEV NOTE) via <optgroup>, shows each exercise's
// equipment inline, and adds a local, UI-only equipment filter. The
// filter never removes an <option> from the DOM (only toggles `hidden`)
// so the underlying uncontrolled data-field="exercise_id" select's
// current selection is never silently dropped by React reconciling a
// shorter option list out from under it - the currently-selected
// exercise always stays visible/selectable regardless of the filter.
function ExerciseField({ workItem, blockIndex, weekIndex, sessionIndex, workItemIndex, templateExercises }: WorkItemControlProps & { templateExercises: JsonRecord[] }) {
  const [equipmentFilter, setEquipmentFilter] = React.useState("");

  const equipmentOptions = React.useMemo(() => {
    const tags = new Set<string>();
    for (const exercise of templateExercises) {
      for (const tag of Array.isArray(exercise.equipment) ? exercise.equipment : []) {
        tags.add(String(tag));
      }
    }
    return [...tags].sort((left, right) => titleCase(left).localeCompare(titleCase(right)));
  }, [templateExercises]);

  const groupedExercises = React.useMemo(() => {
    const buckets = new Map<string, JsonRecord[]>();
    for (const exercise of templateExercises) {
      const category = exerciseCategory(exercise);
      if (!buckets.has(category)) buckets.set(category, []);
      buckets.get(category)!.push(exercise);
    }
    return EXERCISE_CATEGORY_ORDER
      .map((category) => ({ category, exercises: buckets.get(category) ?? [] }))
      .filter((entry) => entry.exercises.length > 0);
  }, [templateExercises]);

  return (
    <>
      <label className="template-exercise-filter-field">
        <span>Equipment</span>
        <select value={equipmentFilter} onChange={(event) => setEquipmentFilter(event.target.value)}>
          <option value="">All equipment</option>
          {equipmentOptions.map((tag) => (
            <option key={tag} value={tag}>{titleCase(tag)}</option>
          ))}
        </select>
      </label>
      <label className="template-exercise-field">
        <span>Exercise</span>
        <select defaultValue={workItem.exercise_id} {...workItemAttrs(blockIndex, weekIndex, sessionIndex, workItemIndex, "exercise_id")}>
          {groupedExercises.map(({ category, exercises }) => (
            <optgroup label={category} key={category}>
              {exercises.map((exercise) => {
                const exerciseId = String(exercise.exercise_id);
                const equipmentTags = Array.isArray(exercise.equipment) ? exercise.equipment.map((tag) => titleCase(String(tag))) : [];
                const matchesFilter = !equipmentFilter || (Array.isArray(exercise.equipment) && exercise.equipment.includes(equipmentFilter));
                return (
                  <option key={exerciseId} value={exerciseId} hidden={!matchesFilter && exerciseId !== workItem.exercise_id}>
                    {String(exercise.display_name ?? exerciseId)}{equipmentTags.length ? ` (${equipmentTags.join(", ")})` : ""}
                  </option>
                );
              })}
            </optgroup>
          ))}
        </select>
      </label>
    </>
  );
}

function BuilderWorkItem({
  workItem,
  blockIndex,
  weekIndex,
  sessionIndex,
  workItemIndex,
  workItemCount,
  templateExercises
}: WorkItemControlProps & { workItemCount: number; templateExercises: JsonRecord[] }) {
  const grouped = Boolean(workItem.group_id);

  return (
    <div className={`template-work-item${grouped ? " template-work-item-grouped" : ""}`}>
      <div className="template-work-item-header">
        <span className="exercise-order">{workItemIndex + 1}</span>
        <ExerciseField
          workItem={workItem}
          blockIndex={blockIndex}
          weekIndex={weekIndex}
          sessionIndex={sessionIndex}
          workItemIndex={workItemIndex}
          templateExercises={templateExercises}
        />
        <label className="template-role-field">
          <span>Role</span>
          <select defaultValue={workItem.role} {...workItemAttrs(blockIndex, weekIndex, sessionIndex, workItemIndex, "role")}>
            <option value="primary">Primary</option>
            <option value="accessory">Accessory</option>
          </select>
        </label>
        <label className="template-segment-field">
          <span>Segment</span>
          <select defaultValue={workItem.segment} {...workItemAttrs(blockIndex, weekIndex, sessionIndex, workItemIndex, "segment")}>
            <option value="warm_up">Warm-up</option>
            <option value="working">Working</option>
            <option value="cool_down">Cool-down</option>
          </select>
        </label>
        <div className="builder-action-row">
          <button className="button secondary small-button move-template-work-item" type="button" aria-label="Move exercise up" title="Move exercise up" data-direction={-1} data-block-index={blockIndex} data-week-index={weekIndex} data-session-index={sessionIndex} data-work-item-index={workItemIndex} disabled={workItemIndex === 0}>↑</button>
          <button className="button secondary small-button move-template-work-item" type="button" aria-label="Move exercise down" title="Move exercise down" data-direction={1} data-block-index={blockIndex} data-week-index={weekIndex} data-session-index={sessionIndex} data-work-item-index={workItemIndex} disabled={workItemIndex === workItemCount - 1}>↓</button>
          <button className="button secondary small-button template-work-item-info-toggle" type="button" data-block-index={blockIndex} data-week-index={weekIndex} data-session-index={sessionIndex} data-work-item-index={workItemIndex}>Exercise info</button>
          <button className="button secondary small-button duplicate-template-work-item" type="button" data-block-index={blockIndex} data-week-index={weekIndex} data-session-index={sessionIndex} data-work-item-index={workItemIndex} disabled={workItemCount >= 12}>Duplicate</button>
          {workItemCount > 1 ? (
            <button className="button danger small-button remove-template-work-item" type="button" data-block-index={blockIndex} data-week-index={weekIndex} data-session-index={sessionIndex} data-work-item-index={workItemIndex}>Remove</button>
          ) : null}
        </div>
      </div>
      <div className="template-work-item-info" hidden />
      <div className="template-prescription-grid">
        <label className="template-sets-field">
          <span>Sets</span>
          <input type="number" min={1} max={20} step={1} defaultValue={workItem.planned_sets} {...workItemAttrs(blockIndex, weekIndex, sessionIndex, workItemIndex, "planned_sets")} />
        </label>
        <PrescriptionControls workItem={workItem} blockIndex={blockIndex} weekIndex={weekIndex} sessionIndex={sessionIndex} workItemIndex={workItemIndex} />
        <LoadControls workItem={workItem} blockIndex={blockIndex} weekIndex={weekIndex} sessionIndex={sessionIndex} workItemIndex={workItemIndex} />
        <label className="template-rest-field">
          <span>Rest seconds</span>
          <input type="number" min={0} max={900} step={5} defaultValue={workItem.rest_seconds} {...workItemAttrs(blockIndex, weekIndex, sessionIndex, workItemIndex, "rest_seconds")} />
        </label>
      </div>
      <div className="template-grouping-row">
        {grouped ? (
          <>
            <label className="template-group-type-field">
              <span>Grouping</span>
              <select defaultValue={workItem.group_type} {...workItemAttrs(blockIndex, weekIndex, sessionIndex, workItemIndex, "group_type")}>
                <option value="superset">Superset</option>
                <option value="circuit">Circuit</option>
              </select>
            </label>
            <button className="button secondary small-button ungroup-work-item" type="button" data-block-index={blockIndex} data-week-index={weekIndex} data-session-index={sessionIndex} data-work-item-index={workItemIndex}>Ungroup</button>
          </>
        ) : workItemIndex < workItemCount - 1 ? (
          <button className="button secondary small-button group-with-next-work-item" type="button" data-block-index={blockIndex} data-week-index={weekIndex} data-session-index={sessionIndex} data-work-item-index={workItemIndex}>Group with next</button>
        ) : null}
      </div>
      <label className="field template-work-item-notes-field">
        <span>Coaching notes</span>
        <textarea maxLength={500} defaultValue={workItem.coaching_notes} {...workItemAttrs(blockIndex, weekIndex, sessionIndex, workItemIndex, "coaching_notes")} />
      </label>
    </div>
  );
}

function BuilderSession({
  session,
  blockIndex,
  weekIndex,
  sessionIndex,
  sessionCount,
  templateExercises
}: {
  session: ProgrammeSessionDraft;
  blockIndex: number;
  weekIndex: number;
  sessionIndex: number;
  sessionCount: number;
  templateExercises: JsonRecord[];
}) {
  return (
    <section className="template-session">
      <div className="template-session-header">
        <label className="field template-session-title-field">
          <span>Session title</span>
          <input
            defaultValue={session.title}
            data-template-kind="session"
            data-block-index={blockIndex}
            data-week-index={weekIndex}
            data-session-index={sessionIndex}
            data-field="title"
            maxLength={100}
          />
        </label>
        <div className="builder-action-row">
          <button className="button secondary small-button move-template-session" type="button" aria-label="Move session up" title="Move session up" data-direction={-1} data-block-index={blockIndex} data-week-index={weekIndex} data-session-index={sessionIndex} disabled={sessionIndex === 0}>↑</button>
          <button className="button secondary small-button move-template-session" type="button" aria-label="Move session down" title="Move session down" data-direction={1} data-block-index={blockIndex} data-week-index={weekIndex} data-session-index={sessionIndex} disabled={sessionIndex === sessionCount - 1}>↓</button>
          <button className="button secondary small-button duplicate-template-session" type="button" data-block-index={blockIndex} data-week-index={weekIndex} data-session-index={sessionIndex}>Duplicate</button>
          {sessionCount > 1 ? (
            <button className="button danger small-button remove-template-session" type="button" data-block-index={blockIndex} data-week-index={weekIndex} data-session-index={sessionIndex}>Remove</button>
          ) : null}
        </div>
      </div>
      <label className="field template-session-notes-field">
        <span>Session coaching notes</span>
        <textarea
          maxLength={500}
          defaultValue={session.coaching_notes}
          data-template-kind="session"
          data-block-index={blockIndex}
          data-week-index={weekIndex}
          data-session-index={sessionIndex}
          data-field="coaching_notes"
        />
      </label>
      <div className="template-work-items">
        {session.work_items.map((workItem, workItemIndex) => (
          <BuilderWorkItem
            key={workItem.work_item_id || `new_${workItemIndex}`}
            workItem={workItem}
            blockIndex={blockIndex}
            weekIndex={weekIndex}
            sessionIndex={sessionIndex}
            workItemIndex={workItemIndex}
            workItemCount={session.work_items.length}
            templateExercises={templateExercises}
          />
        ))}
      </div>
      <button className="button secondary add-template-work-item" type="button" data-block-index={blockIndex} data-week-index={weekIndex} data-session-index={sessionIndex} disabled={session.work_items.length >= 12}>Add exercise</button>
    </section>
  );
}

function BuilderWeek({
  week,
  blockIndex,
  weekIndex,
  weekCount,
  templateExercises
}: {
  week: ProgrammeWeekDraft;
  blockIndex: number;
  weekIndex: number;
  weekCount: number;
  templateExercises: JsonRecord[];
}) {
  return (
    <article className="template-week">
      <div className="template-week-header">
        <div>
          <p className="eyebrow">Week {weekIndex + 1}</p>
          <h4>Training week</h4>
          {week.calendar_start_date ? (
            <p className="template-week-calendar">
              {formatDate(week.calendar_start_date)} – {formatDate(week.calendar_end_date)}
              {Number.isInteger(week.days_until_event_at_week_start) ? ` · ${week.days_until_event_at_week_start} days to event` : ""}
              {week.partial_week ? " · Partial week" : ""}
            </p>
          ) : null}
        </div>
        <div className="builder-action-row">
          <button className="button secondary small-button move-template-week" type="button" aria-label="Move week up" title="Move week up" data-direction={-1} data-block-index={blockIndex} data-week-index={weekIndex} disabled={weekIndex === 0}>↑</button>
          <button className="button secondary small-button move-template-week" type="button" aria-label="Move week down" title="Move week down" data-direction={1} data-block-index={blockIndex} data-week-index={weekIndex} disabled={weekIndex === weekCount - 1}>↓</button>
          <button className="button secondary small-button duplicate-template-week" type="button" data-block-index={blockIndex} data-week-index={weekIndex}>Duplicate</button>
          {weekCount > 1 ? (
            <button className="button danger small-button remove-template-week" type="button" data-block-index={blockIndex} data-week-index={weekIndex}>Remove</button>
          ) : null}
        </div>
      </div>
      <div className="template-sessions">
        {week.sessions.map((session, sessionIndex) => (
          <BuilderSession
            key={session.session_id || `new_${sessionIndex}`}
            session={session}
            blockIndex={blockIndex}
            weekIndex={weekIndex}
            sessionIndex={sessionIndex}
            sessionCount={week.sessions.length}
            templateExercises={templateExercises}
          />
        ))}
      </div>
      <button className="button secondary add-template-session" type="button" data-block-index={blockIndex} data-week-index={weekIndex} disabled={week.sessions.length >= 7}>Add session</button>
    </article>
  );
}

function BuilderBlock({
  block,
  blockIndex,
  blockCount,
  totalWeeks,
  hasEventPlan,
  templateExercises
}: {
  block: ProgrammeBlockDraft;
  blockIndex: number;
  blockCount: number;
  totalWeeks: number;
  hasEventPlan: boolean;
  templateExercises: JsonRecord[];
}) {
  return (
    <article className="template-block">
      <div className="template-block-header">
        <div>
          <p className="eyebrow">Training block {blockIndex + 1}</p>
          <h3>{block.name || `Block ${blockIndex + 1}`}</h3>
        </div>
        <div className="builder-action-row">
          <button className="button secondary small-button move-template-block" type="button" aria-label="Move block up" title="Move block up" data-direction={-1} data-block-index={blockIndex} disabled={blockIndex === 0}>↑</button>
          <button className="button secondary small-button move-template-block" type="button" aria-label="Move block down" title="Move block down" data-direction={1} data-block-index={blockIndex} disabled={blockIndex === blockCount - 1}>↓</button>
          <button className="text-button small-inline-action add-template-week" type="button" data-block-index={blockIndex} disabled={block.weeks.length >= 52 || totalWeeks >= 104}>+ Add week</button>
          <button className="button secondary small-button duplicate-template-block" type="button" data-block-index={blockIndex} disabled={blockCount >= 12 || totalWeeks + block.weeks.length > 104}>Duplicate block</button>
          {blockCount > 1 ? (
            <button className="button danger small-button remove-template-block" type="button" data-block-index={blockIndex}>Remove block</button>
          ) : null}
        </div>
      </div>

      <div className="template-block-settings">
        <label className="field">
          <span>Block name</span>
          <input defaultValue={block.name} maxLength={120} data-template-kind="block" data-block-index={blockIndex} data-field="name" />
        </label>
        <label className="field">
          <span>Block type</span>
          <select defaultValue={block.block_type} data-template-kind="block" data-block-index={blockIndex} data-field="block_type">
            <option value="general">General</option>
            <option value="volume">Volume</option>
            <option value="strength">Strength</option>
            <option value="peak">Peak</option>
            <option value="deload">Deload</option>
            <option value="custom">Custom</option>
          </select>
        </label>
        <label className="field template-block-week-count-field">
          <span>Weeks in block</span>
          <input type="number" min={1} max={52} step={1} defaultValue={block.weeks.length} data-template-kind="block" data-block-index={blockIndex} data-field="week_count" />
        </label>
        <label className="field template-block-description-field">
          <span>Block description</span>
          <input defaultValue={block.description} maxLength={500} data-template-kind="block" data-block-index={blockIndex} data-field="description" placeholder="Optional factual purpose or phase label" />
        </label>
      </div>

      {hasEventPlan && block.calendar_start_date ? (
        <div className="block-calendar-strip">
          <span>{formatDate(block.calendar_start_date)}</span>
          <span>→</span>
          <span>{formatDate(block.calendar_end_date)}</span>
          <strong>{block.weeks.length} week{block.weeks.length === 1 ? "" : "s"}</strong>
        </div>
      ) : null}
      <div className="template-weeks">
        {block.weeks.map((week, weekIndex) => (
          <BuilderWeek
            key={week.week_id || `new_${weekIndex}`}
            week={week}
            blockIndex={blockIndex}
            weekIndex={weekIndex}
            weekCount={block.weeks.length}
            templateExercises={templateExercises}
          />
        ))}
      </div>
    </article>
  );
}

export function CoachProgrammeBuilderTree() {
  const { draft, templateExercises } = useProgrammeBuilderDraft();
  if (!draft) return null;

  const totalWeeks = templateCounts(draft).weeks;
  const hasEventPlan = Boolean(draft.event_plan);

  return (
    <>
      {draft.blocks.map((block, blockIndex) => (
        <BuilderBlock
          key={block.block_id || `new_${blockIndex}`}
          block={block}
          blockIndex={blockIndex}
          blockCount={draft.blocks.length}
          totalWeeks={totalWeeks}
          hasEventPlan={hasEventPlan}
          templateExercises={templateExercises}
        />
      ))}
    </>
  );
}
