import { describe, expect, it } from "vitest";
import {
  ALLOWED_HISTORY_COUNT_FIELDS,
  assertHistoryResponseClosedWorld,
  deniedHistoryResponse
} from "../../server/history/historyCounts.contract";
import { decideHistoryAccess } from "../../server/history/historyCounts.access";
import { buildHistoryCountsResponse } from "../../server/history/historyCounts.query";

describe("S40 History Counts Only", () => {
  it("derives factual counts from runtime events only", () => {
    const response = buildHistoryCountsResponse({
      athlete_user_id: "ath_001",
      viewer_type: "athlete",
      s36_active: true,
      sessions: [
        {
          session_id: "sess_001",
          athlete_user_id: "ath_001",
          status: "completed",
          started_at: "2026-05-01T10:00:00.000Z",
          completed_at: "2026-05-01T11:00:00.000Z",
          created_at: "2026-05-01T09:30:00.000Z"
        },
        {
          session_id: "sess_002",
          athlete_user_id: "ath_001",
          status: "partially_completed",
          started_at: "2026-05-03T10:00:00.000Z",
          completed_at: null,
          created_at: "2026-05-03T09:30:00.000Z"
        },
        {
          session_id: "sess_other",
          athlete_user_id: "ath_999",
          status: "completed",
          started_at: "2026-05-04T10:00:00.000Z",
          completed_at: "2026-05-04T11:00:00.000Z",
          created_at: "2026-05-04T09:30:00.000Z"
        }
      ],
      runtime_items: [
        {
          runtime_item_id: "ri_001",
          session_id: "sess_001",
          athlete_user_id: "ath_001",
          status: "completed",
          recorded_at: "2026-05-01T10:10:00.000Z"
        },
        {
          runtime_item_id: "ri_002",
          session_id: "sess_001",
          athlete_user_id: "ath_001",
          status: "skipped",
          recorded_at: "2026-05-01T10:20:00.000Z"
        },
        {
          runtime_item_id: "ri_003",
          session_id: "sess_002",
          athlete_user_id: "ath_001",
          status: "partial",
          recorded_at: "2026-05-03T10:20:00.000Z"
        },
        {
          runtime_item_id: "ri_other",
          session_id: "sess_other",
          athlete_user_id: "ath_999",
          status: "completed",
          recorded_at: "2026-05-04T10:20:00.000Z"
        }
      ],
      extra_work_events: [
        {
          extra_work_event_id: "ew_001",
          session_id: "sess_002",
          athlete_user_id: "ath_001",
          recorded_at: "2026-05-03T10:40:00.000Z"
        }
      ]
    });

    expect(response.counts).toEqual({
      session_count: 2,
      completed_item_count: 1,
      skipped_item_count: 1,
      partial_item_count: 1,
      extra_work_event_count: 1,
      first_session_at: "2026-05-01T10:00:00.000Z",
      latest_session_at: "2026-05-03T10:00:00.000Z"
    });

    expect(response.sessions.map(session => session.session_id)).toEqual(["sess_002", "sess_001"]);
  });

  it("omits extra_work_event_count when S36 is inactive", () => {
    const response = buildHistoryCountsResponse({
      athlete_user_id: "ath_001",
      viewer_type: "athlete",
      s36_active: false,
      sessions: [],
      runtime_items: [],
      extra_work_events: [
        {
          extra_work_event_id: "ew_001",
          session_id: "sess_001",
          athlete_user_id: "ath_001",
          recorded_at: "2026-05-03T10:40:00.000Z"
        }
      ]
    });

    expect(Object.prototype.hasOwnProperty.call(response.counts, "extra_work_event_count")).toBe(false);
  });

  it("allows athlete to read own history", () => {
    expect(
      decideHistoryAccess({
        requester: {
          requester_user_id: "ath_001",
          requester_role: "athlete"
        },
        athlete_user_id: "ath_001",
        links: [],
        now_iso: "2026-05-20T12:00:00.000Z"
      })
    ).toEqual({
      allowed: true,
      viewer_type: "athlete",
      athlete_user_id: "ath_001"
    });
  });

  it("denies athlete reading another athlete history", () => {
    expect(
      decideHistoryAccess({
        requester: {
          requester_user_id: "ath_001",
          requester_role: "athlete"
        },
        athlete_user_id: "ath_002",
        links: [],
        now_iso: "2026-05-20T12:00:00.000Z"
      })
    ).toEqual({
      allowed: false,
      reason: "requester_not_athlete"
    });
  });

  it("allows coach with accepted active scoped link", () => {
    expect(
      decideHistoryAccess({
        requester: {
          requester_user_id: "coach_001",
          requester_role: "coach"
        },
        athlete_user_id: "ath_001",
        now_iso: "2026-05-20T12:00:00.000Z",
        links: [
          {
            link_id: "link_001",
            coach_user_id: "coach_001",
            athlete_user_id: "ath_001",
            status: "accepted",
            scope: { history_counts: true },
            accepted_at: "2026-05-01T12:00:00.000Z",
            revoked_at: null,
            expires_at: null
          }
        ]
      })
    ).toEqual({
      allowed: true,
      viewer_type: "linked_coach",
      coach_user_id: "coach_001",
      athlete_user_id: "ath_001",
      link_id: "link_001"
    });
  });

  it.each([
    ["invited", "coach_link_not_accepted"],
    ["rejected", "coach_link_not_accepted"],
    ["revoked", "coach_link_revoked"],
    ["expired", "coach_link_expired"]
  ] as const)("denies coach where link status is %s", (status, reason) => {
    expect(
      decideHistoryAccess({
        requester: {
          requester_user_id: "coach_001",
          requester_role: "coach"
        },
        athlete_user_id: "ath_001",
        now_iso: "2026-05-20T12:00:00.000Z",
        links: [
          {
            link_id: "link_001",
            coach_user_id: "coach_001",
            athlete_user_id: "ath_001",
            status,
            scope: { history_counts: true },
            accepted_at: null,
            revoked_at: status === "revoked" ? "2026-05-10T12:00:00.000Z" : null,
            expires_at: status === "expired" ? "2026-05-10T12:00:00.000Z" : null
          }
        ]
      })
    ).toEqual({
      allowed: false,
      reason
    });
  });

  it("denies accepted coach link without history_counts scope", () => {
    expect(
      decideHistoryAccess({
        requester: {
          requester_user_id: "coach_001",
          requester_role: "coach"
        },
        athlete_user_id: "ath_001",
        now_iso: "2026-05-20T12:00:00.000Z",
        links: [
          {
            link_id: "link_001",
            coach_user_id: "coach_001",
            athlete_user_id: "ath_001",
            status: "accepted",
            scope: {},
            accepted_at: "2026-05-01T12:00:00.000Z",
            revoked_at: null,
            expires_at: null
          }
        ]
      })
    ).toEqual({
      allowed: false,
      reason: "coach_scope_missing"
    });
  });

  it("denied response contains no counts and no sessions", () => {
    const response = deniedHistoryResponse();

    expect(response).toEqual({
      error: {
        code: "HISTORY_VISIBILITY_DENIED",
        message_copy_id: "history.error.visibility_denied"
      }
    });

    expect("counts" in response).toBe(false);
    expect("sessions" in response).toBe(false);
  });

  it("keeps response fields closed-world", () => {
    const response = buildHistoryCountsResponse({
      athlete_user_id: "ath_001",
      viewer_type: "athlete",
      s36_active: true,
      sessions: [],
      runtime_items: [],
      extra_work_events: []
    });

    expect(() => assertHistoryResponseClosedWorld(response)).not.toThrow();
    expect(ALLOWED_HISTORY_COUNT_FIELDS).toContain("session_count");
    expect(ALLOWED_HISTORY_COUNT_FIELDS).not.toContain("readiness" as never);
  });

  it("rejects unknown response fields", () => {
    const response = {
      schema_version: "kolosseum.history_counts.v0.1" as const,
      athlete_user_id: "ath_001",
      viewer_type: "athlete" as const,
      counts: {
        session_count: 0,
        completed_item_count: 0,
        skipped_item_count: 0,
        partial_item_count: 0,
        first_session_at: null,
        latest_session_at: null,
        readiness: "not_allowed"
      },
      sessions: []
    };

    expect(() => assertHistoryResponseClosedWorld(response as never)).toThrow(
      "Forbidden history count field: readiness"
    );
  });
});