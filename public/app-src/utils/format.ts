// DEV NOTE: Ported verbatim from public/app/app.js's titleCase()/formatDate()
// so migrated consent-history rendering matches the legacy output exactly.
// escapeHtml() has no equivalent here - React escapes all text content by
// default, which is the same guarantee via a safer default.

export function titleCase(value: unknown): string {
  return String(value ?? "")
    .replaceAll("_", " ")
    .replace(/\b\w/gu, (letter) => letter.toUpperCase());
}

export function formatDate(value: unknown): string {
  if (!value) return "Date not recorded";

  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/u.test(String(value));
  const parsed = new Date(isDateOnly ? `${value}T12:00:00.000Z` : String(value));
  if (Number.isNaN(parsed.getTime())) return "Date not recorded";

  return new Intl.DateTimeFormat(
    "en-GB",
    isDateOnly
      ? { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }
      : { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }
  ).format(parsed);
}
