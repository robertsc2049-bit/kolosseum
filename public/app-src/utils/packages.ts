import { type JsonRecord } from "../api/transport";

// A package membership as lines anyone can read (package_membership_service.ts).
const dayLabel = (day: unknown) => new Date(`${String(day)}T00:00:00Z`).toLocaleDateString(undefined, { day: "numeric", month: "short", timeZone: "UTC" });

// "Payment due", "Paid until 30 Nov", "Paid in full", "Not paid yet".
export function paidLabel(membership: JsonRecord): string {
  if (membership.payment_due) return membership.paid_until ? `Payment due - paid until ${dayLabel(membership.paid_until)}` : "Payment due";
  if (membership.paid_in_full) return "Paid in full";
  if (membership.paid_until) return `Paid until ${dayLabel(membership.paid_until)}`;
  return `Starts ${dayLabel(membership.started_on)}`;
}

const PERIOD: Record<string, string> = { monthly: "this month", weekly: "this week", one_off: "so far" };

// "1 of 2 check-in calls this month" - booked or held, for what's included.
export function usageLines(membership: JsonRecord): string[] {
  const usage = (membership.usage ?? {}) as Record<string, { used?: number; included?: number }>;
  const period = PERIOD[String(((membership.package ?? {}) as JsonRecord).billing)] ?? "";
  const line = (key: string, one: string, many: string) => {
    const { used = 0, included = 0 } = usage[key] ?? {};
    if (!included && !used) return "";
    return included ? `${used} of ${included} ${included === 1 ? one : many} ${period}` : `${used} ${used === 1 ? one : many} ${period}`;
  };
  return [line("checkin_calls", "check-in call", "check-in calls"), line("in_person_sessions", "in-person session", "in-person sessions")].filter(Boolean);
}
