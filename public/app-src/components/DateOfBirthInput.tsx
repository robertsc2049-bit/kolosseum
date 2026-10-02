import React, { useState } from "react";

// Date of birth as three typed boxes (day, month, year) with the number
// keypad - a calendar picker makes you scroll back decades. Reports an ISO
// date (YYYY-MM-DD) once all three make a real date, otherwise "".
export function toIsoDate(day: string, month: string, year: string): string {
  const d = Number(day);
  const m = Number(month);
  const y = Number(year);
  if (!Number.isInteger(d) || !Number.isInteger(m) || !Number.isInteger(y) || year.length !== 4) return "";
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return "";
  return date.toISOString().slice(0, 10);
}

export function DateOfBirthInput({ value, onChange }: { value: string; onChange: (iso: string) => void }) {
  const [parts, setParts] = useState(() => {
    const [y = "", m = "", d = ""] = value ? value.split("-") : [];
    return { day: d, month: m, year: y };
  });

  function update(key: "day" | "month" | "year", raw: string) {
    const next = { ...parts, [key]: raw.replace(/\D/gu, "").slice(0, key === "year" ? 4 : 2) };
    setParts(next);
    onChange(toIsoDate(next.day, next.month, next.year));
  }

  const field = (key: "day" | "month" | "year", label: string, placeholder: string, autoComplete: string) => (
    <label>
      <span>{label}</span>
      <input
        inputMode="numeric"
        autoComplete={autoComplete}
        placeholder={placeholder}
        aria-label={`Date of birth ${label.toLowerCase()}`}
        value={parts[key]}
        onChange={(event) => update(key, event.target.value)}
      />
    </label>
  );

  return (
    <fieldset className="field date-of-birth">
      <legend>Date of birth</legend>
      <div className="dob-fields">
        {field("day", "Day", "DD", "bday-day")}
        {field("month", "Month", "MM", "bday-month")}
        {field("year", "Year", "YYYY", "bday-year")}
      </div>
    </fieldset>
  );
}
