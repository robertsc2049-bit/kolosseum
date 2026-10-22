import React, { useEffect, useState } from "react";

import { loadAccountDetail } from "../../api/client";
import { giveProgrammeGrant, loadProgrammeGrants, revokeProgrammeGrant } from "../../api/coachWorkspaceClient";
import { type JsonRecord } from "../../api/transport";

// "Give this programme": a coach who sold this programme outside the app
// gives it to the athlete by email (src/api/programme_grant_service.ts). The
// athlete runs it themselves - not a coaching client, no seat - and it counts
// toward the coach's programme-athlete allowance while they're training on it.

const STATE_LABELS: Record<string, string> = {
  pending: "Waiting for them", accepted: "Accepted", active: "Training", dormant: "Dormant (counts again when they're back)",
  finished: "Finished", stopped: "Stopped", declined: "Declined", revoked: "Taken back"
};

const ERRORS: Record<string, string> = {
  programme_grant_email_invalid: "Enter the athlete's email address.",
  programme_grant_allowance_full: "Your programme-athlete allowance is full. Athletes who finish, stop or go dormant free a place.",
  programme_grant_already_given: "This athlete already has this programme.",
  programme_grant_template_not_active: "Activate this programme before you give it.",
  programme_grant_already_accepted: "They've accepted it - it's theirs now."
};

const requestId = () => `pg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

export function ProgrammeGrantsSection({ template }: { template: JsonRecord }) {
  const templateId = String(template.template_id ?? "");
  const [grants, setGrants] = useState<JsonRecord[]>([]);
  const [usage, setUsage] = useState<JsonRecord | null>(null);
  const [email, setEmail] = useState("");
  const [pendingRequest, setPendingRequest] = useState(requestId);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  function apply(result: JsonRecord) {
    setGrants(Array.isArray(result.grants) ? (result.grants as JsonRecord[]) : []);
    setUsage(result.usage && typeof result.usage === "object" ? (result.usage as JsonRecord) : null);
  }

  useEffect(() => {
    let cancelled = false;
    loadProgrammeGrants().then((result) => { if (!cancelled) apply(result); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [templateId]);

  async function csrf(): Promise<string> {
    const account = await loadAccountDetail();
    return typeof account.csrf_token === "string" ? account.csrf_token : "";
  }

  async function give() {
    setBusy(true);
    setStatus(null);
    try {
      await giveProgrammeGrant(templateId, { athlete_email: email.trim(), client_request_id: pendingRequest }, await csrf());
      setStatus(`Given to ${email.trim()}. They'll see it when they sign in to Kolosseum with that email.`);
      setEmail("");
      setPendingRequest(requestId());
      apply(await loadProgrammeGrants());
    }
    catch (caught) {
      const code = String((caught as { payload?: JsonRecord })?.payload?.error ?? "");
      setStatus(ERRORS[code] ?? "It couldn't be given - try again.");
    }
    finally { setBusy(false); }
  }

  async function revoke(grantId: string) {
    setBusy(true);
    setStatus(null);
    try {
      await revokeProgrammeGrant(grantId, await csrf());
      apply(await loadProgrammeGrants());
    }
    catch (caught) {
      const code = String((caught as { payload?: JsonRecord })?.payload?.error ?? "");
      setStatus(ERRORS[code] ?? "It couldn't be taken back - try again.");
    }
    finally { setBusy(false); }
  }

  if (template.template_status !== "active") return null;
  const mine = grants.filter((grant) => grant.template_id === templateId);

  return (
    <article className="programme-detail-section programme-grants" data-testid="programme-grants">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Sold outside the app</p>
          <h4>Give this programme</h4>
        </div>
        {usage ? <span className="badge neutral" data-testid="programme-grants-usage">{`Programme athletes: ${String(usage.active)} of ${String(usage.allowance)}`}</span> : null}
      </div>
      <p className="muted">Sold this programme to an athlete? Give it to them here. They run it themselves with their own weights - they aren't a coaching client and don't use a seat. Someone not training on it for {String(usage?.dormant_after_days ?? 28)} days stops counting toward your allowance.</p>
      <div className="inline-form">
        <label className="field">
          <span>Athlete's email</span>
          <input type="email" value={email} maxLength={254} autoComplete="off" onChange={(event) => setEmail(event.target.value)} />
        </label>
        <button className="button primary" type="button" disabled={busy || !email.trim()} onClick={() => void give()}>Give programme</button>
      </div>
      {status ? <p className="muted small" role="status">{status}</p> : null}
      {mine.length ? (
        <ul className="compact-list">
          {mine.map((grant) => (
            <li key={String(grant.grant_id)}>
              <span>{String(grant.athlete_email || "Erased account")}</span>
              <span className="muted small">{STATE_LABELS[String(grant.state)] ?? String(grant.state)}</span>
              {grant.state === "pending" || grant.state === "declined" ? (
                <button className="button tertiary" type="button" disabled={busy} onClick={() => void revoke(String(grant.grant_id))}>Take back</button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}
