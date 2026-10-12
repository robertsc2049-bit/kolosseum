// A phone mid-session without a native app: the screen stays on between sets,
// the end-of-rest cue is reliable, and Today offers to put Kolosseum on the
// home screen (utils/sessionDevice.ts, components/InstallAppPrompt.tsx).
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import { InstallAppPrompt } from "../components/InstallAppPrompt";
import { keepScreenOn, playRestCompleteCue } from "../utils/sessionDevice";

const ANDROID_UA = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/128.0 Mobile Safari/537.36";
const IPHONE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1";

function setNavigator(key: string, value: unknown) {
  Object.defineProperty(window.navigator, key, { value, configurable: true, writable: true });
}
function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", { value: state, configurable: true });
}
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

test.afterEach(() => {
  cleanup();
  window.localStorage.clear();
  window.kolosseumInstallPrompt = null;
  setNavigator("userAgent", ANDROID_UA);
  setNavigator("standalone", undefined);
  setNavigator("wakeLock", undefined);
});

test("the screen stays on during a session, comes back on after the athlete switches apps, and is let go when the session ends", async () => {
  setVisibility("visible");
  const requests: string[] = [];
  let released = 0;
  setNavigator("wakeLock", {
    request: async (type: string) => {
      requests.push(type);
      const listeners: (() => void)[] = [];
      return {
        release: async () => { released++; listeners.forEach((l) => l()); },
        addEventListener: (_: string, listener: () => void) => listeners.push(listener)
      };
    }
  });
  const stop = keepScreenOn();
  await flush();
  assert.deepEqual(requests, ["screen"]);

  // Switching to the music app drops the lock; coming back takes it again.
  setVisibility("hidden");
  document.dispatchEvent(new Event("visibilitychange"));
  setVisibility("visible");
  document.dispatchEvent(new Event("visibilitychange"));
  await flush();
  assert.equal(requests.length, 1, "still held - the browser didn't release it");

  stop();
  await flush();
  assert.equal(released, 1, "released when the session ends");
  document.dispatchEvent(new Event("visibilitychange"));
  await flush();
  assert.equal(requests.length, 1, "not taken again after the session");
});

test("a phone without screen wake lock just carries on", () => {
  setNavigator("wakeLock", undefined);
  const stop = keepScreenOn();
  assert.doesNotThrow(stop);
});

test("the end of rest buzzes twice where the phone can vibrate", () => {
  const patterns: unknown[] = [];
  setNavigator("vibrate", (pattern: unknown) => { patterns.push(pattern); return true; });
  playRestCompleteCue();
  assert.deepEqual(patterns, [[180, 80, 180]]);
});

test("on an iPhone in Safari, Today shows how to add Kolosseum to the home screen", () => {
  setNavigator("userAgent", IPHONE_UA);
  render(<InstallAppPrompt />);
  assert.ok(screen.getByText(/tap the Share button/u));
  assert.equal(screen.queryByText("Install"), null, "Safari has no one-tap install");
});

test("on Android, Install opens the browser's install prompt and the card goes once accepted", async () => {
  let prompted = 0;
  window.kolosseumInstallPrompt = Object.assign(new Event("beforeinstallprompt"), {
    prompt: async () => { prompted++; },
    userChoice: Promise.resolve({ outcome: "accepted" })
  });
  render(<InstallAppPrompt />);
  await act(async () => { fireEvent.click(screen.getByText("Install")); });
  assert.equal(prompted, 1);
  assert.equal(screen.queryByTestId("install-app-prompt"), null);
});

test("the prompt appears when the browser offers install after Today has loaded", () => {
  render(<InstallAppPrompt />);
  assert.equal(screen.queryByTestId("install-app-prompt"), null, "nothing to offer yet on a desktop-like browser");
  act(() => {
    window.kolosseumInstallPrompt = Object.assign(new Event("beforeinstallprompt"), { prompt: async () => {} });
    document.dispatchEvent(new CustomEvent("kolosseum:install-available"));
  });
  assert.ok(screen.getByText("Install"));
});

test("'Not now' hides the card for good, and it never shows inside the installed app", () => {
  setNavigator("userAgent", IPHONE_UA);
  render(<InstallAppPrompt />);
  fireEvent.click(screen.getByText("Not now"));
  assert.equal(screen.queryByTestId("install-app-prompt"), null);
  cleanup();
  render(<InstallAppPrompt />);
  assert.equal(screen.queryByTestId("install-app-prompt"), null, "remembered");

  window.localStorage.clear();
  cleanup();
  setNavigator("standalone", true);
  render(<InstallAppPrompt />);
  assert.equal(screen.queryByTestId("install-app-prompt"), null, "already on the home screen");
});
