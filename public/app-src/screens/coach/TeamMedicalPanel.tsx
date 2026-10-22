import React, { useEffect, useState } from "react";

import { loadAccountDetail } from "../../api/client";
import { endAthleteStandDown, loadAthleteStandDown, recordAthleteStandDown } from "../../api/coachWorkspaceClient";
import { request, type JsonRecord } from "../../api/transport";
import { StandDownPanel } from "../../components/StandDownPanel";
import { InjuryLog } from "./InjuryLog";

// The team's medical lead: for one athlete on the team, their injury log and
// medical stand-down - and nothing else of theirs (no programme, no analysis).

export function TeamMedicalPanel({ athleteUserId, name }: { athleteUserId: string; name: string }) {
  const [injuries, setInjuries] = useState<JsonRecord | null>(null);
  const [standDown, setStandDown] = useState<JsonRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = async () => {
    try {
      const [log, stand] = await Promise.all([
        request("GET", `/coach-workspace/athletes/${encodeURIComponent(athleteUserId)}/injuries`),
        loadAthleteStandDown(athleteUserId).catch(() => ({ stand_down: null }))
      ]);
      setInjuries((log.injuries as JsonRecord | undefined) ?? { rows: [] });
      setStandDown(((stand as JsonRecord).stand_down as JsonRecord | null) ?? null);
      setError(null);
    }
    catch { setError("Their medical record couldn't be loaded."); }
  };
  useEffect(() => { void load(); }, [athleteUserId]);
  async function standDownAction(action: (csrf: string) => Promise<JsonRecord>) {
    setBusy(true);
    setError(null);
    try {
      const account = await loadAccountDetail();
      const result = await action(typeof account.csrf_token === "string" ? account.csrf_token : "");
      setStandDown((result.stand_down as JsonRecord | null) ?? null);
    }
    catch { setError("The stand-down could not be saved. Check the date and try again."); }
    finally { setBusy(false); }
  }
  return (
    <div className="team-medical" data-testid="team-medical">
      <h4>{`${name}: injuries and stand-downs`}</h4>
      {error ? <p className="muted small" role="alert">{error}</p> : null}
      <StandDownPanel
        standDown={standDown}
        busy={busy}
        error={null}
        whose="their"
        onRecord={(input) => void standDownAction((csrf) => recordAthleteStandDown(athleteUserId, input, csrf))}
        onEnd={() => void standDownAction((csrf) => endAthleteStandDown(athleteUserId, csrf))}
      />
      {injuries ? <InjuryLog athleteUserId={athleteUserId} injuries={injuries} onChanged={() => void load()} /> : <p className="muted small">Loading…</p>}
    </div>
  );
}
