import React, { useCallback, useEffect, useState } from "react";

import { cancelCheckin, loadAthleteCheckinsForCoach, moveCheckin, scheduleCheckin } from "../../api/checkinsClient";
import { loadAccountDetail } from "../../api/client";
import { type JsonRecord } from "../../api/transport";
import { checkinWhen, downloadCalendarFile, errorCode, localInputToIso, METHOD_LABEL } from "../../utils/checkins";
import { CoachAthletePackageSection } from "./CoachAthletePackageSection";

// Check-in calls with the athlete whose profile the coach has open: book one
// (once, weekly or fortnightly), see whether the athlete confirmed or asked
// to move it, move it, or cancel it (coach_checkin_service.ts). Their
// package with the coach sits at the top (CoachAthletePackageSection).
const OPENED_EVENT = "kolosseum:coach-athlete-profile-opened";
const CLOSED_EVENT = "kolosseum:coach-athlete-profile-closed";

const STATUS_LABEL: Record<string, string> = {
  scheduled: "Waiting for them to confirm",
  confirmed: "Confirmed",
  move_requested: "Asked to move it"
};

const ERROR_MESSAGES: Record<string, string> = {
  checkin_whatsapp_number_missing: "Add your WhatsApp number under Account → Branding first.",
  checkin_teams_link_missing: "Add your Teams meeting link under Account → Branding first.",
  checkin_start_invalid: "Pick a time in the next year.",
  checkin_athlete_not_coached: "You no longer coach this athlete.",
  checkin_not_found: "That call has already been cancelled."
};

// A run of weekly calls is long on a phone: the next few, then the rest on request.
const SHOWN_AT_FIRST = 3;

const message = (error: unknown) => ERROR_MESSAGES[errorCode(error)] ?? "That didn't work. Try again.";

async function csrf(): Promise<string> {
  const account = await loadAccountDetail();
  return typeof account.csrf_token === "string" ? account.csrf_token : "";
}

export function CoachAthleteCheckinsPanel() {
  const [athleteUserId, setAthleteUserId] = useState<string | null>(null);
  const [checkins, setCheckins] = useState<JsonRecord[] | null>(null);
  const [settings, setSettings] = useState<JsonRecord>({});
  const [booking, setBooking] = useState(false);
  const [when, setWhen] = useState("");
  const [duration, setDuration] = useState("30");
  const [method, setMethod] = useState("whatsapp");
  const [repeat, setRepeat] = useState("none");
  const [occurrences, setOccurrences] = useState("6");
  const [note, setNote] = useState("");
  const [moving, setMoving] = useState<string | null>(null);
  const [moveTo, setMoveTo] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentDue, setPaymentDue] = useState(false);

  const show = useCallback((payload: JsonRecord) => {
    setCheckins(Array.isArray(payload.checkins) ? (payload.checkins as JsonRecord[]) : []);
    setSettings((payload.call_settings ?? {}) as JsonRecord);
  }, []);

  useEffect(() => {
    const opened = (event: Event) => {
      const id = ((event as CustomEvent).detail as { athlete_user_id?: string } | undefined)?.athlete_user_id;
      if (id) setAthleteUserId(id);
    };
    const closed = () => setAthleteUserId(null);
    document.addEventListener(OPENED_EVENT, opened);
    document.addEventListener(CLOSED_EVENT, closed);
    return () => {
      document.removeEventListener(OPENED_EVENT, opened);
      document.removeEventListener(CLOSED_EVENT, closed);
    };
  }, []);

  useEffect(() => {
    setCheckins(null);
    setBooking(false);
    setMoving(null);
    setError(null);
    setShowAll(false);
    setPaymentDue(false);
    if (!athleteUserId) return undefined;
    let live = true;
    loadAthleteCheckinsForCoach(athleteUserId).then((payload) => { if (live) show(payload); }, () => { if (live) setCheckins(null); });
    return () => { live = false; };
  }, [athleteUserId, show]);

  if (!athleteUserId || checkins === null) return null;

  async function act(action: (token: string) => Promise<JsonRecord>): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      show(await action(await csrf()));
      return true;
    }
    catch (caught) {
      setError(message(caught));
      return false;
    }
    finally {
      setBusy(false);
    }
  }

  async function book(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const startsAt = localInputToIso(when);
    if (!startsAt) {
      setError("Pick a date and time.");
      return;
    }
    const ok = await act((token) => scheduleCheckin({
      athlete_user_id: athleteUserId,
      starts_at: startsAt,
      duration_minutes: Number(duration),
      call_method: method,
      repeat,
      ...(repeat === "none" ? {} : { occurrences: Number(occurrences) }),
      ...(note.trim() ? { note: note.trim() } : {})
    }, token));
    if (ok) {
      setBooking(false);
      setWhen("");
      setNote("");
      setRepeat("none");
    }
  }

  const noLink = (method === "whatsapp" && !settings.whatsapp_number) || (method === "teams" && !settings.teams_link);

  return (
    <article className="panel" data-testid="coach-athlete-checkins">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Package and calls</p>
          <h3>Package and check-ins</h3>
          {paymentDue ? <span className="badge partial">Payment due</span> : null}
        </div>
        {!booking ? <button className="button secondary" type="button" onClick={() => setBooking(true)}>Book a check-in</button> : null}
      </div>
      {error ? <p className="field-error" role="alert">{error}</p> : null}
      <CoachAthletePackageSection athleteUserId={athleteUserId} upcomingCount={checkins.filter((c) => new Date(String(c.starts_at)).getTime() > Date.now()).length} onPaymentDue={setPaymentDue} onCheckinsChanged={() => {
        loadAthleteCheckinsForCoach(athleteUserId).then(show, () => undefined);
      }} />

      {booking ? (
        <form className="athlete-detail-note-form" onSubmit={book}>
          <label className="field">
            <span>Date and time</span>
            <input type="datetime-local" required value={when} onChange={(event) => setWhen(event.target.value)} />
          </label>
          <label className="field">
            <span>How</span>
            <select value={method} onChange={(event) => setMethod(event.target.value)}>
              <option value="whatsapp">WhatsApp call</option>
              <option value="teams">Teams call</option>
              <option value="in_person">In person</option>
            </select>
          </label>
          {noLink ? <p className="muted small" role="note">{method === "whatsapp" ? "Add your WhatsApp number under Account → Branding first." : "Add your Teams meeting link under Account → Branding first."}</p> : null}
          <label className="field">
            <span>Length</span>
            <select value={duration} onChange={(event) => setDuration(event.target.value)}>
              {["15", "30", "45", "60"].map((minutes) => <option key={minutes} value={minutes}>{`${minutes} minutes`}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Repeat</span>
            <select value={repeat} onChange={(event) => setRepeat(event.target.value)}>
              <option value="none">Just once</option>
              <option value="weekly">Every week</option>
              <option value="fortnightly">Every 2 weeks</option>
            </select>
          </label>
          {repeat !== "none" ? (
            <label className="field">
              <span>How many calls</span>
              <input type="number" min={2} max={12} value={occurrences} onChange={(event) => setOccurrences(event.target.value)} />
            </label>
          ) : null}
          <label className="field">
            <span>What it's about (optional)</span>
            <input type="text" maxLength={300} placeholder="Review the block, plan the next one" value={note} onChange={(event) => setNote(event.target.value)} />
          </label>
          <div className="inline-controls">
            <button className="button primary" type="submit" disabled={busy || noLink}>Book</button>
            <button className="button secondary" type="button" disabled={busy} onClick={() => setBooking(false)}>Cancel</button>
          </div>
        </form>
      ) : null}

      {checkins.length === 0 && !booking ? <p className="muted small">No check-ins booked.</p> : null}
      <div className="record-list">
        {(showAll ? checkins : checkins.slice(0, SHOWN_AT_FIRST)).map((checkin) => {
          const id = String(checkin.checkin_id);
          // The coach joins their own Teams meeting; a WhatsApp call they
          // make to the athlete themselves (the link is the coach's number).
          const teams = checkin.teams_link ? String(checkin.teams_link) : null;
          return (
            <article className="record-row" key={id}>
              <div>
                <strong>{checkinWhen(checkin.starts_at)}</strong>
                <p className="muted small">{`${METHOD_LABEL[String(checkin.call_method)] ?? ""} · ${String(checkin.duration_minutes)} min${checkin.series_id ? " · repeating" : ""}`}</p>
                <p className="muted small">{checkin.booked_by === "athlete" ? "They booked this" : STATUS_LABEL[String(checkin.status)] ?? ""}</p>
                {checkin.athlete_message ? <p className="small">{`“${String(checkin.athlete_message)}”`}</p> : null}
                {checkin.note ? <p className="muted small">{String(checkin.note)}</p> : null}
                {moving === id ? (
                  <form className="inline-controls" onSubmit={(event) => {
                    event.preventDefault();
                    const iso = localInputToIso(moveTo);
                    if (!iso) return;
                    void act((token) => moveCheckin(id, iso, token)).then((ok) => { if (ok) setMoving(null); });
                  }}>
                    <input type="datetime-local" required aria-label="New date and time" value={moveTo} onChange={(event) => setMoveTo(event.target.value)} />
                    <button className="button primary small" type="submit" disabled={busy}>Move</button>
                    <button className="button secondary small" type="button" onClick={() => setMoving(null)}>Keep</button>
                  </form>
                ) : null}
              </div>
              <div className="inline-controls">
                {teams ? <a className="button secondary small" href={teams} target="_blank" rel="noopener noreferrer">Join on Teams</a> : null}
                <button className="button secondary small" type="button" onClick={() => downloadCalendarFile(checkin, "Check-in call")}>Add to calendar</button>
                <button className="button secondary small" type="button" disabled={busy} onClick={() => { setMoving(id); setMoveTo(""); }}>Move</button>
                <button className="button secondary small" type="button" disabled={busy} onClick={() => void act((token) => cancelCheckin(id, false, token))}>Cancel</button>
                {checkin.series_id ? <button className="button secondary small" type="button" disabled={busy} onClick={() => void act((token) => cancelCheckin(id, true, token))}>Cancel this and later</button> : null}
              </div>
            </article>
          );
        })}
      </div>
      {!showAll && checkins.length > SHOWN_AT_FIRST ? (
        <button className="button secondary small" type="button" onClick={() => setShowAll(true)}>{`Show all ${checkins.length} calls`}</button>
      ) : null}
    </article>
  );
}
