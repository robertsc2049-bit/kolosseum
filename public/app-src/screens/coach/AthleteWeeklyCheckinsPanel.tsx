import React from "react";

import { type JsonRecord } from "../../api/transport";
import { formatDate } from "../../utils/format";
import { useAthleteWeeklyCheckins } from "./useAthleteWeeklyCheckins";

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

export function AthleteWeeklyCheckinsPanel() {
  const { athleteUserId, loading, error, checkins } = useAthleteWeeklyCheckins();

  if (!athleteUserId) return null;

  if (loading && checkins.length === 0) {
    return <p className="muted small">Loading weekly check-ins…</p>;
  }

  if (error) {
    return <p role="status" className="muted small error">{error}</p>;
  }

  if (checkins.length === 0) {
    return (
      <div className="empty-state compact-empty">
        <p>No weekly check-ins yet.</p>
      </div>
    );
  }

  return (
    <>
      {checkins.map((checkin) => (
        <WeeklyCheckinCard key={String(checkin.week_start_date)} checkin={checkin} />
      ))}
    </>
  );
}
