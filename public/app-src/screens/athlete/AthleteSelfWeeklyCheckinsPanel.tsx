import React, { useState } from "react";

import { type JsonRecord } from "../../api/transport";
import { formatDate } from "../../utils/format";
import { useWeeklyCheckins } from "./useWeeklyCheckins";

// DEV NOTE: FULL-UI-64 athlete's own weekly check-in - ported from app.js's
// defaultWeeklyCheckinWeekStartDate()/renderWeeklyCheckinCard()/
// renderWeeklyCheckinList()/refreshWeeklyCheckins()/submitWeeklyCheckin().
// Named "Self" (and mounted into athlete-self-weekly-checkins-root) to
// avoid colliding with the already-shipped, unrelated coach-facing
// read-only mirror of the same domain (screens/coach/
// AthleteWeeklyCheckinsPanel.tsx, viewing another athlete's check-ins).

function defaultWeekStartDate(): string {
  const now = new Date();
  const isoDayOfWeek = (now.getUTCDay() + 6) % 7;
  const monday = new Date(now.getTime() - isoDayOfWeek * 86400000);
  return monday.toISOString().slice(0, 10);
}

function WeeklyCheckinCard({ checkin }: { checkin: JsonRecord }) {
  return (
    <article className="record-card">
      <div className="record-meta">
        <span className="muted small">Week of {formatDate(checkin.week_start_date)}</span>
      </div>
      <p className="muted small">
        Energy {String(checkin.energy_level)}/5 · Motivation {String(checkin.motivation_level)}/5 · Sleep {String(checkin.sleep_quality)}/5
      </p>
      {checkin.note ? <p>{String(checkin.note)}</p> : null}
    </article>
  );
}

export function AthleteSelfWeeklyCheckinsPanel() {
  const { loading, checkins, submitting, submitError, submit } = useWeeklyCheckins();
  const [weekStartDate, setWeekStartDate] = useState(defaultWeekStartDate());
  const [energyLevel, setEnergyLevel] = useState("");
  const [motivationLevel, setMotivationLevel] = useState("");
  const [sleepQuality, setSleepQuality] = useState("");
  const [note, setNote] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!weekStartDate || energyLevel === "" || motivationLevel === "" || sleepQuality === "") {
      setValidationError("Enter a week and all three ratings.");
      setConfirmation(null);
      return;
    }

    setValidationError(null);

    const ok = await submit({
      week_start_date: weekStartDate,
      energy_level: Number(energyLevel),
      motivation_level: Number(motivationLevel),
      sleep_quality: Number(sleepQuality),
      note: note.trim() || undefined
    });

    if (ok) {
      setEnergyLevel("");
      setMotivationLevel("");
      setSleepQuality("");
      setNote("");
      setWeekStartDate(defaultWeekStartDate());
      setConfirmation("Check-in submitted.");
    }
  }

  const statusText = validationError ?? submitError ?? confirmation;

  return (
    <div className="panel weekly-checkin-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Weekly check-in</p>
          <h3>Weekly check-in</h3>
        </div>
      </div>

      <form className="athlete-detail-note-form" onSubmit={handleSubmit}>
        <label className="field">
          <span>Week starting</span>
          <input type="date" required value={weekStartDate} onChange={(event) => setWeekStartDate(event.target.value)} />
        </label>

        <label className="field">
          <span>Energy (1-5)</span>
          <input type="number" min={1} max={5} step={1} required value={energyLevel} onChange={(event) => setEnergyLevel(event.target.value)} />
        </label>

        <label className="field">
          <span>Motivation (1-5)</span>
          <input type="number" min={1} max={5} step={1} required value={motivationLevel} onChange={(event) => setMotivationLevel(event.target.value)} />
        </label>

        <label className="field">
          <span>Sleep quality (1-5)</span>
          <input type="number" min={1} max={5} step={1} required value={sleepQuality} onChange={(event) => setSleepQuality(event.target.value)} />
        </label>

        <label className="field">
          <span>Note (optional)</span>
          <input type="text" maxLength={280} value={note} onChange={(event) => setNote(event.target.value)} />
        </label>

        <div className="inline-controls">
          <button className="button primary" type="submit" disabled={submitting}>Submit check-in</button>
        </div>
      </form>

      {statusText ? <p className="dashboard-status" role="status" aria-live="polite">{statusText}</p> : null}

      <div className="record-list">
        {loading && checkins.length === 0 ? (
          <div className="empty-state compact-empty"><p>Loading weekly check-ins…</p></div>
        ) : checkins.length === 0 ? (
          <div className="empty-state compact-empty"><p>No weekly check-ins yet.</p></div>
        ) : (
          checkins.map((checkin) => (
            <WeeklyCheckinCard key={String(checkin.week_start_date)} checkin={checkin} />
          ))
        )}
      </div>
    </div>
  );
}
