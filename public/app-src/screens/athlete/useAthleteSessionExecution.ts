import { useCallback, useEffect, useRef, useState } from "react";

import { loadAccountDetail } from "../../api/client";
import {
  loadAthleteSessionState,
  loadExerciseContent,
  loadExerciseReferenceMedia,
  postAthleteSessionEvent,
  requestSessionSubstitution,
  startAthleteSession,
  uploadSessionVideoFeedback,
  validateSessionVideoFeedbackClientSide
} from "../../api/athleteSessionClient";
import { type JsonRecord } from "../../api/transport";

// DEV NOTE: FULL-UI-15C session execution - ported from app.js's
// startSession()/postSessionEvent()/loadSessionState()/
// confirmSkipWithReason()/confirmPainReport()/confirmRpeReport()/
// confirmBorgReport()/confirmCr10Report()/
// checkSubstitution()/applySubstitution()/uploadExerciseVideo()/
// startRestTimer() family/renderExerciseFocus() family. createSession() and
// loadAthleteToday() stay fully legacy (they reach into
// state.phase1Input/state.coachCode/state.authRecord bootstrap fields no
// other migrated screen needs) - this hook only owns the Session view once
// a session already exists. It independently fetches the session's own
// /state (same pattern as useAthleteToday.ts) rather than trusting
// legacy's cached copy, and listens for the same kolosseum:today-changed
// event legacy's notifyTodayChanged() already dispatches after every
// loadSessionState() call (on view entry, after loadAthleteToday(), and -
// once wired below - after every mutation this hook performs), so no new
// read-direction bridge event is needed.
//
// For the write direction, a single kolosseum:athlete-session-mutated event
// tells legacy to bump its own state.localSessions runtime_event_count
// cache and re-run its own (now-trimmed) loadSessionState() - which keeps
// state.history/state.activeSessionState/Today's "recent activity" preview
// in sync exactly as it was before this migration, just triggered from
// React instead of from app.js's own action handlers.
const TODAY_CHANGED_EVENT = "kolosseum:today-changed";
const SESSION_MUTATED_EVENT = "kolosseum:athlete-session-mutated";
const STORAGE_KEY = "kolosseum.product.app.v1";

function readActiveSessionId(): string | null {
  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}") as { activeSessionId?: unknown };
    return typeof stored.activeSessionId === "string" && stored.activeSessionId ? stored.activeSessionId : null;
  }
  catch {
    return null;
  }
}

function notifyMutated(sessionId: string, refreshHistory: boolean) {
  document.dispatchEvent(new CustomEvent(SESSION_MUTATED_EVENT, { detail: { session_id: sessionId, refreshHistory } }));
}

export type ActionPanelKind = "skip" | "pain" | "rpe" | "borg" | "cr10" | "substitution" | "video" | null;

export type HowtoState = {
  exerciseId: string;
  status: "loading" | "loaded" | "error";
  content?: JsonRecord;
  referenceMedia?: JsonRecord | null;
} | null;

export type SubstitutionResultState = { exerciseId: string; outcome: JsonRecord } | null;

export type AthleteSessionExecutionState = {
  loading: boolean;
  error: boolean;
  sessionId: string | null;
  sessionState: JsonRecord | null;
  busy: boolean;
  actionPanel: ActionPanelKind;
  skipReasonCode: string;
  rpeValue: number;
  borgValue: number;
  cr10Value: number;
  substitutionUnavailableEquipment: string[];
  substitutionResult: SubstitutionResultState;
  substitutionChecking: boolean;
  videoUploading: boolean;
  videoError: string | null;
  restRemainingSeconds: number | null;
  restDone: boolean;
  howto: HowtoState;
};

const initialState: AthleteSessionExecutionState = {
  loading: true,
  error: false,
  sessionId: null,
  sessionState: null,
  busy: false,
  actionPanel: null,
  skipReasonCode: "equipment_unavailable",
  rpeValue: 8,
  borgValue: 13,
  cr10Value: 5,
  substitutionUnavailableEquipment: [],
  substitutionResult: null,
  substitutionChecking: false,
  videoUploading: false,
  videoError: null,
  restRemainingSeconds: null,
  restDone: false,
  howto: null
};

export function currentStepExercise(sessionState: JsonRecord | null): JsonRecord | null {
  const step = sessionState?.current_step as JsonRecord | undefined;
  if (!step || step.type === "RETURN_DECISION") return null;
  return (step.exercise as JsonRecord | undefined) ?? null;
}

export function currentExerciseId(sessionState: JsonRecord | null): string | null {
  const exercise = currentStepExercise(sessionState);
  const id = exercise?.exercise_id ?? exercise?.item_id;
  return id ? String(id) : null;
}

const howtoCache = new Map<string, { content: JsonRecord; referenceMedia: JsonRecord | null }>();

export function useAthleteSessionExecution() {
  const [state, setState] = useState<AthleteSessionExecutionState>(initialState);
  const restIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const restTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    const sessionId = readActiveSessionId();

    if (!sessionId) {
      setState((current) => ({
        ...current,
        loading: false,
        error: false,
        sessionId: null,
        sessionState: null,
        actionPanel: null,
        substitutionResult: null,
        videoError: null,
        howto: null
      }));
      return;
    }

    setState((current) => ({ ...current, loading: true, sessionId }));

    try {
      const sessionState = await loadAthleteSessionState(sessionId);
      setState((current) => ({
        ...current,
        loading: false,
        error: false,
        sessionId,
        sessionState,
        actionPanel: null,
        skipReasonCode: "equipment_unavailable",
        rpeValue: 8,
        borgValue: 13,
        cr10Value: 5,
        substitutionUnavailableEquipment: [],
        substitutionResult: null,
        videoError: null,
        howto: null
      }));
    }
    catch {
      setState((current) => ({ ...current, loading: false, error: true }));
    }
  }, []);

  useEffect(() => {
    refresh();
    document.addEventListener(TODAY_CHANGED_EVENT, refresh);
    return () => document.removeEventListener(TODAY_CHANGED_EVENT, refresh);
  }, [refresh]);

  const stopRestTimer = useCallback(() => {
    if (restIntervalRef.current !== null) {
      clearInterval(restIntervalRef.current);
      restIntervalRef.current = null;
    }
    if (restTimeoutRef.current !== null) {
      clearTimeout(restTimeoutRef.current);
      restTimeoutRef.current = null;
    }
    setState((current) => ({ ...current, restRemainingSeconds: null, restDone: false }));
  }, []);

  const playRestCompleteCue = useCallback(() => {
    try {
      if (typeof navigator.vibrate === "function") navigator.vibrate([180, 80, 180]);
    }
    catch {
      // Vibration is a best-effort cue; ignore if unsupported or blocked.
    }

    try {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;
      const context = new AudioContextClass();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = 880;
      gain.gain.setValueAtTime(0.15, context.currentTime);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.4);
      oscillator.onended = () => context.close();
    }
    catch {
      // AudioContext can be blocked pre-interaction in some browsers; the
      // visual done-state is the primary cue, this is a best-effort extra.
    }
  }, []);

  const startRestTimer = useCallback((totalSeconds: number) => {
    if (restIntervalRef.current !== null) clearInterval(restIntervalRef.current);
    if (restTimeoutRef.current !== null) clearTimeout(restTimeoutRef.current);

    let remaining = totalSeconds;
    setState((current) => ({ ...current, restRemainingSeconds: remaining, restDone: false }));

    restIntervalRef.current = setInterval(() => {
      remaining -= 1;

      if (remaining <= 0) {
        if (restIntervalRef.current !== null) clearInterval(restIntervalRef.current);
        restIntervalRef.current = null;
        setState((current) => ({ ...current, restRemainingSeconds: 0, restDone: true }));
        playRestCompleteCue();
        restTimeoutRef.current = setTimeout(() => {
          setState((current) => ({ ...current, restRemainingSeconds: null, restDone: false }));
        }, 2500);
        return;
      }

      setState((current) => ({ ...current, restRemainingSeconds: remaining }));
    }, 1000);
  }, [playRestCompleteCue]);

  const maybeStartRestTimer = useCallback((sessionState: JsonRecord | null) => {
    const exercise = currentStepExercise(sessionState);
    const restSeconds = Number(exercise?.rest_seconds);
    if (Number.isInteger(restSeconds) && restSeconds > 0) startRestTimer(restSeconds);
  }, [startRestTimer]);

  useEffect(() => () => {
    if (restIntervalRef.current !== null) clearInterval(restIntervalRef.current);
    if (restTimeoutRef.current !== null) clearTimeout(restTimeoutRef.current);
  }, []);

  const runMutation = useCallback(async (perform: (sessionId: string, csrfToken: string) => Promise<void>, refreshHistory: boolean) => {
    const sessionId = readActiveSessionId();
    if (!sessionId) return false;

    setState((current) => ({ ...current, busy: true }));
    try {
      const account = await loadAccountDetail();
      const csrfToken = typeof account.csrf_token === "string" ? account.csrf_token : "";
      await perform(sessionId, csrfToken);
      notifyMutated(sessionId, refreshHistory);
      await refresh();
      setState((current) => ({ ...current, busy: false }));
      return true;
    }
    catch {
      setState((current) => ({ ...current, busy: false }));
      return false;
    }
  }, [refresh]);

  const startSession = useCallback(async () => {
    return runMutation(async (sessionId, csrfToken) => {
      await startAthleteSession(sessionId, csrfToken);
    }, false);
  }, [runMutation]);

  const completeStep = useCallback(async () => {
    maybeStartRestTimer(state.sessionState);
    return runMutation(async (sessionId, csrfToken) => {
      await postAthleteSessionEvent(sessionId, { type: "COMPLETE_STEP" }, csrfToken);
    }, true);
  }, [runMutation, maybeStartRestTimer, state.sessionState]);

  const openActionPanel = useCallback((panel: ActionPanelKind) => {
    if (!currentExerciseId(state.sessionState)) return;
    setState((current) => ({ ...current, actionPanel: panel }));
  }, [state.sessionState]);

  const closeActionPanel = useCallback(() => {
    setState((current) => ({ ...current, actionPanel: null, substitutionResult: null }));
  }, []);

  const setSkipReasonCode = useCallback((code: string) => {
    setState((current) => ({ ...current, skipReasonCode: code }));
  }, []);

  const confirmSkipWithReason = useCallback(async () => {
    const exerciseId = currentExerciseId(state.sessionState);
    if (!exerciseId) return false;
    const reasonCode = state.skipReasonCode;
    setState((current) => ({ ...current, actionPanel: null }));
    return runMutation(async (sessionId, csrfToken) => {
      await postAthleteSessionEvent(sessionId, { type: "SKIP_EXERCISE", exercise_id: exerciseId, reason_code: reasonCode }, csrfToken);
    }, true);
  }, [runMutation, state.sessionState, state.skipReasonCode]);

  const confirmPainReport = useCallback(async () => {
    const exerciseId = currentExerciseId(state.sessionState);
    if (!exerciseId) return false;
    setState((current) => ({ ...current, actionPanel: null }));
    return runMutation(async (sessionId, csrfToken) => {
      await postAthleteSessionEvent(sessionId, { type: "PAIN_REPORT", exercise_id: exerciseId, pain_reported: true }, csrfToken);
    }, true);
  }, [runMutation, state.sessionState]);

  const setRpeValue = useCallback((value: number) => {
    setState((current) => ({ ...current, rpeValue: value }));
  }, []);

  const confirmRpeReport = useCallback(async () => {
    const exerciseId = currentExerciseId(state.sessionState);
    if (!exerciseId) return false;
    const rpeValue = state.rpeValue;
    setState((current) => ({ ...current, actionPanel: null }));
    return runMutation(async (sessionId, csrfToken) => {
      await postAthleteSessionEvent(sessionId, { type: "RPE_REPORT", exercise_id: exerciseId, rpe_value: rpeValue }, csrfToken);
    }, true);
  }, [runMutation, state.sessionState, state.rpeValue]);

  const setBorgValue = useCallback((value: number) => {
    setState((current) => ({ ...current, borgValue: value }));
  }, []);

  const confirmBorgReport = useCallback(async () => {
    const exerciseId = currentExerciseId(state.sessionState);
    if (!exerciseId) return false;
    const borgValue = state.borgValue;
    setState((current) => ({ ...current, actionPanel: null }));
    return runMutation(async (sessionId, csrfToken) => {
      await postAthleteSessionEvent(sessionId, { type: "BORG_REPORT", exercise_id: exerciseId, borg_value: borgValue }, csrfToken);
    }, true);
  }, [runMutation, state.sessionState, state.borgValue]);

  const setCr10Value = useCallback((value: number) => {
    setState((current) => ({ ...current, cr10Value: value }));
  }, []);

  const confirmCr10Report = useCallback(async () => {
    const exerciseId = currentExerciseId(state.sessionState);
    if (!exerciseId) return false;
    const cr10Value = state.cr10Value;
    setState((current) => ({ ...current, actionPanel: null }));
    return runMutation(async (sessionId, csrfToken) => {
      await postAthleteSessionEvent(sessionId, { type: "CR10_REPORT", exercise_id: exerciseId, cr10_value: cr10Value }, csrfToken);
    }, true);
  }, [runMutation, state.sessionState, state.cr10Value]);

  const toggleSubstitutionEquipment = useCallback((equipmentId: string) => {
    setState((current) => {
      const has = current.substitutionUnavailableEquipment.includes(equipmentId);
      return {
        ...current,
        substitutionUnavailableEquipment: has
          ? current.substitutionUnavailableEquipment.filter((id) => id !== equipmentId)
          : [...current.substitutionUnavailableEquipment, equipmentId]
      };
    });
  }, []);

  const checkSubstitution = useCallback(async () => {
    const exerciseId = currentExerciseId(state.sessionState);
    const sessionId = readActiveSessionId();
    if (!exerciseId || !sessionId) return;

    setState((current) => ({ ...current, substitutionChecking: true }));
    try {
      const account = await loadAccountDetail();
      const csrfToken = typeof account.csrf_token === "string" ? account.csrf_token : "";
      const outcome = await requestSessionSubstitution(sessionId, exerciseId, state.substitutionUnavailableEquipment, csrfToken);
      setState((current) => ({ ...current, substitutionChecking: false, substitutionResult: { exerciseId, outcome } }));
    }
    catch {
      setState((current) => ({ ...current, substitutionChecking: false, substitutionResult: { exerciseId, outcome: { ok: false } } }));
    }
  }, [state.sessionState, state.substitutionUnavailableEquipment]);

  const applySubstitution = useCallback(async (eventType: "COMPLETE_EXERCISE" | "SKIP_EXERCISE") => {
    const result = state.substitutionResult;
    const exerciseId = currentExerciseId(state.sessionState);
    if (!result || result.exerciseId !== exerciseId) return false;
    const outcome = result.outcome as JsonRecord;
    const output = (outcome?.result as JsonRecord | undefined)?.substitution_output as JsonRecord | undefined;
    if (outcome?.ok !== true || (outcome.result as JsonRecord | undefined)?.substitution_status !== "substitution_applied" || !output) {
      return false;
    }

    setState((current) => ({ ...current, actionPanel: null, substitutionResult: null }));
    if (eventType === "COMPLETE_EXERCISE") maybeStartRestTimer(state.sessionState);

    return runMutation(async (sessionId, csrfToken) => {
      await postAthleteSessionEvent(sessionId, {
        type: eventType,
        exercise_id: exerciseId,
        substituted_exercise_id: output.target_exercise_id,
        substitution_edge_id: output.substitution_edge_id
      }, csrfToken);
    }, true);
  }, [runMutation, state.sessionState, state.substitutionResult, maybeStartRestTimer]);

  const uploadVideo = useCallback(async (file: File | undefined, caption: string) => {
    const exerciseId = currentExerciseId(state.sessionState);
    const sessionId = readActiveSessionId();
    const exercise = currentStepExercise(state.sessionState);
    if (!exerciseId || !sessionId) return false;

    const validationError = validateSessionVideoFeedbackClientSide(file);
    if (validationError) {
      setState((current) => ({ ...current, videoError: validationError }));
      return false;
    }

    setState((current) => ({ ...current, videoUploading: true, videoError: null }));
    try {
      const account = await loadAccountDetail();
      const csrfToken = typeof account.csrf_token === "string" ? account.csrf_token : "";
      const exerciseLabel = String(exercise?.display_name ?? exercise?.exercise_name ?? exerciseId ?? "Exercise");
      await uploadSessionVideoFeedback({ sessionId, exerciseId, exerciseLabel, file: file as File, caption }, csrfToken);
      setState((current) => ({ ...current, videoUploading: false, actionPanel: null }));
      return true;
    }
    catch (error) {
      setState((current) => ({
        ...current,
        videoUploading: false,
        videoError: error instanceof Error ? error.message : "Video could not be uploaded."
      }));
      return false;
    }
  }, [state.sessionState]);

  const splitSession = useCallback(async () => {
    return runMutation(async (sessionId, csrfToken) => {
      await postAthleteSessionEvent(sessionId, { type: "SPLIT_SESSION" }, csrfToken);
    }, true);
  }, [runMutation]);

  const returnContinue = useCallback(async () => {
    return runMutation(async (sessionId, csrfToken) => {
      await postAthleteSessionEvent(sessionId, { type: "RETURN_CONTINUE" }, csrfToken);
    }, true);
  }, [runMutation]);

  const returnSkip = useCallback(async () => {
    return runMutation(async (sessionId, csrfToken) => {
      await postAthleteSessionEvent(sessionId, { type: "RETURN_SKIP" }, csrfToken);
    }, true);
  }, [runMutation]);

  const loadHowto = useCallback(async (exerciseId: string) => {
    if (!exerciseId) return;

    const cached = howtoCache.get(exerciseId);
    if (cached) {
      setState((current) => ({ ...current, howto: { exerciseId, status: "loaded", ...cached } }));
      return;
    }

    setState((current) => ({ ...current, howto: { exerciseId, status: "loading" } }));
    try {
      const [content, referenceMediaResult] = await Promise.all([
        loadExerciseContent(exerciseId),
        loadExerciseReferenceMedia(exerciseId).catch(() => null)
      ]);
      const referenceMedia = (referenceMediaResult?.reference_media as JsonRecord | undefined) ?? null;
      howtoCache.set(exerciseId, { content, referenceMedia });
      setState((current) => (current.howto?.exerciseId === exerciseId
        ? { ...current, howto: { exerciseId, status: "loaded", content, referenceMedia } }
        : current));
    }
    catch {
      setState((current) => (current.howto?.exerciseId === exerciseId
        ? { ...current, howto: { exerciseId, status: "error" } }
        : current));
    }
  }, []);

  return {
    ...state,
    refresh,
    startSession,
    completeStep,
    openActionPanel,
    closeActionPanel,
    setSkipReasonCode,
    confirmSkipWithReason,
    confirmPainReport,
    setRpeValue,
    confirmRpeReport,
    setBorgValue,
    confirmBorgReport,
    setCr10Value,
    confirmCr10Report,
    toggleSubstitutionEquipment,
    checkSubstitution,
    applySubstitution,
    uploadVideo,
    splitSession,
    returnContinue,
    returnSkip,
    stopRestTimer,
    loadHowto
  };
}
