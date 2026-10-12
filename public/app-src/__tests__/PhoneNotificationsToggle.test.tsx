// The bell's "notifications on this phone" control (PhoneNotificationsToggle):
// hidden when the server has no push set up, the home-screen step on an
// iPhone in Safari, and on/off on a phone that supports push.
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { PhoneNotificationsToggle, applicationServerKey } from "../components/PhoneNotificationsToggle";

const PUBLIC_KEY = "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4";
const IPHONE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1";
const ANDROID_UA = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/128.0 Mobile Safari/537.36";

const json = (body: unknown) => ({ ok: true, status: 200, text: async () => JSON.stringify(body) }) as Response;
const setNav = (key: string, value: unknown) => Object.defineProperty(window.navigator, key, { value, configurable: true, writable: true });

function mockServer(enabled: boolean, posts: { path: string; body: unknown }[] = []) {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    if (path === "/account/notifications/push") return json({ enabled, public_key: enabled ? PUBLIC_KEY : null, subscription_count: 0 });
    if (path === "/account/me" || path.startsWith("/account/detail") || path === "/account") return json({ csrf_token: "csrf-1" });
    posts.push({ path, body: typeof init?.body === "string" ? JSON.parse(init.body) : null });
    return json({ ok: true, csrf_token: "csrf-1" });
  }) as typeof fetch;
}

test.afterEach(() => {
  cleanup();
  setNav("userAgent", ANDROID_UA);
  setNav("serviceWorker", undefined);
  delete (window as unknown as Record<string, unknown>).PushManager;
  delete (window as unknown as Record<string, unknown>).Notification;
});

test("the server's base64url key becomes the 65 raw bytes PushManager wants", () => {
  const bytes = applicationServerKey(PUBLIC_KEY);
  assert.equal(bytes.length, 65);
  assert.equal(bytes[0], 4, "an uncompressed P-256 point");
});

test("nothing shows when the server hasn't set up phone notifications", async () => {
  mockServer(false);
  render(<PhoneNotificationsToggle />);
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  assert.equal(screen.queryByTestId("phone-notifications"), null);
});

test("on an iPhone in Safari, it says to add Kolosseum to the home screen first", async () => {
  mockServer(true);
  setNav("userAgent", IPHONE_UA);
  render(<PhoneNotificationsToggle />);
  await waitFor(() => assert.ok(screen.getByText(/add Kolosseum to your home screen/u)));
});

test("on a phone with push, turning it on asks permission, subscribes and saves this phone; turning it off removes it", async () => {
  const posts: { path: string; body: unknown }[] = [];
  mockServer(true, posts);
  let subscription: { endpoint: string; toJSON: () => unknown; unsubscribe: () => Promise<boolean> } | null = null;
  const pushManager = {
    getSubscription: async () => subscription,
    subscribe: async (options: { applicationServerKey: Uint8Array }) => {
      assert.equal(options.applicationServerKey.length, 65);
      subscription = {
        endpoint: "https://fcm.googleapis.com/fcm/send/phone-1",
        toJSON: () => ({ endpoint: "https://fcm.googleapis.com/fcm/send/phone-1", keys: { p256dh: "p", auth: "a" } }),
        unsubscribe: async () => { subscription = null; return true; }
      };
      return subscription;
    }
  };
  setNav("serviceWorker", { ready: Promise.resolve({ pushManager }) });
  (window as unknown as Record<string, unknown>).PushManager = function PushManager() {};
  let permission = "default";
  (window as unknown as Record<string, unknown>).Notification = { get permission() { return permission; }, requestPermission: async () => { permission = "granted"; return "granted"; } };

  render(<PhoneNotificationsToggle />);
  const turnOn = await screen.findByText("Turn on notifications on this phone");
  await act(async () => { fireEvent.click(turnOn); });
  await waitFor(() => assert.ok(screen.getByText(/Notifications are on for this phone/u)));
  const saved = posts.find((p) => p.path === "/account/notifications/push/subscribe");
  assert.deepEqual(saved?.body, { endpoint: "https://fcm.googleapis.com/fcm/send/phone-1", keys: { p256dh: "p", auth: "a" } });

  await act(async () => { fireEvent.click(screen.getByText("Turn off")); });
  await waitFor(() => assert.ok(screen.getByText("Turn on notifications on this phone")));
  assert.deepEqual(posts.find((p) => p.path === "/account/notifications/push/unsubscribe")?.body, { endpoint: "https://fcm.googleapis.com/fcm/send/phone-1" });
});
