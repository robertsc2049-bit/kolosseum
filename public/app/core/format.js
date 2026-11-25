import { state } from "./state.js";

export function nowIso() {
  return new Date().toISOString();
}

export function todayDateOnly() {
  return new Date().toISOString().slice(0, 10);
}

function dateOnlyEpochDay(value) {
  const text = String(value ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(text)) return null;
  const parsed = Date.parse(`${text}T00:00:00.000Z`);
  return Number.isFinite(parsed) ? Math.floor(parsed / 86400000) : null;
}

export function addDateOnlyDays(value, days) {
  const epochDay = dateOnlyEpochDay(value);
  if (epochDay === null) return "";
  return new Date((epochDay + Number(days)) * 86400000).toISOString().slice(0, 10);
}

export function dateOnlyDifference(fromDate, toDate) {
  const from = dateOnlyEpochDay(fromDate);
  const to = dateOnlyEpochDay(toDate);
  return from === null || to === null ? null : to - from;
}

export function countdownLabel(eventDate, fromDate = todayDateOnly()) {
  const days = dateOnlyDifference(fromDate, eventDate);
  if (days === null) return "Set dates";
  if (days < 0) return `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago`;
  if (days === 0) return "Today";
  const weeks = Math.floor(days / 7);
  const remainder = days % 7;
  return weeks > 0
    ? `${weeks}w ${remainder}d`
    : `${days} day${days === 1 ? "" : "s"}`;
}

export function initials(name) {
  const words = String(name ?? "").trim().split(/\s+/u).filter(Boolean);
  return (words.slice(0, 2).map((word) => word[0]).join("") || "K").toUpperCase();
}

export function titleCase(value) {
  return String(value ?? "")
    .replaceAll("_", " ")
    .replace(/\b\w/gu, (letter) => letter.toUpperCase());
}

export function formatDate(value) {
  if (!value) return "Date not recorded";

  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/u.test(String(value));
  const parsed = new Date(isDateOnly ? `${value}T12:00:00.000Z` : value);
  if (Number.isNaN(parsed.getTime())) return "Date not recorded";

  return new Intl.DateTimeFormat("en-GB", isDateOnly
    ? {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC"
      }
    : {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      }
  ).format(parsed);
}

export function roleLabel() {
  return state.role === "coach" ? "Coach" : "Athlete";
}

