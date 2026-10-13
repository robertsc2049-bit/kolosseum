// DEV NOTE: Exercise demo videos. A coach can set their own demo for an
// exercise (shown to them and to their athletes); a platform admin can set
// the default everyone else sees; the exercise registry's curated
// reference_media is the fallback under both. Demos are YouTube or Vimeo
// links - the app plays them inline through the provider's own embed player
// (YouTube's privacy-enhanced youtube-nocookie.com domain), so nothing is
// copied or hosted here. A link anywhere else is refused. A coach can also
// upload their own clip (exercise_demo_video_storage.ts): stored here, served
// only through an authenticated route to the viewers it resolves for.

import { pool } from "../db/pool.js";
import { getExerciseReferenceMedia } from "./exercise_reference_media_service.js";
import { demoVideoLink, parseDemoVideoLink } from "./exercise_demo_video_links.js";
import { removeDemoUploadFiles } from "./exercise_demo_video_storage.js";

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
export type DemoVideo = Readonly<{
  provider: "youtube" | "vimeo" | "upload";
  video_id: string;
  watch_url: string;
  embed_url: string;
  poster_url?: string;
}>;
export type ResolvedDemoVideo = Readonly<DemoVideo & { source: DemoVideoSource; video_url: string }>;

type DemoRow = {
  coach_user_id: string | null;
  provider: "youtube" | "vimeo" | "upload";
  video_id: string;
  storage_key: string | null;
  poster_key: string | null;
};

// An uploaded clip plays from the app's own authenticated route; a link
// through its provider's embed player.
function demoFromRow(exerciseId: string, row: Pick<DemoRow, "provider" | "video_id" | "poster_key">): DemoVideo {
  if (row.provider !== "upload") return demoVideoLink(row.provider, row.video_id);
  const fileUrl = `/exercises/${encodeURIComponent(exerciseId)}/demo-uploads/${row.video_id}`;
  return Object.freeze({
    provider: "upload" as const,
    video_id: row.video_id,
    watch_url: fileUrl,
    embed_url: "",
    ...(row.poster_key ? { poster_url: `${fileUrl}/poster` } : {})
  });
}

function resolved(demo: DemoVideo, source: DemoVideoSource): ResolvedDemoVideo {
  return Object.freeze({ ...demo, video_url: demo.watch_url, source });
}

function exerciseExists(exerciseId: string): Promise<boolean> {
  return getExerciseReferenceMedia(exerciseId).then(() => true, () => false);
}

async function requireExercise(exerciseId: string): Promise<string> {
  const id = typeof exerciseId === "string" ? exerciseId.trim() : "";
  if (!id || !(await exerciseExists(id))) throw new ExerciseDemoVideoError("exercise_not_found", 404);
  return id;
}

async function previousStorageKey(demoKey: string): Promise<string | null> {
  const result = await pool.query(`SELECT storage_key FROM product_exercise_demo_videos WHERE demo_key = $1`, [demoKey]);
  return (result.rows[0]?.storage_key as string | null | undefined) ?? null;
}

// Insert or replace a demo; a replaced upload's files are deleted.
async function upsertDemo(
  exerciseId: string,
  coachUserId: string | null,
  setByUserId: string,
  row: Pick<DemoRow, "provider" | "video_id" | "storage_key" | "poster_key">
): Promise<void> {
  const demoKey = `${exerciseId}|${coachUserId ?? "platform"}`;
  const previous = await previousStorageKey(demoKey);
  await pool.query(
    `
    INSERT INTO product_exercise_demo_videos (demo_key, exercise_id, coach_user_id, provider, video_id, storage_key, poster_key, set_by_user_id)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (demo_key) DO UPDATE
      SET provider = EXCLUDED.provider, video_id = EXCLUDED.video_id,
          storage_key = EXCLUDED.storage_key, poster_key = EXCLUDED.poster_key,
          set_by_user_id = EXCLUDED.set_by_user_id, updated_at = now()
    `,
    [demoKey, exerciseId, coachUserId, row.provider, row.video_id, row.storage_key, row.poster_key, setByUserId]
  );
  if (previous && previous !== row.storage_key) await removeDemoUploadFiles(previous);
}

// Set (or replace) a demo link. coachUserId null = the platform default.
export async function setExerciseDemoVideo(exerciseId: string, coachUserId: string | null, setByUserId: string, link: unknown): Promise<ResolvedDemoVideo> {
  const id = await requireExercise(exerciseId);
  const parsed = parseDemoVideoLink(link);
  if (!parsed) throw new ExerciseDemoVideoError("demo_video_link_invalid");
  await upsertDemo(id, coachUserId, setByUserId, { provider: parsed.provider, video_id: parsed.video_id, storage_key: null, poster_key: null });
  return resolved(parsed, coachUserId ? "coach_entered" : "admin_entered");
}

// A coach's own uploaded clip (already validated and stored). An unknown
// exercise discards the stored files.
export async function setExerciseDemoUpload(
  exerciseId: string,
  coachUserId: string,
  upload: Readonly<{ uploadId: string; storageKey: string; posterKey: string | null }>
): Promise<ResolvedDemoVideo> {
  let id: string;
  try {
    id = await requireExercise(exerciseId);
  }
  catch (error) {
    await removeDemoUploadFiles(upload.storageKey);
    throw error;
  }
  const row = { provider: "upload" as const, video_id: upload.uploadId, storage_key: upload.storageKey, poster_key: upload.posterKey };
  await upsertDemo(id, coachUserId, coachUserId, row);
  return resolved(demoFromRow(id, row), "coach_entered");
}

export async function removeExerciseDemoVideo(exerciseId: string, coachUserId: string | null): Promise<void> {
  const id = typeof exerciseId === "string" ? exerciseId.trim() : "";
  const demoKey = `${id}|${coachUserId ?? "platform"}`;
  const previous = await previousStorageKey(demoKey);
  await pool.query(`DELETE FROM product_exercise_demo_videos WHERE demo_key = $1`, [demoKey]);
  await removeDemoUploadFiles(previous);
}

// Every demo a coach (or, null, the platform) has set - for their list.
export async function listExerciseDemoVideos(coachUserId: string | null): Promise<readonly Readonly<{ exercise_id: string } & DemoVideo>[]> {
  const result = await pool.query(
    `SELECT exercise_id, provider, video_id, poster_key FROM product_exercise_demo_videos
     WHERE ${coachUserId ? "coach_user_id = $1" : "coach_user_id IS NULL"}
     ORDER BY exercise_id`,
    coachUserId ? [coachUserId] : []
  );
  return result.rows.map((row) => Object.freeze({ exercise_id: String(row.exercise_id), ...demoFromRow(String(row.exercise_id), row as DemoRow) }));
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

async function resolveDemoRow(
  exerciseId: string,
  viewer: Readonly<{ userId: string; actorType: string }>
): Promise<{ demo: ResolvedDemoVideo; row: DemoRow | null } | null> {
  const coachIds = viewer.actorType === "coach" ? [viewer.userId] : viewer.actorType === "athlete" ? await activeCoachIdsForAthlete(viewer.userId) : [];
  const rows = (await pool.query(
    `SELECT coach_user_id, provider, video_id, storage_key, poster_key FROM product_exercise_demo_videos
     WHERE exercise_id = $1 AND (coach_user_id IS NULL OR coach_user_id = ANY($2::text[]))`,
    [exerciseId, coachIds]
  )).rows as DemoRow[];
  for (const coachId of coachIds) {
    const own = rows.find((row) => row.coach_user_id === coachId);
    if (own) return { demo: resolved(demoFromRow(exerciseId, own), "coach_entered"), row: own };
  }
  const platform = rows.find((row) => row.coach_user_id === null);
  if (platform) return { demo: resolved(demoFromRow(exerciseId, platform), "admin_entered"), row: platform };
  const curated = (await getExerciseReferenceMedia(exerciseId)).reference_media;
  const link = curated ? parseDemoVideoLink(curated.video_url) : null;
  return link ? { demo: resolved(link, "curated"), row: null } : null;
}

// The demo this viewer sees: their own (coach) or their coach's (athlete),
// else the platform default, else the curated registry video, else none.
export async function resolveExerciseDemoVideo(
  exerciseId: string,
  viewer: Readonly<{ userId: string; actorType: string }>
): Promise<ResolvedDemoVideo | null> {
  return (await resolveDemoRow(exerciseId, viewer))?.demo ?? null;
}

// The uploaded clip this viewer may watch: only the one their demo resolves
// to - a coach's clip reaches their own athletes and no one else.
export async function demoUploadForViewer(
  exerciseId: string,
  uploadId: string,
  viewer: Readonly<{ userId: string; actorType: string }>
): Promise<Readonly<{ storage_key: string; poster_key: string | null }> | null> {
  const found = await resolveDemoRow(exerciseId, viewer);
  if (!found?.row || found.row.provider !== "upload" || found.row.video_id !== uploadId || !found.row.storage_key) return null;
  return Object.freeze({ storage_key: found.row.storage_key, poster_key: found.row.poster_key });
}
