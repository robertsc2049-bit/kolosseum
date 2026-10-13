// Exercise demo videos in the app: the demo plays inline through YouTube's
// privacy-enhanced player (or Vimeo's), only those players are ever framed,
// and a coach can set their own demo from the programme builder.
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { ExerciseHowtoBody } from "../components/ExerciseHowtoBody";
import { CoachDemoVideoEditor } from "../screens/coach/CoachDemoVideoEditor";

test.afterEach(() => cleanup());

const content = { instruction: { detailed: ["Brace and sit down between your hips."] } };

test("an athlete sees their coach's squat demo playing inline, with a link out to YouTube", () => {
  const { container } = render(<ExerciseHowtoBody content={content} referenceMedia={{
    video_url: "https://www.youtube.com/watch?v=bbbbbbbbbbb",
    embed_url: "https://www.youtube-nocookie.com/embed/bbbbbbbbbbb?rel=0&playsinline=1",
    provider: "youtube",
    source: "coach_entered"
  }} />);
  assert.ok(screen.getByText("Your coach's demo"));
  const frame = container.querySelector("iframe");
  assert.equal(frame?.getAttribute("src"), "https://www.youtube-nocookie.com/embed/bbbbbbbbbbb?rel=0&playsinline=1");
  assert.equal(screen.getByText("Open in YouTube").getAttribute("href"), "https://www.youtube.com/watch?v=bbbbbbbbbbb");
});

test("a Vimeo demo plays through Vimeo's player", () => {
  const { container } = render(<ExerciseHowtoBody content={content} referenceMedia={{ video_url: "https://vimeo.com/76979871", embed_url: "https://player.vimeo.com/video/76979871?dnt=1", provider: "vimeo", source: "admin_entered" }} />);
  assert.equal(container.querySelector("iframe")?.getAttribute("src"), "https://player.vimeo.com/video/76979871?dnt=1");
  assert.ok(screen.getByText("Open in Vimeo"));
});

test("an embed URL that isn't YouTube's or Vimeo's player is never framed - only linked", () => {
  const { container } = render(<ExerciseHowtoBody content={content} referenceMedia={{ video_url: "https://www.youtube.com/watch?v=bbbbbbbbbbb", embed_url: "https://evil.example/embed/bbbbbbbbbbb" }} />);
  assert.equal(container.querySelector("iframe"), null);
  assert.ok(screen.getByText("Watch reference video"));
});

test("a coach pastes their own demo link and saves it; a bad link gets a plain message", async () => {
  const puts: { path: string; body: unknown }[] = [];
  let reject = true;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    const json = (status: number, body: unknown) => ({ ok: status < 400, status, text: async () => JSON.stringify(body) }) as Response;
    if (path === "/account/detail") return json(200, { csrf_token: "csrf-1" });
    puts.push({ path, body: typeof init?.body === "string" ? JSON.parse(init.body) : null });
    if (reject) return json(400, { ok: false, code: "BAD_REQUEST", error: "demo_video_link_invalid", details: { failure_token: "demo_video_link_invalid" } });
    return json(200, { ok: true });
  }) as typeof fetch;
  let changed = 0;
  render(<CoachDemoVideoEditor exerciseId="back_squat" referenceMedia={null} onChanged={() => { changed++; }} />);
  const input = screen.getByPlaceholderText("https://youtu.be/...");

  fireEvent.change(input, { target: { value: "https://example.com/squat.mp4" } });
  await act(async () => { fireEvent.click(screen.getByText("Save demo")); });
  await waitFor(() => assert.ok(screen.getByText("That isn't a YouTube or Vimeo video link.")));
  assert.equal(changed, 0);

  reject = false;
  fireEvent.change(input, { target: { value: "https://youtu.be/bbbbbbbbbbb" } });
  await act(async () => { fireEvent.click(screen.getByText("Save demo")); });
  await waitFor(() => assert.ok(screen.getByText("Saved - your athletes see this demo.")));
  assert.equal(changed, 1);
  assert.deepEqual(puts.at(-1), { path: "/coach-workspace/exercise-demo-videos/back_squat", body: { video_url: "https://youtu.be/bbbbbbbbbbb" } });
});

test("a coach with their own demo can remove it", async () => {
  const deletes: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    if (init?.method === "DELETE") deletes.push(path);
    return { ok: true, status: 200, text: async () => JSON.stringify({ ok: true, csrf_token: "csrf-1" }) } as Response;
  }) as typeof fetch;
  render(<CoachDemoVideoEditor exerciseId="back_squat" referenceMedia={{ video_url: "https://www.youtube.com/watch?v=bbbbbbbbbbb", source: "coach_entered" }} onChanged={() => {}} />);
  assert.equal((screen.getByPlaceholderText("https://youtu.be/...") as HTMLInputElement).value, "https://www.youtube.com/watch?v=bbbbbbbbbbb");
  await act(async () => { fireEvent.click(screen.getByText("Remove my demo")); });
  await waitFor(() => assert.ok(screen.getByText("Removed - your athletes see the default demo.")));
  assert.deepEqual(deletes, ["/coach-workspace/exercise-demo-videos/back_squat"]);
});
