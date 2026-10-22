import React, { useEffect, useState } from "react";

import { declineProgrammeGrant, loadProgrammeGrants, startProgrammeGrant } from "../../api/athleteOnboardingClient";
import { loadAccountDetail } from "../../api/client";
import { type JsonRecord } from "../../api/transport";
import { ENTRY_AUTH_SUCCEEDED_EVENT } from "../entry/useEntryAuth";

// Programmes coaches have given the athlete (src/api/programme_grant_service.ts),
// usually ones they bought from that coach: start one (it replaces the
// programme they're running), start an owned one again, or decline.

const ERRORS: Record<string, string> = {
  programme_grant_coach_programme_active: "You're on your coach's programme - your sessions come from them. This one will be here when you've finished with them.",
  programme_grant_not_found: "This programme is no longer available."
};

export function ProgrammeGrantsCard() {
  const [grants, setGrants] = useState<JsonRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    const load = () => { loadProgrammeGrants().then((result) => setGrants(Array.isArray(result.grants) ? (result.grants as JsonRecord[]) : [])).catch(() => undefined); };
    load();
    document.addEventListener(ENTRY_AUTH_SUCCEEDED_EVENT, load);
    return () => document.removeEventListener(ENTRY_AUTH_SUCCEEDED_EVENT, load);
  }, []);

  async function act(grantId: string, action: "start" | "decline") {
    setBusy(true);
    setStatus(null);
    try {
      const account = await loadAccountDetail();
      const csrf = typeof account.csrf_token === "string" ? account.csrf_token : "";
      const result = action === "start" ? await startProgrammeGrant(grantId, csrf) : await declineProgrammeGrant(grantId, csrf);
      setGrants(Array.isArray(result.grants) ? (result.grants as JsonRecord[]) : []);
      if (action === "start") {
        setStatus("Started - your next session is from this programme.");
        document.dispatchEvent(new CustomEvent("kolosseum:data-changed"));
      }
    }
    catch (caught) {
      const code = String((caught as { payload?: JsonRecord })?.payload?.error ?? "");
      setStatus(ERRORS[code] ?? "That didn't work - try again.");
    }
    finally { setBusy(false); }
  }

  if (!grants.length) return null;
  return (
    <article className="onboarding-card programme-grants-card" data-testid="programme-grants-card">
      <p className="eyebrow">Programmes from coaches</p>
      <h3>Your programmes</h3>
      <ul className="compact-list">
        {grants.map((grant) => (
          <li key={String(grant.grant_id)}>
            <div>
              <strong>{String(grant.title)}</strong>
              <span className="muted small">{` from ${String(grant.coach_name)}`}</span>
            </div>
            {grant.running ? <span className="badge complete">Running</span> : (
              <div className="button-row">
                <button className="button primary" type="button" disabled={busy} onClick={() => void act(String(grant.grant_id), "start")}>
                  {grant.accepted ? "Start again" : "Start"}
                </button>
                {!grant.accepted ? <button className="button tertiary" type="button" disabled={busy} onClick={() => void act(String(grant.grant_id), "decline")}>Not mine</button> : null}
              </div>
            )}
          </li>
        ))}
      </ul>
      {status ? <p className="muted small" role="status">{status}</p> : null}
    </article>
  );
}
