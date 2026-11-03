import React, { useCallback, useEffect, useRef, useState } from "react";

import { loadPackageMembers, recordPackagePayment, undoPackagePayment } from "../../api/checkinsClient";
import { loadAccountDetail } from "../../api/client";
import { type JsonRecord } from "../../api/transport";
import { dayLabel, paidLabel } from "../../utils/packages";
import { ENTRY_AUTH_SUCCEEDED_EVENT } from "../entry/useEntryAuth";

// Payments, on the coach's Athletes page: everyone on one of their packages
// - payment due, due in the next week, paid up - with what's owed and what's
// coming in over the next 30 days, worked out from the package prices
// (package_membership_service.ts listCoachPackageMembers; payments are made
// outside the app). The coach records a payment from the row, or opens the
// athlete's profile. Shows nothing until someone is on a package.
const REFRESH_EVENTS = [ENTRY_AUTH_SUCCEEDED_EVENT, "kolosseum:account-role-known", "kolosseum:athlete-directory-changed"];
const SOON_DAYS = 7;

const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

export function money(minor: number, currency: string): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency, minimumFractionDigits: minor % 100 ? 2 : 0 }).format(minor / 100);
}

const billingOf = (member: JsonRecord) => String(((member.package ?? {}) as JsonRecord).billing ?? "");

// The next payment's first day: the day after the paid-up date, or the start.
function nextPaymentDay(member: JsonRecord): string | null {
  if (member.paid_in_full) return null;
  return member.paid_until ? addDays(String(member.paid_until), 1) : String(member.started_on);
}

export function paymentGroups(members: JsonRecord[], today: string): { due: JsonRecord[]; soon: JsonRecord[]; paid: JsonRecord[] } {
  const soonBy = addDays(today, SOON_DAYS);
  const due: JsonRecord[] = [];
  const soon: JsonRecord[] = [];
  const paid: JsonRecord[] = [];
  for (const member of members) {
    const next = nextPaymentDay(member);
    if (member.payment_due) due.push(member);
    else if (next && next <= soonBy) soon.push(member);
    else paid.push(member);
  }
  return { due, soon, paid };
}

function openProfile(athleteUserId: string) {
  document.dispatchEvent(new CustomEvent("kolosseum:open-athlete-profile-request", { detail: { athlete_user_id: athleteUserId } }));
}

function recordLabel(member: JsonRecord): string {
  if (billingOf(member) === "one_off") return "Record paid in full";
  return member.next_paid_until ? `Record payment - to ${dayLabel(member.next_paid_until)}` : "Record payment";
}

function PaymentRow({ member, busy, onRecord }: { member: JsonRecord; busy: boolean; onRecord: (member: JsonRecord) => void }) {
  const name = String(member.athlete_display_name);
  const owedPeriods = Number(member.owed_periods ?? 0);
  const per = billingOf(member) === "weekly" ? "week" : "month";
  return (
    <article className="record-row payment-row">
      <div>
        <button className="link-button" type="button" onClick={() => openProfile(String(member.athlete_user_id))}>{name}</button>
        <p className="muted small">{`${String(((member.package ?? {}) as JsonRecord).name ?? "")} - ${String(((member.package ?? {}) as JsonRecord).price_label ?? "")}`}</p>
        <p className={member.payment_due ? "field-error" : "muted small"}>
          {paidLabel(member)}
          {member.payment_due && Number(member.owed_minor) > 0
            ? ` - ${money(Number(member.owed_minor), String(member.currency))} owed${owedPeriods > 1 ? ` (${owedPeriods} ${per}s)` : ""}`
            : ""}
        </p>
      </div>
      <button className="button secondary small-button" type="button" disabled={busy} aria-label={`${recordLabel(member)}: ${name}`} onClick={() => onRecord(member)}>
        {recordLabel(member)}
      </button>
    </article>
  );
}

export function CoachPaymentsPanel() {
  const [payload, setPayload] = useState<JsonRecord | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // The payment just recorded, while it can still be undone.
  const [undoable, setUndoable] = useState<{ athleteUserId: string; paymentId: string; name: string } | null>(null);
  // Open while payment is due, until the coach opens or closes it - and it
  // stays open after recording a payment, so they see it went through.
  const [open, setOpen] = useState<boolean | null>(null);

  // Set while this panel's own change is being announced, so its message
  // stays; any other change (e.g. on the athlete's profile) clears it.
  const ownChange = useRef(false);

  const refresh = useCallback(async () => {
    if (!ownChange.current) {
      setNotice(null);
      setUndoable(null);
    }
    try { setPayload(await loadPackageMembers()); }
    catch { setPayload(null); }
  }, []);

  const announce = () => {
    ownChange.current = true;
    document.dispatchEvent(new Event("kolosseum:athlete-directory-changed"));
    ownChange.current = false;
  };

  useEffect(() => {
    refresh();
    for (const name of REFRESH_EVENTS) document.addEventListener(name, refresh);
    return () => { for (const name of REFRESH_EVENTS) document.removeEventListener(name, refresh); };
  }, [refresh]);

  const members = Array.isArray(payload?.members) ? (payload?.members as JsonRecord[]) : [];
  if (!members.length) return null;
  const today = String(payload?.today ?? new Date().toISOString().slice(0, 10));
  const { due, soon, paid } = paymentGroups(members, today);
  const totals = Array.isArray(payload?.totals) ? (payload?.totals as JsonRecord[]) : [];
  const owed = totals.filter((t) => Number(t.owed_minor) > 0).map((t) => money(Number(t.owed_minor), String(t.currency)));
  const upcoming = totals.filter((t) => Number(t.upcoming_minor) > 0).map((t) => money(Number(t.upcoming_minor), String(t.currency)));

  async function record(member: JsonRecord) {
    const id = String(member.athlete_user_id);
    if (busyId) return;
    setBusyId(id);
    setError(null);
    setNotice(null);
    setUndoable(null);
    setOpen(true);
    try {
      const account = await loadAccountDetail();
      const result = await recordPackagePayment(id, "", typeof account.csrf_token === "string" ? account.csrf_token : "");
      const after = (result.membership ?? {}) as JsonRecord;
      setNotice(`${String(member.athlete_display_name)}: ${after.paid_in_full ? "paid in full" : `paid until ${dayLabel(after.paid_until)}`}.`);
      if (result.recorded_payment_id) setUndoable({ athleteUserId: id, paymentId: String(result.recorded_payment_id), name: String(member.athlete_display_name) });
      // The roster's Payment due badge, and this list, reload.
      announce();
    }
    catch {
      setError("That payment didn't save. Try again.");
    }
    finally {
      setBusyId(null);
    }
  }

  async function undo() {
    if (!undoable || busyId) return;
    const { athleteUserId, paymentId, name } = undoable;
    setBusyId(athleteUserId);
    setError(null);
    try {
      const account = await loadAccountDetail();
      await undoPackagePayment(athleteUserId, paymentId, typeof account.csrf_token === "string" ? account.csrf_token : "");
      setUndoable(null);
      setNotice(`${name}: payment undone.`);
      announce();
    }
    catch {
      setError("It's too late to undo that - open their profile to correct the paid-up date.");
      setUndoable(null);
    }
    finally {
      setBusyId(null);
    }
  }

  const rows = (list: JsonRecord[]) => (
    <div className="record-list">
      {list.map((member) => <PaymentRow key={String(member.membership_id)} member={member} busy={busyId !== null} onRecord={record} />)}
    </div>
  );

  return (
    <details className="panel coach-payments" data-testid="coach-payments" open={open ?? due.length > 0} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>
        <span className="eyebrow">Payments</span>
        <strong>{due.length ? `${due.length} payment${due.length === 1 ? "" : "s"} due` : soon.length ? `${soon.length} due this week` : "Everyone's paid up"}</strong>
      </summary>
      <p className="muted small">
        {[owed.length ? `Owed now: ${owed.join(", ")}` : "", upcoming.length ? `Due in the next ${String(payload?.outlook_days ?? 30)} days: ${upcoming.join(", ")}` : ""].filter(Boolean).join(" · ")
          || "Nothing due in the next 30 days."}
        {" "}Worked out from your package prices - athletes pay you directly.
      </p>
      {error ? <p className="field-error" role="alert">{error}</p> : null}
      {notice ? (
        <p className="muted small" role="status">
          {notice}
          {undoable ? <> <button className="link-button" type="button" disabled={busyId !== null} onClick={() => void undo()}>Undo</button></> : null}
        </p>
      ) : null}
      {due.length ? <><h4>Payment due</h4>{rows(due)}</> : null}
      {soon.length ? <><h4>Due in the next week</h4>{rows(soon)}</> : null}
      {paid.length ? (
        <details className="payments-paid">
          <summary>{`Paid up (${paid.length})`}</summary>
          {rows(paid)}
        </details>
      ) : null}
    </details>
  );
}
