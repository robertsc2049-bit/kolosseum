import React, { useEffect, useState } from "react";

import { requestCoachingViaLink } from "../../api/athleteOnboardingClient";
import { loadSharedCoachCard } from "../../api/coachBrandingClient";
import { loadAccountDetail } from "../../api/client";
import { type JsonRecord } from "../../api/transport";
import { clearPendingCoach, usePendingCoach } from "../../utils/pendingCoach";
import { useRole } from "../../utils/role";

// Someone who followed a coach's share link (/c/<slug>) and is now signed
// in as an athlete: offer to send that coach a coaching request. Nothing
// is sent until they tap Ask.
export function CoachLinkRequestCard() {
  const isAthlete = useRole() === "athlete";
  const slug = usePendingCoach();
  const [coach, setCoach] = useState<JsonRecord | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCoach(null);
    if (!isAthlete || !slug) return;
    let live = true;
    loadSharedCoachCard(slug).then(
      (payload) => { if (live) setCoach((payload.coach ?? null) as JsonRecord | null); },
      // The link was switched off or changed: nothing to offer.
      () => { if (live) clearPendingCoach(); }
    );
    return () => { live = false; };
  }, [isAthlete, slug]);

  if (done) {
    return (
      <article className="panel" data-testid="coach-link-request-card">
        <p role="status">{done}</p>
        <button className="button secondary small" type="button" onClick={() => setDone(null)}>OK</button>
      </article>
    );
  }
  if (!isAthlete || !slug || !coach) return null;

  const name = String(coach.display_name ?? "This coach");
  const label = coach.business_name ? `${name} · ${String(coach.business_name)}` : name;

  async function ask() {
    setBusy(true);
    setError(null);
    try {
      const account = await loadAccountDetail();
      await requestCoachingViaLink(slug, note.trim(), typeof account.csrf_token === "string" ? account.csrf_token : "");
      clearPendingCoach();
      setDone(`Asked - ${name} will invite you if they can take you on. Their invitation shows on your Account page.`);
    }
    catch (caught) {
      const code = String(((caught as { payload?: JsonRecord }).payload ?? {}).error ?? "");
      if (code === "coaching_request_already_coached" || code === "coaching_request_already_sent" || code === "coaching_request_self_not_allowed") {
        clearPendingCoach();
        setDone(code === "coaching_request_already_coached" ? `${name} already coaches you.` : code === "coaching_request_already_sent" ? `You've already asked ${name}.` : "That's your own link.");
      }
      else if (code === "coaching_request_coach_not_found") {
        clearPendingCoach();
        setDone(`${name}'s link isn't available any more.`);
      }
      else {
        setError("Your request couldn't be sent. Try again.");
      }
    }
    finally {
      setBusy(false);
    }
  }

  return (
    <article className="panel coach-link-request" data-testid="coach-link-request-card" style={coach.brand_color ? { borderTop: `4px solid ${String(coach.brand_color)}` } : undefined}>
      <p className="eyebrow">You followed a coach's link</p>
      <h3>{`Ask ${label} to coach you?`}</h3>
      {coach.tagline ? <p className="muted">{String(coach.tagline)}</p> : null}
      <label className="field">
        <span>A line about you and your goals (optional)</span>
        <input type="text" maxLength={300} value={note} onChange={(event) => setNote(event.target.value)} />
      </label>
      {error ? <p className="field-error" role="alert">{error}</p> : null}
      <div className="inline-controls">
        <button className="button primary" type="button" disabled={busy} onClick={() => void ask()}>Ask to coach me</button>
        <button className="button secondary" type="button" disabled={busy} onClick={() => clearPendingCoach()}>Not now</button>
      </div>
    </article>
  );
}
