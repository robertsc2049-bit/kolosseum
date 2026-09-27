import React, { useEffect, useState } from "react";

import { endStandDown, loadStandDown, recordStandDown } from "../../api/athleteOnboardingClient";
import { loadAccountDetail } from "../../api/client";
import { type JsonRecord } from "../../api/transport";
import { StandDownPanel } from "../../components/StandDownPanel";

// The athlete's own medical stand-down (see StandDownPanel).
export function StandDownCard() {
  const [standDown, setStandDown] = useState<JsonRecord | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadStandDown()
      .then((result) => { if (!cancelled) setStandDown((result.stand_down as JsonRecord | null) ?? null); })
      .catch(() => undefined)
      .finally(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, []);

  async function run(action: (csrf: string) => Promise<JsonRecord>, failure: string) {
    setBusy(true);
    setError(null);
    try {
      const account = await loadAccountDetail();
      const csrf = typeof account.csrf_token === "string" ? account.csrf_token : "";
      const result = await action(csrf);
      setStandDown((result.stand_down as JsonRecord | null) ?? null);
    }
    catch {
      setError(failure);
    }
    finally {
      setBusy(false);
    }
  }

  if (!loaded) return null;

  return (
    <article className="onboarding-card stand-down-card">
      <p className="eyebrow">Medical stand-down</p>
      <h3>{standDown ? "You are stood down from training" : "Head injury or told not to train?"}</h3>
      <StandDownPanel
        standDown={standDown}
        busy={busy}
        error={error}
        whose="your"
        onRecord={(input) => void run((csrf) => recordStandDown(input, csrf), "The stand-down could not be recorded. Check the date and try again.")}
        onEnd={() => void run((csrf) => endStandDown(csrf), "The stand-down could not be ended. Try again.")}
      />
    </article>
  );
}
