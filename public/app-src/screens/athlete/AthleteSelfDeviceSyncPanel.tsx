import React, { useState } from "react";

import { type JsonRecord } from "../../api/transport";
import { formatDate } from "../../utils/format";
import { useDeviceSync } from "./useDeviceSync";

// DEV NOTE: FULL-UI-31 athlete's own device sync - ported from app.js's
// renderDeviceConnectionCard()/renderDeviceConnectionList()/
// renderDeviceMetricEntry()/renderDeviceMetricList()/refreshDeviceSync()/
// connectDeviceSync()/disconnectDeviceSync(). Named "Self" (and mounted
// into athlete-self-device-sync-root) to avoid colliding with the
// unrelated, already-shipped coach-facing read-only mirror of the same
// domain (screens/coach/AthleteDeviceSyncPanel.tsx, viewing another
// athlete - which never renders a Disconnect control since a coach has no
// route to take that action).

const DEVICE_PROVIDER_LABELS: Record<string, string> = {
  apple_health: "Apple Health",
  garmin: "Garmin",
  whoop: "Whoop",
  manual_import: "Manual import"
};

const DEVICE_METRIC_TYPE_LABELS: Record<string, string> = {
  resting_heart_rate_bpm: "Resting heart rate",
  steps_count: "Steps",
  sleep_duration_minutes: "Sleep duration"
};

function providerLabel(provider: unknown): string {
  const key = String(provider);
  return DEVICE_PROVIDER_LABELS[key] ?? key;
}

function DeviceConnectionCard({ connection, onDisconnect }: { connection: JsonRecord; onDisconnect: (id: string) => void }) {
  const active = connection.connection_status === "active";

  return (
    <article className="record-card">
      <div className="record-meta">
        <span className="badge neutral">{active ? "Connected" : "Disconnected"}</span>
        <span className="muted small">{formatDate(connection.updated_at_iso8601)}</span>
      </div>
      <strong>{providerLabel(connection.provider)}</strong>
      {active ? (
        <button className="button ghost small" type="button" onClick={() => onDisconnect(String(connection.connection_id))}>
          Disconnect
        </button>
      ) : null}
    </article>
  );
}

function DeviceMetricCard({ entry }: { entry: JsonRecord }) {
  const label = DEVICE_METRIC_TYPE_LABELS[String(entry.metric_type)] ?? String(entry.metric_type);

  return (
    <article className="record-card">
      <div className="record-meta">
        <span className="badge neutral">Synced from {providerLabel(entry.provider)}</span>
        <span className="muted small">{formatDate(entry.reported_at_iso8601)}</span>
      </div>
      <strong>{label}: {String(entry.value)} {String(entry.unit ?? "")}</strong>
    </article>
  );
}

export function AthleteSelfDeviceSyncPanel() {
  const { connections, metricEntries, actionError, connect, disconnect } = useDeviceSync();
  const [provider, setProvider] = useState("apple_health");
  const [validationError, setValidationError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!provider) {
      setValidationError("Choose a device provider.");
      return;
    }

    setValidationError(null);
    await connect(provider);
  }

  const statusText = validationError ?? actionError;

  return (
    <div className="panel device-sync-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Device sync</p>
          <h3>Connected devices</h3>
        </div>
      </div>

      <form className="athlete-detail-note-form" onSubmit={handleSubmit}>
        <label className="field">
          <span>Provider</span>
          <select value={provider} onChange={(event) => setProvider(event.target.value)}>
            <option value="apple_health">Apple Health</option>
            <option value="garmin">Garmin</option>
            <option value="whoop">Whoop</option>
            <option value="manual_import">Manual import</option>
          </select>
        </label>

        <div className="inline-controls">
          <button className="button primary" type="submit">Connect device</button>
        </div>
      </form>

      {statusText ? <p className="dashboard-status" role="status" aria-live="polite">{statusText}</p> : null}

      <div className="record-list">
        {connections.length === 0 ? (
          <div className="empty-state compact-empty"><p>No connected devices yet.</p></div>
        ) : (
          connections.map((connection) => (
            <DeviceConnectionCard key={String(connection.connection_id)} connection={connection} onDisconnect={disconnect} />
          ))
        )}
      </div>

      <div className="panel-header">
        <div>
          <h3>Synced metrics</h3>
        </div>
      </div>

      <div className="record-list">
        {metricEntries.length === 0 ? (
          <div className="empty-state compact-empty"><p>No synced metrics yet.</p></div>
        ) : (
          metricEntries.map((entry, index) => (
            <DeviceMetricCard key={`${String(entry.metric_type)}-${String(entry.reported_at_iso8601)}-${index}`} entry={entry} />
          ))
        )}
      </div>
    </div>
  );
}
