import { type JsonRecord } from "../api/transport";

// A package membership as lines anyone can read (package_membership_service.ts).
export const dayLabel = (day: unknown) => new Date(`${String(day)}T00:00:00Z`).toLocaleDateString(undefined, { day: "numeric", month: "short", timeZone: "UTC" });

// "Payment due", "Paid until 30 Nov", "Paid in full", "Not paid yet".
export function paidLabel(membership: JsonRecord): string {
  if (membership.payment_due) return membership.paid_until ? `Payment due - paid until ${dayLabel(membership.paid_until)}` : "Payment due";
  if (membership.paid_in_full) return "Paid in full";
  if (membership.paid_until) return `Paid until ${dayLabel(membership.paid_until)}`;
  return `Starts ${dayLabel(membership.started_on)}`;
}

// One recorded payment: "3 Nov - paid up to 22 Dec (1 month)", "Paid in
// full", or a correction ("Paid-up date moved back to 22 Nov"). Coaches also
// see the amount at the package price.
export function paymentLine(payment: JsonRecord, billing: string): string {
  const on = new Date(String(payment.recorded_at)).toLocaleDateString(undefined, { day: "numeric", month: "short" });
  if (payment.paid_in_full) return `${on} - paid in full`;
  const periods = Number(payment.periods ?? 0);
  const unit = billing === "weekly" ? "week" : "month";
  const to = payment.paid_until_to ? dayLabel(payment.paid_until_to) : "not paid";
  if (periods < 0 || (payment.paid_until_from && payment.paid_until_to && String(payment.paid_until_to) < String(payment.paid_until_from))) {
    return `${on} - paid-up date moved back to ${to}`;
  }
  const amount = typeof payment.amount_minor === "number" && payment.amount_minor !== 0 && payment.currency
    ? ` · ${new Intl.NumberFormat("en-GB", { style: "currency", currency: String(payment.currency), minimumFractionDigits: Number(payment.amount_minor) % 100 ? 2 : 0 }).format(Number(payment.amount_minor) / 100)}`
    : "";
  return `${on} - paid up to ${to}${periods > 0 ? ` (${periods} ${unit}${periods === 1 ? "" : "s"})` : ""}${amount}`;
}

const PERIOD: Record<string, string> = { monthly: "this month", weekly: "this week", one_off: "so far" };

// "This month: 23 Oct - 22 Nov" - billing periods run from the start date,
// not the calendar month.
export function periodLine(membership: JsonRecord): string {
  const billing = String(((membership.package ?? {}) as JsonRecord).billing);
  if (billing === "one_off" || !membership.period_end) return "";
  return `${billing === "weekly" ? "This week" : "This month"}: ${dayLabel(membership.period_start)} - ${dayLabel(membership.period_end)}`;
}

// "1 of 2 check-in calls this month" - booked or held, for what's included;
// past what's included it says so ("3 in-person sessions this month - 1
// included").
export function usageLines(membership: JsonRecord): string[] {
  const usage = (membership.usage ?? {}) as Record<string, { used?: number; included?: number }>;
  const period = PERIOD[String(((membership.package ?? {}) as JsonRecord).billing)] ?? "";
  const line = (key: string, one: string, many: string) => {
    const { used = 0, included = 0 } = usage[key] ?? {};
    if (!included && !used) return "";
    if (included && used <= included) return `${used} of ${included} ${included === 1 ? one : many} ${period}`;
    return `${used} ${used === 1 ? one : many} ${period}${included ? ` - ${included} included` : ""}`;
  };
  return [line("checkin_calls", "check-in call", "check-in calls"), line("in_person_sessions", "in-person session", "in-person sessions")].filter(Boolean);
}
