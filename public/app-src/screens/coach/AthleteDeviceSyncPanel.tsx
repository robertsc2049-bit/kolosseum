import React from "react";

import { type JsonRecord } from "../../api/transport";
import { formatDate } from "../../utils/format";
import { useAthleteDeviceSync } from "./useAthleteDeviceSync";

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

// NOTE: connect/disconnect are athlete-self only (device_sync.routes.ts has
// no coach write path at all) - this card deliberately never renders a
// Disconnect control, unlike the legacy coach mirror which used to pass a
// viewerIsCoach flag into a shared card renderer to suppress it.
function DeviceConnectionCard({ connection }: { connection: JsonRecord }) {
  const statusBadge = connection.connection_status === "active" ? "Connected" : "Disconnected";

  return (
    <article className="record-card">
      <div className="record-meta">
        <span className="badge neutral">{statusBadge}</span>
        <span className="muted small">{formatDate(connection.updated_at_iso8601)}</span>
      </div>
      <strong>{providerLabel(connection.provider)}</strong>
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

export function AthleteDeviceSyncPanel() {
  const { athleteUserId, loading, error, connections, metricEntries } = useAthleteDeviceSync();

  if (!athleteUserId) return null;

  if (loading && connections.length === 0 && metricEntries.length === 0) {
    return <p className="muted small">Loading device sync…</p>;
  }

  if (error) {
    return <p role="status" className="muted small error">{error}</p>;
  }

  return (
    <>
      {connections.length === 0 ? (
        <div className="empty-state compact-empty">
          <p>No connected devices yet.</p>
        </div>
      ) : (
        connections.map((connection) => (
          <DeviceConnectionCard key={String(connection.connection_id)} connection={connection} />
        ))
      )}
      {metricEntries.length === 0 ? (
        <div className="empty-state compact-empty">
          <p>No synced metrics yet.</p>
        </div>
      ) : (
        metricEntries.map((entry, index) => (
          <DeviceMetricCard key={`${String(entry.metric_type)}-${String(entry.reported_at_iso8601)}-${index}`} entry={entry} />
        ))
      )}
    </>
  );
}
