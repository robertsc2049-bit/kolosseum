import React, { useState } from "react";

import { type JsonRecord } from "../../api/transport";
import { BODY_METRIC_TYPE_LABELS, NUTRITION_METRIC_TYPES, formatDate } from "../../utils/format";
import { useAthleteBodyMetrics } from "./useAthleteBodyMetrics";

// DEV NOTE: matches #coachBodyMetricTypeSelect's exact option set in the
// legacy DOM this replaces - deliberately excludes body_weight_kg, which
// stays an athlete-self-reported measurement only.
const METRIC_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "waist_circumference_cm", label: "Waist (cm)" },
  { value: "chest_circumference_cm", label: "Chest (cm)" },
  { value: "arm_circumference_cm", label: "Arm (cm)" },
  { value: "thigh_circumference_cm", label: "Thigh (cm)" },
  { value: "hip_circumference_cm", label: "Hip (cm)" },
  { value: "body_fat_percentage", label: "Body fat (%)" }
];

function sourceBadge(entry: JsonRecord): string {
  if (entry.source === "coach_entered") return "Coach";
  if (entry.source === "device_synced") return "Device";
  return "Athlete";
}

function BodyMetricCard({ entry }: { entry: JsonRecord }) {
  const label = BODY_METRIC_TYPE_LABELS[String(entry.metric_type)] ?? String(entry.metric_type);
  const unitSuffix = entry.unit === "percent" ? "%" : ` ${String(entry.unit)}`;

  return (
    <article className="record-card">
      <div className="record-meta">
        <span className="badge neutral">{sourceBadge(entry)}</span>
        <span className="muted small">{formatDate(entry.effective_date)}</span>
      </div>
      <strong>{label}: {String(entry.value)}{unitSuffix}</strong>
      {entry.note ? <p>{String(entry.note)}</p> : null}
    </article>
  );
}

export function AthleteBodyMetricsPanel() {
  const { athleteUserId, loading, error, entries, save } = useAthleteBodyMetrics();

  const [metricType, setMetricType] = useState(METRIC_TYPE_OPTIONS[0].value);
  const [value, setValue] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  if (!athleteUserId) return null;

  if (loading && entries.length === 0) {
    return <p className="muted small">Loading body-metric history…</p>;
  }

  if (error) {
    return <p role="status" className="muted small error">{error}</p>;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const numericValue = Number(value);
    if (!metricType || !Number.isFinite(numericValue) || !effectiveDate) {
      setResult("Choose a measurement, value and date.");
      return;
    }

    if (saving) return;
    setSaving(true);
    setResult(null);

    try {
      await save({ metric_type: metricType, value: numericValue, effective_date: effectiveDate, note: note || undefined });
      setValue("");
      setEffectiveDate("");
      setNote("");
      setResult("Body-metric entry logged.");
    }
    catch {
      setResult("Measurement could not be logged.");
    }
    finally {
      setSaving(false);
    }
  }

  const history = entries.filter((entry) => !NUTRITION_METRIC_TYPES.includes(String(entry.metric_type)));

  return (
    <>
      <form className="athlete-detail-note-form" onSubmit={handleSubmit}>
        <label className="field">
          <span>Measurement</span>
          <select value={metricType} onChange={(event) => setMetricType(event.target.value)}>
            {METRIC_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Value</span>
          <input type="number" step="0.1" required value={value} onChange={(event) => setValue(event.target.value)} />
        </label>

        <label className="field">
          <span>Date</span>
          <input type="date" required value={effectiveDate} onChange={(event) => setEffectiveDate(event.target.value)} />
        </label>

        <label className="field">
          <span>Note (optional)</span>
          <input type="text" maxLength={280} value={note} onChange={(event) => setNote(event.target.value)} />
        </label>

        <div className="inline-controls">
          <button className="button primary" type="submit" disabled={saving}>Log measurement</button>
        </div>
      </form>

      {result ? <p className="dashboard-status" role="status" aria-live="polite">{result}</p> : null}

      {history.length === 0 ? (
        <div className="empty-state compact-empty">
          <p>No body-metric entries yet.</p>
        </div>
      ) : (
        history.map((entry) => <BodyMetricCard key={String(entry.record_sha256)} entry={entry} />)
      )}
    </>
  );
}
