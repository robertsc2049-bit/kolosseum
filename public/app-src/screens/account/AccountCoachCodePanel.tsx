import React, { useEffect, useState } from "react";

import { useRole } from "../../utils/role";

// DEV NOTE: ported from app.js's athleteCoachLinkPanel block inside
// renderAccount() - a legacy, pre-relationship-system way to link an
// athlete to a coach by manually entering a code, now mostly superseded by
// the formal invite/accept relationship flow (AccountCoachInvitationsPanel.
// tsx) but still read as a fallback by the still-legacy createSession()
// (state.athleteToday?.coach_user_id always wins when present). Writes
// directly into the same localStorage blob legacy's saveState() persists,
// since this field has no server round-trip of its own - matches
// AccountBrandingPanel.tsx's readRole() precedent for reading that same
// key, extended here to a targeted write of one field. Role gate uses the
// shared useRole() hook (not a local storage-only listener) so a same-tab
// sign-in/register re-evaluates it too - see utils/role.ts.
const STORAGE_KEY = "kolosseum.product.app.v1";

type PersistedState = { role?: unknown; coachCode?: unknown; [key: string]: unknown };

function readPersistedState(): PersistedState {
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}") as PersistedState;
  }
  catch {
    return {};
  }
}

export function AccountCoachCodePanel() {
  const isAthlete = useRole() === "athlete";
  const [code, setCode] = useState(() => String(readPersistedState().coachCode ?? ""));
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    function handleStorage() {
      setCode(String(readPersistedState().coachCode ?? ""));
    }
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  if (!isAthlete) return null;

  const handleSave = () => {
    const trimmed = code.trim();
    const stored = readPersistedState();
    stored.coachCode = trimmed;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    setCode(trimmed);
    setNotice(trimmed ? "Coach account code saved." : "Coach account code cleared.");
  };

  return (
    <article className="panel">
      <p className="eyebrow">Coach-managed training</p>
      <h3>Coach account code</h3>
      <p className="muted">Enter the coach account code only after the coach has connected this athlete account.</p>
      <div className="inline-controls">
        <input
          autoComplete="off"
          placeholder="Coach account code"
          value={code}
          onChange={(event) => setCode(event.target.value)}
        />
        <button className="button secondary" type="button" onClick={handleSave}>Save code</button>
      </div>
      {notice ? <p role="status" className="muted small">{notice}</p> : null}
    </article>
  );
}
