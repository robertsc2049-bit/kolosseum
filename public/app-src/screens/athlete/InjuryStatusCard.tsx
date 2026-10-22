import React, { useEffect, useState } from "react";

import { request, type JsonRecord } from "../../api/transport";
import { ENTRY_AUTH_SUCCEEDED_EVENT } from "../entry/useEntryAuth";

// The athlete's own injury, as their coach or physio logged it: out of
// training, or training modified. Read-only - their physio moves it on.
export function InjuryStatusCard() {
  const [injury, setInjury] = useState<JsonRecord | null>(null);
  useEffect(() => {
    const load = () => { request("GET", "/account/onboarding/injury-status").then((result) => setInjury((result.injury as JsonRecord | null) ?? null)).catch(() => undefined); };
    load();
    document.addEventListener(ENTRY_AUTH_SUCCEEDED_EVENT, load);
    return () => document.removeEventListener(ENTRY_AUTH_SUCCEEDED_EVENT, load);
  }, []);
  if (!injury) return null;
  const out = injury.status === "out";
  return (
    <article className="onboarding-card injury-status-card" data-testid="injury-status-card">
      <p className="eyebrow">Injury</p>
      <h3>{out ? "Out of training" : "Training modified"}</h3>
      <p>{`Your ${String(injury.name)}${injury.expected_return ? ` - expected back around ${String(injury.expected_return)}` : ""}.`}</p>
      <p className="muted small">{out ? "No sessions until your physio or coach moves you on. Follow their rehab plan." : "Follow your physio's plan in your sessions, and stop anything that hurts."}</p>
    </article>
  );
}
