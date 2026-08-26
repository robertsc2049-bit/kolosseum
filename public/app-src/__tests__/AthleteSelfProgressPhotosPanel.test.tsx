// DEV NOTE: athlete's own progress-photo upload/history/compare behavioral
// proof - replaces the source-text regex checks against the now-removed
// app.js validateProgressPhotoClientSide()/renderProgressPhotoCard()/
// renderProgressPhotoComparisonPanel()/uploadProgressPhoto() rendering
// block.
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { AthleteSelfProgressPhotosPanel } from "../screens/athlete/AthleteSelfProgressPhotosPanel";

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400): Response {
  return {
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body)
  } as Response;
}

function installMocks(options: { photos?: Record<string, unknown>[]; uploadFails?: boolean }) {
  const { photos = [], uploadFails = false } = options;
  let currentPhotos = photos;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    const method = init?.method ?? "GET";
    if (path.startsWith("/account/detail")) return jsonResponse({ account: { user_id: "athlete_1" }, csrf_token: "csrf-abc" });
    if (path.startsWith("/progress-photos") && method === "GET") return jsonResponse({ ok: true, photos: currentPhotos });
    if (path.startsWith("/progress-photos") && method === "POST") {
      if (uploadFails) return jsonResponse({ error: "progress_photo_type_unsupported" }, false, 400);
      const record = {
        photo_id: `photo_${currentPhotos.length + 1}`,
        url: `/progress-photos/photo_${currentPhotos.length + 1}/file`,
        taken_at_iso8601: "2026-08-20T00:00:00.000Z",
        byte_size: 12345,
        caption: null
      };
      currentPhotos = [record, ...currentPhotos];
      return jsonResponse({ ok: true, photo: record }, true, 201);
    }
    return jsonResponse({ error: `unhandled_request_${path}` }, false, 404);
  }) as typeof fetch;
}

function makeFile(name: string, type: string, size: number): File {
  const file = new File(["x".repeat(Math.min(size, 1024))], name, { type });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

test.afterEach(() => {
  cleanup();
});

test("shows a factual empty state when no photos are uploaded", async () => {
  installMocks({});
  render(<AthleteSelfProgressPhotosPanel />);
  await waitFor(() => screen.getByText("No progress photos yet."));
});

test("renders a photo card with date and byte size", async () => {
  installMocks({
    photos: [
      { photo_id: "p1", url: "/progress-photos/p1/file", taken_at_iso8601: "2026-08-20T00:00:00.000Z", byte_size: 204800, caption: "Week 4" }
    ]
  });

  render(<AthleteSelfProgressPhotosPanel />);
  await waitFor(() => screen.getByText("Week 4"));

  const card = document.querySelector(".progress-photo-card") as HTMLElement;
  assert.ok(card.querySelector("img"));
  assert.match(card.textContent ?? "", /200\.0 KB/u);
});

test("blocks submission client-side when no file is chosen", async () => {
  installMocks({});
  render(<AthleteSelfProgressPhotosPanel />);
  await waitFor(() => screen.getByText("No progress photos yet."));

  const form = document.querySelector("form") as HTMLFormElement;
  fireEvent.submit(form);

  await waitFor(() => screen.getByText("Choose a photo to upload."));
});

test("blocks submission client-side for an unsupported file type", async () => {
  installMocks({});
  render(<AthleteSelfProgressPhotosPanel />);
  await waitFor(() => screen.getByText("No progress photos yet."));

  const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
  const file = makeFile("photo.gif", "image/gif", 1000);
  Object.defineProperty(fileInput, "files", { value: [file] });
  fireEvent.change(fileInput);

  const form = document.querySelector("form") as HTMLFormElement;
  fireEvent.submit(form);

  await waitFor(() => screen.getByText(/That file type isn't supported/u));
});

test("blocks submission client-side for a file over 10MB", async () => {
  installMocks({});
  render(<AthleteSelfProgressPhotosPanel />);
  await waitFor(() => screen.getByText("No progress photos yet."));

  const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
  const file = makeFile("photo.jpg", "image/jpeg", 11 * 1024 * 1024);
  Object.defineProperty(fileInput, "files", { value: [file] });
  fireEvent.change(fileInput);

  const form = document.querySelector("form") as HTMLFormElement;
  fireEvent.submit(form);

  await waitFor(() => screen.getByText("Photos must be 10MB or smaller."));
});

test("uploads a valid photo, then resets the form and shows the new entry", async () => {
  installMocks({});
  render(<AthleteSelfProgressPhotosPanel />);
  await waitFor(() => screen.getByText("No progress photos yet."));

  const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
  const file = makeFile("photo.jpg", "image/jpeg", 1000);
  Object.defineProperty(fileInput, "files", { value: [file] });
  fireEvent.change(fileInput);

  const form = document.querySelector("form") as HTMLFormElement;
  fireEvent.submit(form);

  await waitFor(() => assert.ok(document.querySelector(".progress-photo-card")));
  assert.equal(fileInput.value, "");
});

test("shows a submit error when the server rejects the upload", async () => {
  installMocks({ uploadFails: true });
  render(<AthleteSelfProgressPhotosPanel />);
  await waitFor(() => screen.getByText("No progress photos yet."));

  const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
  const file = makeFile("photo.jpg", "image/jpeg", 1000);
  Object.defineProperty(fileInput, "files", { value: [file] });
  fireEvent.change(fileInput);

  const form = document.querySelector("form") as HTMLFormElement;
  fireEvent.submit(form);

  await waitFor(() => screen.getByText("Photo could not be uploaded."));
});

test("selecting two photos shows an earlier-first comparison, selecting a third drops the oldest", async () => {
  installMocks({
    photos: [
      { photo_id: "p3", url: "/p3", taken_at_iso8601: "2026-08-22T00:00:00.000Z", byte_size: 1000, caption: "Third" },
      { photo_id: "p2", url: "/p2", taken_at_iso8601: "2026-08-21T00:00:00.000Z", byte_size: 1000, caption: "Second" },
      { photo_id: "p1", url: "/p1", taken_at_iso8601: "2026-08-20T00:00:00.000Z", byte_size: 1000, caption: "First" }
    ]
  });

  render(<AthleteSelfProgressPhotosPanel />);
  await waitFor(() => screen.getByText("First"));

  const buttons = screen.getAllByText("Compare");
  fireEvent.click(buttons[0]);
  fireEvent.click(buttons[1]);

  await waitFor(() => screen.getByText("Comparing two photos"));
  const sides = document.querySelectorAll(".progress-photo-comparison-side");
  assert.equal(sides.length, 2);
  assert.match(sides[0].textContent ?? "", /Second/u);
  assert.match(sides[1].textContent ?? "", /Third/u);

  const remainingCompareButton = screen.getAllByText("Compare")[0];
  fireEvent.click(remainingCompareButton);

  await waitFor(() => {
    const updatedSides = document.querySelectorAll(".progress-photo-comparison-side");
    assert.equal(updatedSides.length, 2);
    const combined = `${updatedSides[0].textContent ?? ""}${updatedSides[1].textContent ?? ""}`;
    assert.doesNotMatch(combined, /Third/u);
    assert.match(combined, /First/u);
    assert.match(combined, /Second/u);
  });
});

test("a caption containing markup renders as inert text, never as HTML", async () => {
  installMocks({
    photos: [
      { photo_id: "p1", url: "/p1", taken_at_iso8601: "2026-08-20T00:00:00.000Z", byte_size: 1000, caption: '<img src=x onerror="window.pwned=true">' }
    ]
  });

  render(<AthleteSelfProgressPhotosPanel />);

  await waitFor(() => screen.getByText(/img src=x/iu));
  assert.equal((globalThis as Record<string, unknown>).pwned, undefined);
  assert.equal(document.querySelectorAll(".progress-photo-card img").length, 1);
});

test("refetches when kolosseum:history-changed fires", async () => {
  installMocks({});
  render(<AthleteSelfProgressPhotosPanel />);
  await waitFor(() => screen.getByText("No progress photos yet."));

  installMocks({
    photos: [{ photo_id: "p1", url: "/p1", taken_at_iso8601: "2026-08-20T00:00:00.000Z", byte_size: 1000, caption: "Fresh" }]
  });

  document.dispatchEvent(new CustomEvent("kolosseum:history-changed"));

  await waitFor(() => screen.getByText("Fresh"));
});
