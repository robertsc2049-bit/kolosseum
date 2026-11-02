import React, { useCallback, useEffect, useState } from "react";

import { addAvailabilityBlock, addDayOff, loadAvailability, removeAvailabilityBlock, removeDayOff } from "../../api/checkinsClient";
import { loadAccountDetail } from "../../api/client";
import { type JsonRecord } from "../../api/transport";
import { errorCode, METHOD_LABEL } from "../../utils/checkins";

// The hours a coach is free for check-in calls - every week on a day, or on
// one date - split into calls of a set length, each with its call method,
// plus days off. Their athletes book an open slot straight away
// (coach_availability_service.ts). Times are this device's time zone.
export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const ERROR_MESSAGES: Record<string, string> = {
  availability_limit_reached: "That's the most you can add - remove one first.",
  availability_not_found: "That's already been removed."
};

function deviceTimeZone(): string {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; }
  catch { return "UTC"; }
}

function messageFor(error: unknown): string {
  const code = errorCode(error);
  if (ERROR_MESSAGES[code]) return ERROR_MESSAGES[code];
  const fieldErrors = (((error as { payload?: JsonRecord }).payload ?? {}).field_errors ?? {}) as JsonRecord;
  return Object.values(fieldErrors).map(String)[0] ?? "That didn't save. Try again.";
}

const shortDate = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });

function blockLabel(block: JsonRecord): string {
  const when = block.repeats_weekly ? `Every ${WEEKDAYS[Number(block.weekday)]}` : shortDate(String(block.on_date));
  return `${when}, ${String(block.start)}-${String(block.end)}`;
}

export function CoachAvailabilityPanel() {
  const [availability, setAvailability] = useState<JsonRecord | null>(null);
  const [repeats, setRepeats] = useState("weekly");
  const [weekday, setWeekday] = useState("2");
  const [onDate, setOnDate] = useState("");
  const [start, setStart] = useState("18:00");
  const [end, setEnd] = useState("20:00");
  const [slot, setSlot] = useState("30");
  const [method, setMethod] = useState("whatsapp");
  const [offFrom, setOffFrom] = useState("");
  const [offTo, setOffTo] = useState("");
  const [offNote, setOffNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try { setAvailability(await loadAvailability()); }
    catch { setAvailability(null); }
  }, []);

  useEffect(() => {
    refresh();
    document.addEventListener("kolosseum:account-role-known", refresh);
    return () => document.removeEventListener("kolosseum:account-role-known", refresh);
  }, [refresh]);

  if (!availability) return null;

  async function act(action: (token: string) => Promise<JsonRecord>): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      const account = await loadAccountDetail();
      setAvailability(await action(typeof account.csrf_token === "string" ? account.csrf_token : ""));
      return true;
    }
    catch (caught) {
      setError(messageFor(caught));
      return false;
    }
    finally {
      setBusy(false);
    }
  }

  const blocks = Array.isArray(availability.blocks) ? (availability.blocks as JsonRecord[]) : [];
  const daysOff = Array.isArray(availability.days_off) ? (availability.days_off as JsonRecord[]) : [];
  const zone = deviceTimeZone();

  return (
    <section className="panel" aria-labelledby="coachAvailabilityHeading" data-testid="coach-availability">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Check-in slots</p>
          <h3 id="coachAvailabilityHeading">When athletes can book a call</h3>
          <p className="muted">{`Set the hours you're free and your athletes book an open slot themselves - at least ${Number(availability.booking_notice_hours ?? 12)} hours ahead, up to ${Math.round(Number(availability.booking_window_days ?? 28) / 7)} weeks out, one at a time. You're told when they book. Times are your local time (${zone}).`}</p>
        </div>
      </div>
      {error ? <p className="field-error" role="alert">{error}</p> : null}

      <div className="record-list">
        {blocks.length === 0 ? <p className="muted small">No hours set - athletes can't book a call yet.</p> : blocks.map((block) => (
          <article className="record-row" key={String(block.block_id)}>
            <div>
              <strong>{blockLabel(block)}</strong>
              <p className="muted small">{`${String(block.slot_minutes)}-minute ${(METHOD_LABEL[String(block.call_method)] ?? "").toLowerCase()}s`}</p>
            </div>
            <button className="button secondary small" type="button" disabled={busy} onClick={() => void act((token) => removeAvailabilityBlock(String(block.block_id), token))}>Remove</button>
          </article>
        ))}
      </div>

      <form className="athlete-detail-note-form" data-testid="availability-add" onSubmit={(event) => {
        event.preventDefault();
        void act((token) => addAvailabilityBlock({
          repeats_weekly: repeats === "weekly",
          ...(repeats === "weekly" ? { weekday: Number(weekday) } : { on_date: onDate }),
          start, end, slot_minutes: Number(slot), call_method: method, time_zone: zone
        }, token));
      }}>
        <p className="muted small">Add hours</p>
        <label className="field">
          <span>Repeats</span>
          <select aria-label="Repeats" value={repeats} onChange={(event) => setRepeats(event.target.value)}>
            <option value="weekly">Every week</option>
            <option value="once">On one date</option>
          </select>
        </label>
        {repeats === "weekly" ? (
          <label className="field">
            <span>Day</span>
            <select aria-label="Day" value={weekday} onChange={(event) => setWeekday(event.target.value)}>
              {[1, 2, 3, 4, 5, 6, 0].map((n) => <option key={n} value={String(n)}>{WEEKDAYS[n]}</option>)}
            </select>
          </label>
        ) : (
          <label className="field">
            <span>Date</span>
            <input type="date" aria-label="Date" required value={onDate} onChange={(event) => setOnDate(event.target.value)} />
          </label>
        )}
        <div className="inline-controls">
          <label className="field">
            <span>From</span>
            <input type="time" aria-label="From" required value={start} onChange={(event) => setStart(event.target.value)} />
          </label>
          <label className="field">
            <span>To</span>
            <input type="time" aria-label="To" required value={end} onChange={(event) => setEnd(event.target.value)} />
          </label>
        </div>
        <label className="field">
          <span>Each call</span>
          <select aria-label="Each call" value={slot} onChange={(event) => setSlot(event.target.value)}>
            {["15", "30", "45", "60"].map((minutes) => <option key={minutes} value={minutes}>{`${minutes} minutes`}</option>)}
          </select>
        </label>
        <label className="field">
          <span>How</span>
          <select aria-label="How" value={method} onChange={(event) => setMethod(event.target.value)}>
            <option value="whatsapp">WhatsApp call</option>
            <option value="teams">Teams call</option>
            <option value="in_person">In person</option>
          </select>
        </label>
        <div className="inline-controls">
          <button className="button primary" type="submit" disabled={busy}>Add these hours</button>
        </div>
      </form>

      <div className="record-list">
        <p className="muted small">Days off</p>
        {daysOff.length === 0 ? <p className="muted small">None booked.</p> : daysOff.map((day) => (
          <article className="record-row" key={String(day.day_off_id)}>
            <div>
              <strong>{day.from_date === day.to_date ? shortDate(String(day.from_date)) : `${shortDate(String(day.from_date))} - ${shortDate(String(day.to_date))}`}</strong>
              {day.note ? <p className="muted small">{String(day.note)}</p> : null}
            </div>
            <button className="button secondary small" type="button" disabled={busy} onClick={() => void act((token) => removeDayOff(String(day.day_off_id), token))}>Remove</button>
          </article>
        ))}
      </div>
      <form className="athlete-detail-note-form" data-testid="days-off-add" onSubmit={(event) => {
        event.preventDefault();
        void act((token) => addDayOff({ from_date: offFrom, to_date: offTo || offFrom, ...(offNote.trim() ? { note: offNote.trim() } : {}) }, token)).then((ok) => {
          if (ok) { setOffFrom(""); setOffTo(""); setOffNote(""); }
        });
      }}>
        <div className="inline-controls">
          <label className="field">
            <span>First day off</span>
            <input type="date" aria-label="First day off" required value={offFrom} onChange={(event) => setOffFrom(event.target.value)} />
          </label>
          <label className="field">
            <span>Last day off</span>
            <input type="date" aria-label="Last day off" value={offTo} onChange={(event) => setOffTo(event.target.value)} />
          </label>
        </div>
        <label className="field">
          <span>Note (optional)</span>
          <input type="text" maxLength={80} placeholder="Holiday" value={offNote} onChange={(event) => setOffNote(event.target.value)} />
        </label>
        <div className="inline-controls">
          <button className="button secondary" type="submit" disabled={busy}>Add days off</button>
        </div>
      </form>
    </section>
  );
}
