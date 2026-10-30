import React, { useCallback, useEffect, useState } from "react";

import { decideCoachingRequest, loadCoachingRequests } from "../../api/coachWorkspaceClient";
import { loadAccountDetail } from "../../api/client";
import { type JsonRecord } from "../../api/transport";
import { formatDate } from "../../utils/format";

// Athletes who found the coach at a gym and asked to be coached
// (coaching_request_service.ts): invite them (the usual invitation they
// accept) or dismiss the request. Shows nothing when there are none.
export function CoachingRequestsPanel() {
  const [requests, setRequests] = useState<JsonRecord[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const payload = await loadCoachingRequests();
      setRequests(Array.isArray(payload.requests) ? (payload.requests as JsonRecord[]) : []);
    }
    catch {
      // Not a coach (yet) or signed out: nothing to show.
      setRequests([]);
    }
  }, []);

  useEffect(() => {
    refresh();
    document.addEventListener("kolosseum:account-role-known", refresh);
    return () => document.removeEventListener("kolosseum:account-role-known", refresh);
  }, [refresh]);

  async function decide(request: JsonRecord, decision: "invite" | "dismiss") {
    const id = String(request.request_id);
    setBusyId(id);
    setError(null);
    setNotice(null);
    try {
      const account = await loadAccountDetail();
      const payload = await decideCoachingRequest(id, decision, typeof account.csrf_token === "string" ? account.csrf_token : "");
      setRequests(Array.isArray(payload.requests) ? (payload.requests as JsonRecord[]) : []);
      setNotice(decision === "invite" ? `Invitation sent to ${String(request.athlete_display_name)}.` : "Request dismissed.");
      if (decision === "invite") document.dispatchEvent(new CustomEvent("kolosseum:data-changed"));
    }
    catch {
      setError("That didn't work. Try again.");
    }
    finally {
      setBusyId(null);
    }
  }

  if (requests.length === 0 && !notice) return null;

  return (
    <section className="panel" aria-labelledby="coachingRequestsHeading" data-testid="coaching-requests">
      <p className="eyebrow">Requests</p>
      <h3 id="coachingRequestsHeading">Athletes asking you to coach them</h3>
      <p className="muted small">They found you at a gym that confirmed you coach there.</p>
      {error ? <p role="alert" className="field-error">{error}</p> : null}
      {notice ? <p role="status" className="muted small">{notice}</p> : null}
      <div className="record-list">
        {requests.map((request) => {
          const id = String(request.request_id);
          return (
            <article className="record-row" key={id}>
              <div>
                <strong>{String(request.athlete_display_name ?? "")}</strong>
                <p className="muted small">{String(request.athlete_email ?? "")}</p>
                <p className="muted small">
                  {request.via_share_link ? "Found you through your link" : request.gym_name ? `Found you at ${String(request.gym_name)}` : "Found you at a gym"}
                  {request.requested_at ? ` · ${formatDate(request.requested_at)}` : ""}
                </p>
                {request.note ? <p className="small">{`"${String(request.note)}"`}</p> : null}
              </div>
              <div className="inline-controls">
                <button type="button" className="button secondary" disabled={busyId === id} onClick={() => void decide(request, "dismiss")}>Dismiss</button>
                <button type="button" className="button primary" disabled={busyId === id} onClick={() => void decide(request, "invite")}>Invite</button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
