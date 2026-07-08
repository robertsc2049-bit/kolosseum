import {
  LIVE_SESSION_STATUS_COPY_IDS,
  liveSessionStatusContract
} from "./liveSessionStatus.mjs";

export const liveSessionStatusUiSurfaceId = "live_session_status_ui";
export const liveSessionStatusUiVersion = "1.0.0";

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * FUNCTION NOTE:
 * Export: renderLiveSessionStatus
 * Purpose: Produces a copy-id backed UI model for the S-V1-43 live session status read model.
 * Inputs: Accepts an already-built S-V1-43 read model only.
 * Output: Returns copy ids and row facts; no inline coaching prose or control surfaces.
 * Boundary: Must remain read-only and must not add coach control, contact, media, or substitution-control surfaces.
 * Determinism: Same read model returns the same UI model.
 * Failure: Unknown read models return a stable permission-denied style envelope.
 */
export function renderLiveSessionStatus(readModel) {
  if (!isRecord(readModel) || readModel.surface_id !== liveSessionStatusContract.surface_id) {
    return Object.freeze({
      ui_surface_id: liveSessionStatusUiSurfaceId,
      version: liveSessionStatusUiVersion,
      ok: false,
      copy_ids: Object.freeze([LIVE_SESSION_STATUS_COPY_IDS.permissionDenied]),
      presentation_contract: Object.freeze({
        read_only: true,
        coach_action_controls_present: false,
        coach_contact_surface_present: false,
        media_stream_surface_present: false,
        coach_substitution_control_present: false,
        calls_engine: false
      }),
      display: Object.freeze({})
    });
  }

  return Object.freeze({
    ui_surface_id: liveSessionStatusUiSurfaceId,
    version: liveSessionStatusUiVersion,
    ok: true,
    read_model_hash: readModel.read_model_hash,
    copy_ids: Object.freeze([
      LIVE_SESSION_STATUS_COPY_IDS.title,
      LIVE_SESSION_STATUS_COPY_IDS.readOnlyNotice,
      LIVE_SESSION_STATUS_COPY_IDS.factsOnlyNotice,
      LIVE_SESSION_STATUS_COPY_IDS.statusLabel,
      LIVE_SESSION_STATUS_COPY_IDS.startedAtLabel,
      LIVE_SESSION_STATUS_COPY_IDS.lastEventAtLabel,
      LIVE_SESSION_STATUS_COPY_IDS.currentWorkItemLabel,
      LIVE_SESSION_STATUS_COPY_IDS.lastWorkItemLabel,
      LIVE_SESSION_STATUS_COPY_IDS.eventTimelineLabel,
      readModel.event_timeline.length === 0
        ? LIVE_SESSION_STATUS_COPY_IDS.emptyTimeline
        : LIVE_SESSION_STATUS_COPY_IDS.eventTimelineLabel
    ]),
    presentation_contract: Object.freeze({
      read_only: true,
      coach_action_controls_present: false,
      coach_contact_surface_present: false,
      media_stream_surface_present: false,
      coach_substitution_control_present: false,
      calls_engine: false
    }),
    display: Object.freeze({
      session_id: readModel.session_id,
      status: readModel.status,
      status_label: readModel.status_label,
      started_at: readModel.started_at,
      last_event_at: readModel.last_event_at,
      counts: readModel.counts,
      current_work_item: readModel.current_work_item,
      last_work_item: readModel.last_work_item,
      event_count: readModel.event_timeline.length,
      event_timeline: Object.freeze(readModel.event_timeline)
    })
  });
}