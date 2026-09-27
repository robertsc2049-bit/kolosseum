// DEV NOTE: FULL-UI-03C authenticated athlete onboarding HTTP boundary.
// This route exposes factual declaration state only and cannot infer training decisions.

import {
  Router,
  type NextFunction,
  type Request,
  type Response
} from "express";

import {
  PRODUCT_SESSION_COOKIE,
  ProductAccountError,
  assertProductCsrf,
  resolveProductSession
} from "./product_account_service.js";
import {
  AthleteOnboardingError,
  confirmAthleteOnboarding,
  getAthleteOnboardingState,
  getAthleteProgrammeExercises,
  saveAthleteProgrammeExercises,
  saveAthleteOnboardingDraft,
  updateAthleteOnboardingPreferences
} from "./athlete_onboarding_service.js";
import {
  AthleteActivityChangeError,
  cancelQueuedActivityChange,
  getAthleteActivityChangeState,
  getAthletePositionChangeState,
  requestAthleteActivityChange,
  respondToActivityChangeProposal
} from "./athlete_activity_change_service.js";

import { rateLimit } from "express-rate-limit";
import { PainFlagError, getAthletePainFlags, recordPainCheckIn } from "./pain_flag_service.js";

// Rate-limited like every newly-added authorising route (CodeQL
// js/missing-rate-limiting); the profile reads flags on every visit.
const painFlagsRateLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 120, standardHeaders: true, legacyHeaders: false });

import { AthleteEquipmentError, describeAthleteEquipment, saveAthleteEquipment } from "./athlete_equipment_service.js";

export const athleteOnboardingRouter = Router();

// Rate-limited like every newly-added authorising route (CodeQL
// js/missing-rate-limiting).
const equipmentRateLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 120, standardHeaders: true, legacyHeaders: false });

type AsyncHandler = (
  request: Request,
  response: Response,
  next: NextFunction
) => Promise<unknown>;

function asyncHandler(handler: AsyncHandler) {
  return (request: Request, response: Response, next: NextFunction): void => {
    void handler(request, response, next).catch(next);
  };
}

function cookieValue(request: Request, name: string): string {
  const header = String(request.headers.cookie ?? "");
  for (const item of header.split(";")) {
    const separator = item.indexOf("=");
    if (separator < 0 || item.slice(0, separator).trim() !== name) continue;
    try {
      return decodeURIComponent(item.slice(separator + 1).trim());
    }
    catch {
      return "";
    }
  }
  return "";
}

async function athleteSession(request: Request) {
  const token = cookieValue(request, PRODUCT_SESSION_COOKIE);
  if (!token) throw new ProductAccountError("account_session_missing", 401);

  const session = await resolveProductSession(token);
  if (session.account_row.actor_type !== "athlete") {
    throw new AthleteOnboardingError("athlete_onboarding_athlete_required", 403);
  }

  return { token, session };
}

function assertMutation(request: Request, token: string): void {
  assertProductCsrf(token, request.get("x-kolosseum-csrf"));
}

athleteOnboardingRouter.get(
  "/",
  asyncHandler(async (request, response) => {
    const { session } = await athleteSession(request);
    const state = await getAthleteOnboardingState(session.account_row.user_id);
    return response.status(200).json(state);
  })
);

athleteOnboardingRouter.patch(
  "/draft",
  asyncHandler(async (request, response) => {
    const { token, session } = await athleteSession(request);
    assertMutation(request, token);
    const state = await saveAthleteOnboardingDraft(
      session.account_row.user_id,
      request.body
    );
    return response.status(200).json(state);
  })
);

athleteOnboardingRouter.post(
  "/confirm",
  asyncHandler(async (request, response) => {
    const { token, session } = await athleteSession(request);
    assertMutation(request, token);
    const state = await confirmAthleteOnboarding(
      session.account_row.user_id,
      request.body
    );
    return response.status(200).json(state);
  })
);

// The athlete's programme: fixed exercises, open slots, what may fill each,
// and their current choices.
athleteOnboardingRouter.get(
  "/exercises",
  asyncHandler(async (request, response) => {
    const { session } = await athleteSession(request);
    return response.status(200).json(await getAthleteProgrammeExercises(session.account_row.user_id));
  })
);

athleteOnboardingRouter.put(
  "/exercises",
  asyncHandler(async (request, response) => {
    const { token, session } = await athleteSession(request);
    assertMutation(request, token);
    return response.status(200).json(await saveAthleteProgrammeExercises(session.account_row.user_id, request.body));
  })
);

athleteOnboardingRouter.patch(
  "/preferences",
  asyncHandler(async (request, response) => {
    const { token, session } = await athleteSession(request);
    assertMutation(request, token);
    const state = await updateAthleteOnboardingPreferences(
      session.account_row.user_id,
      request.body
    );
    return response.status(200).json(state);
  })
);

athleteOnboardingRouter.get(
  "/activity-change",
  asyncHandler(async (request, response) => {
    const { session } = await athleteSession(request);
    const [activityChange, positionChange] = await Promise.all([
      getAthleteActivityChangeState(session.account_row.user_id),
      getAthletePositionChangeState(session.account_row.user_id)
    ]);
    return response.status(200).json({ activity_change: activityChange, position_change: positionChange });
  })
);

athleteOnboardingRouter.patch(
  "/activity",
  asyncHandler(async (request, response) => {
    const { token, session } = await athleteSession(request);
    assertMutation(request, token);
    const result = await requestAthleteActivityChange(
      session.account_row.user_id,
      request.body
    );
    return response.status(200).json(result);
  })
);

athleteOnboardingRouter.post(
  "/activity-proposal-response",
  asyncHandler(async (request, response) => {
    const { token, session } = await athleteSession(request);
    assertMutation(request, token);
    const result = await respondToActivityChangeProposal(
      session.account_row.user_id,
      request.body
    );
    return response.status(200).json(result);
  })
);

athleteOnboardingRouter.post(
  "/activity-proposal-cancel",
  asyncHandler(async (request, response) => {
    const { token, session } = await athleteSession(request);
    assertMutation(request, token);
    const requestId = String((request.body as Record<string, unknown> | null)?.request_id ?? "");
    const result = await cancelQueuedActivityChange(session.account_row.user_id, requestId);
    return response.status(200).json(result);
  })
);

// Pain carry-forward: the athlete's open pain flags and their check-in
// ("how is it now?") before the next session that loads the same area.
athleteOnboardingRouter.get(
  "/pain-flags",
  painFlagsRateLimit,
  asyncHandler(async (request, response) => {
    const { session } = await athleteSession(request);
    return response.status(200).json(await getAthletePainFlags(session.account_row.user_id));
  })
);

athleteOnboardingRouter.post(
  "/pain-flags/check-in",
  painFlagsRateLimit,
  asyncHandler(async (request, response) => {
    const { token, session } = await athleteSession(request);
    assertMutation(request, token);
    return response.status(200).json(await recordPainCheckIn(session.account_row.user_id, request.body));
  })
);

// The equipment a self-directed athlete has (a full gym until they say).
athleteOnboardingRouter.get(
  "/equipment",
  equipmentRateLimit,
  asyncHandler(async (request, response) => {
    const { session } = await athleteSession(request);
    return response.status(200).json(await describeAthleteEquipment(session.account_row.user_id));
  })
);

athleteOnboardingRouter.put(
  "/equipment",
  equipmentRateLimit,
  asyncHandler(async (request, response) => {
    const { token, session } = await athleteSession(request);
    assertMutation(request, token);
    return response.status(200).json(await saveAthleteEquipment(session.account_row.user_id, request.body));
  })
);

athleteOnboardingRouter.use(
  (
    error: unknown,
    _request: Request,
    response: Response,
    next: NextFunction
  ) => {
    if (error instanceof AthleteOnboardingError) {
      response.status(error.status).json({
        error: error.code,
        field_errors: error.field_errors
      });
      return;
    }

    if (error instanceof PainFlagError) {
      response.status(error.status).json({ error: error.code, field_errors: error.fieldErrors });
      return;
    }

    if (error instanceof AthleteEquipmentError) {
      response.status(error.status).json({ error: error.code, field_errors: error.fieldErrors });
      return;
    }

    if (error instanceof AthleteActivityChangeError) {
      response.status(error.status).json({ error: error.code });
      return;
    }

    if (error instanceof ProductAccountError) {
      response.status(error.status).json({
        error: error.code,
        account_state: error.account_state ?? null
      });
      return;
    }

    next(error);
  }
);
