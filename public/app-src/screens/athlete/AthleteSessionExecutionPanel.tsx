import React, { useRef } from "react";

import { type JsonRecord } from "../../api/transport";
import { exerciseDetails, exerciseName, rpeReserveLabel, titleCase } from "../../utils/format";
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

function ExerciseHowtoBody({ content, referenceMedia }: { content: JsonRecord; referenceMedia: JsonRecord | null }) {
  const instruction = content?.instruction as JsonRecord | undefined;
  const detailedSteps = Array.isArray(instruction?.detailed) ? (instruction!.detailed as string[]) : [];
  const density = document.documentElement.dataset.instructionDensity || "standard";
  const cues = density !== "minimal" && Array.isArray(content?.coaching_cues) ? (content.coaching_cues as string[]) : [];
  const faults = density === "detailed" && Array.isArray(content?.common_faults) ? (content.common_faults as string[]) : [];
  const videoUrl = typeof referenceMedia?.video_url === "string" ? referenceMedia.video_url : "";

  if (!detailedSteps.length && !cues.length && !faults.length && !videoUrl) {
    return <p className="muted">No written instructions are available for this exercise yet.</p>;
  }

  return (
    <>
      {detailedSteps.length ? (
        <ol className="exercise-howto-steps">
          {detailedSteps.map((step, index) => <li key={index}>{step}</li>)}
        </ol>
      ) : null}
      {cues.length ? (
        <>
          <p className="exercise-howto-heading">Coaching cues</p>
          <ul className="exercise-howto-list">
            {cues.map((cue, index) => <li key={index}>{cue}</li>)}
          </ul>
        </>
      ) : null}
      {faults.length ? (
        <>
          <p className="exercise-howto-heading">Common faults</p>
          <ul className="exercise-howto-list">
            {faults.map((fault, index) => <li key={index}>{fault}</li>)}
          </ul>
        </>
      ) : null}
      {videoUrl ? (
        <>
          <p className="exercise-howto-heading">Reference video</p>
          <a className="exercise-reference-media-link" href={videoUrl} target="_blank" rel="noopener noreferrer">
            {typeof referenceMedia?.thumbnail_url === "string" ? (
              <img className="exercise-reference-media-thumbnail" src={referenceMedia.thumbnail_url} alt="Reference video thumbnail" loading="lazy" />
            ) : null}
            <span>Watch reference video</span>
          </a>
        </>
      ) : null}
    </>
  );
}

export function AthleteSessionExecutionPanel() {
  const session = useAthleteSessionExecution();
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

  const rows: { exercise: JsonRecord; status: "complete" | "current" | "remaining" | "dropped" }[] = [
    ...counts.completed.map((row) => ({ exercise: row, status: "complete" as const })),
    ...counts.remaining.map((row, index) => ({
      exercise: row,
      status: ((row.exercise_id ?? row.item_id) === currentId || index === 0 ? "current" : "remaining") as "current" | "remaining"
    })),
    ...counts.dropped.map((row) => ({ exercise: row, status: "dropped" as const }))
  ];

  return (
    <>
      <div className="page-heading session-heading">
        <div>
          <p className="eyebrow">{activity}</p>
          <h2>{`${activity} session`}</h2>
          <p className="muted">{total ? `${total} exercises recorded in this session.` : "Session record loaded."}</p>
        </div>
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
            ) : step.type === "RETURN_DECISION" ? null : (
              <div className="exercise-focus">
                <p className="eyebrow">Current exercise</p>
                <h3>{exerciseName(exercise)}</h3>
                <div className="exercise-detail-row">
                  {String(exercise?.segment ?? "working") !== "working" ? (
                    <span className="badge neutral">{titleCase(exercise?.segment)}</span>
                  ) : null}
                  {exercise?.group_id ? <span className="badge neutral">{titleCase(exercise?.group_type)}</span> : null}
                  {exerciseDetails(exercise).map((detail, index) => <span className="exercise-detail" key={index}>{detail}</span>)}
                </div>
                {String(exercise?.coaching_notes ?? "").trim() ? (
                  <p className="muted exercise-coaching-note">{String(exercise?.coaching_notes).trim()}</p>
                ) : null}
                {currentId ? (
                  <ExerciseHowto exerciseId={currentId} howto={session.howto} onOpen={session.loadHowto} />
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
                  <p>Choose the factual reason for the skip.</p>
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
                  <div className="button-row">
                    <button id="confirmPainReportButton" className="button primary" type="button" disabled={session.busy} onClick={() => session.confirmPainReport()}>Record pain reported</button>
                    <button id="cancelPainReportButton" className="button secondary" type="button" onClick={() => session.closeActionPanel()}>Cancel</button>
                  </div>
                </div>
              ) : null}

              {session.actionPanel === "rpe" ? (
                <div className="pain-report-panel">
                  <h3>Report RPE for this exercise?</h3>
                  <p>This records only your own factual effort rating for this exercise. It does not infer readiness, risk, or optimisation.</p>
                  <label><span>RPE (1-10)</span><input type="number" min={1} max={10} step={1} value={session.rpeValue} onChange={(event) => session.setRpeValue(Number(event.target.value))} /></label>
                  <p className="muted small">RPE {session.rpeValue} - {rpeReserveLabel(session.rpeValue)}</p>
                  <div className="button-row">
                    <button id="confirmRpeReportButton" className="button primary" type="button" disabled={session.busy} onClick={() => session.confirmRpeReport()}>Record RPE</button>
                    <button id="cancelRpeReportButton" className="button secondary" type="button" onClick={() => session.closeActionPanel()}>Cancel</button>
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
              ) : (
                <>
                  <button id="completeExerciseButton" className="button primary wide" type="button" disabled={session.busy} onClick={() => session.completeStep()}>Mark exercise complete</button>
                  <button id="skipExerciseButton" className="button secondary wide" type="button" onClick={() => session.openActionPanel("skip")}>Skip exercise</button>
                  <button id="reportPainButton" className="button secondary wide" type="button" onClick={() => session.openActionPanel("pain")}>Report pain</button>
                  <button id="reportRpeButton" className="button secondary wide" type="button" onClick={() => session.openActionPanel("rpe")}>Report RPE</button>
                  <button id="requestSubstitutionButton" className="button secondary wide" type="button" onClick={() => session.openActionPanel("substitution")}>Request substitution</button>
                  <button id="recordVideoFeedbackButton" className="button secondary wide" type="button" onClick={() => session.openActionPanel("video")}>Record form-check video</button>
                  <button id="splitSessionButton" className="button secondary wide" type="button" disabled={session.busy} onClick={() => session.splitSession()}>Stop and return later</button>
                </>
              )}
            </div>
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
            const statusLabel = status === "complete" ? "Completed" : status === "dropped" ? "Dropped" : status === "current" ? "Current" : "Upcoming";
            const segment = String(row?.segment ?? "working");
            return (
              <div className={`exercise-row ${status} ${row?.group_id ? "exercise-row-grouped" : ""}`} key={`${row?.exercise_id ?? row?.item_id ?? index}_${index}`}>
                <span className="exercise-order">{index + 1}</span>
                <div>
                  <strong>{exerciseName(row)}</strong>
                  {segment !== "working" ? <span className="badge neutral">{titleCase(segment)}</span> : null}
                  {row?.group_id ? <span className="badge neutral">{titleCase(row?.group_type)}</span> : null}
                  <small>{exerciseDetails(row).join(" · ") || "Recorded exercise"}</small>
                  {String(row?.coaching_notes ?? "").trim() ? <small className="exercise-coaching-note">{String(row?.coaching_notes).trim()}</small> : null}
                </div>
                <span className={`badge ${status === "complete" ? "complete" : status === "dropped" ? "partial" : status === "current" ? "active" : "neutral"}`}>{statusLabel}</span>
              </div>
            );
          }) : <div className="empty-state"><p>No exercise records are available.</p></div>}
        </div>
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
