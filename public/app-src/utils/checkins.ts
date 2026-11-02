import { type JsonRecord } from "../api/transport";

// Shared by the coach's and the athlete's check-in screens.
export const METHOD_LABEL: Record<string, string> = { whatsapp: "WhatsApp call", teams: "Teams call", in_person: "In person" };

// "Tue 4 Nov, 18:00" in the viewer's own time zone.
export function checkinWhen(iso: unknown): string {
  const date = new Date(String(iso ?? ""));
  if (Number.isNaN(date.getTime())) return "";
  return `${date.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}, ${date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`;
}

// A datetime-local input's value ("2026-11-04T18:00", the viewer's own
// time) as an ISO instant for the server.
export function localInputToIso(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

const icsDate = (date: Date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const icsText = (value: string) => value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

// An .ics calendar file for one check-in, with the join link in it.
export function checkinCalendarFile(checkin: JsonRecord, title: string): string {
  const start = new Date(String(checkin.starts_at));
  const end = new Date(start.getTime() + Number(checkin.duration_minutes ?? 30) * 60000);
  const link = String(checkin.whatsapp_url ?? checkin.teams_link ?? "");
  const description = [METHOD_LABEL[String(checkin.call_method)] ?? "", link, String(checkin.note ?? "")].filter(Boolean).join("\n");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Kolosseum//Check-in//EN",
    "BEGIN:VEVENT",
    `UID:${String(checkin.checkin_id)}@kolosseum`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(start)}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:${icsText(title)}`,
    `DESCRIPTION:${icsText(description)}`,
    ...(link ? [`URL:${link}`] : []),
    "BEGIN:VALARM",
    "TRIGGER:-PT15M",
    "ACTION:DISPLAY",
    `DESCRIPTION:${icsText(title)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
    ""
  ].join("\r\n");
}

export function downloadCalendarFile(checkin: JsonRecord, title: string): void {
  const blob = new Blob([checkinCalendarFile(checkin, title)], { type: "text/calendar" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "check-in.ics";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Join the call: the coach's WhatsApp chat or their Teams meeting.
export function joinLink(checkin: JsonRecord): { href: string; label: string } | null {
  if (checkin.whatsapp_url) return { href: String(checkin.whatsapp_url), label: "Open WhatsApp" };
  if (checkin.teams_link) return { href: String(checkin.teams_link), label: "Join on Teams" };
  return null;
}

export function errorCode(error: unknown): string {
  return String(((error as { payload?: JsonRecord }).payload ?? {}).error ?? "");
}
