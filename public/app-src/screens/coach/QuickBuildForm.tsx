import React, { useEffect, useRef, useState } from "react";

import { loadAccountDetail } from "../../api/client";
import { createQuickBuildProgramme, loadQuickBuildGoals } from "../../api/coachWorkspaceClient";
import { type JsonRecord } from "../../api/transport";
import { ActivityCategoryFilter } from "../../components/ActivityCategoryFilter";

// Quick build: one short form builds a whole periodised draft programme -
// 4-week blocks (three loading weeks and a deload) running through the
// goal's phases, exercises chosen for the equipment, accessory work trimmed
// to the session length (kolosseum_starter_template_service.ts). It opens
// in the builder as a draft; nothing is assigned.
type Goal = { goal_id: string; label: string; summary: string };

// The first-programme guide opens the form from Overview.
export const OPEN_QUICK_BUILD_EVENT = "kolosseum:open-quick-build";

export function QuickBuildForm({ onCreated, startOpen = false }: { onCreated: (templateId: string) => void; startOpen?: boolean }) {
  const [open, setOpen] = useState(startOpen);
  const [activityId, setActivityId] = useState("");
  const [level, setLevel] = useState("amateur");
  const [days, setDays] = useState(3);
  const [weeks, setWeeks] = useState(8);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [goal, setGoal] = useState("");
  const [minutes, setMinutes] = useState("");
  const [equipment, setEquipment] = useState("full_gym");
  const [weights, setWeights] = useState("percent_1rm");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A double tap builds once.
  const inFlight = useRef(false);

  useEffect(() => {
    const show = () => setOpen(true);
    document.addEventListener(OPEN_QUICK_BUILD_EVENT, show);
    return () => document.removeEventListener(OPEN_QUICK_BUILD_EVENT, show);
  }, []);

  useEffect(() => {
    setGoals([]);
    setGoal("");
    if (!activityId) return undefined;
    let live = true;
    loadQuickBuildGoals(activityId).then(
      (payload) => {
        if (!live) return;
        const list = Array.isArray(payload.goals) ? (payload.goals as Goal[]) : [];
        setGoals(list);
        setGoal(list[0]?.goal_id ?? "");
      },
      () => { if (live) setGoals([]); }
    );
    return () => { live = false; };
  }, [activityId]);

  async function build(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || !activityId || !goal) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const account = await loadAccountDetail();
      const result = await createQuickBuildProgramme({
        activity_id: activityId,
        experience_level: level,
        days_per_week: days,
        weeks,
        goal,
        session_minutes: minutes ? Number(minutes) : null,
        equipment,
        weights
      }, typeof account.csrf_token === "string" ? account.csrf_token : "");
      const template = (result.template as JsonRecord | undefined) ?? {};
      setOpen(false);
      onCreated(String(template.template_id ?? ""));
    }
    catch {
      setError("The programme couldn't be built. Check the choices and try again.");
    }
    finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <div className="button-row quick-build">
        <button className="button primary" type="button" onClick={() => setOpen(true)}>Quick build a programme</button>
      </div>
    );
  }

  const chosen = goals.find((g) => g.goal_id === goal);

  return (
    <form className="panel kolosseum-starter-form" data-testid="quick-build" onSubmit={build}>
      <div className="panel-header kolosseum-starter-header">
        <h4>Quick build a programme</h4>
        <button className="button secondary small-button" type="button" onClick={() => setOpen(false)}>Close</button>
      </div>
      <p className="muted">Answer a few questions and get a whole programme as a draft - 4-week blocks, each ending in a deload - to change and assign.</p>
      <ActivityCategoryFilter value={activityId} onChange={setActivityId} sportLabel="Sport" />
      <label className="field">
        <span>Level</span>
        <select aria-label="Level" value={level} onChange={(event) => setLevel(event.target.value)}>
          <option value="beginner">Beginner</option>
          <option value="amateur">Amateur</option>
          <option value="pro">Pro</option>
        </select>
      </label>
      <label className="field">
        <span>Goal</span>
        <select aria-label="Goal" value={goal} disabled={!goals.length} onChange={(event) => setGoal(event.target.value)}>
          {!goals.length ? <option value="">Choose a sport first</option> : null}
          {goals.map((g) => <option key={g.goal_id} value={g.goal_id}>{g.label}</option>)}
        </select>
      </label>
      {chosen ? <p className="muted small">{chosen.summary}</p> : null}
      <label className="field">
        <span>Length</span>
        <select aria-label="Length" value={weeks} onChange={(event) => setWeeks(Number(event.target.value))}>
          {[4, 8, 12, 16].map((n) => <option key={n} value={n}>{`${n} weeks`}</option>)}
        </select>
      </label>
      <label className="field">
        <span>Training days a week</span>
        <select aria-label="Training days a week" value={days} onChange={(event) => setDays(Number(event.target.value))}>
          {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </label>
      <label className="field">
        <span>Session length</span>
        <select aria-label="Session length" value={minutes} onChange={(event) => setMinutes(event.target.value)}>
          <option value="">No limit</option>
          {[45, 60, 75, 90].map((n) => <option key={n} value={n}>{`About ${n} minutes`}</option>)}
        </select>
      </label>
      <label className="field">
        <span>Equipment</span>
        <select aria-label="Equipment" value={equipment} onChange={(event) => setEquipment(event.target.value)}>
          <option value="full_gym">Full gym</option>
          <option value="home_gym">Home gym (barbell, rack, bench, dumbbells, pull-up bar, bands)</option>
          <option value="bodyweight">Bodyweight only</option>
        </select>
      </label>
      <label className="field">
        <span>Set weights by</span>
        <select aria-label="Set weights by" value={weights} onChange={(event) => setWeights(event.target.value)}>
          <option value="percent_1rm">% of max - you'll need each athlete's maxes</option>
          <option value="rpe">RPE - no maxes needed</option>
        </select>
      </label>
      {error ? <p className="field-error" role="alert">{error}</p> : null}
      <div className="button-row">
        <button className="button primary" type="submit" disabled={busy || !activityId || !goal}>{busy ? "Building…" : "Build programme"}</button>
        <button className="button secondary" type="button" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  );
}
