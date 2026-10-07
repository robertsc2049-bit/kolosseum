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

import { ReadinessError, describeReadiness, saveReadiness } from "./readiness_service.js";
import { StandDownError, describeStandDown, endStandDown, recordStandDown } from "./medical_stand_down_service.js";
import { AthleteEquipmentError, describeAthleteEquipment, saveAthleteEquipment } from "./athlete_equipment_service.js";
import { MatchWeekError, getMatchWeek, saveMatchWeek } from "./match_week_service.js";
import { WeightClassError, getWeightClass, saveWeightClass } from "./weight_class_service.js";
import { AthleteMaxesError, getAthleteMaxes, saveAthleteMaxes } from "./athlete_maxes_service.js";
import { ProgrammeCatalogueError, getAthleteProgrammes, setAthleteProgramme } from "./programme_catalogue_service.js";
import { TrainingWeekError, getAthleteTrainingWeek, saveAthleteTrainingWeek } from "./athlete_training_week_service.js";

export const athleteOnboardingRouter = Router();

// Rate-limited like every newly-added authorising route (CodeQL
// js/missing-rate-limiting).
const readinessRateLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 120, standardHeaders: true, legacyHeaders: false });
const standDownRateLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 120, standardHeaders: true, legacyHeaders: false });
const equipmentRateLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 120, standardHeaders: true, legacyHeaders: false });
const matchWeekRateLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 120, standardHeaders: true, legacyHeaders: false });
const weightClassRateLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 120, standardHeaders: true, legacyHeaders: false });
const athleteMaxesRateLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 120, standardHeaders: true, legacyHeaders: false });
const athleteProgrammeRateLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 120, standardHeaders: true, legacyHeaders: false });

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

// Today's optional readiness check-in (sleep, soreness, stress).
athleteOnboardingRouter.get(
  "/readiness",
  readinessRateLimit,
  asyncHandler(async (request, response) => {
    const { session } = await athleteSession(request);
    return response.status(200).json(await describeReadiness(session.account_row.user_id));
  })
);

// Medical stand-down (e.g. after a head injury): no sessions until the date
// the athlete's medical professional gave, or until they are cleared.
athleteOnboardingRouter.get(
  "/stand-down",
  standDownRateLimit,
  asyncHandler(async (request, response) => {
    const { session } = await athleteSession(request);
    return response.status(200).json(await describeStandDown(session.account_row.user_id));
  })
);

athleteOnboardingRouter.post(
  "/stand-down",
  standDownRateLimit,
  asyncHandler(async (request, response) => {
    const { token, session } = await athleteSession(request);
    assertMutation(request, token);
    return response.status(200).json(await recordStandDown(session.account_row.user_id, request.body));
  })
);

athleteOnboardingRouter.post(
  "/stand-down/end",
  standDownRateLimit,
  asyncHandler(async (request, response) => {
    const { token, session } = await athleteSession(request);
    assertMutation(request, token);
    return response.status(200).json(await endStandDown(session.account_row.user_id, request.body));
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

// A fighter's declared weight class (fight-camp loading before a fight).
athleteOnboardingRouter.get(
  "/weight-class",
  weightClassRateLimit,
  asyncHandler(async (request, response) => {
    const { session } = await athleteSession(request);
    return response.status(200).json(await getWeightClass(session.account_row.user_id));
  })
);

athleteOnboardingRouter.put(
  "/weight-class",
  weightClassRateLimit,
  asyncHandler(async (request, response) => {
    const { token, session } = await athleteSession(request);
    assertMutation(request, token);
    return response.status(200).json(await saveWeightClass(session.account_row.user_id, request.body));
  })
);

// The athlete's match week: usual match/race/key-session days and fixtures.
athleteOnboardingRouter.get(
  "/match-week",
  matchWeekRateLimit,
  asyncHandler(async (request, response) => {
    const { session } = await athleteSession(request);
    return response.status(200).json(await getMatchWeek(session.account_row.user_id));
  })
);

// A self-directed athlete's own maxes, so % of 1RM work becomes a weight.
athleteOnboardingRouter.get(
  "/maxes",
  athleteMaxesRateLimit,
  asyncHandler(async (request, response) => {
    const { session } = await athleteSession(request);
    return response.status(200).json(await getAthleteMaxes(session.account_row.user_id));
  })
);

// Kolosseum programmes that suit the athlete, and the one they're running.
athleteOnboardingRouter.get(
  "/programmes",
  athleteProgrammeRateLimit,
  asyncHandler(async (request, response) => {
    const { session } = await athleteSession(request);
    return response.status(200).json(await getAthleteProgrammes(session.account_row.user_id));
  })
);

// Start a Kolosseum programme ({ listing_id }) or stop the current one ({ listing_id: null }).
athleteOnboardingRouter.put(
  "/programme",
  athleteProgrammeRateLimit,
  asyncHandler(async (request, response) => {
    const { token, session } = await athleteSession(request);
    assertMutation(request, token);
    return response.status(200).json(await setAthleteProgramme(session.account_row.user_id, request.body));
  })
);

// A self-coached athlete's own training week: the days, exercises, sets and
// reps they repeat (athlete_training_week_service.ts).
athleteOnboardingRouter.get(
  "/training-week",
  athleteProgrammeRateLimit,
  asyncHandler(async (request, response) => {
    const { session } = await athleteSession(request);
    return response.status(200).json(await getAthleteTrainingWeek(session.account_row.user_id));
  })
);

athleteOnboardingRouter.put(
  "/training-week",
  athleteProgrammeRateLimit,
  asyncHandler(async (request, response) => {
    const { token, session } = await athleteSession(request);
    assertMutation(request, token);
    return response.status(200).json(await saveAthleteTrainingWeek(session.account_row.user_id, request.body));
  })
);

athleteOnboardingRouter.put(
  "/readiness",
  readinessRateLimit,
  asyncHandler(async (request, response) => {
    const { token, session } = await athleteSession(request);
    assertMutation(request, token);
    return response.status(200).json(await saveReadiness(session.account_row.user_id, request.body));
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

athleteOnboardingRouter.put(
  "/match-week",
  matchWeekRateLimit,
  asyncHandler(async (request, response) => {
    const { token, session } = await athleteSession(request);
    assertMutation(request, token);
    return response.status(200).json(await saveMatchWeek(session.account_row.user_id, request.body));
  })
);

athleteOnboardingRouter.put(
  "/maxes",
  athleteMaxesRateLimit,
  asyncHandler(async (request, response) => {
    const { token, session } = await athleteSession(request);
    assertMutation(request, token);
    return response.status(200).json(await saveAthleteMaxes(session.account_row.user_id, request.body));
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

    if (error instanceof ProgrammeCatalogueError) {
      response.status(error.status).json({ error: error.code, field_errors: error.fieldErrors });
      return;
    }

    if (error instanceof TrainingWeekError) {
      response.status(error.status).json({ error: error.code, field_errors: error.fieldErrors });
      return;
    }

    if (error instanceof PainFlagError) {
      response.status(error.status).json({ error: error.code, field_errors: error.fieldErrors });
      return;
    }

    if (error instanceof ReadinessError) {
      response.status(error.status).json({ error: error.code, field_errors: error.fieldErrors });
      return;
    }

    if (error instanceof StandDownError) {
      response.status(error.status).json({ error: error.code, field_errors: error.fieldErrors });
      return;
    }

    if (error instanceof AthleteEquipmentError) {
      response.status(error.status).json({ error: error.code, field_errors: error.fieldErrors });
      return;
    }

    if (error instanceof WeightClassError) {
      response.status(error.status).json({ error: error.code, field_errors: error.fieldErrors });
      return;
    }

    if (error instanceof MatchWeekError) {
      response.status(error.status).json({ error: error.code, field_errors: error.fieldErrors });
      return;
    }

    if (error instanceof AthleteMaxesError) {
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
