import React, { useCallback, useEffect, useState } from "react";

import { loadAccountDetail } from "../../api/client";
import { ApiRequestError, type JsonRecord, request } from "../../api/transport";
import { ENTRY_AUTH_SUCCEEDED_EVENT } from "../entry/useEntryAuth";

// An organisation handed to this coach after its owner's account was erased
// (src/api/org_handover_service.ts): the coach takes it over by choosing a
// password for the organisation app, where they then sign in with their
// coach email. Shows nothing when there's nothing handed to them.

type Handover = { org_id: string; org_name: string };

const MESSAGES: Record<string, string> = {
  org_owner_password_invalid: "Choose a password of at least 12 characters.",
  org_handover_email_in_use: "An organisation account already uses your email. Contact support to take this organisation over.",
  org_handover_not_found: "This organisation is no longer waiting for you."
};

function HandoverRow({ handover, onDone }: { handover: Handover; onDone: (message: string) => void }) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const takeOver = async () => {
    setBusy(true);
    setError(null);
    try {
      const account = await loadAccountDetail();
      const csrf = typeof account.csrf_token === "string" ? account.csrf_token : "";
      const result = await request("POST", `/coach-workspace/org-handovers/${encodeURIComponent(handover.org_id)}/accept`, { password }, csrf);
      const email = String((result.handover as JsonRecord | undefined)?.org_owner_email ?? "");
      onDone(`You now run ${handover.org_name}. Sign in to the organisation app at /org with ${email} and the password you just chose.`);
    }
    catch (caught) {
      const code = caught instanceof ApiRequestError ? `${caught.code} ${caught.message}` : "";
      const known = Object.keys(MESSAGES).find((key) => code.includes(key));
      setError(known ? MESSAGES[known] : "Couldn't take the organisation over. Check your connection and try again.");
    }
    finally {
      setBusy(false);
    }
  };

  return (
    <li className="org-handover-row">
      <p><strong>{handover.org_name}</strong> has been handed to you - its owner's account was closed.</p>
      <label>
        <span>Choose a password for the organisation app</span>
        <input type="password" autoComplete="new-password" minLength={12} value={password} onChange={(event) => setPassword(event.target.value)} />
      </label>
      <button className="button primary" type="button" disabled={busy || password.length < 12} onClick={() => { void takeOver(); }}>
        {busy ? "Taking over..." : `Take over ${handover.org_name}`}
      </button>
      {error ? <p className="field-warning" role="status">{error}</p> : null}
    </li>
  );
}

export function CoachOrgHandoverCard() {
  const [handovers, setHandovers] = useState<Handover[]>([]);
  const [done, setDone] = useState<string[]>([]);

  const load = useCallback(async () => {
    try {
      const body = await request("GET", "/coach-workspace/org-handovers");
      setHandovers(Array.isArray(body.handovers) ? (body.handovers as Handover[]) : []);
    }
    catch {
      setHandovers([]);
    }
  }, []);

  useEffect(() => {
    void load();
    // Always mounted - a coach signing in later needs a fresh look.
    document.addEventListener(ENTRY_AUTH_SUCCEEDED_EVENT, load);
    return () => document.removeEventListener(ENTRY_AUTH_SUCCEEDED_EVENT, load);
  }, [load]);

  if (!handovers.length && !done.length) return null;
  return (
    <article className="panel org-handover-card" data-testid="org-handover-card">
      <h3>Organisations handed to you</h3>
      {done.map((message) => <p key={message} className="muted" role="status">{message}</p>)}
      <ul className="org-handover-list">
        {handovers.map((handover) => (
          <HandoverRow
            key={handover.org_id}
            handover={handover}
            onDone={(message) => {
              setDone((current) => [...current, message]);
              setHandovers((current) => current.filter((h) => h.org_id !== handover.org_id));
            }}
          />
        ))}
      </ul>
    </article>
  );
}
