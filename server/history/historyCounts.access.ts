/**
 * DEV NOTE:
 * Purpose: Controls access to factual history count surfaces.
 * Boundary: Access permission must gate viewing only and must not alter engine or history truth.
 * Determinism: The same relationship and permission state must produce the same access result.
 * Failure: Missing or invalid access context must deny rather than infer permission.
 */
import type { HistoryAccessDecision, HistoryRequesterRole } from "./historyCounts.contract";

export type CoachAthleteLinkStatus = "invited" | "accepted" | "revoked" | "expired" | "rejected";

export type CoachAthleteLinkForHistory = {
  link_id: string;
  coach_user_id: string;
  athlete_user_id: string;
  status: CoachAthleteLinkStatus;
  scope: {
    history_counts?: boolean;
    [key: string]: unknown;
  };
  accepted_at: string | null;
  revoked_at: string | null;
  expires_at: string | null;
};

export type HistoryRequesterContext = {
  requester_user_id: string;
  requester_role: HistoryRequesterRole;
};

function isExpired(expiresAt: string | null, nowIso: string): boolean {
  return expiresAt !== null && expiresAt <= nowIso;
}

export function decideHistoryAccess(input: {
  requester: HistoryRequesterContext;
  athlete_user_id: string;
  links: CoachAthleteLinkForHistory[];
  now_iso: string;
}): HistoryAccessDecision {
  const { requester, athlete_user_id, links, now_iso } = input;

  if (requester.requester_role === "athlete") {
    if (requester.requester_user_id === athlete_user_id) {
      return {
        allowed: true,
        viewer_type: "athlete",
        athlete_user_id
      };
    }

    return {
      allowed: false,
      reason: "requester_not_athlete"
    };
  }

  if (requester.requester_role === "coach") {
    const link = links.find(
      item =>
        item.coach_user_id === requester.requester_user_id &&
        item.athlete_user_id === athlete_user_id
    );

    if (!link) {
      return {
        allowed: false,
        reason: "coach_link_missing"
      };
    }

    if (link.status === "revoked" || link.revoked_at !== null) {
      return {
        allowed: false,
        reason: "coach_link_revoked"
      };
    }

    if (link.status === "expired" || isExpired(link.expires_at, now_iso)) {
      return {
        allowed: false,
        reason: "coach_link_expired"
      };
    }

    if (link.status !== "accepted" || link.accepted_at === null) {
      return {
        allowed: false,
        reason: "coach_link_not_accepted"
      };
    }

    if (link.scope.history_counts !== true) {
      return {
        allowed: false,
        reason: "coach_scope_missing"
      };
    }

    return {
      allowed: true,
      viewer_type: "linked_coach",
      coach_user_id: requester.requester_user_id,
      athlete_user_id,
      link_id: link.link_id
    };
  }

  return {
    allowed: false,
    reason: "unknown_role"
  };
}