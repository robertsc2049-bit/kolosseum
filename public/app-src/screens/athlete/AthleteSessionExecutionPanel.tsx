import React, { useRef, useState } from "react";

import { withPendingSetLogs } from "../../api/offlineSessionQueue";
import { type JsonRecord } from "../../api/transport";
import { ExerciseHowtoBody } from "../../components/ExerciseHowtoBody";
import { InfoTooltip } from "../../components/InfoTooltip";
import { MuscleGroupSelect } from "../../components/MuscleGroupSelect";
import { inMuscleGroup, musclesText } from "../../utils/muscleGroups";
import { PlateWarmupCalculator } from "../../components/PlateWarmupCalculator";
import { borgAnchorLabel, cr10AnchorLabel, exerciseDetails, exerciseName, groupTimingLabel, rpeReserveLabel, titleCase } from "../../utils/format";
import { trainingCycleSummary } from "../../utils/trainingPlan";
import { programmePositionLine } from "./AthleteProgrammeCard";
import { SetLogger } from "./SetLogger";
import { currentExerciseId, currentStepExercise, useAthleteSessionExecution } from "./useAthleteSessionExecution";

// DEV NOTE: FULL-UI-15C session execution - ported from app.js's
// renderAthleteSession()/renderExerciseFocus()/renderExerciseQueue()/
// renderSessionCompletionSummary() plus the action-panel/rest-timer
// markup in index.html's old #view-session. createSession()/
// loadAthleteToday() stay legacy - see useAthleteSessionExecution.ts's own
// DEV NOTE for why and how the two stacks stay in sync.

function goToToday() {
  (document.querySelector('[data-view="today"]') as HTMLElement | null)?.click();
}

function countsFromSession(sessionState: JsonRecord | null) {
  return {
    completed: Array.isArray(sessionState?.completed_exercises) ? (sessionState!.completed_exercises as JsonRecord[]) : [],
    remaining: Array.isArray(sessionState?.remaining_exercises) ? (sessionState!.remaining_exercises as JsonRecord[]) : [],
    dropped: Array.isArray(sessionState?.dropped_exercises) ? (sessionState!.dropped_exercises as JsonRecord[]) : []
  };
}

function sessionClassification(sessionState: JsonRecord | null): { label: string; className: string; key: string } {
  const counts = countsFromSession(sessionState);
  const total = counts.completed.length + counts.remaining.length + counts.dropped.length;
  const currentStep = sessionState?.current_step as JsonRecord | undefined;

  if (currentStep?.type === "RETURN_DECISION") return { label: "Return decision", className: "active", key: "return" };
  if (total > 0 && counts.remaining.length === 0 && counts.dropped.length > 0) {
    return { label: "Partially completed", className: "partial", key: "partial" };
  }
  if (total > 0 && counts.remaining.length === 0) return { label: "Completed", className: "complete", key: "complete" };
  if (sessionState?.started === true) return { label: "In progress", className: "active", key: "active" };
  return { label: "Planned", className: "neutral", key: "planned" };
}

function ExerciseHowto({ exerciseId, howto, onOpen }: {
  exerciseId: string;
  howto: ReturnType<typeof useAthleteSessionExecution>["howto"];
  onOpen: (exerciseId: string) => void;
}) {
  const active = howto?.exerciseId === exerciseId ? howto : null;

  return (
    <details
      className="exercise-howto"
      onToggle={(event) => {
        if ((event.target as HTMLDetailsElement).open) onOpen(exerciseId);
      }}
    >
      <summary>How to perform this exercise</summary>
      <div className="exercise-howto-body">
        {!active || active.status === "loading" ? <p className="muted">Loading…</p> : null}
        {active?.status === "error" ? <p className="muted">Instructions could not be loaded right now.</p> : null}
        {active?.status === "loaded" ? <ExerciseHowtoBody content={active.content ?? {}} referenceMedia={active.referenceMedia ?? null} /> : null}
      </div>
    </details>
  );
}

// DEV NOTE: a complex/AMRAP/EMOM/for-time group executes as one continuous
// unit, so this replaces the plain single-exercise focus view (never both
// at once) - see useAthleteSessionExecution.ts's currentStepGroup() and
// session_state_read_model.ts's deriveCurrentStepFromRemaining() for where
// this step shape comes from. No in-app countdown timer is shown here
// deliberately - the athlete times themselves, exactly like RPE/Borg/CR10
// are logged after the fact rather than enforced in real time.
function GroupWorkoutFocus({ step }: { step: JsonRecord }) {
  const groupType = String(step.group_type ?? "");
  const exercises = Array.isArray(step.exercises) ? (step.exercises as JsonRecord[]) : [];
  const timeCapSeconds = Number(step.time_cap_seconds ?? 0);
  const roundSeconds = Number(step.round_seconds ?? 0);
  const totalRounds = Number(step.total_rounds ?? 0);

  return (
    <div className="exercise-focus group-workout-focus">
      <p className="eyebrow">{groupType ? groupTimingLabel(step) : "Group"}</p>
      <h3>{exercises.map((exercise) => exerciseName(exercise)).join(" + ")}</h3>
      {timeCapSeconds > 0 ? <p className="muted">{`Time cap: ${Math.round(timeCapSeconds / 60)} minute${timeCapSeconds === 60 ? "" : "s"}`}</p> : null}
      {roundSeconds > 0 && totalRounds > 0 ? (
        <p className="muted">{`${totalRounds} rounds, one every ${roundSeconds} second${roundSeconds === 1 ? "" : "s"}`}</p>
      ) : null}
      <ul className="group-workout-exercise-list">
        {exercises.map((exercise, index) => (
          <li key={String(exercise.exercise_id ?? index)}>
            <span>{exerciseName(exercise)}</span>
            {exerciseDetails(exercise).map((detail, detailIndex) => <span className="exercise-detail" key={detailIndex}>{detail}</span>)}
          </li>
        ))}
      </ul>
    </div>
  );
}

// Rx or scaled: CrossFit scores are only comparable like for like.
function ScaledToggle({ session }: { session: ReturnType<typeof useAthleteSessionExecution> }) {
  return (
    <fieldset className="rx-scaled-toggle">
      <legend>How did you do it?</legend>
      <label className="check-line">
        <input type="radio" name="rxScaled" checked={!session.groupScaled} onChange={() => session.setGroupScaled(false)} />
        <span>Rx (as prescribed)</span>
      </label>
      <label className="check-line">
        <input type="radio" name="rxScaled" checked={session.groupScaled} onChange={() => session.setGroupScaled(true)} />
        <span>Scaled (lighter load or easier movements)</span>
      </label>
    </fieldset>
  );
}

function GroupWorkoutActions({ step, session }: { step: JsonRecord; session: ReturnType<typeof useAthleteSessionExecution> }) {
  const groupType = String(step.group_type ?? "");

  if (groupType === "complex") {
    return (
      <button id="completeGroupButton" className="button primary wide" type="button" disabled={session.busy} onClick={() => session.confirmCompleteGroup()}>Mark complex complete</button>
    );
  }

  if (groupType === "amrap") {
    return (
      <div className="group-workout-result-form">
        <label><span>Rounds completed</span><input type="number" min={0} step={1} value={session.groupAmrapRoundsCompleted} onChange={(event) => session.setGroupAmrapRoundsCompleted(Math.max(0, Number(event.target.value) || 0))} /></label>
        <label><span>Extra reps</span><input type="number" min={0} step={1} value={session.groupAmrapExtraReps} onChange={(event) => session.setGroupAmrapExtraReps(Math.max(0, Number(event.target.value) || 0))} /></label>
        <ScaledToggle session={session} />
        <button id="confirmAmrapResultButton" className="button primary wide" type="button" disabled={session.busy} onClick={() => session.confirmAmrapResult()}>Record AMRAP result</button>
      </div>
    );
  }

  if (groupType === "emom") {
    return (
      <div className="group-workout-result-form">
        <label><span>Rounds completed</span><input type="number" min={0} step={1} value={session.groupEmomRoundsCompleted} onChange={(event) => session.setGroupEmomRoundsCompleted(Math.max(0, Number(event.target.value) || 0))} /></label>
        <label><span>Rounds missed</span><input type="number" min={0} step={1} value={session.groupEmomRoundsMissed} onChange={(event) => session.setGroupEmomRoundsMissed(Math.max(0, Number(event.target.value) || 0))} /></label>
        <ScaledToggle session={session} />
        <button id="confirmEmomResultButton" className="button primary wide" type="button" disabled={session.busy} onClick={() => session.confirmEmomResult()}>Record EMOM result</button>
      </div>
    );
  }

  if (groupType === "for_time") {
    return (
      <div className="group-workout-result-form">
        <label className="check-line">
          <input type="checkbox" checked={session.groupForTimeHitTimeCap} onChange={(event) => session.setGroupForTimeHitTimeCap(event.target.checked)} />
          <span>Hit the time cap before finishing</span>
        </label>
        {!session.groupForTimeHitTimeCap ? (
          <label><span>Elapsed time (seconds)</span><input type="number" min={1} step={1} value={session.groupForTimeElapsedSeconds} onChange={(event) => session.setGroupForTimeElapsedSeconds(Math.max(0, Number(event.target.value) || 0))} /></label>
        ) : null}
        <ScaledToggle session={session} />
        <button id="confirmForTimeResultButton" className="button primary wide" type="button" disabled={session.busy} onClick={() => session.confirmForTimeResult()}>Record for-time result</button>
      </div>
    );
  }

  return null;
}

// Where it hurt (optional). Values match the pain carry-forward areas.
const PAIN_AREA_OPTIONS: Array<[string, string]> = [
  ["knee", "Knee"], ["hip", "Hip"], ["lumbar_low", "Lower back"], ["shoulder", "Shoulder"], ["elbow", "Elbow"],
  ["wrist", "Wrist"], ["ankle", "Ankle"], ["neck", "Neck"], ["other", "Somewhere else"]
];

function PainAreaPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <label className="field">
      <span>Where does it hurt? (optional)</span>
      <select aria-label="Where does it hurt?" value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Not sure / prefer not to say</option>
        {PAIN_AREA_OPTIONS.map(([area, label]) => <option key={area} value={area}>{label}</option>)}
      </select>
    </label>
  );
}

function isRecord(value: unknown): value is JsonRecord {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

// How today's match week shaped this exercise.
function matchWeekNote(context: JsonRecord): string {
  const what = String(context.label ?? "match");
  if (context.role === "day_after") return `Day after your ${what === "Match day" ? "match" : what} - a recovery session: fewer sets, easy effort.`;
  if (context.role === "match_day") return `${what === "Match day" ? "Match" : what} today - a short primer only, no heavy leg work.`;
  return `Day before your ${what === "Match day" ? "match" : what} - a short primer, no heavy leg work.`;
}

// An exercise held back because of what the athlete did last time.
function autoregulationNote(hold: JsonRecord): string {
  const planned = hold.planned_intensity as JsonRecord | undefined;
  const plannedText = planned?.type === "percent_1rm" ? `${Number(planned.value)}% 1RM` : planned?.type === "rpe" ? `RPE ${Number(planned.value)}` : "the plan";
  return `Held back from ${plannedText} - ${String(hold.detail ?? "last time was hard")}.`;
}

// An exercise swapped because an open pain flag is still sore.
function painSwapNote(swap: JsonRecord): string {
  const area = PAIN_AREA_OPTIONS.find(([key]) => key === swap.area)?.[1]?.toLowerCase();
  const from = String(swap.from_display_name ?? swap.from_exercise_id ?? "an exercise");
  return area ? `Swapped from ${from} - your ${area} is still sore.` : `Swapped from ${from} - it is still sore.`;
}

export function AthleteSessionExecutionPanel() {
  const session = useAthleteSessionExecution();
  const [painArea, setPainArea] = useState("");
  const [addMuscleFilter, setAddMuscleFilter] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const captionInputRef = useRef<HTMLTextAreaElement | null>(null);

  if (session.loading && !session.sessionState) {
    return (
      <>
        <div className="page-heading session-heading">
          <div>
            <p className="eyebrow">Session</p>
            <h2>Loading session…</h2>
          </div>
        </div>
        <div className="panel empty-state">
          <div className="empty-icon">…</div>
          <h3>Loading session…</h3>
          <p>Fetching the current session record.</p>
        </div>
      </>
    );
  }

  if (session.error) {
    return (
      <>
        <div className="page-heading session-heading">
          <div>
            <p className="eyebrow">Session</p>
            <h2>Session could not be loaded</h2>
          </div>
        </div>
        <div className="panel empty-state">
          <div className="empty-icon">!</div>
          <h3>Session could not be loaded</h3>
          <p>The session record could not be fetched. Check your connection and try again.</p>
          <button id="sessionRetryButton" className="button primary" type="button" onClick={() => session.refresh()}>Retry</button>
        </div>
      </>
    );
  }

  if (!session.sessionId || !session.sessionState) {
    return (
      <>
        <div className="page-heading session-heading">
          <div>
            <p className="eyebrow">Session</p>
            <h2>No session selected</h2>
            <p className="muted">Create or open a session to begin.</p>
          </div>
          <span className="badge neutral">No session</span>
        </div>
        <div className="panel empty-state">
          <div className="empty-icon">S</div>
          <h3>No session selected</h3>
          <p>Return to Today and create a session.</p>
          <button className="button primary" type="button" onClick={goToToday}>Go to Today</button>
        </div>
      </>
    );
  }

  const sessionState = session.sessionState;
  const counts = countsFromSession(sessionState);
  const total = counts.completed.length + counts.remaining.length + counts.dropped.length;
  const classification = sessionClassification(sessionState);
  const activity = titleCase("training");
  const currentId = currentExerciseId(sessionState);
  const exercise = currentStepExercise(sessionState);
  const step = sessionState.current_step as JsonRecord | undefined;
  const started = sessionState.started === true;
  const progress = total === 0 ? 0 : Math.round((counts.completed.length / total) * 100);
  const executionStatus = sessionState.execution_status;
  const isEnded = executionStatus === "completed" || executionStatus === "partial";
  // Where this session sits in the athlete's periodised plan (self-directed only).
  const cycle = sessionState.training_cycle as JsonRecord | undefined;
  const programmeRun = isRecord(sessionState.programme_run) ? (sessionState.programme_run as JsonRecord) : null;
  // The athlete's own week (MyTrainingCard): which day of it, which week.
  const ownTraining = isRecord(sessionState.own_training) ? (sessionState.own_training as JsonRecord) : null;
  const cycleSummary = ownTraining?.today === true
    ? "Today's session - your own exercises"
    : ownTraining
    ? `My training · Day ${Number(ownTraining.day_number)} of ${Number(ownTraining.days_total)} · week ${Number(ownTraining.week_number)}${ownTraining.lighter === true ? " (lighter)" : ""}`
    : programmeRun
    ? [String(programmeRun.title ?? ""), programmePositionLine(programmeRun), `Session ${Number(programmeRun.session_number)}${Number(programmeRun.sessions_total) > 0 ? ` of ${Number(programmeRun.sessions_total)}` : ""}${programmeRun.session_title ? `: ${String(programmeRun.session_title)}` : ""}`].filter(Boolean).join(" · ")
    : trainingCycleSummary(cycle);
  const deload = cycle?.deload === true;
  // Back after a break: a lighter re-entry week, then blocks restart at week 1
  // - or, on a Kolosseum programme, the programme carries on where it left off.
  const runReentry = isRecord(programmeRun?.reentry) ? (programmeRun?.reentry as JsonRecord) : isRecord(ownTraining?.reentry) ? (ownTraining?.reentry as JsonRecord) : null;
  const reentry = runReentry ?? (isRecord(cycle?.reentry) ? (cycle?.reentry as JsonRecord) : null);
  const reentryNote = reentry && reentry.reentry_week === true
    ? reentry.after_head_injury === true
      ? `Your first week back after a head injury: a lighter re-entry week with no jumping, sprinting, cutting or neck loading.${runReentry ? " Your programme carries on from here, a set fewer and lighter this week." : ""} Follow your medical professional's return-to-play plan.`
      : runReentry
        ? `Welcome back - it has been ${Number(reentry.gap_days)} days since your last session, so this week's sessions are lighter: a set fewer and less weight. Your programme picks up where you left off.`
        : `Welcome back - it has been ${Number(reentry.gap_days)} days since your last session, so this week is a lighter re-entry week. Your training blocks restart from week 1 next week.`
    : null;

  const rows: { exercise: JsonRecord; status: "complete" | "current" | "remaining" | "dropped" }[] = [
    ...counts.completed.map((row) => ({ exercise: row, status: "complete" as const })),
    ...counts.remaining.map((row, index) => ({
      exercise: row,
      status: ((row.exercise_id ?? row.item_id) === currentId || index === 0 ? "current" : "remaining") as "current" | "remaining"
    })),
    ...counts.dropped.map((row) => ({ exercise: row, status: "dropped" as const }))
  ];

  const prescribedExerciseIds = new Set(
    rows.map(({ exercise: row }) => String(row?.exercise_id ?? row?.item_id ?? ""))
  );
  const addableExercises = session.exerciseCatalog.filter(
    (option) => !prescribedExerciseIds.has(String(option.exercise_id))
  );

  return (
    <>
      <div className="page-heading session-heading">
        <div>
          <p className="eyebrow">{activity}</p>
          <h2>{`${activity} session`}</h2>
          <p className="muted">{total ? `${total} exercises recorded in this session.` : "Session record loaded."}</p>
          {cycleSummary ? <p className="session-cycle" data-testid="session-cycle">{cycleSummary}</p> : null}
          {reentryNote ? <p className="inline-result" data-tone="warning" data-testid="session-reentry">{reentryNote}</p> : null}
        </div>
        {deload && !reentryNote ? <span className="badge" title="A lighter week to absorb the last three weeks of training">Deload week</span> : null}
        {reentryNote ? <span className="badge" title="A lighter week to ease back in after a break">Re-entry week</span> : null}
        <span className={`badge ${classification.className}`}>{classification.label}</span>
      </div>

      <div className="session-layout">
        <article className="panel current-work">
          <div className="panel-kicker">
            <span>Current work</span>
            <span>{`${counts.completed.length} of ${total} complete`}</span>
          </div>

          <div>
            {!step ? (
              <div className="exercise-focus">
                <p className="eyebrow">{classification.label}</p>
                <h3>Session record complete</h3>
                <p className="muted">No further exercise is currently recorded.</p>
              </div>
            ) : step.type === "RETURN_DECISION" ? null : step.type === "GROUP_WORKOUT" ? (
              <GroupWorkoutFocus step={step} />
            ) : (
              <div className="exercise-focus">
                <p className="eyebrow">Current exercise</p>
                <h3>{exerciseName(exercise)}</h3>
                <div className="exercise-detail-row">
                  {String(exercise?.segment ?? "working") !== "working" ? (
                    <span className="badge neutral">{titleCase(exercise?.segment)}</span>
                  ) : null}
                  {exercise?.group_id ? <span className="badge neutral">{groupTimingLabel(exercise)}</span> : null}
                  {exerciseDetails(exercise).map((detail, index) => <span className="exercise-detail" key={index}>{detail}</span>)}
                </div>
                {isRecord(exercise?.readiness) ? (
                  <p className="inline-result readiness-note" data-tone="warning">
                    {`Lighter today - your readiness check-in was low (sleep ${Number((exercise.readiness as JsonRecord).sleep)}/5, soreness ${Number((exercise.readiness as JsonRecord).soreness)}/5, stress ${Number((exercise.readiness as JsonRecord).stress)}/5).`}
                  </p>
                ) : null}
                {isRecord(exercise?.equipment_swap) ? (
                  <p className="inline-result equipment-note" data-tone="warning">
                    {`Substitute: no ${((exercise.equipment_swap as JsonRecord).missing as string[] ?? []).join(" or ").toLowerCase() || "equipment"} for ${String((exercise.equipment_swap as JsonRecord).from_display_name)} - this is not the same exercise.`}
                  </p>
                ) : null}
                {Array.isArray(exercise?.equipment_missing) && (exercise.equipment_missing as string[]).length ? (
                  <p className="inline-result equipment-note" data-tone="warning">
                    {`You told us you don't have: ${(exercise.equipment_missing as string[]).join(", ").toLowerCase()}. Skip this exercise or use what you have.`}
                  </p>
                ) : null}
                {isRecord(exercise?.fight_camp) ? (
                  <p className="inline-result fight-camp-note" data-tone="warning">
                    {`Fight camp (${Number((exercise.fight_camp as JsonRecord).days_out)} days out): ${Number((exercise.fight_camp as JsonRecord).planned_sets)} × ${Number((exercise.fight_camp as JsonRecord).planned_reps)} cut to keep strength without building muscle mass.`}
                  </p>
                ) : null}
                {isRecord(exercise?.match_week) ? (
                  <p className="inline-result match-week-note" data-tone="warning">
                    {matchWeekNote(exercise.match_week as JsonRecord)}
                  </p>
                ) : null}
                {isRecord(exercise?.autoregulation) ? (
                  <p className="inline-result autoregulation-note" data-tone="warning">
                    {autoregulationNote(exercise.autoregulation as JsonRecord)}
                  </p>
                ) : null}
                {isRecord(exercise?.pain_swap) ? (
                  <p className="inline-result pain-swap-note" data-tone="warning">
                    {painSwapNote(exercise.pain_swap as JsonRecord)}
                  </p>
                ) : null}
                {String(exercise?.coaching_notes ?? "").trim() ? (
                  <p className="muted exercise-coaching-note">{String(exercise?.coaching_notes).trim()}</p>
                ) : null}
                {currentId ? (
                  <ExerciseHowto exerciseId={currentId} howto={session.howto} onOpen={session.loadHowto} />
                ) : null}
                <PlateWarmupCalculator exercise={exercise} />
                {started && exercise && currentId ? (
                  <SetLogger
                    exercise={exercise}
                    setLogs={withPendingSetLogs(String(session.sessionId ?? ""), currentId, Array.isArray((sessionState.set_logs as JsonRecord | undefined)?.[currentId]) ? ((sessionState.set_logs as JsonRecord)[currentId] as JsonRecord[]) : [])}
                    busy={session.busy}
                    logSet={session.logSet}
                  />
                ) : null}
              </div>
            )}
          </div>

          {step?.type === "RETURN_DECISION" ? (
            <div className="return-decision">
              <h3>Continue this session?</h3>
              <p>The session was stopped with work remaining. Choose how to record the return.</p>
              <div className="button-row">
                <button id="returnContinueButton" className="button primary" type="button" disabled={session.busy} onClick={() => session.returnContinue()}>Continue remaining work</button>
                <button id="returnSkipButton" className="button secondary" type="button" disabled={session.busy} onClick={() => session.returnSkip()}>Finish without remaining work</button>
              </div>
            </div>
          ) : (
            <>
              {session.actionPanel === "skip" ? (
                <div className="skip-reason-panel">
                  <h3>Skip this exercise?</h3>
                  <p>Choose the reason for the skip.</p>
                  <select id="skipReasonSelect" value={session.skipReasonCode} onChange={(event) => session.setSkipReasonCode(event.target.value)}>
                    <option value="equipment_unavailable">Equipment unavailable</option>
                    <option value="time_constraint">Time constraint</option>
                    <option value="pain_or_discomfort">Pain or discomfort</option>
                    <option value="fatigue">Fatigue</option>
                    <option value="other">Other</option>
                  </select>
                  <div className="button-row">
                    <button id="confirmSkipButton" className="button primary" type="button" disabled={session.busy} onClick={() => session.confirmSkipWithReason()}>Confirm skip</button>
                    <button id="cancelSkipButton" className="button secondary" type="button" onClick={() => session.closeActionPanel()}>Cancel</button>
                  </div>
                </div>
              ) : null}

              {session.actionPanel === "pain" ? (
                <div className="pain-report-panel">
                  <h3>Report pain during this exercise?</h3>
                  <p>This records only that pain was reported for this exercise. It does not diagnose, score risk, or provide treatment advice.</p>
                  <PainAreaPicker value={painArea} onChange={setPainArea} />
                  <p className="muted">Before your next session with exercises that load the same area, you will be asked how it is.</p>
                  <div className="button-row">
                    <button id="confirmPainReportButton" className="button primary" type="button" disabled={session.busy} onClick={() => { void session.confirmPainReport(painArea || undefined); setPainArea(""); }}>Record pain reported</button>
                    <button id="cancelPainReportButton" className="button secondary" type="button" onClick={() => session.closeActionPanel()}>Cancel</button>
                  </div>
                </div>
              ) : null}

              {session.actionPanel === "rpe" ? (
                <div className="pain-report-panel">
                  <h3>Report RPE for this exercise?</h3>
                  <p>This only records your own effort rating for this exercise. It doesn't judge your readiness or risk, or change your programme.</p>
                  <label><span>RPE (1-10)<InfoTooltip label="About RPE">RPE stands for Rate of Perceived Exertion - how hard this set felt to you, on a 1-10 scale.</InfoTooltip></span><input type="number" min={1} max={10} step={1} value={session.rpeValue} onChange={(event) => session.setRpeValue(Number(event.target.value))} /></label>
                  <p className="muted small">RPE {session.rpeValue} - {rpeReserveLabel(session.rpeValue)}</p>
                  <div className="button-row">
                    <button id="confirmRpeReportButton" className="button primary" type="button" disabled={session.busy} onClick={() => session.confirmRpeReport()}>Record RPE</button>
                    <button id="cancelRpeReportButton" className="button secondary" type="button" onClick={() => session.closeActionPanel()}>Cancel</button>
                  </div>
                </div>
              ) : null}

              {session.actionPanel === "borg" ? (
                <div className="pain-report-panel">
                  <h3>Report Borg rating for this exercise?</h3>
                  <p>This only records your own effort rating for this exercise. It doesn't judge your readiness or risk, or change your programme.</p>
                  <label><span>Borg (6-20)<InfoTooltip label="About the Borg scale">Borg is a separate perceived-exertion scale from RPE, not a conversion of it - 6 means no exertion at all, 20 means maximal effort.</InfoTooltip></span><input type="number" min={6} max={20} step={1} value={session.borgValue} onChange={(event) => session.setBorgValue(Number(event.target.value))} /></label>
                  <p className="muted small">Borg {session.borgValue} - {borgAnchorLabel(session.borgValue)}</p>
                  <div className="button-row">
                    <button id="confirmBorgReportButton" className="button primary" type="button" disabled={session.busy} onClick={() => session.confirmBorgReport()}>Record Borg</button>
                    <button id="cancelBorgReportButton" className="button secondary" type="button" onClick={() => session.closeActionPanel()}>Cancel</button>
                  </div>
                </div>
              ) : null}

              {session.actionPanel === "cr10" ? (
                <div className="pain-report-panel">
                  <h3>Report modified Borg / CR10 rating for this exercise?</h3>
                  <p>This only records your own effort rating for this exercise. It doesn't judge your readiness or risk, or change your programme.</p>
                  <label><span>Modified Borg / CR10 (0-10)<InfoTooltip label="About CR10">CR10 is its own 0-10, half-point scale for perceived exertion - it's not a conversion of RPE or the Borg scale.</InfoTooltip></span><input type="number" min={0} max={10} step={0.5} value={session.cr10Value} onChange={(event) => session.setCr10Value(Number(event.target.value))} /></label>
                  <p className="muted small">CR10 {session.cr10Value} - {cr10AnchorLabel(session.cr10Value)}</p>
                  <div className="button-row">
                    <button id="confirmCr10ReportButton" className="button primary" type="button" disabled={session.busy} onClick={() => session.confirmCr10Report()}>Record CR10</button>
                    <button id="cancelCr10ReportButton" className="button secondary" type="button" onClick={() => session.closeActionPanel()}>Cancel</button>
                  </div>
                </div>
              ) : null}

              {session.actionPanel === "video" ? (
                <div className="pain-report-panel">
                  <h3>Record a form-check video</h3>
                  <p>Upload a short video of this exercise for your coach to review and reply to.</p>
                  <label><span>Video (MP4/MOV, up to 50MB)</span><input ref={fileInputRef} type="file" accept="video/mp4,video/quicktime" capture="environment" /></label>
                  <label><span>Note for your coach (optional)</span><textarea ref={captionInputRef} rows={2} maxLength={4000}></textarea></label>
                  {session.videoError ? <p className="muted">{session.videoError}</p> : null}
                  <div className="button-row">
                    <button
                      id="uploadVideoFeedbackButton"
                      className="button primary"
                      type="button"
                      disabled={session.videoUploading}
                      onClick={() => session.uploadVideo(fileInputRef.current?.files?.[0], captionInputRef.current?.value ?? "")}
                    >
                      Upload video
                    </button>
                    <button id="cancelVideoFeedbackButton" className="button secondary" type="button" onClick={() => session.closeActionPanel()}>Cancel</button>
                  </div>
                </div>
              ) : null}

              {session.actionPanel === "substitution" ? (
                <div className="substitution-panel">
                  <h3>Request a substitution</h3>
                  <p>Select any equipment that is unavailable right now.</p>
                  <div className="button-row">
                    {["barbell", "dumbbell", "kettlebell"].map((equipmentId) => (
                      <label key={equipmentId}>
                        <input
                          type="checkbox"
                          className="substitution-equipment-option"
                          checked={session.substitutionUnavailableEquipment.includes(equipmentId)}
                          onChange={() => session.toggleSubstitutionEquipment(equipmentId)}
                        />
                        {" "}{titleCase(equipmentId)}
                      </label>
                    ))}
                  </div>
                  <div className="button-row">
                    <button id="checkSubstitutionButton" className="button primary" type="button" disabled={session.substitutionChecking} onClick={() => session.checkSubstitution()}>Check for substitute</button>
                    <button id="cancelSubstitutionButton" className="button secondary" type="button" onClick={() => session.closeActionPanel()}>Cancel</button>
                  </div>
                  {session.substitutionResult && session.substitutionResult.exerciseId === currentId ? (
                    <div className="substitution-result">
                      {session.substitutionResult.outcome?.ok === true && (session.substitutionResult.outcome.result as JsonRecord | undefined)?.substitution_status === "substitution_applied" ? (
                        <>
                          <p><strong>Substitute available:</strong> {String(((session.substitutionResult.outcome.result as JsonRecord).substitution_output as JsonRecord).target_exercise_id)}</p>
                          <div className="button-row">
                            <button className="button primary" type="button" disabled={session.busy} onClick={() => session.applySubstitution("COMPLETE_EXERCISE")}>Complete with substitute</button>
                            <button className="button secondary" type="button" disabled={session.busy} onClick={() => session.applySubstitution("SKIP_EXERCISE")}>Skip with substitute</button>
                          </div>
                        </>
                      ) : session.substitutionResult.outcome?.ok === true ? (
                        <p>No substitution is required for the selected equipment.</p>
                      ) : (
                        <p>No lawful substitute is available for this exercise.</p>
                      )}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </>
          )}

          {session.restRemainingSeconds !== null ? (
            <div className={`rest-timer-panel${session.restDone ? " rest-timer-done" : ""}`}>
              <p className="eyebrow">Resting</p>
              <p className="rest-timer-remaining">{session.restDone ? "Rest complete" : formatRestClock(session.restRemainingSeconds)}</p>
              <div className="button-row">
                <button id="skipRestButton" className="button secondary" type="button" onClick={() => session.stopRestTimer()}>Skip rest</button>
              </div>
            </div>
          ) : null}

          {step && step.type !== "RETURN_DECISION" ? (
            <div className="session-actions">
              {!started ? (
                <button id="startSessionButton" className="button primary wide" type="button" disabled={session.busy} onClick={() => session.startSession()}>Start session</button>
              ) : step.type === "GROUP_WORKOUT" ? (
                <>
                  <GroupWorkoutActions step={step} session={session} />
                  <button id="splitSessionButton" className="button secondary wide" type="button" disabled={session.busy} onClick={() => session.splitSession()}>Stop and return later</button>
                </>
              ) : (
                <>
                  <button id="completeExerciseButton" className="button primary wide" type="button" disabled={session.busy} onClick={() => session.completeStep()}>Mark exercise complete</button>
                  <button id="skipExerciseButton" className="button secondary wide" type="button" onClick={() => session.openActionPanel("skip")}>Skip exercise</button>
                  <button id="reportPainButton" className="button secondary wide" type="button" onClick={() => session.openActionPanel("pain")}>Report pain</button>
                  <button id="reportRpeButton" className="button secondary wide" type="button" onClick={() => session.openActionPanel("rpe")}>Report RPE</button>
                  <button id="reportBorgButton" className="button secondary wide" type="button" onClick={() => session.openActionPanel("borg")}>Report Borg</button>
                  <button id="reportCr10Button" className="button secondary wide" type="button" onClick={() => session.openActionPanel("cr10")}>Report CR10</button>
                  <button id="requestSubstitutionButton" className="button secondary wide" type="button" onClick={() => session.openActionPanel("substitution")}>Request substitution</button>
                  <button id="recordVideoFeedbackButton" className="button secondary wide" type="button" onClick={() => session.openActionPanel("video")}>Record form-check video</button>
                  <button id="splitSessionButton" className="button secondary wide" type="button" disabled={session.busy} onClick={() => session.splitSession()}>Stop and return later</button>
                </>
              )}
            </div>
          ) : null}

          {session.mutationError ? <p className="muted" role="status" aria-live="polite">{session.mutationError}</p> : null}
          {session.offlinePending > 0 ? (
            <p className="inline-result" data-tone="warning" role="status" data-testid="offline-pending">
              {`${session.offlinePending} ${session.offlinePending === 1 ? "entry" : "entries"} saved on this phone - ${session.offlinePending === 1 ? "it" : "they"} will send when you are back online.`}
            </p>
          ) : null}
        </article>

        <aside className="panel session-summary">
          <p className="eyebrow">Session progress</p>
          <div className="progress-track"><span style={{ width: `${progress}%` }}></span></div>
          <div className="metric-stack">
            <div><span>Completed</span><strong>{counts.completed.length}</strong></div>
            <div><span>Remaining</span><strong>{counts.remaining.length}</strong></div>
            <div><span>Dropped</span><strong>{counts.dropped.length}</strong></div>
          </div>
        </aside>
      </div>

      {isEnded ? (
        <article id="sessionCompletionSummary" className="panel session-completion-summary">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Session ended</p>
              <h3>{executionStatus === "completed" ? "Session complete" : "Session partially completed"}</h3>
            </div>
          </div>
          <p className="muted">
            {executionStatus === "completed" ? "Every exercise in this session was completed." : "This session ended with one or more exercises dropped."}
          </p>
          <div className="metric-stack">
            <div><span>Completed</span><strong>{counts.completed.length}</strong></div>
            <div><span>Dropped</span><strong>{counts.dropped.length}</strong></div>
          </div>
        </article>
      ) : null}

      <article className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Session order</p>
            <h3>Exercises</h3>
          </div>
        </div>
        <div className="exercise-list">
          {rows.length ? rows.map(({ exercise: row, status }, index) => {
            // The group's cap/rounds badge shows once, on its first listed member.
            const groupId = String(row?.group_id ?? "");
            const firstInGroup = groupId.length > 0 && !rows.slice(0, index).some(({ exercise: earlier }) => String(earlier?.group_id ?? "") === groupId);
            const statusLabel = status === "complete" ? "Completed" : status === "dropped" ? "Dropped" : status === "current" ? "Current" : "Upcoming";
            const segment = String(row?.segment ?? "working");
            const exerciseId = String(row?.exercise_id ?? row?.item_id ?? "");
            const canAddExtraSet = exerciseId.length > 0 && (status === "complete" || status === "dropped");
            const extraSetPanelOpen = canAddExtraSet && session.extraSetTargetExerciseId === exerciseId;
            const justLoggedExtraSet = canAddExtraSet && session.extraSetJustLoggedExerciseId === exerciseId;
            return (
              <div className={`exercise-row ${status} ${row?.group_id ? "exercise-row-grouped" : ""}`} key={`${row?.exercise_id ?? row?.item_id ?? index}_${index}`}>
                <span className="exercise-order">{index + 1}</span>
                <div>
                  <strong>{exerciseName(row)}</strong>
                  {segment !== "working" ? <span className="badge neutral">{titleCase(segment)}</span> : null}
                  {firstInGroup ? <span className="badge neutral group-timing-badge">{groupTimingLabel(row)}</span> : null}
                  <small>{exerciseDetails(row).join(" · ") || "Recorded exercise"}</small>
                  {String(row?.coaching_notes ?? "").trim() ? <small className="exercise-coaching-note">{String(row?.coaching_notes).trim()}</small> : null}
                  {canAddExtraSet && !extraSetPanelOpen ? (
                    <button
                      className="button secondary small"
                      type="button"
                      onClick={() => session.openExtraSetPanel(exerciseId)}
                    >
                      Add extra set
                    </button>
                  ) : null}
                  {justLoggedExtraSet ? (
                    <small className="extra-set-confirmation">
                      Extra set logged.{" "}
                      {session.extraSetJustLoggedIsPr ? <span className="badge active">PR</span> : null}
                    </small>
                  ) : null}
                  {extraSetPanelOpen ? (
                    <div className="extra-set-panel">
                      <label className="field">
                        <span>Reps</span>
                        <input
                          type="number"
                          min={1}
                          step={1}
                          value={session.extraSetReps}
                          onChange={(event) => session.setExtraSetReps(Math.max(1, Math.round(Number(event.target.value) || 1)))}
                        />
                      </label>
                      <label className="field">
                        <span>Weight (optional)<InfoTooltip label="About negative weight values">A negative value records assisted reps, such as help from a resistance band or an assisted-exercise machine.</InfoTooltip></span>
                        <input
                          type="number"
                          step="any"
                          title="Use a negative value to record assisted reps (e.g. band or machine assistance)"
                          value={session.extraSetLoadValue}
                          onChange={(event) => session.setExtraSetLoadValue(event.target.value)}
                        />
                      </label>
                      <label className="field">
                        <span>Unit</span>
                        <select
                          value={session.extraSetLoadUnit}
                          onChange={(event) => session.setExtraSetLoadUnit(event.target.value === "lb" ? "lb" : "kg")}
                        >
                          <option value="kg">kg</option>
                          <option value="lb">lb</option>
                        </select>
                      </label>
                      <div className="extra-set-actions">
                        <button className="button secondary" type="button" disabled={session.busy} onClick={() => session.closeExtraSetPanel()}>Cancel</button>
                        <button className="button primary" type="button" disabled={session.busy} onClick={() => session.confirmExtraSetReport()}>Log extra set</button>
                      </div>
                    </div>
                  ) : null}
                </div>
                <span className={`badge ${status === "complete" ? "complete" : status === "dropped" ? "partial" : status === "current" ? "active" : "neutral"}`}>{statusLabel}</span>
              </div>
            );
          }) : <div className="empty-state"><p>No exercise records are available.</p></div>}
        </div>
      </article>

      <article className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Extra work</p>
            <h3>Extra exercise</h3>
          </div>
        </div>
        {!session.addExercisePanelOpen ? (
          <button
            className="button secondary"
            type="button"
            onClick={() => session.openAddExercisePanel(String(addableExercises[0]?.exercise_id ?? ""))}
          >
            Add exercise
          </button>
        ) : (
          <div className="extra-set-panel">
            <MuscleGroupSelect value={addMuscleFilter} onChange={setAddMuscleFilter} />
            <label className="field">
              <span>Exercise</span>
              <select
                value={session.addExerciseSelectedId}
                onChange={(event) => session.setAddExerciseSelectedId(event.target.value)}
              >
                {addableExercises.filter((option) => String(option.exercise_id) === session.addExerciseSelectedId || inMuscleGroup(option, addMuscleFilter)).map((option) => (
                  <option key={String(option.exercise_id)} value={String(option.exercise_id)}>
                    {String(option.display_name ?? option.exercise_id)}
                  </option>
                ))}
              </select>
              {session.addExerciseSelectedId ? <small className="muted exercise-muscles">{musclesText(addableExercises.find((option) => String(option.exercise_id) === session.addExerciseSelectedId))}</small> : null}
            </label>
            <label className="field">
              <span>Reps</span>
              <input
                type="number"
                min={1}
                step={1}
                value={session.addExerciseReps}
                onChange={(event) => session.setAddExerciseReps(Math.max(1, Math.round(Number(event.target.value) || 1)))}
              />
            </label>
            <label className="field">
              <span>Weight (optional)<InfoTooltip label="About negative weight values">A negative value records assisted reps, such as help from a resistance band or an assisted-exercise machine.</InfoTooltip></span>
              <input
                type="number"
                step="any"
                title="Use a negative value to record assisted reps (e.g. band or machine assistance)"
                value={session.addExerciseLoadValue}
                onChange={(event) => session.setAddExerciseLoadValue(event.target.value)}
              />
            </label>
            <label className="field">
              <span>Unit</span>
              <select
                value={session.addExerciseLoadUnit}
                onChange={(event) => session.setAddExerciseLoadUnit(event.target.value === "lb" ? "lb" : "kg")}
              >
                <option value="kg">kg</option>
                <option value="lb">lb</option>
              </select>
            </label>
            <div className="extra-set-actions">
              <button className="button secondary" type="button" disabled={session.busy} onClick={() => session.closeAddExercisePanel()}>Cancel</button>
              <button
                className="button primary"
                type="button"
                disabled={session.busy}
                onClick={() => session.confirmAddExercise()}
              >
                Log exercise
              </button>
            </div>
          </div>
        )}
        {session.addExerciseJustLoggedLabel ? (
          <small className="extra-set-confirmation">
            {session.addExerciseJustLoggedLabel} added.{" "}
            {session.addExerciseJustLoggedIsPr ? <span className="badge active">PR</span> : null}
          </small>
        ) : null}
      </article>
    </>
  );
}

function formatRestClock(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
