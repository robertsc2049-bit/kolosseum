import React, { useEffect, useState } from "react";

import { loadAthleteProgrammes, setAthleteProgramme } from "../../api/athleteOnboardingClient";
import { loadAccountDetail } from "../../api/client";
import { type JsonRecord } from "../../api/transport";
import { titleCase } from "../../utils/format";

// Kolosseum programmes (src/api/programme_catalogue_service.ts): coach-written
// programmes an athlete without a coach runs. Shows the one they're running
// and the ones that suit them - their sport's own first, then general ones -
// to start, switch to or stop.

type Option = { listing_id: string; title: string; summary: string; levels: string[]; activity_ids: string[]; days_per_week: number; sport_specific: boolean };

const asOptions = (value: unknown): Option[] => (Array.isArray(value) ? (value as JsonRecord[]) : []).map((o) => ({
  listing_id: String(o.listing_id), title: String(o.title ?? ""), summary: String(o.summary ?? ""),
  levels: Array.isArray(o.levels) ? o.levels.map(String) : [], activity_ids: Array.isArray(o.activity_ids) ? o.activity_ids.map(String) : [],
  days_per_week: Number(o.days_per_week) || 0, sport_specific: o.sport_specific === true
}));

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
  const showOptions = !current || browsing;

  return (
    <article className="onboarding-card athlete-programme" data-testid="athlete-programme">
      <p className="eyebrow">Your programme</p>
      <h3>{current ? String(current.title) : "Choose your programme"}</h3>
      {error ? <p className="field-error" role="alert">{error}</p> : null}
      {current ? (
        <>
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
              {option.summary ? <p>{option.summary}</p> : null}
              {current && confirming === option.listing_id ? (
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
                  onClick={() => (current ? setConfirming(option.listing_id) : void choose(option.listing_id))}
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
