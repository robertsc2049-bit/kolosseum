import React, { useEffect, useState } from "react";

import { loadAccountDetail } from "../../api/client";
import { request } from "../../api/transport";

// The coach's own rule for one athlete: whether a low readiness check-in
// lightens that athlete's sessions on the coach's programme. Off by default -
// Kolosseum doesn't change training on its own judgement. The athlete sees
// that their coach turned it on.

export function AthleteReadinessLightening({ athleteUserId }: { athleteUserId: string }) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const path = `/coach-workspace/athletes/${encodeURIComponent(athleteUserId)}/readiness-lightening`;

  useEffect(() => {
    let cancelled = false;
    setEnabled(null);
    request("GET", path)
      .then((result) => { if (!cancelled) setEnabled(result.enabled === true); })
      .catch(() => { if (!cancelled) setError("This setting could not be loaded."); });
    return () => { cancelled = true; };
  }, [path]);

  async function change(next: boolean) {
    setBusy(true);
    setError(null);
    try {
      const account = await loadAccountDetail();
      const result = await request("PUT", path, { enabled: next }, typeof account.csrf_token === "string" ? account.csrf_token : "");
      setEnabled(result.enabled === true);
    }
    catch {
      setError("Your choice could not be saved. Try again.");
    }
    finally {
      setBusy(false);
    }
  }

  if (enabled === null && !error) return null;
  return (
    <div className="readiness-rule coach-readiness-rule" data-testid="coach-readiness-lightening">
      <label className="checkbox-field">
        <input type="checkbox" checked={enabled === true} disabled={busy || enabled === null} onChange={(event) => void change(event.target.checked)} />
        <span>Lighten sessions after a low check-in</span>
      </label>
      <small className="muted">Off by default. When on, a low readiness check-in from this athlete (any answer of 1, or 7 or less out of 15 for sleep, soreness and stress) takes one set off each exercise in that day's session on your programme, and lowers it by 5% of max or 1 RPE. It's your rule; the athlete sees that you turned it on.</small>
      {error ? <p className="field-error" role="alert">{error}</p> : null}
    </div>
  );
}
