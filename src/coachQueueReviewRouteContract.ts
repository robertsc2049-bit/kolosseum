import {
  coachQueueReviewApiAdapterSurfaceId,
  coachQueueReviewApiAdapterVersion,
  getCoachQueueReviewApiAdapterResponse,
  type CoachQueueReviewApiAdapterResponse,
  type CoachQueueReviewSource,
} from "./coachQueueReviewApiAdapter.js";

export const coachQueueReviewRoutePath = "/v0/coach/queue-review" as const;
export const coachQueueReviewRouteMethod = "GET" as const;
export const coachQueueReviewRouteContractSurfaceId =
  "coach_queue_review_route_contract" as const;
export const coachQueueReviewRouteContractVersion = "1.0.0" as const;

export type CoachQueueReviewRouteError =
  | "method_not_allowed"
  | "route_not_found";

export interface CoachQueueReviewRouteRequest {
  method: string;
  path: string;
  query?: {
    coach_id?: string;
  };
}

export interface CoachQueueReviewRouteErrorBody {
  ok: false;
  surface_id: typeof coachQueueReviewRouteContractSurfaceId;
  version: typeof coachQueueReviewRouteContractVersion;
  error: CoachQueueReviewRouteError;
}

export type CoachQueueReviewRouteBody =
  | CoachQueueReviewApiAdapterResponse
  | CoachQueueReviewRouteErrorBody;

export interface CoachQueueReviewRouteResponse {
  status: 200 | 400 | 404 | 405 | 503;
  body: CoachQueueReviewRouteBody;
}

function routeErrorBody(
  error: CoachQueueReviewRouteError,
): CoachQueueReviewRouteErrorBody {
  return {
    ok: false,
    surface_id: coachQueueReviewRouteContractSurfaceId,
    version: coachQueueReviewRouteContractVersion,
    error,
  };
}

function adapterStatus(response: CoachQueueReviewApiAdapterResponse): 200 | 400 | 503 {
  if (response.ok) {
    return 200;
  }

  if (response.error === "coach_id_required") {
    return 400;
  }

  if (response.error === "source_unavailable") {
    return 503;
  }

  return 503;
}

export function handleCoachQueueReviewRoute(
  request: CoachQueueReviewRouteRequest,
  source: CoachQueueReviewSource,
): CoachQueueReviewRouteResponse {
  if (request.path !== coachQueueReviewRoutePath) {
    return {
      status: 404,
      body: routeErrorBody("route_not_found"),
    };
  }

  if (request.method !== coachQueueReviewRouteMethod) {
    return {
      status: 405,
      body: routeErrorBody("method_not_allowed"),
    };
  }

  const adapterResponse = getCoachQueueReviewApiAdapterResponse(
    {
      coach_id: request.query?.coach_id,
    },
    source,
  );

  return {
    status: adapterStatus(adapterResponse),
    body: adapterResponse,
  };
}

export const coachQueueReviewRouteContract = {
  method: coachQueueReviewRouteMethod,
  path: coachQueueReviewRoutePath,
  surface_id: coachQueueReviewRouteContractSurfaceId,
  version: coachQueueReviewRouteContractVersion,
  adapter_surface_id: coachQueueReviewApiAdapterSurfaceId,
  adapter_version: coachQueueReviewApiAdapterVersion,
} as const;