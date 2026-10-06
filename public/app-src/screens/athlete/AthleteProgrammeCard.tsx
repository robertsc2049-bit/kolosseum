import React, { useEffect, useState } from "react";

import { loadAthleteProgrammes, setAthleteProgramme } from "../../api/athleteOnboardingClient";
import { loadAccountDetail } from "../../api/client";
import { type JsonRecord } from "../../api/transport";
import { titleCase } from "../../utils/format";

// Kolosseum programmes (src/api/programme_catalogue_service.ts): coach-written
// programmes an athlete without a coach runs. Shows the one they're running
// and the ones that suit them - their sport's own first, then general ones -
// to start, switch to or stop. Once they finish one, it offers the programme
// its coach says comes next (or running it again).

type Fit = {
  weeks_total: number;
  days: { programme: number; athlete: number } | null;
  competition: { date: string; weeks_away: number; start_on: string; timing: "too_late" | "on_time" | "too_early" } | null;
};
type Option = { listing_id: string; title: string; summary: string; levels: string[]; activity_ids: string[]; days_per_week: number; sport_specific: boolean; fit: Fit | null };

const dayLabel = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

// How a programme fits the athlete: their training days, and when to start a
// programme that ends in a taper for their competition.
export function fitNotes(fit: Fit | null): { text: string; caution: boolean }[] {
  if (!fit) return [];
  const notes: { text: string; caution: boolean }[] = [];
  if (fit.days) {
    notes.push({ caution: true, text: `${fit.days.programme} days a week - you said you train ${fit.days.athlete}, so it will take longer than ${fit.weeks_total} weeks.` });
  }
  const c = fit.competition;
  if (c && c.timing === "too_late") {
    notes.push({ caution: true, text: `Your competition is in ${c.weeks_away} weeks; this is ${/^(8|11|18)(D|$)/u.test(String(fit.weeks_total)) ? "an" : "a"} ${fit.weeks_total}-week programme, so it won't peak on the day.` });
  }
  else if (c && c.timing === "too_early") {
    notes.push({ caution: true, text: `Your competition is in ${c.weeks_away} weeks: start this the week of ${dayLabel(c.start_on)} so it peaks on ${dayLabel(c.date)}.` });
  }
  else if (c) {
    notes.push({ caution: false, text: `Start now and it peaks for your competition on ${dayLabel(c.date)}.` });
  }
  return notes;
}

const asOptions = (value: unknown): Option[] => (Array.isArray(value) ? (value as JsonRecord[]) : []).map((o) => ({
  listing_id: String(o.listing_id), title: String(o.title ?? ""), summary: String(o.summary ?? ""),
  levels: Array.isArray(o.levels) ? o.levels.map(String) : [], activity_ids: Array.isArray(o.activity_ids) ? o.activity_ids.map(String) : [],
  days_per_week: Number(o.days_per_week) || 0, sport_specific: o.sport_specific === true,
  fit: o.fit && typeof o.fit === "object" ? (o.fit as unknown as Fit) : null
}));

// "Week 7 of 12 · Heavy strength" - where the athlete's next session sits.
export function programmePositionLine(position: unknown): string | null {
  if (!position || typeof position !== "object") return null;
  const p = position as JsonRecord;
  const week = Number(p.week_number);
  const weeks = Number(p.weeks_total);
  if (!week || !weeks) return null;
  const block = String(p.block_name ?? "").trim();
  const lighter = p.block_type === "deload" ? " (lighter)" : "";
  return [`Week ${week} of ${weeks}`, block ? `${block}${lighter}` : lighter.trim()].filter(Boolean).join(" · ");
}

const finishedLine = (total: number) => (total === 1 ? "Finished. Choose what to train next." : `Finished - all ${total} sessions done. Choose what to train next.`);
// "amateur and pro", "beginner, amateur and pro".
const levelList = (levels: string[]) => {
  const words = levels.map((l) => l.toLowerCase());
  return words.length <= 1 ? words.join("") : `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
};

export function AthleteProgrammeCard() {
  const [data, setData] = useState<JsonRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [browsing, setBrowsing] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadAthleteProgrammes()
      .then((result) => { if (!cancelled) setData(result); })
      .catch(() => { if (!cancelled) setError("Your programme could not be loaded. Try again."); });
    return () => { cancelled = true; };
  }, []);

  async function choose(listingId: string | null) {
    setBusy(true);
    setError(null);
    try {
      const account = await loadAccountDetail();
      const csrf = typeof account.csrf_token === "string" ? account.csrf_token : "";
      setData(await setAthleteProgramme(listingId, csrf));
      setBrowsing(false);
      setConfirming(null);
    }
    catch {
      setError(listingId ? "That programme could not be started. Try again." : "Your programme could not be stopped. Try again.");
    }
    finally {
      setBusy(false);
    }
  }

  if (!data && !error) return null;
  const current = data?.current && typeof data.current === "object" ? (data.current as JsonRecord) : null;
  const options = asOptions(data?.options).filter((o) => o.listing_id !== current?.listing_id);
  const finished = current?.finished === true;
  const next = finished && current?.next && typeof current.next === "object" ? (current.next as JsonRecord) : null;
  const showOptions = !current || browsing;

  return (
    <article className="onboarding-card athlete-programme" data-testid="athlete-programme">
      <p className="eyebrow">Your programme</p>
      <h3>{current ? String(current.title) : "Choose your programme"}</h3>
      {error ? <p className="field-error" role="alert">{error}</p> : null}
      {current && finished ? (
        <>
          <p className="muted">{finishedLine(Number(current.sessions_total ?? 0))}</p>
          {next ? (
            <div className="programme-option programme-next" data-testid="programme-next">
              <p className="eyebrow">Next</p>
              <strong>{String(next.title)}</strong>
              <p className="muted small">{`${Number(next.days_per_week) || 0} days a week`}</p>
              {next.summary ? <p>{String(next.summary)}</p> : null}
              {next.suits_level === true ? (
                <button className="button primary" type="button" disabled={busy} onClick={() => void choose(String(next.listing_id))}>{`Start ${String(next.title)}`}</button>
              ) : (
                <p className="muted small">
                  {`It's for ${levelList(Array.isArray(next.levels) ? next.levels.map(String) : [])} athletes. When you're ready to move up, change your training level in your setup, then start it here.`}
                </p>
              )}
            </div>
          ) : null}
          <div className="onboarding-actions">
            {current.can_repeat === true ? (
              <button className="button secondary" type="button" disabled={busy} onClick={() => void choose(String(current.listing_id))}>Run it again</button>
            ) : null}
            {options.length > 0 ? (
              <button className="button secondary" type="button" onClick={() => setBrowsing(!browsing)}>{browsing ? "Hide other programmes" : "Choose a different programme"}</button>
            ) : null}
          </div>
        </>
      ) : current ? (
        <>
          {programmePositionLine(current.next_position) ? (
            <p className="programme-position" data-testid="programme-position">{programmePositionLine(current.next_position)}</p>
          ) : null}
          <p className="muted">
            {`${Number(current.sessions_done ?? 0)} of ${Number(current.sessions_total ?? 0)} sessions done. Your sessions follow this programme in order.`}
          </p>
          {confirming === "stop" ? (
            <div className="inline-result" data-tone="warning">
              <p>Stop this programme? You'll choose what to train next before your next session.</p>
              <div className="button-row">
                <button className="button secondary" type="button" disabled={busy} onClick={() => void choose(null)}>Stop programme</button>
                <button className="button secondary" type="button" onClick={() => setConfirming(null)}>Keep it</button>
              </div>
            </div>
          ) : (
            <div className="onboarding-actions">
              {options.length > 0 ? <button className="button secondary" type="button" onClick={() => setBrowsing(!browsing)}>{browsing ? "Hide other programmes" : "Switch programme"}</button> : null}
              <button className="button secondary" type="button" onClick={() => setConfirming("stop")}>Stop programme</button>
            </div>
          )}
        </>
      ) : (
        <p className="muted">
          {options.length > 0
            ? "Programmes written by coaches for your level - your sessions then follow the programme you choose."
            : "There are no Kolosseum programmes for your level yet - your sessions come from your generated programme for now."}
        </p>
      )}
      {showOptions && options.length > 0 ? (
        <ul className="programme-options">
          {options.map((option) => (
            <li className="programme-option" key={option.listing_id}>
              <div className="programme-option-head">
                <strong>{option.title}</strong>
                <span className="badge neutral">{option.sport_specific ? option.activity_ids.map((id) => titleCase(id)).join(", ") : "Any sport"}</span>
              </div>
              <p className="muted small">{`${option.days_per_week} days a week · ${option.levels.map((l) => titleCase(l)).join(", ")}`}</p>
              {fitNotes(option.fit).map((note) => (
                <p key={note.text} className={note.caution ? "programme-fit small" : "muted small"} data-tone={note.caution ? "warning" : undefined}>{note.text}</p>
              ))}
              {option.summary ? <p>{option.summary}</p> : null}
              {current && !finished && confirming === option.listing_id ? (
                <div className="inline-result" data-tone="warning">
                  <p>{`Switch to ${option.title}? Your progress on ${String(current.title)} ends.`}</p>
                  <div className="button-row">
                    <button className="button primary" type="button" disabled={busy} onClick={() => void choose(option.listing_id)}>Switch</button>
                    <button className="button secondary" type="button" onClick={() => setConfirming(null)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <button
                  className="button primary"
                  type="button"
                  disabled={busy}
                  onClick={() => (current && !finished ? setConfirming(option.listing_id) : void choose(option.listing_id))}
                >
                  {`Start ${option.title}`}
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}
