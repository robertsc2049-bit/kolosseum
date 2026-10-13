// DEV NOTE: Exercise demo videos. A coach can set their own demo for an
// exercise (shown to them and to their athletes); a platform admin can set
// the default everyone else sees; the exercise registry's curated
// reference_media is the fallback under both. Demos are YouTube or Vimeo
// links - the app plays them inline through the provider's own embed player
// (YouTube's privacy-enhanced youtube-nocookie.com domain), so nothing is
// copied or hosted here. A link anywhere else is refused.

import { pool } from "../db/pool.js";
import { getExerciseReferenceMedia } from "./exercise_reference_media_service.js";
import { type DemoVideoLink, demoVideoLink, parseDemoVideoLink } from "./exercise_demo_video_links.js";

export { parseDemoVideoLink };

export class ExerciseDemoVideoError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "ExerciseDemoVideoError";
    this.status = status;
  }
}

export type DemoVideoSource = "coach_entered" | "admin_entered" | "curated";
export type ResolvedDemoVideo = Readonly<DemoVideoLink & { source: DemoVideoSource; video_url: string }>;

function exerciseExists(exerciseId: string): Promise<boolean> {
  return getExerciseReferenceMedia(exerciseId).then(() => true, () => false);
}

async function requireExercise(exerciseId: string): Promise<string> {
  const id = typeof exerciseId === "string" ? exerciseId.trim() : "";
  if (!id || !(await exerciseExists(id))) throw new ExerciseDemoVideoError("exercise_not_found", 404);
  return id;
}

// Set (or replace) a demo. coachUserId null = the platform default.
export async function setExerciseDemoVideo(exerciseId: string, coachUserId: string | null, setByUserId: string, link: unknown): Promise<ResolvedDemoVideo> {
  const id = await requireExercise(exerciseId);
  const parsed = parseDemoVideoLink(link);
  if (!parsed) throw new ExerciseDemoVideoError("demo_video_link_invalid");
  await pool.query(
    `
    INSERT INTO product_exercise_demo_videos (demo_key, exercise_id, coach_user_id, provider, video_id, set_by_user_id)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (demo_key) DO UPDATE
      SET provider = EXCLUDED.provider, video_id = EXCLUDED.video_id,
          set_by_user_id = EXCLUDED.set_by_user_id, updated_at = now()
    `,
    [`${id}|${coachUserId ?? "platform"}`, id, coachUserId, parsed.provider, parsed.video_id, setByUserId]
  );
  return Object.freeze({ ...parsed, video_url: parsed.watch_url, source: coachUserId ? "coach_entered" : "admin_entered" });
}

export async function removeExerciseDemoVideo(exerciseId: string, coachUserId: string | null): Promise<void> {
  const id = typeof exerciseId === "string" ? exerciseId.trim() : "";
  await pool.query(`DELETE FROM product_exercise_demo_videos WHERE demo_key = $1`, [`${id}|${coachUserId ?? "platform"}`]);
}

// Every demo a coach (or, null, the platform) has set - for their list.
export async function listExerciseDemoVideos(coachUserId: string | null): Promise<readonly Readonly<{ exercise_id: string } & DemoVideoLink>[]> {
  const result = await pool.query(
    `SELECT exercise_id, provider, video_id FROM product_exercise_demo_videos
     WHERE ${coachUserId ? "coach_user_id = $1" : "coach_user_id IS NULL"}
     ORDER BY exercise_id`,
    coachUserId ? [coachUserId] : []
  );
  return result.rows.map((row) => Object.freeze({ exercise_id: String(row.exercise_id), ...demoVideoLink(row.provider, String(row.video_id)) }));
}

// The coaches an athlete currently trains with (latest relationship record
// accepted), most recently updated first.
async function activeCoachIdsForAthlete(athleteUserId: string): Promise<string[]> {
  const result = await pool.query(
    `
    SELECT coach_user_id FROM (
      SELECT DISTINCT ON (actor_user_id) actor_user_id AS coach_user_id,
             record_payload->>'relationship_state' AS state, effective_at
      FROM beta_product_records
      WHERE record_type = 'beta17_coach_relationship' AND subject_user_id = $1
      ORDER BY actor_user_id, effective_at DESC, created_at DESC
    ) latest
    WHERE state = 'accepted'
    ORDER BY effective_at DESC
    `,
    [athleteUserId]
  );
  return result.rows.map((row) => String(row.coach_user_id));
}

// The demo this viewer sees: their own (coach) or their coach's (athlete),
// else the platform default, else the curated registry video, else none.
export async function resolveExerciseDemoVideo(
  exerciseId: string,
  viewer: Readonly<{ userId: string; actorType: string }>
): Promise<ResolvedDemoVideo | null> {
  const coachIds = viewer.actorType === "coach" ? [viewer.userId] : viewer.actorType === "athlete" ? await activeCoachIdsForAthlete(viewer.userId) : [];
  const rows = (await pool.query(
    `SELECT coach_user_id, provider, video_id, updated_at FROM product_exercise_demo_videos
     WHERE exercise_id = $1 AND (coach_user_id IS NULL OR coach_user_id = ANY($2::text[]))`,
    [exerciseId, coachIds]
  )).rows as { coach_user_id: string | null; provider: "youtube" | "vimeo"; video_id: string }[];
  for (const coachId of coachIds) {
    const own = rows.find((row) => row.coach_user_id === coachId);
    if (own) return Object.freeze({ ...demoVideoLink(own.provider, own.video_id), video_url: demoVideoLink(own.provider, own.video_id).watch_url, source: "coach_entered" });
  }
  const platform = rows.find((row) => row.coach_user_id === null);
  if (platform) return Object.freeze({ ...demoVideoLink(platform.provider, platform.video_id), video_url: demoVideoLink(platform.provider, platform.video_id).watch_url, source: "admin_entered" });
  const curated = (await getExerciseReferenceMedia(exerciseId)).reference_media;
  const link = curated ? parseDemoVideoLink(curated.video_url) : null;
  return link ? Object.freeze({ ...link, video_url: link.watch_url, source: "curated" }) : null;
}
