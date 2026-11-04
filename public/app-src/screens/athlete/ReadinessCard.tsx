import React, { useEffect, useState } from "react";

import { loadReadiness, saveOwnLightening, saveReadiness } from "../../api/athleteOnboardingClient";
import { loadAccountDetail } from "../../api/client";
import { type JsonRecord } from "../../api/transport";

// Today's optional readiness check-in before training. It is recorded, and
// the coach sees it. It changes a session only where a rule someone chose is
// on: the athlete's coach for a coached athlete, the athlete themselves when
// self-directed. Off by default. A low score is any 1, or 7 or less in total.

const QUESTIONS: Array<["sleep" | "soreness" | "stress", string, string, string]> = [
  ["sleep", "How did you sleep?", "1 very badly", "5 very well"],
  ["soreness", "How fresh do your muscles feel?", "1 very sore", "5 fresh"],
  ["stress", "How are stress and energy?", "1 very stressed", "5 great"]
];

// Optional extras: two more questions, and readings from a watch or strap.
const EXTRA_QUESTIONS: Array<["fatigue" | "mood", string, string, string]> = [
  ["fatigue", "How tired do you feel?", "1 exhausted", "5 full of energy"],
  ["mood", "How's your mood?", "1 very low", "5 great"]
];

export function ReadinessCard({ selfDirected = false }: { selfDirected?: boolean }) {
  const [extrasOpen, setExtrasOpen] = useState(false);
  const [readings, setReadings] = useState<{ resting_hr: string; hrv_ms: string }>({ resting_hr: "", hrv_ms: "" });
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [today, setToday] = useState<JsonRecord | null>(null);
  const [low, setLow] = useState(false);
  const [lightening, setLightening] = useState<{ own: boolean; coach_on: boolean }>({ own: false, coach_on: false });
  const [switching, setSwitching] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function apply(result: JsonRecord) {
    const check = (result.today as JsonRecord | null) ?? null;
    setToday(check);
    setLow(result.low === true);
    const rule = (result.lightening as JsonRecord | undefined) ?? {};
    setLightening({ own: rule.own === true, coach_on: rule.coach_on === true });
    if (check) {
      setAnswers({ sleep: Number(check.sleep), soreness: Number(check.soreness), stress: Number(check.stress), ...(typeof check.fatigue === "number" ? { fatigue: check.fatigue } : {}), ...(typeof check.mood === "number" ? { mood: check.mood } : {}) });
      setReadings({ resting_hr: typeof check.resting_hr === "number" ? String(check.resting_hr) : "", hrv_ms: typeof check.hrv_ms === "number" ? String(check.hrv_ms) : "" });
    }
  }

  useEffect(() => {
    let cancelled = false;
    loadReadiness()
      .then((result) => { if (!cancelled) apply(result); })
      .catch(() => undefined)
      .finally(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, []);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const account = await loadAccountDetail();
      const csrf = typeof account.csrf_token === "string" ? account.csrf_token : "";
      const reading = (value: string) => (value.trim() !== "" && Number.isInteger(Number(value)) ? Number(value) : undefined);
      apply(await saveReadiness({
        sleep: answers.sleep, soreness: answers.soreness, stress: answers.stress,
        ...(answers.fatigue ? { fatigue: answers.fatigue } : {}), ...(answers.mood ? { mood: answers.mood } : {}),
        ...(reading(readings.resting_hr) !== undefined ? { resting_hr: reading(readings.resting_hr) } : {}),
        ...(reading(readings.hrv_ms) !== undefined ? { hrv_ms: reading(readings.hrv_ms) } : {})
      }, csrf));
    }
    catch {
      setError("Your check-in could not be saved. Try again.");
    }
    finally {
      setSaving(false);
    }
  }

  async function switchOwn(enabled: boolean) {
    setSwitching(true);
    setError(null);
    try {
      const account = await loadAccountDetail();
      apply(await saveOwnLightening(enabled, typeof account.csrf_token === "string" ? account.csrf_token : ""));
    }
    catch {
      setError("Your choice could not be saved. Try again.");
    }
    finally {
      setSwitching(false);
    }
  }

  if (!loaded) return null;
  const ruleOn = selfDirected ? lightening.own : lightening.coach_on;
  const complete = QUESTIONS.every(([key]) => Number.isInteger(answers[key]));

  return (
    <article className="onboarding-card readiness" data-testid="readiness">
      <p className="eyebrow">Today's readiness</p>
      <h3>How are you today? (optional)</h3>
      <p className="muted">{selfDirected ? "Your answers are recorded for you." : "Your answers are recorded, and your coach sees them."}</p>
      {selfDirected ? (
        <div className="readiness-rule" data-testid="readiness-rule">
          <label className="checkbox-field">
            <input type="checkbox" checked={lightening.own} disabled={switching} onChange={(event) => void switchOwn(event.target.checked)} />
            <span>Lighten my sessions after a low check-in</span>
          </label>
          <small className="muted">Off unless you turn it on. When it's on, a low check-in (any answer of 1, or 7 or less in total) takes one set off each exercise and makes it a little lighter. It's a simple rule you choose - not an assessment of your health or of what you should do.</small>
        </div>
      ) : (
        <p className="muted small" data-testid="readiness-rule">{lightening.coach_on
          ? "Your coach has turned on a rule for your sessions: a low check-in takes one set off each exercise and makes it a little lighter."
          : "Your check-in doesn't change your sessions unless your coach turns that on."}</p>
      )}
      {today ? (
        <p className="muted" role="status">{low && ruleOn ? "Saved - today's session will be lighter." : "Saved."}</p>
      ) : null}
      {error ? <p className="field-error" role="alert">{error}</p> : null}
      {QUESTIONS.map(([key, label, lowText, highText]) => (
        <fieldset className="readiness-question" key={key}>
          <legend>{label}</legend>
          <div className="choice-chips readiness-scale">
            {[1, 2, 3, 4, 5].map((n) => (
              <label key={n} className="choice-chip readiness-option">
                <input type="radio" name={`readiness-${key}`} aria-label={`${label} ${n}`} checked={answers[key] === n} onChange={() => setAnswers((current) => ({ ...current, [key]: n }))} />
                <span>{n}</span>
              </label>
            ))}
          </div>
          <small className="muted">{`${lowText} - ${highText}`}</small>
        </fieldset>
      ))}
      <button type="button" className="text-button readiness-more" aria-expanded={extrasOpen} onClick={() => setExtrasOpen((open) => !open)}>{extrasOpen ? "Fewer questions" : "Add more (optional): tiredness, mood, heart rate, HRV"}</button>
      {extrasOpen ? (
        <div className="readiness-extras" data-testid="readiness-extras">
          {EXTRA_QUESTIONS.map(([key, label, lowText, highText]) => (
            <fieldset className="readiness-question" key={key}>
              <legend>{label}</legend>
              <div className="choice-chips readiness-scale">
                {[1, 2, 3, 4, 5].map((n) => (
                  <label key={n} className="choice-chip readiness-option">
                    <input type="radio" name={`readiness-${key}`} aria-label={`${label} ${n}`} checked={answers[key] === n} onChange={() => setAnswers((current) => ({ ...current, [key]: n }))} />
                    <span>{n}</span>
                  </label>
                ))}
              </div>
              <small className="muted">{`${lowText} - ${highText}`}</small>
            </fieldset>
          ))}
          <div className="readiness-readings">
            <label className="field"><span>Resting heart rate (bpm)</span><input type="number" inputMode="numeric" min={30} max={120} value={readings.resting_hr} onChange={(event) => setReadings({ ...readings, resting_hr: event.target.value })} /></label>
            <label className="field"><span>HRV (ms)</span><input type="number" inputMode="numeric" min={5} max={300} value={readings.hrv_ms} onChange={(event) => setReadings({ ...readings, hrv_ms: event.target.value })} /></label>
          </div>
          <small className="muted">Take these first thing in the morning, the same way each day, from your watch or strap.</small>
        </div>
      ) : null}
      <div className="onboarding-actions">
        <button className="button primary" type="button" disabled={saving || !complete} onClick={() => void save()}>Save check-in</button>
      </div>
    </article>
  );
}
