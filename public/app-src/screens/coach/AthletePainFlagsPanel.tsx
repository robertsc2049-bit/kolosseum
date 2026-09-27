import React, { useCallback, useEffect, useState } from "react";

import { loadAccountDetail } from "../../api/client";
import { clearAthletePainFlag, loadAthletePainFlags } from "../../api/coachWorkspaceClient";
import { type JsonRecord } from "../../api/transport";

// Pain carry-forward, coach side: the open pain flags of the athlete whose
// profile is open - where it hurts, since when, during which exercises and
// their latest check-in - with a way to clear one (e.g. after seeing them).
// Uses the same open/close bridge as the other athlete-profile panels.
const OPENED_EVENT = "kolosseum:coach-athlete-profile-opened";
const CLOSED_EVENT = "kolosseum:coach-athlete-profile-closed";

function when(iso: unknown): string {
  const date = new Date(String(iso ?? ""));
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function checkInLabel(checkIn: JsonRecord | null | undefined): string {
  if (!checkIn) return "No check-in yet";
  if (checkIn.status === "pain_free") return `Pain-free (${when(checkIn.at)})`;
  return `Still sore (${when(checkIn.at)}) - ${checkIn.plan === "swap" ? "swapping" : "leaving out"} those exercises`;
}

export function AthletePainFlagsPanel() {
  const [athleteUserId, setAthleteUserId] = useState<string | null>(null);
  const [flags, setFlags] = useState<JsonRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  useEffect(() => {
    function handleOpened(event: Event) {
      const detail = (event as CustomEvent).detail as { athlete_user_id?: string } | undefined;
      if (detail?.athlete_user_id) setAthleteUserId(detail.athlete_user_id);
    }
    function handleClosed() {
      setAthleteUserId(null);
    }
    document.addEventListener(OPENED_EVENT, handleOpened);
    document.addEventListener(CLOSED_EVENT, handleClosed);
    return () => {
      document.removeEventListener(OPENED_EVENT, handleOpened);
      document.removeEventListener(CLOSED_EVENT, handleClosed);
    };
  }, []);

  const refresh = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await loadAthletePainFlags(id);
      setFlags(Array.isArray(result.flags) ? (result.flags as JsonRecord[]) : []);
    }
    catch {
      setError("Pain flags could not be loaded. Check your connection and try again.");
    }
    finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setFlags([]);
    if (athleteUserId) void refresh(athleteUserId);
  }, [athleteUserId, refresh]);

  async function clear(flagKey: string) {
    if (!athleteUserId) return;
    setBusyKey(flagKey);
    setError(null);
    try {
      const account = await loadAccountDetail();
      const csrf = typeof account.csrf_token === "string" ? account.csrf_token : "";
      const result = await clearAthletePainFlag(athleteUserId, flagKey, csrf);
      setFlags(Array.isArray(result.flags) ? (result.flags as JsonRecord[]) : []);
    }
    catch {
      setError("The pain flag could not be cleared. Try again.");
    }
    finally {
      setBusyKey(null);
    }
  }

  if (!athleteUserId) return null;
  if (loading && !flags.length) return <p className="muted">Loading pain flags…</p>;

  return (
    <div data-testid="athlete-pain-flags">
      {error ? <p className="field-error" role="alert">{error}</p> : null}
      {!flags.length && !error ? <p className="muted">No open pain flags.</p> : null}
      {flags.map((flag) => {
        const key = String(flag.flag_key);
        const exercises = Array.isArray(flag.reported_exercises) ? (flag.reported_exercises as JsonRecord[]) : [];
        return (
          <article className="record-item pain-flag" key={key}>
            <strong>{`Pain in ${String(flag.where).replace(/^your /u, "")}`}</strong>
            <span className="badge warning">Open</span>
            <p>{`Reported ${when(flag.first_reported_at)}${exercises.length ? ` during ${exercises.map((e) => String(e.display_name)).join(", ")}` : ""}${flag.last_reported_at !== flag.first_reported_at ? `, latest ${when(flag.last_reported_at)}` : ""}.`}</p>
            <p className="muted">{`Latest check-in: ${checkInLabel(flag.latest_check_in as JsonRecord | null)}`}</p>
            <button className="button secondary" type="button" disabled={busyKey === key} onClick={() => void clear(key)}>Clear flag</button>
          </article>
        );
      })}
    </div>
  );
}
