import React, { useState } from "react";

import { type JsonRecord } from "../../api/transport";
import { BODY_METRIC_TYPE_LABELS, NUTRITION_METRIC_TYPES, formatDate } from "../../utils/format";
import { useAthleteBodyMetricsSelf } from "./useAthleteBodyMetricsSelf";

// DEV NOTE: FULL-UI-29 athlete's own body-measurement logging - ported from
// app.js's logBodyMetricEntry()/renderBodyMetricEntry()/
// renderBodyMetricList() (the body-metric half of refreshBodyMetrics();
// the nutrition half stays legacy until that panel's own migration slice).
// Deliberately excludes body_weight_kg from the measurement select, matching
// #bodyMetricTypeSelect's exact legacy option set - body weight is only
// ever set as a byproduct of other flows, never logged directly here.
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
  return "You";
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

export function AthleteSelfBodyMetricsPanel() {
  const { entries, submitError, logEntry } = useAthleteBodyMetricsSelf();

  const [metricType, setMetricType] = useState(METRIC_TYPE_OPTIONS[0].value);
  const [value, setValue] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [note, setNote] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const numericValue = Number(value);
    if (!metricType || !Number.isFinite(numericValue) || !effectiveDate) {
      setValidationError("Choose a measurement, value and date.");
      return;
    }

    setValidationError(null);

    const ok = await logEntry({
      metric_type: metricType,
      value: numericValue,
      effective_date: effectiveDate,
      note: note || undefined
    });

    if (ok) {
      setValue("");
      setEffectiveDate("");
      setNote("");
    }
  }

  const statusText = validationError ?? submitError;
  const history = entries.filter((entry) => !NUTRITION_METRIC_TYPES.includes(String(entry.metric_type)));

  return (
    <div className="panel body-metrics-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Body metrics</p>
          <h3>Body measurements</h3>
        </div>
      </div>

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
          <input type="number" step={0.1} required value={value} onChange={(event) => setValue(event.target.value)} />
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
          <button className="button primary" type="submit">Log measurement</button>
        </div>
      </form>

      {statusText ? <p className="dashboard-status" role="status" aria-live="polite">{statusText}</p> : null}

      <div className="record-list">
        {history.length === 0 ? (
          <div className="empty-state compact-empty"><p>No body-metric entries yet.</p></div>
        ) : (
          history.map((entry) => <BodyMetricCard key={String(entry.record_sha256)} entry={entry} />)
        )}
      </div>
    </div>
  );
}
