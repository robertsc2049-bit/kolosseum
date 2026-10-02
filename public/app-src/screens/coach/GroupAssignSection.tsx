import React, { useMemo, useState } from "react";

import { loadAccountDetail } from "../../api/client";
import { createAthleteAssignment, loadAthleteStrengthProfile, replaceAthleteAssignment } from "../../api/coachWorkspaceClient";
import { type JsonRecord } from "../../api/transport";
// eslint-disable-next-line import/no-unresolved
import { compareProgrammeStrengthRequirements } from "../../../../shared/strength-reference/strengthReferenceLifecycle.mjs";

// Assign an active programme to several of the coach's athletes at once: the
// coach ticks athletes (same sport as the programme) and each is assigned
// through the same single-athlete request as the athlete profile (replacing
// a current assignment if they have one). Each athlete gets their own
// result line; one missing a strength reference the programme needs is
// flagged, not assigned.

type Result = { athleteId: string; name: string; ok: boolean; message: string };

function newRequestId(kind: string): string {
  const random = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  return `${kind}_${random}`;
}

function athleteName(relationship: JsonRecord): string {
  return String(relationship.display_name ?? relationship.athlete_user_id ?? "Athlete");
}

export function GroupAssignSection({ template, relationships, assignments, onAssigned }: {
  template: JsonRecord;
  relationships: JsonRecord[];
  assignments: JsonRecord[];
  onAssigned: () => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Result[]>([]);

  const athletes = useMemo(() => relationships.filter((r) =>
    String(r.relationship_state ?? "") === "accepted" &&
    r.activity_id === template.activity_id
  ), [relationships, template.activity_id]);

  function currentAssignmentId(athleteId: string): string | null {
    // Same rule as the athlete profile: the one marked current, else the
    // latest if it is still assigned.
    const mine = assignments
      .filter((a) => String(a.assigned_athlete_id ?? "") === athleteId)
      .sort((l, r) => String(r.requested_at_iso8601 ?? "").localeCompare(String(l.requested_at_iso8601 ?? "")));
    const current = mine.find((a) => a.is_current === true) ?? (String(mine[0]?.lifecycle_status ?? mine[0]?.assignment_status ?? "") === "assigned" ? mine[0] : undefined);
    return current ? String(current.assignment_id) : null;
  }

  async function assignAll() {
    setBusy(true);
    setResults([]);
    const account = await loadAccountDetail();
    const coachUserId = String((account.account as JsonRecord | undefined)?.user_id ?? "");
    const csrfToken = typeof account.csrf_token === "string" ? account.csrf_token : "";
    const out: Result[] = [];
    for (const athleteId of selected) {
      const relationship = athletes.find((r) => String(r.athlete_user_id) === athleteId);
      const name = relationship ? athleteName(relationship) : athleteId;
      try {
        const profileResponse = await loadAthleteStrengthProfile(athleteId).catch(() => null);
        const profile = profileResponse && typeof profileResponse.profile === "object" ? (profileResponse.profile as JsonRecord) : null;
        const comparison = compareProgrammeStrengthRequirements(template, profile) as { missing: string[]; complete: boolean };
        if (!comparison.complete) {
          out.push({ athleteId, name, ok: false, message: `Not assigned - needs a current max for: ${comparison.missing.join(", ").replaceAll("_", " ")}.` });
          continue;
        }
        const payload = {
          request_id: newRequestId("assignment"),
          requested_at_iso8601: new Date().toISOString(),
          coach_user_id: coachUserId,
          athlete_user_id: athleteId,
          template_id: template.template_id,
          activity_id: template.activity_id,
          event_id: ""
        };
        const existing = currentAssignmentId(athleteId);
        if (existing) await replaceAthleteAssignment(existing, payload, csrfToken);
        else await createAthleteAssignment(payload, csrfToken);
        out.push({ athleteId, name, ok: true, message: existing ? "Assigned (replaced their current programme)." : "Assigned." });
      }
      catch {
        out.push({ athleteId, name, ok: false, message: "Not assigned - the request failed. Try again." });
      }
    }
    setResults(out);
    setSelected([]);
    setBusy(false);
    if (out.some((r) => r.ok)) {
      document.dispatchEvent(new CustomEvent("kolosseum:coach-relationship-mutated"));
      onAssigned();
    }
  }

  return (
    <article className="programme-detail-section group-assign" data-testid="group-assign">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Assign</p>
          <h4>Assign to several athletes</h4>
        </div>
      </div>
      {!athletes.length ? <p className="muted">No connected athletes in this programme's sport.</p> : (
        <>
          <div className="choice-chips group-assign-athletes">
            {athletes.map((relationship) => {
              const id = String(relationship.athlete_user_id);
              return (
                <label key={id} className="choice-chip group-assign-athlete">
                  <input
                    type="checkbox"
                    checked={selected.includes(id)}
                    onChange={() => setSelected((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]))}
                  />
                  <span>{athleteName(relationship)}{currentAssignmentId(id) ? " (has a programme)" : ""}</span>
                </label>
              );
            })}
          </div>
          <div className="button-row">
            <button className="button secondary" type="button" onClick={() => setSelected(athletes.map((r) => String(r.athlete_user_id)))}>Select all</button>
            <button className="button primary" type="button" disabled={busy || !selected.length} onClick={() => void assignAll()}>
              {busy ? "Assigning…" : `Assign to ${selected.length} athlete${selected.length === 1 ? "" : "s"}`}
            </button>
          </div>
        </>
      )}
      {results.length ? (
        <ul className="group-assign-results" aria-live="polite">
          {results.map((r) => <li key={r.athleteId} data-tone={r.ok ? "success" : "warning"}>{`${r.name}: ${r.message}`}</li>)}
        </ul>
      ) : null}
    </article>
  );
}
