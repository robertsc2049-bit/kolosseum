import React, { useEffect, useState } from "react";

import { loadReadiness, saveReadiness } from "../../api/athleteOnboardingClient";
import { loadAccountDetail } from "../../api/client";
import { type JsonRecord } from "../../api/transport";

// Today's optional readiness check-in before training. A low score (any 1,
// or 7 or less in total) makes today's session lighter and says why.

const QUESTIONS: Array<["sleep" | "soreness" | "stress", string, string, string]> = [
  ["sleep", "How did you sleep?", "1 very badly", "5 very well"],
  ["soreness", "How fresh do your muscles feel?", "1 very sore", "5 fresh"],
  ["stress", "How are stress and energy?", "1 very stressed", "5 great"]
];

export function ReadinessCard() {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [today, setToday] = useState<JsonRecord | null>(null);
  const [low, setLow] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function apply(result: JsonRecord) {
    const check = (result.today as JsonRecord | null) ?? null;
    setToday(check);
    setLow(result.low === true);
    if (check) setAnswers({ sleep: Number(check.sleep), soreness: Number(check.soreness), stress: Number(check.stress) });
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
      apply(await saveReadiness({ sleep: answers.sleep, soreness: answers.soreness, stress: answers.stress }, csrf));
    }
    catch {
      setError("Your check-in could not be saved. Try again.");
    }
    finally {
      setSaving(false);
    }
  }

  if (!loaded) return null;
  const complete = QUESTIONS.every(([key]) => Number.isInteger(answers[key]));

  return (
    <article className="onboarding-card readiness" data-testid="readiness">
      <p className="eyebrow">Today's readiness</p>
      <h3>How are you today? (optional)</h3>
      <p className="muted">If today looks like a hard day, your session is made a little lighter.</p>
      {today ? (
        <p className="muted" role="status">{low ? "Saved - today's session will be lighter." : "Saved - train as planned."}</p>
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
      <div className="onboarding-actions">
        <button className="button primary" type="button" disabled={saving || !complete} onClick={() => void save()}>Save check-in</button>
      </div>
    </article>
  );
}
