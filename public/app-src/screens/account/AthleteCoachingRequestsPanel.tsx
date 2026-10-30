import React, { useCallback, useEffect, useState } from "react";

import { loadMyCoachingRequests, withdrawCoachingRequest } from "../../api/athleteOnboardingClient";
import { loadAccountDetail } from "../../api/client";
import { type JsonRecord } from "../../api/transport";
import { coachLabel } from "../../utils/coachName";
import { COACHING_REQUESTS_CHANGED_EVENT } from "../../utils/coachingRequests";
import { useRole } from "../../utils/role";
import { RELATIONSHIP_CHANGED_EVENT } from "./useAccountCoachInvitations";

// The coaching requests an athlete has sent (from a gym's coaches or a
// coach's share link) and where each stands. A request still waiting can be
// withdrawn; a coach who couldn't take them on can be asked again after 30
// days (coaching_request_service.ts).

function shortDate(iso: unknown): string {
  const date = new Date(String(iso ?? ""));
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function statusLine(request: JsonRecord): string {
  switch (request.status) {
    case "waiting": return "Waiting for the coach to reply";
    case "invited": return "Invited you - accept their invitation above";
    case "coaching": return "Coaching you";
    default: {
      const again = shortDate(request.ask_again_from);
      const canAskNow = new Date(String(request.ask_again_from ?? "")).getTime() <= Date.now();
      return canAskNow || !again
        ? "Can't take you on right now - you can ask them again"
        : `Can't take you on right now - you can ask them again from ${again}`;
    }
  }
}

function whereFrom(request: JsonRecord): string {
  if (request.via_share_link) return "Through their link";
  return request.gym_name ? `At ${String(request.gym_name)}` : "";
}

export function AthleteCoachingRequestsPanel() {
  const isAthlete = useRole() === "athlete";
  const [requests, setRequests] = useState<JsonRecord[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const payload = await loadMyCoachingRequests();
      setRequests(Array.isArray(payload.requests) ? (payload.requests as JsonRecord[]) : []);
    }
    catch {
      setRequests(null);
    }
  }, []);

  useEffect(() => {
    if (!isAthlete) return undefined;
    refresh();
    for (const name of ["kolosseum:account-role-known", RELATIONSHIP_CHANGED_EVENT, COACHING_REQUESTS_CHANGED_EVENT]) document.addEventListener(name, refresh);
    return () => {
      for (const name of ["kolosseum:account-role-known", RELATIONSHIP_CHANGED_EVENT, COACHING_REQUESTS_CHANGED_EVENT]) document.removeEventListener(name, refresh);
    };
  }, [isAthlete, refresh]);

  if (!isAthlete || !requests || requests.length === 0) return null;

  async function withdraw(requestId: string) {
    setBusyId(requestId);
    setError(null);
    try {
      const account = await loadAccountDetail();
      const payload = await withdrawCoachingRequest(requestId, typeof account.csrf_token === "string" ? account.csrf_token : "");
      setRequests(Array.isArray(payload.requests) ? (payload.requests as JsonRecord[]) : []);
    }
    catch {
      setError("That request couldn't be withdrawn - the coach may have just replied.");
      await refresh();
    }
    finally {
      setBusyId(null);
    }
  }

  return (
    <article className="panel" data-testid="athlete-coaching-requests">
      <p className="eyebrow">Finding a coach</p>
      <h3>My coaching requests</h3>
      {error ? <p role="alert" className="field-error">{error}</p> : null}
      <div className="record-list">
        {requests.map((request) => {
          const id = String(request.request_id);
          const from = whereFrom(request);
          return (
            <article className="record-row" key={id}>
              <div>
                <strong>{coachLabel(request, "A coach")}</strong>
                <p className="muted small">{statusLine(request)}</p>
                <p className="muted small">{[from, request.requested_at ? `asked ${shortDate(request.requested_at)}` : ""].filter(Boolean).join(", ")}</p>
              </div>
              {request.status === "waiting" ? (
                <button type="button" className="button secondary" disabled={busyId === id} onClick={() => void withdraw(id)}>Withdraw</button>
              ) : null}
            </article>
          );
        })}
      </div>
    </article>
  );
}
