import React, { useCallback, useEffect, useState } from "react";

import { loadMyCheckins, respondToCheckin } from "../../api/checkinsClient";
import { loadAccountDetail } from "../../api/client";
import { type JsonRecord } from "../../api/transport";
import { checkinWhen, downloadCalendarFile, joinLink, METHOD_LABEL } from "../../utils/checkins";
import { coachLabel } from "../../utils/coachName";
import { useRole } from "../../utils/role";

// The athlete's next check-in call on Today (the rest of a run listed in a
// line, so it doesn't push the session down): join (the coach's WhatsApp
// number or Teams meeting), add to their calendar, confirm, or ask to move it
// with a short message (coach_checkin_service.ts).
export function AthleteCheckinsCard() {
  const isAthlete = useRole() === "athlete";
  const [checkins, setCheckins] = useState<JsonRecord[]>([]);
  const [moving, setMoving] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const payload = await loadMyCheckins();
      setCheckins(Array.isArray(payload.checkins) ? (payload.checkins as JsonRecord[]) : []);
    }
    catch {
      setCheckins([]);
    }
  }, []);

  useEffect(() => {
    if (!isAthlete) return undefined;
    refresh();
    document.addEventListener("kolosseum:account-role-known", refresh);
    return () => document.removeEventListener("kolosseum:account-role-known", refresh);
  }, [isAthlete, refresh]);

  if (!isAthlete || checkins.length === 0) return null;

  async function respond(id: string, response: "confirm" | "move") {
    setBusy(true);
    setError(null);
    try {
      const account = await loadAccountDetail();
      const payload = await respondToCheckin(id, response, response === "move" ? message.trim() : "", typeof account.csrf_token === "string" ? account.csrf_token : "");
      setCheckins(Array.isArray(payload.checkins) ? (payload.checkins as JsonRecord[]) : []);
      setMoving(null);
      setMessage("");
    }
    catch {
      setError("That didn't send. Try again.");
      await refresh();
    }
    finally {
      setBusy(false);
    }
  }

  return (
    <article className="panel" data-testid="athlete-checkins">
      <p className="eyebrow">Check-in calls</p>
      <h3>Your next check-in</h3>
      {error ? <p className="field-error" role="alert">{error}</p> : null}
      <div className="record-list">
        {checkins.slice(0, 1).map((checkin) => {
          const id = String(checkin.checkin_id);
          const join = joinLink(checkin);
          const coach = coachLabel(checkin, "Your coach");
          return (
            <article className="record-row" key={id}>
              <div>
                <strong>{checkinWhen(checkin.starts_at)}</strong>
                <p className="muted small">{`${METHOD_LABEL[String(checkin.call_method)] ?? ""} with ${coach} · ${String(checkin.duration_minutes)} min`}</p>
                {checkin.note ? <p className="muted small">{String(checkin.note)}</p> : null}
                <p className="muted small">
                  {checkin.status === "confirmed" ? "You confirmed" : checkin.status === "move_requested" ? "You asked to move it - your coach will pick a new time" : "Can you make it?"}
                </p>
                {moving === id ? (
                  <form className="athlete-detail-note-form" onSubmit={(event) => { event.preventDefault(); void respond(id, "move"); }}>
                    <label className="field">
                      <span>When suits you better?</span>
                      <input type="text" required maxLength={300} placeholder="Any evening after 6, or Saturday morning" value={message} onChange={(event) => setMessage(event.target.value)} />
                    </label>
                    <div className="inline-controls">
                      <button className="button primary small" type="submit" disabled={busy || !message.trim()}>Send</button>
                      <button className="button secondary small" type="button" onClick={() => setMoving(null)}>Cancel</button>
                    </div>
                  </form>
                ) : null}
              </div>
              <div className="inline-controls">
                {join ? <a className="button primary small" href={join.href} target="_blank" rel="noopener noreferrer">{join.label}</a> : null}
                <button className="button secondary small" type="button" onClick={() => downloadCalendarFile(checkin, `Check-in with ${coach}`)}>Add to calendar</button>
                {checkin.status !== "confirmed" ? <button className="button secondary small" type="button" disabled={busy} onClick={() => void respond(id, "confirm")}>Confirm</button> : null}
                {moving !== id ? <button className="button secondary small" type="button" disabled={busy} onClick={() => { setMoving(id); setMessage(""); }}>Ask to move</button> : null}
              </div>
            </article>
          );
        })}
      </div>
      {checkins.length > 1 ? (
        <p className="muted small">{`Also booked: ${checkins.slice(1, 3).map((checkin) => checkinWhen(checkin.starts_at)).join(" · ")}${checkins.length > 3 ? ` and ${checkins.length - 3} more` : ""}`}</p>
      ) : null}
    </article>
  );
}
