import React, { useCallback, useEffect, useState } from "react";

import { bookSlot, cancelMyBooking, loadMyCheckins, loadOpenSlots, respondToCheckin } from "../../api/checkinsClient";
import { loadAccountDetail } from "../../api/client";
import { type JsonRecord } from "../../api/transport";
import { checkinWhen, downloadCalendarFile, errorCode, joinLink, METHOD_LABEL } from "../../utils/checkins";
import { coachLabel } from "../../utils/coachName";
import { useRole } from "../../utils/role";

// The athlete's next check-in call on Today (the rest of a run listed in a
// line, so it doesn't push the session down): join (the coach's WhatsApp
// number or Teams meeting), add to their calendar, confirm, or ask to move it
// with a short message (coach_checkin_service.ts). A call they booked
// themselves they can cancel instead. When their coach has open slots, "Book
// a check-in" lists them by day and books one straight away
// (coach_availability_service.ts).
const BOOKING_ERRORS: Record<string, string> = {
  booking_slot_taken: "Someone's just taken that slot - pick another.",
  booking_one_at_a_time: "You've already booked a call with this coach - cancel it to book a different time."
};

const dayLabel = (iso: string) => new Date(iso).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
const timeLabel = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

function byDay(slots: JsonRecord[]): [string, JsonRecord[]][] {
  const days = new Map<string, JsonRecord[]>();
  for (const slot of slots) {
    const day = dayLabel(String(slot.starts_at));
    days.set(day, [...(days.get(day) ?? []), slot]);
  }
  return [...days.entries()];
}

function BookCheckin({ coaches, onBooked }: { coaches: JsonRecord[]; onBooked: (payload: JsonRecord) => void }) {
  const [open, setOpen] = useState(false);
  const [coachId, setCoachId] = useState("");
  const [chosen, setChosen] = useState<JsonRecord | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Only coaches they can still book with (one upcoming self-booked call each).
  const bookable = coaches.filter((c) => !c.booked_upcoming_at && Array.isArray(c.slots) && c.slots.length);
  const coach = bookable.find((c) => String(c.coach_user_id) === coachId) ?? bookable[0];
  if (!coach) return null;
  const slots = Array.isArray(coach.slots) ? (coach.slots as JsonRecord[]) : [];

  if (!open) {
    return <button className="button secondary small" type="button" onClick={() => setOpen(true)}>Book a check-in</button>;
  }

  async function book() {
    if (!chosen) return;
    setBusy(true);
    setError(null);
    try {
      const account = await loadAccountDetail();
      const payload = await bookSlot({ coach_user_id: String(coach.coach_user_id), starts_at: String(chosen.starts_at), ...(note.trim() ? { note: note.trim() } : {}) }, typeof account.csrf_token === "string" ? account.csrf_token : "");
      setOpen(false);
      setChosen(null);
      setNote("");
      onBooked(payload);
    }
    catch (caught) {
      setError(BOOKING_ERRORS[errorCode(caught)] ?? "That didn't book. Try again.");
      setChosen(null);
      onBooked({});
    }
    finally {
      setBusy(false);
    }
  }

  return (
    <div className="checkin-booking" data-testid="checkin-booking">
      <div className="panel-header">
        <strong>Book a check-in</strong>
        <button className="button secondary small-button" type="button" onClick={() => setOpen(false)}>Close</button>
      </div>
      {bookable.length > 1 ? (
        <label className="field">
          <span>Coach</span>
          <select aria-label="Coach" value={coachId} onChange={(event) => { setCoachId(event.target.value); setChosen(null); }}>
            {bookable.map((c) => <option key={String(c.coach_user_id)} value={String(c.coach_user_id)}>{coachLabel(c, "Your coach")}</option>)}
          </select>
        </label>
      ) : null}
      {error ? <p className="field-error" role="alert">{error}</p> : null}
      {byDay(slots).map(([day, daySlots]) => (
        <div className="checkin-slot-day" key={day}>
          <p className="muted small">{day}</p>
          <div className="choice-chips">
            {daySlots.map((slot) => {
              const selected = chosen?.starts_at === slot.starts_at;
              return (
                <button key={String(slot.starts_at)} type="button" className={`choice-chip${selected ? " selected" : ""}`} aria-pressed={selected} onClick={() => setChosen(slot)}>
                  {timeLabel(String(slot.starts_at))}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {chosen ? (
        <div className="athlete-detail-note-form">
          <p className="small">{`${checkinWhen(chosen.starts_at)} · ${METHOD_LABEL[String(chosen.call_method)] ?? ""} · ${String(chosen.duration_minutes)} min with ${coachLabel(coach, "your coach")}`}</p>
          <label className="field">
            <span>What do you want to talk about? (optional)</span>
            <input type="text" maxLength={300} value={note} onChange={(event) => setNote(event.target.value)} />
          </label>
          <div className="inline-controls">
            <button className="button primary" type="button" disabled={busy} onClick={() => void book()}>Book this call</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function AthleteCheckinsCard() {
  const isAthlete = useRole() === "athlete";
  const [checkins, setCheckins] = useState<JsonRecord[]>([]);
  const [coaches, setCoaches] = useState<JsonRecord[]>([]);
  const [moving, setMoving] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshSlots = useCallback(async () => {
    try {
      const payload = await loadOpenSlots();
      setCoaches(Array.isArray(payload.coaches) ? (payload.coaches as JsonRecord[]) : []);
    }
    catch {
      setCoaches([]);
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const payload = await loadMyCheckins();
      setCheckins(Array.isArray(payload.checkins) ? (payload.checkins as JsonRecord[]) : []);
    }
    catch {
      setCheckins([]);
    }
    await refreshSlots();
  }, [refreshSlots]);

  useEffect(() => {
    if (!isAthlete) return undefined;
    refresh();
    document.addEventListener("kolosseum:account-role-known", refresh);
    return () => document.removeEventListener("kolosseum:account-role-known", refresh);
  }, [isAthlete, refresh]);

  if (!isAthlete || (checkins.length === 0 && coaches.length === 0)) return null;

  const showList = (payload: JsonRecord) => {
    if (Array.isArray(payload.checkins)) setCheckins(payload.checkins as JsonRecord[]);
    void refreshSlots();
  };

  async function run(action: (token: string) => Promise<JsonRecord>) {
    setBusy(true);
    setError(null);
    try {
      const account = await loadAccountDetail();
      showList(await action(typeof account.csrf_token === "string" ? account.csrf_token : ""));
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
      <h3>{checkins.length ? "Your next check-in" : "Check-in calls"}</h3>
      {error ? <p className="field-error" role="alert">{error}</p> : null}
      {checkins.length === 0 ? <p className="muted small">Nothing booked. Your coach has open slots.</p> : null}
      <div className="record-list">
        {checkins.slice(0, 1).map((checkin) => {
          const id = String(checkin.checkin_id);
          const join = joinLink(checkin);
          const coach = coachLabel(checkin, "Your coach");
          const mine = checkin.booked_by === "athlete";
          return (
            <article className="record-row" key={id}>
              <div>
                <strong>{checkinWhen(checkin.starts_at)}</strong>
                <p className="muted small">{`${METHOD_LABEL[String(checkin.call_method)] ?? ""} with ${coach} · ${String(checkin.duration_minutes)} min`}</p>
                {checkin.note ? <p className="muted small">{String(checkin.note)}</p> : null}
                <p className="muted small">
                  {mine ? "You booked this" : checkin.status === "confirmed" ? "You confirmed" : checkin.status === "move_requested" ? "You asked to move it - your coach will pick a new time" : "Can you make it?"}
                </p>
                {moving === id ? (
                  <form className="athlete-detail-note-form" onSubmit={(event) => { event.preventDefault(); void run((token) => respondToCheckin(id, "move", message.trim(), token)); }}>
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
                {mine ? (
                  <button className="button secondary small" type="button" disabled={busy} onClick={() => void run((token) => cancelMyBooking(id, token))}>Cancel this call</button>
                ) : (
                  <>
                    {checkin.status !== "confirmed" ? <button className="button secondary small" type="button" disabled={busy} onClick={() => void run((token) => respondToCheckin(id, "confirm", "", token))}>Confirm</button> : null}
                    {moving !== id ? <button className="button secondary small" type="button" disabled={busy} onClick={() => { setMoving(id); setMessage(""); }}>Ask to move</button> : null}
                  </>
                )}
              </div>
            </article>
          );
        })}
      </div>
      {checkins.length > 1 ? (
        <p className="muted small">{`Also booked: ${checkins.slice(1, 3).map((checkin) => checkinWhen(checkin.starts_at)).join(" · ")}${checkins.length > 3 ? ` and ${checkins.length - 3} more` : ""}`}</p>
      ) : null}
      <BookCheckin coaches={coaches} onBooked={showList} />
    </article>
  );
}
