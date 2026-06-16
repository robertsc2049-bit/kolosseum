import {
  COACH_FACTUAL_ARTEFACT_VIEW_COPY_IDS,
  coachFactualArtefactViewContract
} from "./coachFactualArtefactView.mjs";

export const coachFactualArtefactViewUiSurfaceId = "coach_factual_artefact_view_ui";
export const coachFactualArtefactViewUiVersion = "1.0.0";

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * FUNCTION NOTE:
 * Export: renderCoachFactualArtefactView
 * Purpose: Produces a copy-id based UI view model for the S-V1-41 factual artefact read model.
 * Inputs: Accepts an already-built S-V1-41 read model only.
 * Output: Returns copy ids, counts, and row facts without inline surfaced prose.
 * Boundary: Must not create text outside copy registry, mutate records, call engine code, or add coach notes.
 * Determinism: The same read model produces the same UI view model.
 * Failure: Unknown read-model surfaces return a stable unavailable envelope.
 */
export function renderCoachFactualArtefactView(readModel) {
  if (!isRecord(readModel) || readModel.surface_id !== coachFactualArtefactViewContract.surface_id) {
    return Object.freeze({
      ui_surface_id: coachFactualArtefactViewUiSurfaceId,
      version: coachFactualArtefactViewUiVersion,
      ok: false,
      copy_ids: Object.freeze([COACH_FACTUAL_ARTEFACT_VIEW_COPY_IDS.permissionDenied]),
      rows: Object.freeze([])
    });
  }

  const rows = Array.isArray(readModel.artefacts)
    ? readModel.artefacts.map((artefact) => Object.freeze({
      artefact_id: artefact.artefact_id,
      session_id: artefact.session_id,
      session_status: artefact.session_status,
      runtime_event_count: artefact.runtime_event_count,
      copy_ids: Object.freeze([
        COACH_FACTUAL_ARTEFACT_VIEW_COPY_IDS.runtimeEventCountLabel,
        COACH_FACTUAL_ARTEFACT_VIEW_COPY_IDS.sessionStatusLabel
      ])
    }))
    : [];

  return Object.freeze({
    ui_surface_id: coachFactualArtefactViewUiSurfaceId,
    version: coachFactualArtefactViewUiVersion,
    ok: true,
    read_model_hash: readModel.read_model_hash,
    artefact_count: rows.length,
    copy_ids: Object.freeze([
      COACH_FACTUAL_ARTEFACT_VIEW_COPY_IDS.title,
      COACH_FACTUAL_ARTEFACT_VIEW_COPY_IDS.readOnlyNotice,
      COACH_FACTUAL_ARTEFACT_VIEW_COPY_IDS.factsOnlyNotice,
      COACH_FACTUAL_ARTEFACT_VIEW_COPY_IDS.notesSeparateNotice,
      rows.length === 0
        ? COACH_FACTUAL_ARTEFACT_VIEW_COPY_IDS.emptyState
        : COACH_FACTUAL_ARTEFACT_VIEW_COPY_IDS.runtimeEventCountLabel
    ]),
    rows: Object.freeze(rows)
  });
}