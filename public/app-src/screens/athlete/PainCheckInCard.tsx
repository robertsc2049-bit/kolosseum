import React, { useCallback, useEffect, useState } from "react";

import { loadPainFlags, savePainCheckIn } from "../../api/athleteOnboardingClient";
import { loadAccountDetail } from "../../api/client";
import { type JsonRecord } from "../../api/transport";

// Pain carry-forward: every open pain flag, and the "how is it now?" check-in
// the athlete answers before their next session that loads the same area.
// Pain-free closes the flag; still sore swaps the affected exercises for ones
// that don't load it, or leaves them out - for that session only. Records
// facts only: no diagnosis, risk score or treatment advice.

function when(iso: unknown): string {
  const date = new Date(String(iso ?? ""));
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function checkInSummary(checkIn: JsonRecord | null | undefined): string | null {
  if (!checkIn || checkIn.status !== "still_sore") return null;
  return checkIn.plan === "swap"
    ? "Still sore - your next session swaps those exercises for ones that don't load it."
    : "Still sore - your next session leaves those exercises out.";
}

export function PainCheckInCard() {
  const [flags, setFlags] = useState<JsonRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [soreFor, setSoreFor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const result = await loadPainFlags();
      setFlags(Array.isArray(result.flags) ? (result.flags as JsonRecord[]) : []);
      setError(null);
    }
    catch {
      setError("Your pain check-ins could not be loaded. Try again.");
    }
    finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  async function answer(flagKey: string, status: "pain_free" | "still_sore", plan?: "swap" | "skip") {
    setBusy(true);
    setError(null);
    setSaved(null);
    try {
      const account = await loadAccountDetail();
      const csrf = typeof account.csrf_token === "string" ? account.csrf_token : "";
      const result = await savePainCheckIn({ flag_key: flagKey, status, ...(plan ? { plan } : {}) }, csrf);
      setFlags(Array.isArray(result.flags) ? (result.flags as JsonRecord[]) : []);
      setSoreFor(null);
      setSaved(status === "pain_free" ? "Glad it's better - your sessions are back to normal." : "Thanks - your next session is adjusted.");
    }
    catch {
      setError("Your check-in could not be saved. Try again.");
    }
    finally {
      setBusy(false);
    }
  }

  if (loading || (!flags.length && !saved && !error)) return null;

  return (
    <article className="onboarding-card pain-check-in" data-testid="pain-check-in">
      <p className="eyebrow">Pain check-in</p>
      <h3>{flags.length ? "How is it now?" : "Pain check-in"}</h3>
      <p className="muted">This only records how it feels. It doesn't diagnose or give treatment advice - if pain persists or is severe, see a qualified professional.</p>
      {saved ? <p className="muted" role="status">{saved}</p> : null}
      {error ? <p className="field-error" role="alert">{error}</p> : null}
      {flags.map((flag) => {
        const key = String(flag.flag_key);
        const exercises = Array.isArray(flag.reported_exercises) ? (flag.reported_exercises as JsonRecord[]) : [];
        const summary = flag.check_in_due === false ? checkInSummary(flag.latest_check_in as JsonRecord | null) : null;
        return (
          <section className="pain-flag" key={key}>
            <h4>{`Pain in ${String(flag.where)}`}</h4>
            <p>{`Reported ${when(flag.first_reported_at)}${exercises.length ? ` during ${exercises.map((e) => String(e.display_name)).join(", ")}` : ""}.`}</p>
            {summary ? <p className="muted">{summary}</p> : null}
            {soreFor === key ? (
              <div className="onboarding-actions">
                <p>For your next session:</p>
                <button className="button primary" type="button" disabled={busy} onClick={() => void answer(key, "still_sore", "swap")}>Swap those exercises</button>
                <button className="button secondary" type="button" disabled={busy} onClick={() => void answer(key, "still_sore", "skip")}>Leave them out</button>
                <button className="button secondary" type="button" disabled={busy} onClick={() => setSoreFor(null)}>Back</button>
              </div>
            ) : (
              <div className="onboarding-actions">
                <button className="button primary" type="button" disabled={busy} onClick={() => void answer(key, "pain_free")}>Pain-free now</button>
                <button className="button secondary" type="button" disabled={busy} onClick={() => setSoreFor(key)}>Still sore</button>
              </div>
            )}
          </section>
        );
      })}
    </article>
  );
}
