/**
 * DEV NOTE: S-V1-U-03 coach review queue API adapter.
 * Purpose: maps a product/API request into the factual coach review queue read model.
 * Boundary: transport adapter only; it does not call engine code, create review decisions, or emit coaching instructions.
 * Determinism: delegates to the pure queue builder and returns stable response shapes.
 * Failure: malformed or unauthorised requests map to product-layer failure responses without engine tokens.
 */

import { buildCoachReviewQueue, CoachReviewQueueError } from "../coachReviewQueue.mjs";

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * FUNCTION NOTE:
 * Export: handleCoachReviewQueueRequest
 * Purpose: Returns a factual coach review queue response for a valid coach actor request.
 * Inputs: Explicit method and body payload only.
 * Output: Frozen API-style response object with status and body.
 * Boundary: Product transport surface only; no engine mutation, persistence, outbound message, or review-state write.
 * Determinism: Same request body returns same queue payload.
 * Failure: Invalid product input returns product failure status and reason only.
 */
export function handleCoachReviewQueueRequest(request) {
  if (!isRecord(request) || request.method !== "GET" || !isRecord(request.body)) {
    return Object.freeze({
      status: 400,
      body: Object.freeze({
        ok: false,
        reason: "coach_review_queue_request_invalid",
        engine_visible: false
      })
    });
  }

  try {
    const queue = buildCoachReviewQueue(request.body);

    return Object.freeze({
      status: 200,
      body: Object.freeze({
        ok: true,
        queue,
        engine_visible: false
      })
    });
  } catch (error) {
    if (error instanceof CoachReviewQueueError) {
      return Object.freeze({
        status: error.reason === "coach_review_queue_actor_not_coach" ? 403 : 400,
        body: Object.freeze({
          ok: false,
          reason: error.reason,
          details: error.details,
          engine_visible: false
        })
      });
    }

    throw error;
  }
}