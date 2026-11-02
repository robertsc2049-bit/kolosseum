import React, { useCallback, useEffect, useState } from "react";

import { loadCallSettings, saveCallSettings } from "../../api/checkinsClient";
import { loadAccountDetail } from "../../api/client";
import { type JsonRecord } from "../../api/transport";
import { errorCode } from "../../utils/checkins";

// How a coach's athletes reach them for a check-in call: their WhatsApp
// number and/or a Teams meeting link (a recurring meeting link made in
// Teams works for every call). Only athletes they've booked a call with see
// these, on that call.
const ERROR_MESSAGES: Record<string, string> = {
  checkin_whatsapp_number_invalid: "Enter your WhatsApp number with the country code, e.g. +44 7700 900123.",
  checkin_teams_link_invalid: "Paste a meeting link from Teams (it starts https://teams.microsoft.com or https://teams.live.com)."
};

export function CoachCallSettingsPanel() {
  const [whatsapp, setWhatsapp] = useState("");
  const [teams, setTeams] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const show = useCallback((payload: JsonRecord) => {
    const settings = (payload.call_settings ?? {}) as JsonRecord;
    setWhatsapp(settings.whatsapp_number ? `+${String(settings.whatsapp_number)}` : "");
    setTeams(String(settings.teams_link ?? ""));
    setLoaded(true);
  }, []);

  const refresh = useCallback(async () => {
    try {
      show(await loadCallSettings());
    }
    catch {
      setLoaded(false);
    }
  }, [show]);

  useEffect(() => {
    refresh();
    document.addEventListener("kolosseum:account-role-known", refresh);
    return () => document.removeEventListener("kolosseum:account-role-known", refresh);
  }, [refresh]);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const account = await loadAccountDetail();
      show(await saveCallSettings({ whatsapp_number: whatsapp.trim(), teams_link: teams.trim() }, typeof account.csrf_token === "string" ? account.csrf_token : ""));
      setNotice("Saved.");
    }
    catch (caught) {
      setError(ERROR_MESSAGES[errorCode(caught)] ?? "That didn't save. Try again.");
    }
    finally {
      setBusy(false);
    }
  }

  if (!loaded) return null;

  return (
    <section className="panel" aria-labelledby="coachCallSettingsHeading" data-testid="coach-call-settings">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Check-in calls</p>
          <h3 id="coachCallSettingsHeading">How athletes reach you for a call</h3>
          <p className="muted">When you book a check-in on WhatsApp or Teams, your athlete gets a button that opens your WhatsApp chat or your Teams meeting. Only athletes you've booked a call with see these.</p>
        </div>
      </div>
      <form className="athlete-detail-note-form" onSubmit={save}>
        <label className="field">
          <span>WhatsApp number (with country code)</span>
          <input type="tel" inputMode="tel" autoComplete="tel" placeholder="+44 7700 900123" value={whatsapp} onChange={(event) => setWhatsapp(event.target.value)} />
        </label>
        <label className="field">
          <span>Teams meeting link</span>
          <input type="url" placeholder="https://teams.microsoft.com/l/meetup-join/..." aria-describedby="coachTeamsLinkHint" value={teams} onChange={(event) => setTeams(event.target.value)} />
        </label>
        <p id="coachTeamsLinkHint" className="muted small">Make a recurring meeting in Teams and paste its link - it works for every call.</p>
        {error ? <p className="field-error" role="alert">{error}</p> : null}
        <div className="inline-controls">
          <button className="button primary" type="submit" disabled={busy}>Save</button>
          {notice ? <span className="muted small" role="status">{notice}</span> : null}
        </div>
      </form>
    </section>
  );
}
