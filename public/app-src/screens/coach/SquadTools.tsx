import React from "react";

import { type JsonRecord } from "../../api/transport";

// Squad tools for the team view: availability today, every athlete's test
// results side by side, and the squad as a spreadsheet.

const rows = (value: unknown) => (Array.isArray(value) ? (value as JsonRecord[]) : []);
const num = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null);
const show = (value: unknown, suffix = "") => (num(value) === null ? "–" : `${num(value)}${suffix}`);
const words = (value: unknown) => String(value ?? "").replaceAll("_", " ");

export const AVAILABILITY: Record<string, { label: string; level: string }> = {
  available: { label: "Available", level: "good" },
  modified: { label: "Modified", level: "watch" },
  unavailable: { label: "Unavailable", level: "alert" }
};

// Available / Modified / Unavailable - with the reason on hover only where
// the server gave one (the athlete's own coach, or the head coach).
export function AvailabilityBadge({ availability }: { availability: unknown }) {
  const value = (availability ?? null) as JsonRecord | null;
  const shown = AVAILABILITY[String(value?.status)];
  if (!shown) return <>–</>;
  const reason = value?.reason ? `${String(value.reason)}${value.until ? ` until ${String(value.until)}` : ""}` : undefined;
  return <span className={`analysis-status is-${shown.level}`} title={reason}>{shown.label}</span>;
}

// The squad as CSV, for staff meetings and selection.
export function squadCsv(athletes: JsonRecord[], testing: JsonRecord[], statusOf: (row: JsonRecord) => string): string {
  const cell = (value: unknown) => {
    const plain = value === null || value === undefined ? "" : String(value);
    return /[",\n]/u.test(plain) ? `"${plain.replaceAll("\"", "\"\"")}"` : plain;
  };
  const tests = testing.map((test) => ({ id: String(test.test_id), label: `${String(test.name)} (${String(test.unit)})` }));
  const header = ["Athlete", "Position", "Coach", "Status", "Availability", "Sessions done %", "Load vs usual", "Readiness z", "Main lifts", ...tests.map((test) => test.label)];
  const lines = athletes.map((athlete) => {
    const lifts = rows(athlete.strength).map((lift) => `${String(lift.name)} ${lift.latest ?? ""} kg${num(lift.relative_to_bodyweight) !== null ? ` (${lift.relative_to_bodyweight}x BW)` : ""} ${String(lift.status ?? "")}`).join("; ");
    const latest = (athlete.tests_latest ?? {}) as Record<string, JsonRecord>;
    return [
      athlete.display_name, words(athlete.position), athlete.yours ? "You" : athlete.coach_name ?? "", statusOf(athlete),
      AVAILABILITY[String((athlete.availability as JsonRecord | undefined)?.status)]?.label ?? "",
      (athlete.adherence as JsonRecord | undefined)?.latest_pct ?? "", (athlete.load as JsonRecord | undefined)?.acute_chronic ?? "",
      (athlete.readiness as JsonRecord | undefined)?.z ?? "", lifts,
      ...tests.map((test) => latest[test.id]?.value ?? "")
    ].map(cell).join(",");
  });
  return [header.map(cell).join(","), ...lines].join("\n");
}

export function downloadFile(filename: string, content: string, type = "text/csv;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

// Every athlete's latest result per test, best first, with the squad and
// position-group averages and the smallest worthwhile change used.
export function SquadTesting({ testing }: { testing: JsonRecord[] }) {
  if (!testing.length) return null;
  return (
    <section className="panel analysis-section" data-testid="team-testing">
      <h3>Squad testing</h3>
      <p className="muted small">Each athlete's latest result, best first. Percentile: where they rank in the squad (100 = best). vs position: against their position group's average.</p>
      {testing.map((test) => {
        const unit = String(test.unit);
        const best = test.best as JsonRecord | null;
        const swcNote = test.swc_source === "squad"
          ? "this squad's own - 0.2 × the spread between athletes"
          : "typical for the test - with 10+ athletes tested it's worked out from your squad";
        const positions = rows(test.positions);
        return (
          <details key={String(test.test_id)} className="analysis-numbers" open={testing.length <= 2}>
            <summary>{`${String(test.name)}: squad average ${test.average} ${unit} (${test.athletes} tested) · best ${best?.value ?? "–"} ${unit}`}</summary>
            <p className="muted small">
              {`Smallest worthwhile change: ${test.swc} ${unit} (${swcNote}).`}
              {positions.length ? ` Position averages: ${positions.map((p) => `${words(p.position)} ${p.average}`).join(", ")}.` : ""}
            </p>
            <div className="analysis-table-wrap">
              <table className="analysis-table">
                <thead><tr><th>Athlete</th><th>Position</th><th>Result</th><th>Percentile</th><th>vs position</th><th>Date</th></tr></thead>
                <tbody>
                  {rows(test.results).map((result) => (
                    <tr key={String(result.athlete_user_id)}>
                      <td>{String(result.display_name)}</td>
                      <td>{result.position ? words(result.position) : "–"}</td>
                      <td>{`${result.value} ${unit}`}</td>
                      <td>{show(result.percentile)}</td>
                      <td>{num(result.vs_position) === null ? "–" : `${Number(result.vs_position) > 0 ? "+" : ""}${result.vs_position}`}</td>
                      <td>{String(result.date ?? "")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        );
      })}
    </section>
  );
}
