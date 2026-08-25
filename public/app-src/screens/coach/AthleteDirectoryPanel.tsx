import React, { useMemo, useState } from "react";

import { type JsonRecord } from "../../api/transport";
import { titleCase } from "../../utils/format";
import { useAthleteDirectory } from "./useAthleteDirectory";

// DEV NOTE: FULL-UI-04A coach athlete directory (roster) - ported from
// app.js's renderCoachAthleteDirectory(). The invite-by-email form,
// broadcast form, connect-athlete (manual relationship) form and the
// relationship-audit detail panel all stay legacy siblings, same
// read-first scoping used throughout this migration. "View audit" keeps
// its data-relationship-action="audit"/data-relationship-athlete-id
// attributes and needs no onClick - app.js already has a document-level
// click delegation for that attribute (not scoped to legacy-rendered
// DOM), so it works unchanged for a React-rendered button. "Open profile"
// can't reuse the equivalent legacy mechanism
// (bindCoachAthleteActions() binds listeners imperatively after each
// legacy render and never re-runs against React output), so it dispatches
// kolosseum:open-athlete-profile-request instead, which app.js listens
// for and handles exactly as bindCoachAthleteActions()'s click handler
// used to (setView("athletes") + openAthleteProfile(id)).

type EffectiveState = "accepted" | "invited" | "expired" | "revoked" | "unknown";

function relationshipEffectiveState(entry: JsonRecord): EffectiveState {
  if (entry.relationship_expired === true) return "expired";

  const stored = String(
    entry.relationship_state ?? (entry.relationship as JsonRecord | undefined)?.relationship_state ?? "unknown"
  ).toLowerCase() as EffectiveState;

  const expiresAt = String((entry.relationship as JsonRecord | undefined)?.expires_at_iso8601 ?? "");
  if (stored === "invited" && expiresAt && Number.isFinite(Date.parse(expiresAt)) && Date.parse(expiresAt) <= Date.now()) {
    return "expired";
  }

  return stored;
}

function relationshipBadgeClass(value: EffectiveState): string {
  if (value === "accepted") return "complete";
  if (value === "invited") return "active";
  return "neutral";
}

function programmeLabelFor(athleteUserId: string, assignments: JsonRecord[], templates: JsonRecord[]): string {
  const assignment = assignments.find((entry) => String(entry.assigned_athlete_id ?? "") === athleteUserId);
  if (!assignment) return "No programme assigned";

  const template = templates.find((entry) => String(entry.template_id ?? "") === String(assignment.template_id ?? ""));
  const name = String(assignment.template_name ?? template?.template_name ?? assignment.template_id ?? "Programme");
  const version = Number(assignment.template_version ?? template?.template_version ?? 0);
  return version > 0 ? `${name} · v${version}` : name;
}

function requestOpenProfile(athleteUserId: string) {
  document.dispatchEvent(
    new CustomEvent("kolosseum:open-athlete-profile-request", { detail: { athlete_user_id: athleteUserId } })
  );
}

const COUNT_LABELS: Array<[string, EffectiveState]> = [
  ["Accepted", "accepted"],
  ["Pending", "invited"],
  ["Expired", "expired"],
  ["Revoked", "revoked"]
];

export function AthleteDirectoryPanel() {
  const { loading, error, relationships, assignments, templates, unreadByAthlete } = useAthleteDirectory();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const counts = useMemo(() => {
    const tally: Record<string, number> = { accepted: 0, invited: 0, expired: 0, revoked: 0 };
    for (const record of relationships) {
      const state = relationshipEffectiveState(record);
      if (state in tally) tally[state] += 1;
    }
    return tally;
  }, [relationships]);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return relationships.filter((record) => {
      const effectiveState = relationshipEffectiveState(record);
      if (filter !== "all" && effectiveState !== filter) return false;
      if (!query) return true;
      return [record.display_name, record.email, record.athlete_user_id, record.activity_id].some((value) =>
        String(value ?? "").toLowerCase().includes(query)
      );
    });
  }, [relationships, search, filter]);

  if (loading && relationships.length === 0) {
    return <p className="muted small">Loading athlete directory…</p>;
  }

  if (error) {
    return <p role="status" className="muted small error">{error}</p>;
  }

  return (
    <>
      <div className="metric-cards relationship-metric-cards" role="status" aria-live="polite">
        {COUNT_LABELS.map(([label, key]) => (
          <article className="metric-card relationship-metric-card" key={key}>
            <span>{label}</span>
            <strong>{counts[key]}</strong>
          </article>
        ))}
      </div>

      <div className="athlete-directory-controls">
        <label className="field">
          <span>Search athletes</span>
          <input
            type="search"
            placeholder="Name, email or account code"
            autoComplete="off"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>

        <label className="field">
          <span>Relationship state</span>
          <select value={filter} onChange={(event) => setFilter(event.target.value)}>
            <option value="all">All relationships</option>
            <option value="accepted">Accepted</option>
            <option value="invited">Pending</option>
            <option value="expired">Expired</option>
            <option value="revoked">Revoked</option>
          </select>
        </label>
      </div>

      <div className="record-list">
        {visible.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">A</div>
            <h3>No matching relationships</h3>
            <p>Change the search or relationship-state filter.</p>
          </div>
        ) : (
          visible.map((record, index) => {
            const athleteUserId = String(record.athlete_user_id ?? "");
            const effectiveState = relationshipEffectiveState(record);
            const accepted = effectiveState === "accepted";
            const unreadCount = Number(unreadByAthlete[athleteUserId] ?? 0);

            return (
              <article className="record-card athlete-record-card relationship-directory-card" key={athleteUserId || index}>
                <div>
                  <p className="eyebrow">{titleCase(record.activity_id)}</p>
                  <h3>{String(record.display_name ?? athleteUserId)}</h3>
                  <p>{String(record.email || athleteUserId)}</p>
                  <p className="muted small">{programmeLabelFor(athleteUserId, assignments, templates)}</p>
                </div>

                <div className="record-meta athlete-record-meta">
                  <span className={`badge ${relationshipBadgeClass(effectiveState)}`}>{titleCase(effectiveState)}</span>

                  {unreadCount > 0 ? (
                    <span className="badge active" title="Unread messages from this athlete">
                      {unreadCount} unread
                    </span>
                  ) : null}

                  <button
                    className="button secondary small-button"
                    type="button"
                    data-relationship-action="audit"
                    data-relationship-athlete-id={athleteUserId}
                  >
                    View audit
                  </button>

                  {accepted ? (
                    <button
                      className="button secondary small-button open-athlete-profile"
                      type="button"
                      onClick={() => requestOpenProfile(athleteUserId)}
                    >
                      Open profile
                    </button>
                  ) : null}
                </div>
              </article>
            );
          })
        )}
      </div>
    </>
  );
}
