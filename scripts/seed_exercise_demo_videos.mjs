// Seeds the platform's default exercise demo videos (what athletes without a
// coach demo see) from scripts/exercise_demo_video_defaults.json - YouTube
// demos for the most-used exercises, each checked to exist and allow
// embedding when chosen. They're third-party videos linked through YouTube's
// own embed player (nothing is copied), so they live as admin-editable
// platform defaults, not in the exercise registry (whose reference_media is
// for founder-original or licensed media only). An admin can replace or
// remove any of them in the admin app's "Exercise demo videos" section.
//
//   node --env-file=.env scripts/seed_exercise_demo_videos.mjs [--replace]
//
// Without --replace, an exercise that already has a platform default keeps it.
import fs from "node:fs";

const { pool } = await import("../dist/src/db/pool.js");

const defaults = JSON.parse(fs.readFileSync(new URL("./exercise_demo_video_defaults.json", import.meta.url), "utf8"));
const replace = process.argv.includes("--replace");
let added = 0;
let kept = 0;
try {
  for (const demo of defaults) {
    const result = await pool.query(
      `
      INSERT INTO product_exercise_demo_videos (demo_key, exercise_id, coach_user_id, provider, video_id, set_by_user_id)
      VALUES ($1, $2, NULL, $3, $4, 'seed_exercise_demo_videos')
      ON CONFLICT (demo_key) DO ${replace ? "UPDATE SET provider = EXCLUDED.provider, video_id = EXCLUDED.video_id, set_by_user_id = EXCLUDED.set_by_user_id, updated_at = now()" : "NOTHING"}
      `,
      [`${demo.exercise_id}|platform`, demo.exercise_id, demo.provider, demo.video_id]
    );
    if (result.rowCount) added++;
    else kept++;
  }
  console.log(`Exercise demo videos: ${added} set, ${kept} kept (an admin had already set them).`);
}
finally {
  await pool.end();
}
