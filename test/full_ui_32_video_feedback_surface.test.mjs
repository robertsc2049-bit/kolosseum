// DEV NOTE: FULL-UI-32 exercise video feedback static surface contract.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const storage = read("src/api/video_submission_storage.ts");
const service = read("src/api/video_feedback_service.ts");
const athleteRoutes = read("src/api/video_feedback.routes.ts");
const coachRoutes = read("src/api/video_feedback_coach.routes.ts");
const serverTs = read("src/server.ts");
const schema = read("schema.sql");
const appJs = read("public/app/app.js");
const indexHtml = read("public/app/index.html");
const historyPanel = read("public/app-src/screens/athlete/AthleteHistoryPanel.tsx");
const guard = read("ci/guards/full_ui_completion_guard.mjs");
const manifest = JSON.parse(read("product/ui/function_manifest.json"));
// DEV NOTE: the coach's video-feedback queue (list + detail + reply) moved
// to React - see public/app-src/screens/coach/CoachVideoFeedbackQueuePanel.tsx
// and its __tests__ file for behavioral coverage. The athlete's own
// capture control (recordVideoFeedbackButton/uploadExerciseVideo) stays
// legacy - it's a different surface (session-in-progress video capture,
// not the coach's review queue).
const coachVideoFeedbackQueuePanel = read("public/app-src/screens/coach/CoachVideoFeedbackQueuePanel.tsx");
const useCoachVideoFeedbackQueue = read("public/app-src/screens/coach/useCoachVideoFeedbackQueue.ts");

const forbiddenEngineImports = /session_state_write_service\.js|session_state_query_service\.js|block_compile_write_service\.js|engine_runner_service\.js|@kolosseum\/engine|engine\/src\//u;

test("video feedback is mounted at /video-feedback (athlete) and /coach-workspace (coach) with the expected routes", () => {
  assert.match(serverTs, /app\.use\("\/video-feedback", videoFeedbackRouter\)/u);
  assert.match(serverTs, /app\.use\("\/coach-workspace", videoFeedbackCoachRouter\)/u);

  for (const path_ of ['"/"', '"/submissions"', '"/submissions/:submission_id"', '"/submissions/:submission_id/media"', '"/submissions/:submission_id/thumbnail"']) {
    assert.ok(athleteRoutes.includes(path_), `expected athlete video-feedback route ${path_}`);
  }

  for (const path_ of [
    '"/video-feedback/queue"',
    '"/video-feedback/submissions/:submission_id"',
    '"/video-feedback/submissions/:submission_id/feedback"',
    '"/video-feedback/submissions/:submission_id/media"',
    '"/video-feedback/submissions/:submission_id/thumbnail"'
  ]) {
    assert.ok(coachRoutes.includes(path_), `expected coach video-feedback route ${path_}`);
  }
});

test("identity is resolved from the session cookie only, never a client-supplied user_id", () => {
  assert.doesNotMatch(athleteRoutes, /request\.body\.(?:coach_|athlete_)?user_id|request\.query\.(?:coach_|athlete_)?user_id/u);
  assert.match(athleteRoutes, /authenticatedAthlete\(request, true\)/u);
  assert.match(athleteRoutes, /authenticatedAthlete\(request, false\)/u);
  assert.match(athleteRoutes, /async function authenticatedAthlete/u);
  assert.match(athleteRoutes, /import \{ cookieValue \} from "\.\/coach_session_auth\.js"/u);

  assert.doesNotMatch(coachRoutes, /request\.body\.(?:coach_|athlete_)?user_id|request\.query\.(?:coach_|athlete_)?user_id/u);
  assert.match(coachRoutes, /authenticatedCoach\(request, false\)/u);
  assert.match(coachRoutes, /authenticatedCoach\(request, true\)/u);
});

test("an athlete's uploaded coach is never client-supplied - it is resolved from the session's own beta_coach_user_id column", () => {
  assert.doesNotMatch(athleteRoutes, /coach_user_id/u);
  assert.match(service, /async function resolveAthleteSessionCoach/u);
  assert.match(service, /SELECT beta_subject_user_id, beta_coach_user_id FROM sessions WHERE session_id/u);
  assert.match(service, /never a client-supplied coach id/u);
});

test("the coach-facing surface can only read and reply - no route lets a coach create a submission", () => {
  assert.doesNotMatch(coachRoutes, /videoFeedbackCoachRouter\.post\(\s*["'`]\/video-feedback\/submissions["'`]/u);
  assert.match(coachRoutes, /videoFeedbackCoachRouter\.post\(\s*\n?\s*"\/video-feedback\/submissions\/:submission_id\/feedback"/u);
});

test("the athlete upload route requires a real file and validates it via content-sniffing before persisting, video-only", () => {
  assert.match(athleteRoutes, /videoFeedbackRouter\.post\(\s*\n?\s*"\/",\s*\n?\s*videoSubmissionUpload\.single\("video"\)/u);
  assert.match(storage, /never trusted/u);
  assert.match(storage, /async function sniffVideoFile/u);
  assert.match(storage, /validateStagedVideoUpload/u);
  assert.match(storage, /video_submission_type_unsupported/u);
  assert.match(storage, /video_submission_too_large/u);
  assert.doesNotMatch(storage, /const MAX_IMAGE_BYTES|"image\/jpeg"|"image\/png"/u);
});

test("uploaded videos are never served through express.static, and storage keys are path-traversal-guarded", () => {
  assert.doesNotMatch(serverTs, /express\.static\([^)]*video-(feedback|submissions)/u);
  assert.match(storage, /function resolveVideoSubmissionPath/u);
  assert.match(storage, /resolved !== STORAGE_ROOT && !resolved\.startsWith\(STORAGE_ROOT \+ path\.sep\)/u);
});

test("a coach relationship must be accepted (not just invited, expired or revoked) before a submission can be created or replied to", () => {
  assert.match(service, /relationship_scope !== "individual_coach_athlete"/u);
  assert.match(service, /relationship_state !== "accepted"/u);
  assert.match(service, /revoked_at_iso8601 !== null/u);
  assert.match(service, /expires_at_iso8601 !== null/u);
});

test("video upload is idempotent on client_request_id and a replay cleans up its now-redundant staged file", () => {
  assert.match(schema, /UNIQUE \(athlete_user_id, client_request_id\)/u);
  assert.match(service, /ON CONFLICT \(athlete_user_id, client_request_id\) DO NOTHING/u);
  assert.match(service, /async function cleanupStagedUpload/u);
});

test("replying to a submission flips it out of the pending queue in the same transaction as the feedback write", () => {
  assert.match(service, /UPDATE product_video_submissions SET review_status = 'reviewed', reviewed_at = now\(\)/u);
  assert.match(service, /WHERE submission_id = \$1 AND review_status = 'pending'/u);
  assert.match(service, /WHERE coach_user_id = \$1 AND review_status = 'pending'/u);
});

test("both video feedback tables exist in schema.sql with the expected shape", () => {
  assert.match(schema, /CREATE TABLE IF NOT EXISTS product_video_submissions/u);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS product_video_submission_feedback/u);
  assert.match(schema, /review_status\s+TEXT NOT NULL DEFAULT 'pending'\s*\n\s*CHECK \(\s*\n\s*review_status IN \('pending', 'reviewed'\)/u);
  assert.match(schema, /REFERENCES product_video_submissions\(submission_id\)\s*\n\s*ON DELETE CASCADE/u);
});

test("no video feedback file imports any engine-truth service", () => {
  for (const source of [storage, service, athleteRoutes, coachRoutes]) {
    assert.doesNotMatch(source, forbiddenEngineImports);
  }
});

test("both video feedback route files are tracked by the FULL-UI completion guard's route discovery", () => {
  assert.match(guard, /\["src\/api\/video_feedback\.routes\.ts", "\/video-feedback"\]/u);
  assert.match(guard, /\["src\/api\/video_feedback_coach\.routes\.ts", "\/coach-workspace"\]/u);
});

test("the athlete capture control, history section and coach queue exist as real controls", () => {
  assert.match(indexHtml, /id="recordVideoFeedbackButton"/u);
  assert.match(indexHtml, /id="videoFeedbackPanel"/u);
  assert.match(indexHtml, /id="videoFeedbackFileInput"/u);
  assert.match(indexHtml, /id="uploadVideoFeedbackButton"/u);
  assert.match(indexHtml, /id="coach-video-feedback-queue-root"/u);

  assert.match(appJs, /async function uploadExerciseVideo/u);
  assert.match(coachVideoFeedbackQueuePanel, /export function CoachVideoFeedbackQueuePanel/u);
  assert.match(coachVideoFeedbackQueuePanel, /submission\.exercise_label/u);
  assert.match(useCoachVideoFeedbackQueue, /loadCoachVideoFeedbackQueue/u);
  assert.match(useCoachVideoFeedbackQueue, /submitCoachVideoFeedback/u);
});

test("the athlete's own history-detail video feedback card is React-owned and renders inert text, never raw HTML", () => {
  assert.doesNotMatch(historyPanel, /dangerouslySetInnerHTML/u);
  assert.match(historyPanel, /function renderVideoSubmissionCard/u);
  assert.match(historyPanel, /submission\.exercise_label/u);
});

test("the video feedback queue has a real search control filtering by athlete name or exercise, resolved from the coach's own relationships - never a new athlete-directory endpoint", () => {
  assert.match(coachVideoFeedbackQueuePanel, /placeholder="Athlete or exercise"/u);
  assert.match(coachVideoFeedbackQueuePanel, /function athleteNameFor/u);
  assert.match(useCoachVideoFeedbackQueue, /loadCoachRelationships/u);
});

test("the queue distinguishes zero pending submissions at all from zero matches for the current search", () => {
  assert.match(coachVideoFeedbackQueuePanel, /No pending video submissions/u);
  assert.match(coachVideoFeedbackQueuePanel, /No submissions match/u);
});

test("the queue card now renders the submitting athlete's name, not just the exercise label - a previously phantom field", () => {
  assert.match(coachVideoFeedbackQueuePanel, /athleteNameFor\(submission, athleteNamesById\)/u);
});

test("the FULL-UI-32 manifest area declares all five functions as implemented with real routes and tests", () => {
  const area = manifest.product_areas.find((entry) => entry.area_id === "video_feedback");
  assert.ok(area, "expected a video_feedback product area");
  assert.equal(area.slice_id, "FULL-UI-32");
  assert.equal(area.state, "implemented");

  const functionIds = area.functions.map((fn) => fn.function_id);
  assert.deepEqual(
    functionIds.sort(),
    [
      "video_feedback_detail",
      "video_feedback_queue",
      "video_feedback_reply",
      "video_submission_capture",
      "video_submission_history"
    ]
  );

  // NOTE: the coach-side queue/detail/reply functions' direct_test now
  // points at their React component test (see the DEV NOTE above) - the
  // athlete-side capture/history functions stay on this surface file.
  const expectedDirectTest = {
    video_feedback_queue: "public/app-src/__tests__/CoachVideoFeedbackQueuePanel.test.tsx",
    video_feedback_detail: "public/app-src/__tests__/CoachVideoFeedbackQueuePanel.test.tsx",
    video_feedback_reply: "public/app-src/__tests__/CoachVideoFeedbackQueuePanel.test.tsx",
    video_submission_capture: "test/full_ui_32_video_feedback_surface.test.mjs",
    video_submission_history: "test/full_ui_32_video_feedback_surface.test.mjs"
  };

  for (const fn of area.functions) {
    assert.equal(fn.state, "implemented");
    assert.equal(fn.integration_test, "test/full_ui_32_video_feedback_persistent.integration.test.mjs");
    assert.equal(fn.direct_test, expectedDirectTest[fn.function_id]);
    assert.notEqual(fn.persistence, "localStorage_only");
  }

  assert.ok(manifest.delivery_slices.some((slice) => slice.slice_id === "FULL-UI-32" && slice.state === "implemented"));
});
