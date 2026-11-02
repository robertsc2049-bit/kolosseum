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
