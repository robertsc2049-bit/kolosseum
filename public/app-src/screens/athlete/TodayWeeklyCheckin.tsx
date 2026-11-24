import React, { useCallback, useEffect, useState } from "react";

import { loadWeeklyCheckins, submitWeeklyCheckin } from "../../api/athleteWeeklyCheckinsClient";
import { accountMayBeAthlete, loadAccountDetail } from "../../api/client";
import { ENTRY_AUTH_SUCCEEDED_EVENT } from "../entry/useEntryAuth";

// This week's check-in on Today, three taps, until it's done. Every week's
// answers, and earlier weeks, stay in History, Wellbeing.
const HISTORY_CHANGED_EVENT = "kolosseum:history-changed";
const QUESTIONS: Array<["energy_level" | "motivation_level" | "sleep_quality", string, string]> = [
  ["energy_level", "Energy this week", "1 very low - 5 great"],
  ["motivation_level", "Motivation", "1 very low - 5 very high"],
  ["sleep_quality", "Sleep", "1 very poor - 5 great"]
];

function thisMonday(): string {
  const now = new Date();
  return new Date(now.getTime() - ((now.getUTCDay() + 6) % 7) * 86_400_000).toISOString().slice(0, 10);
}

export function TodayWeeklyCheckin() {
  const [state, setState] = useState<"unknown" | "due" | "done">("unknown");
  const [open, setOpen] = useState(false);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      if (!(await accountMayBeAthlete())) return;
      const monday = thisMonday();
      const checkins = await loadWeeklyCheckins();
      setState(checkins.some((entry) => String(entry.week_start_date ?? "") >= monday) ? "done" : "due");
    }
    catch {
      // Offline or signed out: nothing to ask for.
    }
  }, []);

  useEffect(() => {
    void refresh();
    const events = [HISTORY_CHANGED_EVENT, ENTRY_AUTH_SUCCEEDED_EVENT];
    for (const name of events) document.addEventListener(name, refresh);
    return () => { for (const name of events) document.removeEventListener(name, refresh); };
  }, [refresh]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const account = await loadAccountDetail();
      await submitWeeklyCheckin({
        week_start_date: thisMonday(), energy_level: answers.energy_level, motivation_level: answers.motivation_level, sleep_quality: answers.sleep_quality,
        note: note.trim() || undefined
      }, typeof account.csrf_token === "string" ? account.csrf_token : "");
      setState("done");
      setOpen(false);
    }
    catch {
      setError("Your check-in could not be saved. Try again.");
    }
    finally {
      setSaving(false);
    }
  }

  if (state !== "due") return null;
  if (!open) {
    return (
      <button type="button" className="today-readiness-line" data-testid="today-weekly-checkin" aria-expanded={false} onClick={() => setOpen(true)}>
        <span><strong>Weekly check-in</strong><small className="muted">Optional - energy, motivation and sleep this week.</small></span>
        <span className="today-readiness-action">Check in</span>
      </button>
    );
  }
  return (
    <article className="onboarding-card readiness" data-testid="today-weekly-checkin-open">
      <h3>How was your week?</h3>
      <p className="muted">Recorded, and your coach sees it if you have one.</p>
      {error ? <p className="field-error" role="alert">{error}</p> : null}
      {QUESTIONS.map(([key, label, scale]) => (
        <fieldset className="readiness-question" key={key}>
          <legend>{label}</legend>
          <div className="choice-chips readiness-scale">
            {[1, 2, 3, 4, 5].map((n) => (
              <label key={n} className="choice-chip readiness-option">
                <input type="radio" name={`weekly-${key}`} aria-label={`${label} ${n}`} checked={answers[key] === n} onChange={() => setAnswers((current) => ({ ...current, [key]: n }))} />
                <span>{n}</span>
              </label>
            ))}
          </div>
          <small className="muted">{scale}</small>
        </fieldset>
      ))}
      <label className="field"><span>Note (optional)</span><input type="text" maxLength={280} value={note} onChange={(event) => setNote(event.target.value)} /></label>
      <div className="onboarding-actions">
        <button className="button primary" type="button" disabled={saving || !QUESTIONS.every(([key]) => answers[key])} onClick={() => void save()}>Save check-in</button>
        <button className="button secondary" type="button" onClick={() => setOpen(false)}>Close</button>
      </div>
    </article>
  );
}
