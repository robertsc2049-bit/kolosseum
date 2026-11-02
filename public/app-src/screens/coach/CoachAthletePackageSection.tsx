import React, { useEffect, useState } from "react";

import { cancelUpcomingForUnpaid, endAthletePackage, loadAthletePackage, recordPackagePayment, startAthletePackage } from "../../api/checkinsClient";
import { loadAccountDetail } from "../../api/client";
import { type JsonRecord } from "../../api/transport";
import { errorCode } from "../../utils/checkins";
import { dayLabel, paidLabel, periodLine, usageLines } from "../../utils/packages";

// The athlete's package with this coach, inside their check-ins: put them on
// one of the coach's packages (or a gym package they deliver), record
// payments made outside the app, see what's been used this period, end it -
// and, when payment is due, cancel every upcoming call and in-person session
// in one go (package_membership_service.ts). While payment is due the
// athlete can't book the coach's open slots.
const ERRORS: Record<string, string> = {
  package_membership_not_found: "They're not on a package any more.",
  package_payment_not_due: "Payment isn't due - nothing was cancelled.",
  checkin_athlete_not_coached: "You no longer coach this athlete."
};

function message(error: unknown): string {
  const fieldErrors = (((error as { payload?: JsonRecord }).payload ?? {}).field_errors ?? {}) as JsonRecord;
  return Object.values(fieldErrors).map(String)[0] ?? ERRORS[errorCode(error)] ?? "That didn't work. Try again.";
}

// Today in the coach's own time zone, for the date input.
const todayInput = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

export function CoachAthletePackageSection({ athleteUserId, upcomingCount, onCheckinsChanged, onPaymentDue }: {
  athleteUserId: string;
  // Upcoming calls and in-person sessions booked with them (the panel's list).
  upcomingCount: number;
  onCheckinsChanged: () => void;
  onPaymentDue?: (due: boolean) => void;
}) {
  const [data, setData] = useState<JsonRecord | null>(null);
  const [mode, setMode] = useState<"view" | "choose" | "pay" | "cancel" | "end">("view");
  const [packageId, setPackageId] = useState("");
  const [startedOn, setStartedOn] = useState(todayInput());
  const [paidNow, setPaidNow] = useState(true);
  const [paidUntil, setPaidUntil] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    setMode("view");
    setError(null);
    setNotice(null);
    let live = true;
    loadAthletePackage(athleteUserId).then((payload) => { if (live) setData(payload); }, () => { if (live) setData(null); });
    return () => { live = false; };
  }, [athleteUserId]);

  const due = !!(data?.membership as JsonRecord | null | undefined)?.payment_due;
  useEffect(() => { onPaymentDue?.(due); }, [due, onPaymentDue]);

  if (!data) return null;
  const membership = (data.membership ?? null) as JsonRecord | null;
  const options = Array.isArray(data.options) ? (data.options as JsonRecord[]) : [];
  const chosen = options.find((option) => String(option.package_id) === packageId) ?? options[0];
  const pkg = (membership?.package ?? {}) as JsonRecord;
  const oneOff = String(pkg.billing) === "one_off";

  async function act(action: (token: string) => Promise<JsonRecord>): Promise<JsonRecord | null> {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const account = await loadAccountDetail();
      const payload = await action(typeof account.csrf_token === "string" ? account.csrf_token : "");
      setData(payload);
      setMode("view");
      // The athlete list shows each athlete's package and payment due.
      document.dispatchEvent(new Event("kolosseum:athlete-directory-changed"));
      return payload;
    }
    catch (caught) {
      setError(message(caught));
      return null;
    }
    finally {
      setBusy(false);
    }
  }

  function openChoose() {
    setPackageId(String(options[0]?.package_id ?? ""));
    setStartedOn(todayInput());
    setPaidNow(true);
    setMode("choose");
  }

  return (
    <div className="athlete-package" data-testid="coach-athlete-package">
      <p className="eyebrow">Package</p>
      {error ? <p className="field-error" role="alert">{error}</p> : null}
      {notice ? <p className="muted small" role="status">{notice}</p> : null}

      {membership && mode !== "choose" ? (
        <div>
          <strong>{String(pkg.name)}</strong>
          <span className="muted">{` ${String(pkg.price_label ?? "")}${pkg.gym_name ? ` · at ${String(pkg.gym_name)}` : ""}`}</span>
          <p className={membership.payment_due ? "field-error" : "muted small"}>{paidLabel(membership)}</p>
          {periodLine(membership) ? <p className="muted small">{periodLine(membership)}</p> : null}
          {usageLines(membership).map((line) => <p className="muted small" key={line}>{line}</p>)}
          {membership.payment_due ? <p className="muted small">They can't book your open slots until you record a payment.</p> : null}
        </div>
      ) : null}
      {!membership && mode !== "choose" ? (
        <p className="muted small">{options.length ? "Not on a package." : "Add packages under Account → Branding to put athletes on one."}</p>
      ) : null}

      {mode === "choose" ? (
        <form className="athlete-detail-note-form" onSubmit={(event) => {
          event.preventDefault();
          if (chosen) void act((token) => startAthletePackage(athleteUserId, { package_id: String(chosen.package_id), started_on: startedOn, paid_now: paidNow }, token));
        }}>
          <label className="field">
            <span>Package</span>
            <select value={String(chosen?.package_id ?? "")} onChange={(event) => setPackageId(event.target.value)}>
              {options.map((option) => (
                <option key={String(option.package_id)} value={String(option.package_id)}>
                  {`${String(option.name)} - ${String(option.price_label)}${option.gym_name ? ` (${String(option.gym_name)})` : ""}`}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Starts</span>
            <input type="date" required value={startedOn} onChange={(event) => setStartedOn(event.target.value)} />
          </label>
          <label className="checkbox-row">
            <input type="checkbox" checked={paidNow} onChange={(event) => setPaidNow(event.target.checked)} />
            <span>{String(chosen?.billing) === "one_off" ? "They've paid in full" : `They've paid for the first ${String(chosen?.billing) === "weekly" ? "week" : "month"}`}</span>
          </label>
          <div className="inline-controls">
            <button className="button primary" type="submit" disabled={busy || !chosen}>Save</button>
            <button className="button secondary" type="button" onClick={() => setMode("view")}>Cancel</button>
          </div>
        </form>
      ) : null}

      {mode === "pay" ? (
        <form className="athlete-detail-note-form" onSubmit={(event) => { event.preventDefault(); void act((token) => recordPackagePayment(athleteUserId, paidUntil, token)); }}>
          <label className="field">
            <span>Paid up to (optional - leave empty for one more {String(pkg.billing) === "weekly" ? "week" : "month"})</span>
            <input type="date" value={paidUntil} onChange={(event) => setPaidUntil(event.target.value)} />
          </label>
          <div className="inline-controls">
            <button className="button primary small" type="submit" disabled={busy}>
              {paidUntil ? `Record payment - paid until ${dayLabel(paidUntil)}` : membership?.next_paid_until ? `Record payment - paid until ${dayLabel(membership.next_paid_until)}` : "Record payment"}
            </button>
            <button className="button secondary small" type="button" onClick={() => setMode("view")}>Cancel</button>
          </div>
        </form>
      ) : null}

      {mode === "cancel" ? (
        <div className="inline-controls" role="group" aria-label="Cancel upcoming">
          <p className="small">{`Cancel the ${upcomingCount === 1 ? "upcoming call or session" : `${upcomingCount} upcoming calls and sessions`} with them? They'll be told.`}</p>
          <button className="button primary small" type="button" disabled={busy} onClick={() => void act((token) => cancelUpcomingForUnpaid(athleteUserId, token)).then((payload) => {
            if (!payload) return;
            const count = Number(payload.cancelled_count ?? 0);
            setNotice(count ? `Cancelled ${count} upcoming ${count === 1 ? "call or session" : "calls and sessions"}.` : "Nothing upcoming to cancel.");
            onCheckinsChanged();
          })}>Yes, cancel them</button>
          <button className="button secondary small" type="button" onClick={() => setMode("view")}>Keep them</button>
        </div>
      ) : null}

      {mode === "end" ? (
        <div className="inline-controls" role="group" aria-label="End package">
          <p className="small">End their package? Their booked calls stay booked; you can put them on a package again any time.</p>
          <button className="button primary small" type="button" disabled={busy} onClick={() => void act((token) => endAthletePackage(athleteUserId, token))}>Yes, end it</button>
          <button className="button secondary small" type="button" onClick={() => setMode("view")}>Keep it</button>
        </div>
      ) : null}

      {mode === "view" ? (
        <div className="inline-controls">
          {membership ? (
            <>
              {oneOff ? (
                !membership.paid_in_full ? <button className="button secondary small" type="button" disabled={busy} onClick={() => void act((token) => recordPackagePayment(athleteUserId, "", token))}>Mark paid in full</button> : null
              ) : (
                <button className="button secondary small" type="button" disabled={busy} onClick={() => { setPaidUntil(""); setMode("pay"); }}>Record a payment</button>
              )}
              {membership.payment_due && upcomingCount > 0 ? <button className="button secondary small" type="button" disabled={busy} onClick={() => setMode("cancel")}>Cancel upcoming sessions and check-ins</button> : null}
              {options.length ? <button className="button secondary small" type="button" disabled={busy} onClick={openChoose}>Change package</button> : null}
              <button className="button secondary small" type="button" disabled={busy} onClick={() => setMode("end")}>End package</button>
            </>
          ) : options.length ? (
            <button className="button secondary small" type="button" onClick={openChoose}>Put them on a package</button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
