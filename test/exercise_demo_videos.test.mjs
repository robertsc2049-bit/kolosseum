// Exercise demo videos: the links a coach actually pastes become the
// provider's own embed player; anything that isn't YouTube or Vimeo is
// refused (src/api/exercise_demo_video_links.ts).
import test from "node:test";
import assert from "node:assert/strict";

import { parseDemoVideoLink } from "../dist/src/api/exercise_demo_video_links.js";

test("every way a coach pastes a YouTube link resolves to the same privacy-enhanced embed", () => {
  for (const link of [
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtube.com/watch?v=dQw4w9WgXcQ&t=42s",
    "https://m.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtu.be/dQw4w9WgXcQ?si=abc",
    "youtu.be/dQw4w9WgXcQ",
    "https://www.youtube.com/shorts/dQw4w9WgXcQ",
    "https://www.youtube.com/embed/dQw4w9WgXcQ",
    "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"
  ]) {
    const parsed = parseDemoVideoLink(link);
    assert.equal(parsed?.provider, "youtube", link);
    assert.equal(parsed.video_id, "dQw4w9WgXcQ", link);
    assert.equal(parsed.embed_url, "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&playsinline=1");
    assert.equal(parsed.watch_url, "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  }
});

test("a Vimeo link embeds through Vimeo's player with do-not-track", () => {
  for (const link of ["https://vimeo.com/76979871", "https://player.vimeo.com/video/76979871"]) {
    assert.equal(parseDemoVideoLink(link)?.embed_url, "https://player.vimeo.com/video/76979871?dnt=1", link);
  }
});

test("anything else is refused - other sites, playlists, channels, scripts", () => {
  for (const link of [
    "",
    "not a link",
    "https://example.com/squat.mp4",
    "https://www.youtube.com/playlist?list=PL123",
    "https://www.youtube.com/@squatuniversity",
    "https://www.youtube.com/watch?v=short",
    "https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ",
    "javascript:alert(1)",
    "https://vimeo.com/channels/staffpicks",
    `https://youtu.be/${"a".repeat(600)}`
  ]) assert.equal(parseDemoVideoLink(link), null, link);
});
