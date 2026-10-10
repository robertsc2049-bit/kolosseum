
// DEV NOTE: API boundary surface. This file may expose or transport engine results, but must
// not bypass engine package boundaries, infer hidden truth, or let UI/product state mutate
// deterministic engine behaviour.

// src/api/blocks.handlers.ts
import type { Request, Response } from "express";
import crypto from "node:crypto";
import { selectCanonicalHash } from "./canonical_hash.js";

import type { Phase6SessionOutput } from "@kolosseum/engine/phases/phase6.js";
import { applyRuntimeEvents } from "@kolosseum/engine/runtime/apply_runtime_event.js";

import { phase1Validate } from "@kolosseum/engine/phases/phase1.js";
import { gapReentryForAthlete, trainingCycleForAthlete } from "./training_cycle_service.js";
import { applyPainCarryForward } from "./pain_flag_service.js";
import { applyTodaysReadiness } from "./readiness_service.js";
import { activeStandDown, exercisePatternOf, headInjuryReturn } from "./medical_stand_down_service.js";
import { withSessionBookends } from "./session_bookends.js";
import { holdBackAfterHeadInjury, lighterAfterHeadInjury } from "./head_injury_return.js";
import { applyAthleteEquipment } from "./athlete_equipment_service.js";
import { applyAthleteMatchWeek } from "./match_week_service.js";
import { applyAthleteFightCamp } from "./weight_class_service.js";
import { autoregulateSession } from "./autoregulation_service.js";
import { resolveAthleteSessionLoads } from "./athlete_maxes_service.js";
import { lighterForReentry } from "./programme_reentry.js";
import { type ProgrammeRun, getCurrentProgrammeRun, programmeRunPosition, programmeRunTotalSessions } from "./programme_catalogue_service.js";
import { type OwnTrainingStamp, type TrainingWeek, TrainingWeekError, getCurrentTrainingWeek, ownTrainingProgram, ownTrainingStamp, todaysSession, trainingWeekSessionCount } from "./athlete_training_week_service.js";
import { getAthleteTrainingPlan, getAthleteTrainingProfile } from "./athlete_onboarding_service.js";
import { getAthleteCustomExerciseNames, getAthleteExerciseSelections, sessionExerciseDisplayNames } from "./athlete_onboarding_service.js";
import { phase2CanonicaliseAndHash } from "@kolosseum/engine/phases/phase2.js";
import { phase3ResolveConstraintsAndLoadRegistries } from "@kolosseum/engine/phases/phase3.js";
import { phase4AssembleProgram } from "@kolosseum/engine/phases/phase4.js";
import { phase6ProduceSessionOutput } from "@kolosseum/engine/phases/phase6.js";

import { validateWireRuntimeEvent } from "@kolosseum/engine/runtime/session_summary.js";

import {
  assertBeta16CompileAdmission,
  beta16AppPathContract
} from "./beta16_app_path_service.js";
import {
  loadStoredBetaCompileAdmission
} from "./beta_product_journey_service.js";
import {
  Beta18ProgrammeTemplateError,
  isCoachAuthoredTemplateId,
  materialiseNextCoachTemplateProgram,
  nextTemplateSessionIndex
} from "./beta18_programme_template_service.js";
import { badRequest, notFound, internalError } from "./http_errors.js";
import { getBlockByIdQuery } from "./block_query_service.js";
import { createSessionFromBlockMutation } from "./block_session_write_service.js";
import { listBlockSessionsQuery } from "./block_session_query_service.js";
import { persistCompiledBlockAndMaybeCreateSession } from "./block_compile_write_service.js";

type CompileBlockBody = {
  phase1_input: unknown;
  engine_version?: string;
  canonical_hash?: string;
  apply_phase5?: boolean;
  phase5_input?: unknown;
  runtime_events?: unknown;
  events?: unknown;
  create_session?: unknown;
  createSession?: unknown;
  beta_path_context?: unknown;
  beta_user_id?: unknown;
  beta_coach_user_id?: unknown;
  // A self-coached athlete with no week of their own: what they train today.
  todays_exercises?: unknown;
};

type JsonRecord = Record<string, unknown>;

function isRecord(v: unknown): v is JsonRecord {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

function asBoolQuery(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v === 1;
  if (typeof v !== "string") return false;
  const s = v.trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "y" || s === "on";
}

function queryHasTruthyFlag(req: Request, ...names: string[]): boolean {
  for (const name of names) {
    const queryValue = (req.query as any)?.[name];
    if (Array.isArray(queryValue)) {
      if (queryValue.some((x) => asBoolQuery(x))) return true;
    } else if (asBoolQuery(queryValue)) {
      return true;
    }

    const bodyValue = (req.body as any)?.[name];
    if (asBoolQuery(bodyValue)) return true;

    const originalUrl = typeof req.originalUrl === "string" ? req.originalUrl : "";
    const pattern = new RegExp(`(?:[?&])${name}=(?:1|true|yes|y|on)(?:&|$)`, "i");
    if (pattern.test(originalUrl)) return true;
  }

  return false;
}

// The competition a taper-ending programme is timed to: the event the coach
// linked the programme to, else the meet, race or fight the athlete declared.
async function peakCompetitionDate(userId: string, eventPlan: unknown): Promise<string | null> {
  const eventDate = isRecord(eventPlan) && typeof eventPlan.event_date === "string" ? eventPlan.event_date : "";
  if (/^\d{4}-\d{2}-\d{2}$/u.test(eventDate)) return eventDate;
  const plan = await getAthleteTrainingPlan(userId).catch(() => null);
  return plan?.competition_date ?? null;
}

function id(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "")}`;
}

function requireObjectBody(req: Request): JsonRecord {
  const bodyUnknown = req.body as unknown;
  if (!isRecord(bodyUnknown)) throw badRequest("Missing/invalid JSON body (expected object)");
  return bodyUnknown;
}

function readRuntimeEvents(body: CompileBlockBody): unknown[] {
  const raw = (body as any)?.runtime_events ?? (body as any)?.events;
  if (typeof raw === "undefined") return [];
  if (!Array.isArray(raw)) throw badRequest("Invalid runtime_events/events (expected array)");
  return raw;
}

function parseRuntimeEvents(raw: unknown[]): any[] {
  const out: any[] = [];
  for (let i = 0; i < raw.length; i++) {
    const candidate = raw[i];
    if (candidate && typeof candidate === "object" && !Array.isArray(candidate) && (candidate as any).type === "START_SESSION") {
      continue;
    }

    const validated = validateWireRuntimeEvent(candidate);
    if (!validated) {
      throw badRequest("Invalid runtime_events/events (event failed validation)", { index: i });
    }
    out.push(validated);
  }
  return out;
}

function mapEngineRuntimeApplyError(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.startsWith("PHASE6_RUNTIME_AWAIT_RETURN_DECISION")) {
    throw badRequest("Runtime event rejected (await return decision)", {
      failure_token: "phase6_runtime_await_return_decision",
      cause: msg
    });
  }
  if (msg.startsWith("PHASE6_RUNTIME_UNKNOWN_EVENT")) {
    throw badRequest("Runtime event rejected (unknown event type)", {
      failure_token: "phase6_runtime_unknown_event",
      cause: msg
    });
  }
  if (msg.startsWith("PHASE6_RUNTIME_INVALID_EVENT")) {
    throw badRequest("Runtime event rejected (invalid event shape)", {
      failure_token: "phase6_runtime_invalid_event",
      cause: msg
    });
  }

  throw internalError("Runtime apply failed (unexpected engine error)", { cause: msg });
}

/**
 * POST /blocks/compile
 * Optional: ?create_session=true
 */
export async function compileBlock(req: Request, res: Response) {
  const bodyRec = requireObjectBody(req);
  const body = bodyRec as unknown as CompileBlockBody;
  const replayKeysProvided =
    Object.prototype.hasOwnProperty.call(bodyRec, "runtime_events") ||
    Object.prototype.hasOwnProperty.call(bodyRec, "events");

  if (!Object.prototype.hasOwnProperty.call(body, "phase1_input")) {
    throw badRequest("Missing phase1_input");
  }

  const engine_version = asString(body.engine_version) ?? "EB2-1.0.0";
  const apply_phase5 = body.apply_phase5 === true;
  const create_session = asBoolQuery((req.query as any)?.create_session);

  const beta_path_requested =
    queryHasTruthyFlag(
      req,
      "beta_path",
      "betaPath"
    );

  const beta_path_context_provided =
    Object.prototype.hasOwnProperty.call(
      bodyRec,
      "beta_path_context"
    );

  const storedBetaUserId =
    asString(
      body.beta_user_id
    );

  const storedBetaCoachUserId =
    asString(
      body.beta_coach_user_id
    );

  const storedBetaSelectorsProvided =
    typeof body.beta_user_id !==
      "undefined" ||
    typeof body.beta_coach_user_id !==
      "undefined";

  let beta_path_admission:
    ReturnType<
      typeof assertBeta16CompileAdmission
    > | null = null;

  let beta_session_binding:
    {
      subject_user_id: string;
      coach_user_id: string;
      assignment_id: string;
      template_id: string;
      event_id: string | null;
      event_plan: Readonly<JsonRecord> | null;
      event_compile_summary: Readonly<JsonRecord> | null;
      event_record_sha256: string | null;
    } |
    null = null;

  // A self-directed (individual, no coach) beta_path_context admission has
  // no coach/assignment/template to bind - only the athlete's own identity,
  // taken from the admitted auth_record. Kept separate from
  // beta_session_binding (which stays coach-path-only, matching its
  // required-string shape) rather than force-fitting it into that shape with
  // empty-string coach/assignment placeholders.
  let beta_individual_subject_user_id: string | undefined;

  if (beta_path_requested) {
    try {
      if (storedBetaSelectorsProvided) {
        if (
          beta_path_context_provided ||
          !storedBetaUserId ||
          !storedBetaCoachUserId
        ) {
          throw {
            reason:
              "stored_beta_selector_invalid"
          };
        }

        const storedAdmission =
          await loadStoredBetaCompileAdmission(
            storedBetaUserId,
            storedBetaCoachUserId,
            body.phase1_input
          );

        beta_path_admission =
          storedAdmission.admission;

        beta_session_binding = {
          subject_user_id:
            storedAdmission
              .subject_user_id,
          coach_user_id:
            storedAdmission
              .coach_user_id,
          assignment_id:
            storedAdmission
              .assignment_id,
          template_id:
            storedAdmission
              .template_id,
          event_id:
            storedAdmission
              .event_id,
          event_plan:
            storedAdmission
              .event_plan,
          event_compile_summary:
            storedAdmission
              .event_compile_summary,
          event_record_sha256:
            storedAdmission
              .event_record_sha256
        };
      }
      else {
        beta_path_admission =
          assertBeta16CompileAdmission(
            body.beta_path_context,
            body.phase1_input
          );

        beta_individual_subject_user_id =
          asString(
            beta_path_admission.user_id
          );
      }
    }
    catch (error) {
      const reason =
        isRecord(error) &&
        typeof error.reason === "string"
          ? error.reason
          : "admission_invalid";

      throw badRequest(
        "BETA16_APP_PATH_ADMISSION_FAILED",
        {
          failure_token:
            "beta16_app_path_invalid",
          reason
        }
      );
    }
  }
  else if (
    beta_path_context_provided ||
    storedBetaSelectorsProvided
  ) {
    throw badRequest(
      "BETA16_APP_PATH_FLAG_REQUIRED",
      {
        failure_token:
          "beta16_app_path_invalid",
        reason:
          "beta_path_flag_required"
      }
    );
  }

  // A self-directed athlete's session is periodised: the server adds where they
  // are in their plan today (phase, mesocycle week, weekly slot). Admission
  // above validated the declared input; the cycle is derived, never declared
  // by the client. Coach-managed sessions follow the coach's programme.
  let phase1ForCompile: unknown = body.phase1_input;
  // Set when a self-directed athlete comes back after a break (training_cycle.ts):
  // shown with the session, never part of the engine input.
  let session_reentry: Record<string, unknown> | undefined;
  // A Kolosseum programme the athlete is running (programme_catalogue_service.ts):
  // the session comes from that programme, not the generated one.
  const programme_run: ProgrammeRun | null =
    create_session && beta_individual_subject_user_id ? await getCurrentProgrammeRun(beta_individual_subject_user_id) : null;
  // An athlete without a coach trains from the week they built
  // (athlete_training_week_service.ts); until they build one, the generated
  // programme. (Kolosseum programmes are for coaches; a run already started
  // finishes.)
  const training_week =
    create_session && beta_individual_subject_user_id && !programme_run ? await getCurrentTrainingWeek(beta_individual_subject_user_id) : null;
  // With no week of their own, the athlete can log what they're training
  // today: the exercises they chose for this session only.
  let todays: { week: TrainingWeek; stamp: OwnTrainingStamp } | null = null;
  if (create_session && beta_individual_subject_user_id && !programme_run && !training_week && Array.isArray(body.todays_exercises)) {
    try {
      const profile = await getAthleteTrainingProfile(beta_individual_subject_user_id);
      todays = todaysSession(body.todays_exercises, profile.activity_id, crypto.randomUUID().replace(/-/gu, ""));
    }
    catch (error) {
      if (error instanceof TrainingWeekError) throw badRequest("Today's exercises are not valid", { failure_token: "todays_exercises_invalid", field_errors: error.fieldErrors });
      throw error;
    }
  }
  if (beta_individual_subject_user_id && isRecord(body.phase1_input)) {
    const cycle_with_reentry = await trainingCycleForAthlete(beta_individual_subject_user_id);
    // Training days are required (no silent default): an athlete who
    // onboarded before plans existed declares them before their next session.
    if (!cycle_with_reentry) {
      throw badRequest("training_plan_required", { failure_token: "training_plan_required" });
    }
    const { reentry, ...training_cycle } = cycle_with_reentry;
    session_reentry = reentry;
    // The athlete's own exercise for each open slot; the engine refuses the
    // session if today's slots are not all chosen (never a default).
    // A programme run, or the athlete's own week, brings its own exercises.
    const exercise_selections = programme_run || training_week || todays ? undefined : await getAthleteExerciseSelections(beta_individual_subject_user_id);
    phase1ForCompile = { ...body.phase1_input, training_cycle, ...(exercise_selections ? { exercise_selections } : {}) };
  }

  const p1 = phase1Validate(phase1ForCompile);
  if (!p1.ok) {
    throw badRequest("Phase 1 failed", { failure_token: p1.failure_token, details: p1.details });
  }
  const canonical_input = p1.canonical_input;

  const p2 = phase2CanonicaliseAndHash(canonical_input);
  if (!p2.ok) {
    throw badRequest("Phase 2 failed", { failure_token: p2.failure_token, details: p2.details });
  }

  const requested_canonical_hash = asString(body.canonical_hash);
  const allow_override = process.env.KOLOSSEUM_ALLOW_CANONICAL_HASH_OVERRIDE === "1";
  const expected_token =
    typeof process.env.KOLOSSEUM_INTERNAL_TOKEN === "string" && process.env.KOLOSSEUM_INTERNAL_TOKEN.trim().length > 0
      ? process.env.KOLOSSEUM_INTERNAL_TOKEN.trim()
      : undefined;
  const provided_token =
    typeof (req as any)?.get === "function" ? (req as any).get("x-kolosseum-internal-token") : undefined;

  let canonical_hash: string;
  try {
    canonical_hash = selectCanonicalHash({
      requested: requested_canonical_hash,
      phase2_hash: p2.phase2.phase2_hash,
      allow_override,
      expected_token,
      provided_token
    }).canonical_hash;
  } catch (e: unknown) {
    throw internalError("canonical_hash selection failed", { cause: e instanceof Error ? e.message : String(e) });
  }

  const p3 = phase3ResolveConstraintsAndLoadRegistries(canonical_input);
  if (!p3.ok) {
    throw badRequest("Phase 3 failed", { failure_token: p3.failure_token, details: p3.details });
  }

  const p4 = phase4AssembleProgram(canonical_input, p3.phase3);
  if (!p4.ok) {
    throw badRequest("Phase 4 failed", { failure_token: p4.failure_token, details: p4.details });
  }

  let programForSession: any =
    p4.program;

  if (
    beta_session_binding &&
    isCoachAuthoredTemplateId(
      beta_session_binding
        .template_id
    )
  ) {
    try {
      programForSession =
        await materialiseNextCoachTemplateProgram({
          coach_user_id:
            beta_session_binding
              .coach_user_id,
          athlete_user_id:
            beta_session_binding
              .subject_user_id,
          assignment_id:
            beta_session_binding
              .assignment_id,
          template_id:
            beta_session_binding
              .template_id,
          event_plan_override:
            beta_session_binding
              .event_plan,
          event_compile_summary_override:
            beta_session_binding
              .event_compile_summary,
          event_record_sha256:
            beta_session_binding
              .event_record_sha256,
          base_program:
            p4.program as unknown as
              JsonRecord,
          ...(create_session
            ? { peak_competition_date: await peakCompetitionDate(beta_session_binding.subject_user_id, beta_session_binding.event_plan) }
            : {})
        });

      const templateExecution =
        isRecord(
          programForSession
            .coach_template_execution
        )
          ? programForSession
              .coach_template_execution
          : null;

      const templateRecordSha256 =
        templateExecution
          ? asString(
              templateExecution
                .template_record_sha256
            )
          : undefined;

      const templateSessionId =
        templateExecution
          ? asString(
              templateExecution
                .template_session_id
            )
          : undefined;

      const athleteProfileRecordSha256 =
        templateExecution
          ? asString(
              templateExecution
                .athlete_profile_record_sha256
            )
          : undefined;

      const eventRecordSha256 =
        templateExecution
          ? asString(
              templateExecution
                .event_record_sha256
            )
          : undefined;

      if (
        !templateRecordSha256 ||
        !templateSessionId
      ) {
        throw new Beta18ProgrammeTemplateError(
          "template_compile_binding_missing"
        );
      }

      canonical_hash =
        crypto
          .createHash("sha256")
          .update(
            JSON.stringify({
              phase2_canonical_hash:
                canonical_hash,
              template_record_sha256:
                templateRecordSha256,
              template_session_id:
                templateSessionId,
              athlete_profile_record_sha256:
                athleteProfileRecordSha256 ??
                null,
              event_record_sha256:
                eventRecordSha256 ??
                null
            }),
            "utf8"
          )
          .digest("hex");
    }
    catch (error) {
      const reason =
        error instanceof
          Beta18ProgrammeTemplateError
          ? error.reason
          : error instanceof Error
            ? error.message
            : "template_materialisation_failed";

      throw badRequest(
        "BETA18_TEMPLATE_MATERIALISATION_FAILED",
        {
          failure_token:
            "beta18_programme_template_invalid",
          reason
        }
      );
    }
  }

  let programme_run_session: { run_id: string; listing_id: string; title: string; session_number: number; sessions_total: number; session_title: string; week_number?: number; weeks_total?: number; block_name?: string; block_type?: string } | undefined;
  if (programme_run && beta_individual_subject_user_id) {
    const baseIndex = await nextTemplateSessionIndex(programme_run.run_id);
    try {
      programForSession = await materialiseNextCoachTemplateProgram({
        coach_user_id: programme_run.author_user_id,
        athlete_user_id: beta_individual_subject_user_id,
        assignment_id: programme_run.run_id,
        template_id: programme_run.template_id,
        base_program: p4.program as unknown as JsonRecord,
        session_index_override: baseIndex,
        athlete_sets_loads: true,
        peak_competition_date: await peakCompetitionDate(beta_individual_subject_user_id, null)
      });
    }
    catch (error) {
      const reason = error instanceof Beta18ProgrammeTemplateError ? error.reason : "template_materialisation_failed";
      if (reason === "assigned_template_sessions_exhausted") {
        throw badRequest("programme_complete", { failure_token: "programme_complete", programme_title: programme_run.title });
      }
      throw badRequest("BETA18_TEMPLATE_MATERIALISATION_FAILED", { failure_token: "beta18_programme_template_invalid", reason });
    }
    const templateExecution = isRecord(programForSession.coach_template_execution) ? programForSession.coach_template_execution : null;
    const sessionIndex = templateExecution && Number.isInteger(templateExecution.template_session_index) ? Number(templateExecution.template_session_index) : baseIndex;
    canonical_hash = crypto.createHash("sha256").update(JSON.stringify({
      phase2_canonical_hash: canonical_hash,
      programme_run_id: programme_run.run_id,
      template_record_sha256: templateExecution ? asString(templateExecution.template_record_sha256) ?? null : null,
      template_session_id: templateExecution ? asString(templateExecution.template_session_id) ?? null : null
    }), "utf8").digest("hex");
    programme_run_session = {
      run_id: programme_run.run_id,
      listing_id: programme_run.listing_id,
      title: programme_run.title,
      session_number: sessionIndex + 1,
      sessions_total: await programmeRunTotalSessions(programme_run),
      session_title: templateExecution ? asString(templateExecution.template_session_title) ?? "" : "",
      ...((await programmeRunPosition(programme_run, sessionIndex)) ?? {})
    };
  }

  // The athlete's own week: today's day of it, in order.
  let own_training_session: OwnTrainingStamp | undefined;
  const own_week = training_week ?? todays?.week ?? null;
  if (own_week && beta_individual_subject_user_id) {
    own_training_session = todays ? todays.stamp : ownTrainingStamp(own_week, await trainingWeekSessionCount(beta_individual_subject_user_id, own_week.week_id));
    programForSession = ownTrainingProgram(p4.program as unknown as Record<string, unknown>, own_week, own_training_session);
    canonical_hash = crypto.createHash("sha256").update(JSON.stringify({
      phase2_canonical_hash: canonical_hash,
      own_training_week_id: own_week.week_id,
      day_number: own_training_session.day_number,
      week_number: own_training_session.week_number
    }), "utf8").digest("hex");
  }

  if (apply_phase5) {
    throw badRequest("Phase 5 compile not implemented", { failure_token: "phase5_compile_not_implemented" });
  }
  const phase5_adjustments: unknown[] = [];

  const p6 = phase6ProduceSessionOutput(programForSession, canonical_input, undefined);
  if (!p6.ok) {
    throw badRequest("Phase 6 failed", { failure_token: p6.failure_token, details: p6.details });
  }
  // Every exercise is named for the session ("Back squat"), as are a
  // self-directed athlete's own exercises and numbered repeats ("Zercher
  // squat", "Back squat (2)").
  const displayNames = sessionExerciseDisplayNames(
    p6.session.exercises.map((e: any) => String(e.exercise_id ?? "")),
    beta_individual_subject_user_id ? await getAthleteCustomExerciseNames(beta_individual_subject_user_id) : {});
  const executionStamp = isRecord(programForSession?.coach_template_execution) ? programForSession.coach_template_execution : null;
  const template_position = executionStamp && Number.isInteger(executionStamp.template_session_index)
    ? { template_session_index: Number(executionStamp.template_session_index), ...(isRecord(executionStamp.peak_timing) ? { peak_timing: executionStamp.peak_timing } : {}) }
    : null;
  const p6_session = programme_run_session || own_training_session
    ? (({ training_cycle: _cycle, ...rest }) => rest)(p6.session as any) as Phase6SessionOutput
    : p6.session;
  const named_session: Phase6SessionOutput = {
    ...p6_session,
    ...(programme_run_session ? { programme_run: programme_run_session } : {}),
    ...(own_training_session ? { own_training: own_training_session } : {}),
    // Where this session sits in a coach's or a Kolosseum programme, so the
    // next one follows it - even after weeks were skipped or held for a
    // competition (peak_timing.ts).
    ...(template_position ? { template_position } : {}),
    ...(!programme_run_session && !own_training_session && session_reentry && isRecord((p6.session as any).training_cycle)
      ? { training_cycle: { ...(p6.session as any).training_cycle, reentry: session_reentry } }
      : {}),
    exercises: p6.session.exercises.map((e: any) => {
      const exId = String(e.exercise_id ?? "");
      return displayNames[exId] ? { ...e, display_name: displayNames[exId] } : e;
    })
  };

  // An open pain flag is never trained through silently: before a session
  // with an affected exercise the athlete checks in, and "still sore" swaps
  // or leaves out those exercises for this session (pain_flag_service.ts).
  const pain_subject_user_id = beta_individual_subject_user_id ?? beta_session_binding?.subject_user_id;
  let planned_session_from_engine: Phase6SessionOutput = named_session;
  // A medical stand-down (e.g. after a head injury) is never overridden: no
  // session is created until its date, or until the athlete is cleared.
  if (create_session && pain_subject_user_id) {
    const standDown = await activeStandDown(pain_subject_user_id);
    if (standDown) {
      throw badRequest("Medical stand-down", { failure_token: "medical_stand_down", details: { until_date: standDown.until_date, reason: standDown.reason } });
    }
  }
  if (create_session && pain_subject_user_id) {
    const pain = await applyPainCarryForward(
      pain_subject_user_id,
      {
        activity_id: String((canonical_input as any)?.activity_id ?? ""),
        experience_level: typeof (canonical_input as any)?.experience_level === "string" ? (canonical_input as any).experience_level : undefined
      },
      named_session.exercises as any
    );
    if (!pain.ok) {
      throw badRequest("Pain check-in required before this session", { failure_token: pain.failure_token, details: pain.details });
    }
    planned_session_from_engine = { ...named_session, exercises: pain.exercises as any };
  }
  if (create_session && pain_subject_user_id) {
    // The first week back after a head injury holds back jumps, sprints,
    // cutting and neck loading (head_injury_return.ts) - coached sessions too.
    const back = await headInjuryReturn(pain_subject_user_id);
    if (back) {
      const held = holdBackAfterHeadInjury(planned_session_from_engine.exercises as any[], exercisePatternOf);
      if (!held.exercises.length) {
        throw badRequest("Head injury return week", { failure_token: "head_injury_return_session_empty", details: { returned_on: back.returned_on } });
      }
      // A self-directed athlete's whole week is a re-entry week; a coach's
      // session is made lighter here.
      const coached = !beta_individual_subject_user_id;
      planned_session_from_engine = {
        ...planned_session_from_engine,
        exercises: (coached ? lighterAfterHeadInjury(held.exercises as any[]) : held.exercises) as any,
        head_injury_return: { returned_on: back.returned_on, held_back_exercise_ids: held.held_back, ...(coached ? { lighter: true } : {}) }
      } as any;
    }
  }
  // A low readiness check-in today trims a self-directed session (readiness.ts).
  if (create_session && beta_individual_subject_user_id) {
    planned_session_from_engine = {
      ...planned_session_from_engine,
      exercises: (await applyTodaysReadiness(beta_individual_subject_user_id, planned_session_from_engine.exercises as any)) as any
    };
  }
  // Exercises a self-directed athlete can't do with their equipment are
  // swapped for a flagged substitute, or flagged when nothing fits.
  if (create_session && beta_individual_subject_user_id) {
    planned_session_from_engine = {
      ...planned_session_from_engine,
      exercises: (await applyAthleteEquipment(
        beta_individual_subject_user_id,
        {
          activity_id: String((canonical_input as any)?.activity_id ?? ""),
          experience_level: typeof (canonical_input as any)?.experience_level === "string" ? (canonical_input as any).experience_level : undefined
        },
        planned_session_from_engine.exercises as any
      )) as any
    };
  }
  // Around a self-directed athlete's matches: a primer on match day and the
  // day before (no heavy lower-body work), recovery the day after
  // (match_week.ts). Coach-assigned sessions follow the coach's own plan.
  if (create_session && beta_individual_subject_user_id) {
    const matchWeek = await applyAthleteMatchWeek(beta_individual_subject_user_id, planned_session_from_engine.exercises as any);
    if (!matchWeek.ok) {
      throw badRequest("Match day rest", { failure_token: matchWeek.failure_token, details: matchWeek.details });
    }
    planned_session_from_engine = { ...planned_session_from_engine, exercises: matchWeek.exercises as any };
  }
  // A fighter who competes at a weight class keeps strength without building
  // mass in the 4 weeks before a fight (weight_class.ts) - on a coach's
  // programme too, since it follows the fighter's own declaration.
  if (create_session && pain_subject_user_id) {
    const camp = await applyAthleteFightCamp(pain_subject_user_id, planned_session_from_engine.exercises as any);
    planned_session_from_engine = { ...planned_session_from_engine, exercises: camp.exercises as any };
  }
  // What a self-directed athlete actually did last time holds an exercise
  // back (missed reps, RPE 9.5+) - never adds load (autoregulation_service.ts).
  // Runs before any weight is worked out from a % of 1RM.
  if (create_session && beta_individual_subject_user_id) {
    planned_session_from_engine = {
      ...planned_session_from_engine,
      exercises: (await autoregulateSession(beta_individual_subject_user_id, planned_session_from_engine.exercises as any)) as any
    };
  }
  // A self-directed athlete's % of 1RM work becomes a weight from their own
  // maxes (or an RPE target when none is recorded); coach-assigned sessions
  // already carry the coach's resolved loads.
  if (create_session && beta_individual_subject_user_id) {
    planned_session_from_engine = {
      ...planned_session_from_engine,
      exercises: (await resolveAthleteSessionLoads(
        beta_individual_subject_user_id,
        planned_session_from_engine.exercises as any,
        typeof (canonical_input as any)?.experience_level === "string" ? (canonical_input as any).experience_level : undefined
      )) as any
    };
  }
  // Back after a break (or a head injury) on a Kolosseum programme: the
  // re-entry week's sessions are lighter (programme_reentry.ts), and the run
  // then carries on from where it left off. A generated programme makes the
  // whole week a deload instead (training_cycle.ts).
  if (create_session && (programme_run_session || own_training_session) && session_reentry?.reentry_week) {
    planned_session_from_engine = {
      ...planned_session_from_engine,
      exercises: lighterForReentry(planned_session_from_engine.exercises as any, session_reentry as any) as any,
      ...(programme_run_session ? { programme_run: { ...programme_run_session, reentry: session_reentry } } : {}),
      ...(own_training_session ? { own_training: { ...own_training_session, reentry: session_reentry } } : {})
    } as any;
  }
  // A coached athlete back from 10+ days away gets the same lighter first
  // week on their coach's programme - never the next session unchanged, and
  // never a competition-timed skip into heavier weeks at full load. (A return
  // from a head injury is already made lighter for coached athletes above.)
  if (create_session && template_position && !programme_run_session && beta_session_binding?.subject_user_id) {
    const back = await gapReentryForAthlete(beta_session_binding.subject_user_id);
    if (back?.reentry_week && !(planned_session_from_engine as any).head_injury_return) {
      planned_session_from_engine = {
        ...planned_session_from_engine,
        exercises: lighterForReentry(planned_session_from_engine.exercises as any, back as any) as any,
        template_position: { ...template_position, reentry: back }
      } as any;
    }
  }

  // A self-directed athlete's session opens with a warm-up for what it trains
  // and ends with stretches for it - last, so it fits what the session became
  // after pain, readiness, equipment, match-week and re-entry adjustments
  // (session_bookends.ts). A Kolosseum programme brings its own; a coach's
  // programme is left as the coach wrote it.
  if (create_session && beta_individual_subject_user_id && !programme_run_session) {
    planned_session_from_engine = {
      ...planned_session_from_engine,
      exercises: withSessionBookends(planned_session_from_engine.exercises as any, exercisePatternOf) as any
    };
  }

  const runtime_events = parseRuntimeEvents(readRuntimeEvents(body));

  let runtime_state: any;
  try {
    runtime_state = applyRuntimeEvents(planned_session_from_engine as any, runtime_events as any);

    if (process.env.KOLOSSEUM_TEST_FORCE_RUNTIME_APPLY_THROW === "1") {
      throw new Error("KOLOSSEUM_TEST_FORCE_RUNTIME_APPLY_THROW: unhandled apply failure sentinel");
    }

    if (runtime_state && typeof runtime_state === "object") {
      const rt = runtime_state.runtime_trace;
      if (rt && typeof rt === "object") {
        const {
          split_active: _legacySplitActive,
          remaining_at_split_ids: _legacyRemainingAtSplitIds,
          return_gate_required: _legacyReturnGateRequired,
          return_decision_required: _derivedReturnDecisionRequired,
          return_decision_options: _derivedReturnDecisionOptions,
          ...traceBase
        } = rt as Record<string, any>;

        runtime_state.runtime_trace = traceBase;
      }
    }
  } catch (e: unknown) {
    mapEngineRuntimeApplyError(e);
  }

  const remaining_ids: string[] = Array.isArray(runtime_state?.remaining_ids)
    ? runtime_state.remaining_ids.map((x: any) => String(x))
    : [];

  const completed_ids: string[] =
    runtime_state?.completed_ids instanceof Set
      ? Array.from(runtime_state.completed_ids).map((x: any) => String(x))
      : (Array.isArray(runtime_state?.completed_ids)
          ? runtime_state.completed_ids.map((x: any) => String(x))
          : []);

  const dropped_ids: string[] =
    runtime_state?.dropped_ids instanceof Set
      ? Array.from(runtime_state.dropped_ids).map((x: any) => String(x))
      : (Array.isArray(runtime_state?.dropped_ids)
          ? runtime_state.dropped_ids.map((x: any) => String(x))
          : (runtime_state?.skipped_ids instanceof Set
              ? Array.from(runtime_state.skipped_ids).map((x: any) => String(x))
              : (Array.isArray(runtime_state?.skipped_ids)
                  ? runtime_state.skipped_ids.map((x: any) => String(x))
                  : [])));

  const return_decision_required: boolean =
    typeof runtime_state?.return_decision_required === "boolean" ? runtime_state.return_decision_required : false;

  const return_decision_options: Array<"RETURN_CONTINUE" | "RETURN_SKIP"> =
    Array.isArray(runtime_state?.return_decision_options)
      ? runtime_state.return_decision_options
          .map((x: any) => String(x))
          .filter((x: string) => x === "RETURN_CONTINUE" || x === "RETURN_SKIP")
      : [];

  const runtime_trace_from_engine = {
    remaining_ids,
    completed_ids,
    dropped_ids,
    return_decision_required,
    return_decision_options
  };

  const completedSet = new Set(completed_ids);
  const droppedSet = new Set(dropped_ids);

  const planned_session_applied: Phase6SessionOutput = {
    ...planned_session_from_engine,
    exercises: planned_session_from_engine.exercises.map((e: any) => {
      const exId = String(e.exercise_id ?? "");
      const status = completedSet.has(exId) ? "completed" : (droppedSet.has(exId) ? "skipped" : "pending");
      return { ...e, status };
    })
  };

  const phase2_canonical_payload = {
    phase2_canonical_json: p2.phase2.phase2_canonical_json,
    phase2_hash: p2.phase2.phase2_hash,
    canonical_input_hash: p2.phase2.canonical_input_hash
  };

  const persisted = await persistCompiledBlockAndMaybeCreateSession({
    engine_version,
    canonical_hash,
    canonical_input,
    phase2_canonical_payload,
    phase3_output: p3.phase3,
    phase4_program: programForSession,
    phase5_adjustments,
    planned_session_from_engine,
    create_session,
    beta_subject_user_id:
      beta_session_binding
        ?.subject_user_id ??
      beta_individual_subject_user_id,
    beta_coach_user_id:
      beta_session_binding
        ?.coach_user_id,
    beta_assignment_id:
      beta_session_binding
        ?.assignment_id
  });

  const status = create_session ? 201 : (persisted.created_block ? 201 : 200);

  const totalExercises = Array.isArray(planned_session_applied?.exercises) ? planned_session_applied.exercises.length : 0;
  const completedWorkItems = completed_ids.length;
  const isTerminalReplay = totalExercises > 0 && remaining_ids.length === 0 && return_decision_required === false;

  const splitEntered =
    Array.isArray(runtime_events) &&
    runtime_events.some((ev: any) => ev && typeof ev === "object" && ev.type === "SPLIT_SESSION");

  const splitReturnDecision =
    Array.isArray(runtime_events)
      ? ((runtime_events.find((ev: any) =>
          ev && typeof ev === "object" && (ev.type === "RETURN_CONTINUE" || ev.type === "RETURN_SKIP")
        )?.type) ?? null)
      : null;

  const replayExecutionStatus =
    splitReturnDecision === "RETURN_CONTINUE"
      ? "completed"
      : (splitReturnDecision === "RETURN_SKIP"
          ? "partial"
          : (isTerminalReplay ? "completed" : (planned_session_applied?.status ?? "ready")));

  const workItemsDone =
    splitReturnDecision === "RETURN_CONTINUE"
      ? totalExercises
      : (splitReturnDecision === "RETURN_SKIP"
          ? completedWorkItems
          : (replayExecutionStatus === "completed" ? totalExercises : completedWorkItems));

  const shouldEmitExecutionSummary =
    splitReturnDecision === "RETURN_CONTINUE" ||
    splitReturnDecision === "RETURN_SKIP" ||
    isTerminalReplay;

  const sessionExecutionSummary = shouldEmitExecutionSummary
    ? [{
        session_ended: true,
        work_items_done: workItemsDone,
        work_items_total: totalExercises,
        split_entered: splitEntered,
        split_return_decision: splitReturnDecision === "RETURN_CONTINUE"
          ? "continue"
          : (splitReturnDecision === "RETURN_SKIP" ? "skip" : null),
        execution_status: replayExecutionStatus
      }]
    : [];

  const blockExecutionSummary = shouldEmitExecutionSummary
    ? [{
        sessions_total: 1,
        sessions_ended: 1,
        work_items_done: workItemsDone,
        work_items_total: totalExercises
      }]
    : [];

  const replayStateEnvelope = {
    ...runtime_state,
    trace: runtime_trace_from_engine,
    execution_status: replayExecutionStatus,
    current_step: null,
    session_execution_summary: sessionExecutionSummary,
    block_execution_summary: blockExecutionSummary
  };

  const payload: any = {
    block_id: persisted.persisted_block_id,
    engine_version,
    canonical_hash,
    planned_session: planned_session_applied,
    runtime_trace: runtime_trace_from_engine
  };

  if (replayKeysProvided) {
    payload.events = runtime_events;
    const runtimeStateKey = ["runtime", "state"].join("_");
    payload[runtimeStateKey] = replayStateEnvelope;
  }

  if (persisted.session_id) payload.session_id = persisted.session_id;

  const coachTemplateExecution =
    isRecord(
      programForSession
        ?.coach_template_execution
    )
      ? programForSession
          .coach_template_execution
      : null;

  if (beta_path_admission) {
    payload.beta_path = {
      surface_id:
        beta16AppPathContract.surface_id,
      version:
        beta16AppPathContract.version,
      phase_range:
        beta16AppPathContract.phase_range,
      user_id:
        beta_path_admission.user_id,
      acknowledgement_id:
        beta_path_admission
          .acknowledgement_id,
      declaration_id:
        beta_path_admission
          .declaration_id,
      declared_input_sha256:
        beta_path_admission
          .declared_input_sha256,
      copy_ids:
        beta_path_admission.copy_ids,
      admission_source:
        beta_session_binding
          ? "stored_product_records"
          : "request_context",
      coach_user_id:
        beta_session_binding
          ?.coach_user_id ??
        null,
      assignment_id:
        beta_session_binding
          ?.assignment_id ??
        null,
      template_id:
        beta_session_binding
          ?.template_id ??
        null,
      template_session_title:
        coachTemplateExecution
          ? asString(
              coachTemplateExecution
                .template_session_title
            ) ?? null
          : null,
      template_session_coaching_notes:
        coachTemplateExecution
          ? asString(
              coachTemplateExecution
                .template_session_coaching_notes
            ) ?? null
          : null,
      template_block_name:
        coachTemplateExecution
          ? asString(
              coachTemplateExecution
                .template_block_name
            ) ?? null
          : null,
      template_week_index_global:
        coachTemplateExecution &&
        Number.isInteger(
          coachTemplateExecution
            .template_week_index_global
        )
          ? Number(
              coachTemplateExecution
                .template_week_index_global
            )
          : null,
      event_id:
        beta_session_binding
          ?.event_id ??
        null,
      event_plan:
        coachTemplateExecution &&
        isRecord(
          coachTemplateExecution
            .event_plan
        )
          ? coachTemplateExecution
              .event_plan
          : null,
      event_compile_summary:
        coachTemplateExecution &&
        isRecord(
          coachTemplateExecution
            .event_compile_summary
        )
          ? coachTemplateExecution
              .event_compile_summary
          : null
    };
  }

  return res.status(status).json(payload);
}

/**
 * GET /blocks/:block_id
 */
export async function getBlock(req: Request, res: Response) {
  const block_id = asString(req.params?.block_id);
  if (!block_id) throw badRequest("Missing block_id");

  const payload = await getBlockByIdQuery(block_id);
  if (!payload) throw notFound("Block not found");

  return res.json(payload);
}

/**
 * POST /blocks/:block_id/sessions
 * body: { planned_session: <Phase6SessionOutput> }
 */
export async function createSessionFromBlock(req: Request, res: Response) {
  const block_id = asString(req.params?.block_id);
  if (!block_id) throw badRequest("Missing block_id");

  const planned_session = (req.body as any)?.planned_session as Phase6SessionOutput | undefined;
  if (!planned_session || typeof planned_session !== "object") {
    throw badRequest("Missing planned_session");
  }

  const result = await createSessionFromBlockMutation(block_id, planned_session);
  return res.status(201).json(result);
}

/**
 * GET /blocks/:block_id/sessions
 */
export async function listBlockSessions(req: Request, res: Response) {
  const block_id = asString(req.params?.block_id);
  if (!block_id) throw badRequest("Missing block_id");

  const payload = await listBlockSessionsQuery(block_id);
  return res.json(payload);
}
