import React from "react";

import { type JsonRecord } from "../../api/transport";
import { titleCase } from "../../utils/format";

// What the athlete actually did in a session, for the coach reviewing it:
// every planned exercise in programme order with the sets logged against it
// ("Set 1 · 5 × 102.5 kg", PRs marked), their effort ratings, any swap, any
// extra sets, then exercises they added and anything skipped. Read from the
// session's entry in /coach-workspace/athlete-detail's session_history - the
// same record the athlete profile's history shows.

export type SessionWorkState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; session: JsonRecord | null };

const list = (value: unknown): JsonRecord[] => (Array.isArray(value) ? (value as JsonRecord[]) : []);

// "custom_farmer_carry" -> "Farmer Carry"; a repeat "back_squat__r2" -> "Back Squat".
export function exerciseLabel(exerciseId: string, names: ReadonlyMap<string, string>): string {
  const base = exerciseId.replace(/__r\d+$/u, "");
  return names.get(exerciseId) ?? names.get(base) ?? titleCase(base.replace(/^custom_/u, ""));
}

function formatNumber(value: unknown): string {
  const n = Number(value);
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2)));
}

export function setDose(entry: JsonRecord): string {
  const reps = Number(entry.reps);
  const repsText = `${reps} rep${reps === 1 ? "" : "s"}`;
  if (entry.load_value === null || entry.load_value === undefined || entry.load_value === "") return repsText;
  return `${reps} × ${formatNumber(entry.load_value)} ${String(entry.load_unit ?? "kg")}`;
}

// One row per set: an edited set appears once, as its latest log.
function latestSets(logs: JsonRecord[]): JsonRecord[] {
  const bySet = new Map<number, JsonRecord>();
  for (const log of [...logs].sort((a, b) => Number(a.seq ?? 0) - Number(b.seq ?? 0))) bySet.set(Number(log.set_index), log);
  return [...bySet.values()].sort((a, b) => Number(a.set_index) - Number(b.set_index));
}

export function ReviewSessionWork({ athleteName, work, exerciseNames }: {
  athleteName: string;
  work: SessionWorkState;
  exerciseNames: ReadonlyMap<string, string>;
}) {
  const firstName = athleteName.split(" ")[0] || "The athlete";
  const heading = <h4>{`What ${firstName} did`}</h4>;
  if (work.status === "loading") {
    return <section className="review-session-work">{heading}<p className="muted small">Loading the logged work…</p></section>;
  }
  if (work.status === "error" || !work.session) {
    return <section className="review-session-work">{heading}<p className="muted small">The logged work for this session isn't available right now.</p></section>;
  }

  const session = work.session;
  const setLogs = list(session.set_logs);
  const extraSets = list(session.extra_set_reports);
  const ratings = [
    ...list(session.rpe_reports).map((entry) => [String(entry.exercise_id), `RPE ${formatNumber(entry.rpe_value)}`]),
    ...list(session.borg_reports).map((entry) => [String(entry.exercise_id), `Borg ${formatNumber(entry.borg_value)}`]),
    ...list(session.cr10_reports).map((entry) => [String(entry.exercise_id), `CR10 ${formatNumber(entry.cr10_value)}`])
  ];
  const swaps = new Map(list(session.substitutions).map((entry) => [String(entry.exercise_id), String(entry.substituted_exercise_id)]));
  const planned = (Array.isArray(session.exercise_ids) ? (session.exercise_ids as unknown[]) : []).map(String);
  // Sets logged against an exercise that isn't in the plan (e.g. a swap's
  // substitute) still show, after the planned ones.
  const order = [...planned, ...setLogs.map((log) => String(log.exercise_id)).filter((id) => !planned.includes(id))]
    .filter((id, index, all) => all.indexOf(id) === index);
  const added = list(session.extra_exercise_reports);
  const skipped = (Array.isArray(session.skip_reasons) ? (session.skip_reasons as unknown[]) : []).map(String);

  return (
    <section className="review-session-work" aria-label={`What ${firstName} did`}>
      {heading}
      {order.length === 0 ? <p className="muted small">No exercises are recorded for this session.</p> : null}
      <ol className="review-work-list">
        {order.map((exerciseId) => {
          const sets = latestSets(setLogs.filter((log) => String(log.exercise_id) === exerciseId));
          const extras = extraSets.filter((entry) => String(entry.exercise_id) === exerciseId);
          const effort = ratings.filter(([id]) => id === exerciseId).map(([, text]) => text);
          const swappedFor = swaps.get(exerciseId);
          return (
            <li className="review-work-exercise" key={exerciseId}>
              <div className="review-work-head">
                <strong>{exerciseLabel(exerciseId, exerciseNames)}</strong>
                {effort.map((text) => <span className="badge neutral" key={text}>{text}</span>)}
              </div>
              {swappedFor ? <p className="muted small">{`Swapped for ${exerciseLabel(swappedFor, exerciseNames)}`}</p> : null}
              {sets.length === 0 && extras.length === 0 ? (
                <p className="muted small">No sets logged</p>
              ) : (
                <ul className="review-work-sets">
                  {sets.map((log) => (
                    <li key={`set-${String(log.set_index)}`}>
                      <span>{`Set ${String(log.set_index)}`}</span>
                      <strong>{setDose(log)}</strong>
                      {log.is_pr === true ? <span className="badge complete">PR</span> : null}
                    </li>
                  ))}
                  {extras.map((entry, index) => (
                    <li key={`extra-${index}`}>
                      <span>Extra</span>
                      <strong>{setDose(entry)}</strong>
                      {entry.is_pr === true ? <span className="badge complete">PR</span> : null}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ol>
      {added.length > 0 ? (
        <div className="review-work-added">
          <p className="eyebrow">Added by the athlete</p>
          <ul className="review-work-sets">
            {added.map((entry, index) => (
              <li key={`added-${index}`}>
                <span>{exerciseLabel(String(entry.exercise_id), exerciseNames)}</span>
                <strong>{setDose(entry)}</strong>
                {entry.is_pr === true ? <span className="badge complete">PR</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {skipped.length > 0 ? <p className="muted small">{`Skipped: ${skipped.map((reason) => titleCase(reason)).join(", ")}`}</p> : null}
      {session.pain_reported === true ? <p className="inline-result" data-tone="warning">Pain was reported during this session.</p> : null}
    </section>
  );
}
