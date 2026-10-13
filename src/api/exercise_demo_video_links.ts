// DEV NOTE: Exercise demo video links - pure parsing, no database (so it can
// be unit-tested on its own). A coach's or admin's pasted YouTube/Vimeo link
// becomes the provider's own embed player URL; anything else is refused.

export type DemoVideoLink = Readonly<{ provider: "youtube" | "vimeo"; video_id: string; watch_url: string; embed_url: string }>;

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/u;
const VIMEO_ID = /^[0-9]{6,12}$/u;

export function demoVideoLink(provider: "youtube" | "vimeo", videoId: string): DemoVideoLink {
  return provider === "youtube"
    ? Object.freeze({ provider, video_id: videoId, watch_url: `https://www.youtube.com/watch?v=${videoId}`, embed_url: `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&playsinline=1` })
    : Object.freeze({ provider, video_id: videoId, watch_url: `https://vimeo.com/${videoId}`, embed_url: `https://player.vimeo.com/video/${videoId}?dnt=1` });
}

// Accepts the links a coach actually pastes: youtube.com/watch?v=, youtu.be/,
// youtube.com/shorts/, youtube.com/embed/, m.youtube.com, vimeo.com/<id>.
export function parseDemoVideoLink(input: unknown): DemoVideoLink | null {
  const text = typeof input === "string" ? input.trim() : "";
  if (!text || text.length > 500) return null;
  let url: URL;
  try { url = new URL(/^https?:\/\//iu.test(text) ? text : `https://${text}`); }
  catch { return null; }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.toLowerCase().replace(/^(www\.|m\.)/u, "");
  const segments = url.pathname.split("/").filter(Boolean);
  let id = "";
  if (host === "youtu.be") id = segments[0] ?? "";
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (segments[0] === "watch") id = url.searchParams.get("v") ?? "";
    else if (["shorts", "embed", "live", "v"].includes(segments[0] ?? "")) id = segments[1] ?? "";
  }
  else if (host === "vimeo.com" || host === "player.vimeo.com") {
    const candidate = host === "player.vimeo.com" ? segments[1] : segments[0];
    return VIMEO_ID.test(candidate ?? "") ? demoVideoLink("vimeo", candidate!) : null;
  }
  return YOUTUBE_ID.test(id) ? demoVideoLink("youtube", id) : null;
}
