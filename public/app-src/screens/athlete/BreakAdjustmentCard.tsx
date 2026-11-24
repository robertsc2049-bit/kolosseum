import React, { useEffect, useState } from "react";

import { loadBreakAdjustment, saveBreakAdjustment } from "../../api/athleteOnboardingClient";
import { loadAccountDetail } from "../../api/client";
import { type JsonRecord } from "../../api/transport";
import { formatDate } from "../../utils/format";

// A self-coached athlete's own choice: does a break make their first week back
// lighter? Every change is logged, and the card says when it was last changed.

export function BreakAdjustmentCard() {
  const [choice, setChoice] = useState<JsonRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadBreakAdjustment()
      .then((result) => { if (!cancelled) setChoice(result); })
      .catch(() => { if (!cancelled) setError("This setting could not be loaded."); });
    return () => { cancelled = true; };
  }, []);

  async function change(enabled: boolean) {
    setBusy(true);
    setError(null);
    try {
      const account = await loadAccountDetail();
      setChoice(await saveBreakAdjustment(enabled, typeof account.csrf_token === "string" ? account.csrf_token : ""));
    }
    catch { setError("Your choice could not be saved. Try again."); }
    finally { setBusy(false); }
  }

  if (!choice && !error) return null;
  const on = choice?.enabled === true;
  return (
    <article className="onboarding-card break-adjustment" data-testid="break-adjustment">
      <p className="eyebrow">Breaks</p>
      <h3>After 10 or more days without a session</h3>
      <label className="checkbox-field">
        <input type="checkbox" checked={on} disabled={busy || !choice} onChange={(event) => void change(event.target.checked)} />
        <span>Adjust for breaks</span>
      </label>
      <p className="muted small">When ticked, your first week back is lighter. Your own week: a set fewer on everything, weights 10% lighter (20% after 28 days) and RPE 1 easier (2 after 28 days). Kolosseum's generated sessions: a deload week, then your training blocks start again from week 1. Not ticked, your sessions carry on as they are. A programme written by a coach follows that coach's own setting. It's a rule you choose - not an assessment of your health or of what you should do.</p>
      {choice?.changed_at ? <p className="muted small" data-testid="break-adjustment-logged">{`Turned ${on ? "on" : "off"} ${formatDate(choice.changed_at)}. Each change is recorded on your account.`}</p> : null}
      {error ? <p className="field-error" role="alert">{error}</p> : null}
    </article>
  );
}
