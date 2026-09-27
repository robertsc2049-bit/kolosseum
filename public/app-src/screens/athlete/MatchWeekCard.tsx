import React, { useEffect, useState } from "react";

import { loadMatchWeek, saveMatchWeek } from "../../api/athleteOnboardingClient";
import { loadAccountDetail } from "../../api/client";
import { type JsonRecord } from "../../api/transport";

// The athlete's match week: the days they usually play, race or have a key
// session, plus one-off fixtures. Sessions on match day and the day before
// become a short primer (no heavy leg work); the day after, recovery.

const DAYS: Array<[string, string]> = [["mon", "Mon"], ["tue", "Tue"], ["wed", "Wed"], ["thu", "Thu"], ["fri", "Fri"], ["sat", "Sat"], ["sun", "Sun"]];
type Fixture = { date: string; label: string };

export function MatchWeekCard() {
  const [days, setDays] = useState<string[]>([]);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [newDate, setNewDate] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function apply(result: JsonRecord) {
    setDays(Array.isArray(result.match_days) ? result.match_days.map(String) : []);
    setFixtures(Array.isArray(result.fixtures) ? (result.fixtures as JsonRecord[]).map((f) => ({ date: String(f.date), label: String(f.label) })) : []);
  }

  useEffect(() => {
    let cancelled = false;
    loadMatchWeek()
      .then((result) => { if (!cancelled) apply(result); })
      .catch(() => { if (!cancelled) setError("Your match week could not be loaded. Try again."); })
      .finally(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, []);

  function toggle(day: string) {
    setSaved(false);
    setDays((current) => (current.includes(day) ? current.filter((d) => d !== day) : [...current, day]));
  }

  function addFixture() {
    if (!newDate) return;
    setSaved(false);
    setFixtures((current) => [...current.filter((f) => f.date !== newDate), { date: newDate, label: newLabel.trim() || "Fixture" }].sort((a, b) => a.date.localeCompare(b.date)));
    setNewDate("");
    setNewLabel("");
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const account = await loadAccountDetail();
      const csrf = typeof account.csrf_token === "string" ? account.csrf_token : "";
      apply(await saveMatchWeek({ match_days: days, fixtures }, csrf));
      setSaved(true);
    }
    catch {
      setError("Your match week could not be saved. Check the dates and try again.");
    }
    finally {
      setSaving(false);
    }
  }

  if (!loaded) return null;

  return (
    <article className="onboarding-card match-week" data-testid="match-week">
      <p className="eyebrow">Your match week</p>
      <h3>Matches, races and key sessions</h3>
      <p className="muted">Sessions on match day and the day before become a short primer with no heavy leg work; the day after, a recovery session.</p>
      {error ? <p className="field-error" role="alert">{error}</p> : null}
      {saved ? <p className="muted" role="status">Your match week is saved.</p> : null}
      <fieldset className="match-days">
        <legend>Usual match or key-session days</legend>
        {DAYS.map(([day, label]) => (
          <label key={day} className="match-day">
            <input type="checkbox" checked={days.includes(day)} onChange={() => toggle(day)} />
            <span>{label}</span>
          </label>
        ))}
      </fieldset>
      <fieldset className="match-fixtures">
        <legend>One-off fixtures</legend>
        {fixtures.length ? (
          <ul>
            {fixtures.map((f) => (
              <li key={f.date}>
                <span>{`${f.date} - ${f.label}`}</span>
                <button className="button secondary" type="button" onClick={() => { setSaved(false); setFixtures((current) => current.filter((x) => x.date !== f.date)); }}>Remove</button>
              </li>
            ))}
          </ul>
        ) : <p className="muted">No one-off fixtures.</p>}
        <label className="field"><span>Date</span><input type="date" aria-label="Fixture date" value={newDate} onChange={(event) => setNewDate(event.target.value)} /></label>
        <label className="field"><span>Name (optional)</span><input aria-label="Fixture name" maxLength={60} value={newLabel} onChange={(event) => setNewLabel(event.target.value)} /></label>
        <button className="button secondary" type="button" disabled={!newDate} onClick={addFixture}>Add fixture</button>
      </fieldset>
      <div className="onboarding-actions">
        <button className="button primary" type="button" disabled={saving} onClick={() => void save()}>Save match week</button>
      </div>
    </article>
  );
}
