import React, { useEffect, useId, useRef, useState } from "react";

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

// Saved on one screen (Today or Training details): the other copy shows it.
const READINESS_SAVED_EVENT = "kolosseum:readiness-saved";

// compact (Today): one line until it's opened, and no rule to set.
export function ReadinessCard({ selfDirected = false, compact = false }: { selfDirected?: boolean; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const selfRef = useRef(Symbol("readiness"));
  // Both copies are in the page at once: their radio groups must not share a name.
  const group = useId();
  const [extrasOpen, setExtrasOpen] = useState(false);
  const [readings, setReadings] = useState<{ resting_hr: string; hrv_ms: string }>({ resting_hr: "", hrv_ms: "" });
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [today, setToday] = useState<JsonRecord | null>(null);
  const [low, setLow] = useState(false);
  // "Saved" only while what's on screen is what was saved.
  const [savedNow, setSavedNow] = useState(false);
  const [lightening, setLightening] = useState<{ own: boolean; coach_on: boolean }>({ own: false, coach_on: false });
  const [switching, setSwitching] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function saved(result: JsonRecord) {
    apply(result);
    document.dispatchEvent(new CustomEvent(READINESS_SAVED_EVENT, { detail: { source: selfRef.current, result } }));
  }

  function apply(result: JsonRecord) {
    const check = (result.today as JsonRecord | null) ?? null;
    setToday(check);
    setLow(result.low === true);
    const rule = (result.lightening as JsonRecord | undefined) ?? {};
    setLightening({ own: rule.own === true, coach_on: rule.coach_on === true });
    setSavedNow(Boolean(check));
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
    const onSaved = (event: Event) => {
      const detail = (event as CustomEvent<{ source: symbol; result: JsonRecord }>).detail;
      if (detail && detail.source !== selfRef.current) apply(detail.result);
    };
    document.addEventListener(READINESS_SAVED_EVENT, onSaved);
    return () => { cancelled = true; document.removeEventListener(READINESS_SAVED_EVENT, onSaved); };
  }, []);

  // The app left open overnight: yesterday's check-in isn't today's.
  const savedDate = typeof today?.date === "string" ? today.date : null;
  useEffect(() => {
    if (!savedDate) return undefined;
    const onVisible = () => {
      if (document.visibilityState === "hidden" || savedDate === new Date().toISOString().slice(0, 10)) return;
      loadReadiness()
        .then((result) => {
          if (!result.today) { setAnswers({}); setReadings({ resting_hr: "", hrv_ms: "" }); }
          apply(result);
        })
        .catch(() => undefined);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [savedDate]);

  // Watches often give HRV to a decimal: rounded, never dropped.
  const reading = (value: string) => (value.trim() !== "" && Number.isFinite(Number(value)) ? Math.round(Number(value)) : undefined);
  const changed = () => { setSavedNow(false); setError(null); };

  async function save() {
    const hr = reading(readings.resting_hr);
    const hrv = reading(readings.hrv_ms);
    if (hr !== undefined && (hr < 30 || hr > 120)) { setSavedNow(false); setError("Resting heart rate: enter 30 to 120 bpm, or leave it blank."); return; }
    if (hrv !== undefined && (hrv < 5 || hrv > 300)) { setSavedNow(false); setError("HRV: enter 5 to 300 ms, or leave it blank."); return; }
    setSaving(true);
    setError(null);
    try {
      const account = await loadAccountDetail();
      const csrf = typeof account.csrf_token === "string" ? account.csrf_token : "";
      saved(await saveReadiness({
        sleep: answers.sleep, soreness: answers.soreness, stress: answers.stress,
        ...(answers.fatigue ? { fatigue: answers.fatigue } : {}), ...(answers.mood ? { mood: answers.mood } : {}),
        ...(hr !== undefined ? { resting_hr: hr } : {}),
        ...(hrv !== undefined ? { hrv_ms: hrv } : {})
      }, csrf));
    }
    catch {
      setSavedNow(false);
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
      saved(await saveOwnLightening(enabled, typeof account.csrf_token === "string" ? account.csrf_token : ""));
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

  if (compact && !open) {
    const done = today !== null;
    return (
      <button type="button" className="today-readiness-line" data-testid="today-readiness" aria-expanded={false} onClick={() => setOpen(true)}>
        <span><strong>{done ? "Checked in today" : "How are you today?"}</strong><small className="muted">{done ? (low && ruleOn ? "Today's session will be lighter, if you haven't opened it yet." : "Sleep, soreness and stress recorded.") : "Optional - sleep, soreness and stress, three taps."}</small></span>
        <span className="today-readiness-action">{done ? "Change" : "Check in"}</span>
      </button>
    );
  }

  return (
    <article className="onboarding-card readiness" data-testid={compact ? "today-readiness-open" : "readiness"}>
      <p className="eyebrow">Today's readiness</p>
      <h3>How are you today? (optional)</h3>
      <p className="muted">{selfDirected ? "Your answers are recorded for you." : "Your answers are recorded, and your coach sees them."}</p>
      {selfDirected && compact ? (
        lightening.own ? <p className="muted small" data-testid="readiness-rule">You've chosen to lighten your sessions after a low check-in. Change that in Training details.</p> : null
      ) : selfDirected ? (
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
      {today && savedNow ? (
        <p className="muted" role="status">{low && ruleOn ? "Saved - today's session will be lighter, if you haven't opened it yet." : "Saved."}</p>
      ) : null}
      {error ? <p className="field-error" role="alert">{error}</p> : null}
      {QUESTIONS.map(([key, label, lowText, highText]) => (
        <fieldset className="readiness-question" key={key}>
          <legend>{label}</legend>
          <div className="choice-chips readiness-scale">
            {[1, 2, 3, 4, 5].map((n) => (
              <label key={n} className="choice-chip readiness-option">
                <input type="radio" name={`readiness-${key}${group}`} aria-label={`${label} ${n}`} checked={answers[key] === n} onChange={() => { changed(); setAnswers((current) => ({ ...current, [key]: n })); }} />
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
                    <input type="radio" name={`readiness-${key}${group}`} aria-label={`${label} ${n}`} checked={answers[key] === n} onChange={() => { changed(); setAnswers((current) => ({ ...current, [key]: n })); }} />
                    <span>{n}</span>
                  </label>
                ))}
              </div>
              <small className="muted">{`${lowText} - ${highText}`}</small>
            </fieldset>
          ))}
          <div className="readiness-readings">
            <label className="field"><span>Resting heart rate (bpm)</span><input type="number" inputMode="numeric" min={30} max={120} value={readings.resting_hr} onChange={(event) => { changed(); setReadings({ ...readings, resting_hr: event.target.value }); }} /></label>
            <label className="field"><span>HRV (ms)</span><input type="number" inputMode="decimal" min={5} max={300} step="any" value={readings.hrv_ms} onChange={(event) => { changed(); setReadings({ ...readings, hrv_ms: event.target.value }); }} /></label>
          </div>
          <small className="muted">Take these first thing in the morning, the same way each day, from your watch or strap.</small>
        </div>
      ) : null}
      <div className="onboarding-actions">
        <button className="button primary" type="button" disabled={saving || !complete} onClick={() => void save()}>Save check-in</button>
        {compact ? <button className="button secondary" type="button" onClick={() => setOpen(false)}>Close</button> : null}
      </div>
    </article>
  );
}
