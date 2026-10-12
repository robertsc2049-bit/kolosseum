import React, { useCallback, useEffect, useState } from "react";

import { loadAccountDetail } from "../api/client";
import { loadPushConfig, removePushSubscription, savePushSubscription } from "../api/notificationsClient";
import { type JsonRecord } from "../api/transport";

// Notifications on this phone (Web Push): a coach's message or a new
// assignment arrives on the lock screen, like a native app's. Shown in the
// bell panel only when the server has push configured. An iPhone only
// allows it once Kolosseum is on the home screen, so there it says that.

type Status = "checking" | "unavailable" | "needs_install" | "blocked" | "off" | "on" | "working";

function isIosBrowser(): boolean {
  return /iPhone|iPad|iPod/u.test(navigator.userAgent);
}

function isInstalledApp(): boolean {
  try {
    if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
  }
  catch {
    // matchMedia unavailable - fall through.
  }
  return (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function pushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

// The VAPID public key arrives base64url; PushManager wants the raw bytes.
export function applicationServerKey(publicKey: string): Uint8Array {
  const base64 = publicKey.replace(/-/gu, "+").replace(/_/gu, "/").padEnd(Math.ceil(publicKey.length / 4) * 4, "=");
  const binary = window.atob(base64);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function csrfToken(): Promise<string> {
  const account = await loadAccountDetail();
  return typeof account.csrf_token === "string" ? account.csrf_token : "";
}

export function PhoneNotificationsToggle() {
  const [status, setStatus] = useState<Status>("checking");
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const check = useCallback(async () => {
    try {
      const config = await loadPushConfig();
      if (!config.enabled || !config.publicKey) { setStatus("unavailable"); return; }
      setPublicKey(config.publicKey);
      if (!pushSupported()) { setStatus(isIosBrowser() && !isInstalledApp() ? "needs_install" : "unavailable"); return; }
      if (window.Notification.permission === "denied") { setStatus("blocked"); return; }
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      setStatus(existing && window.Notification.permission === "granted" ? "on" : "off");
    }
    catch {
      setStatus("unavailable");
    }
  }, []);

  useEffect(() => { void check(); }, [check]);

  const turnOn = async () => {
    if (!publicKey) return;
    setError(null);
    setStatus("working");
    try {
      const permission = await window.Notification.requestPermission();
      if (permission !== "granted") { setStatus(permission === "denied" ? "blocked" : "off"); return; }
      const registration = await navigator.serviceWorker.ready;
      const subscription = (await registration.pushManager.getSubscription())
        ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: applicationServerKey(publicKey) });
      await savePushSubscription(subscription.toJSON() as unknown as JsonRecord, await csrfToken());
      setStatus("on");
    }
    catch {
      setError("Couldn't turn notifications on. Check your connection and try again.");
      setStatus("off");
    }
  };

  const turnOff = async () => {
    setError(null);
    setStatus("working");
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await removePushSubscription(subscription.endpoint, await csrfToken());
        await subscription.unsubscribe();
      }
      setStatus("off");
    }
    catch {
      setError("Couldn't turn notifications off. Check your connection and try again.");
      setStatus("on");
    }
  };

  if (status === "checking" || status === "unavailable") return null;
  return (
    <div className="phone-notifications" data-testid="phone-notifications">
      {status === "needs_install" ? (
        <p className="muted small">To get notifications on your iPhone, add Kolosseum to your home screen (Share, then Add to Home Screen) and open it from there.</p>
      ) : null}
      {status === "blocked" ? (
        <p className="muted small">Notifications are blocked for Kolosseum. Allow them in your phone's settings to get them here.</p>
      ) : null}
      {status === "off" || (status === "working" && !error) ? (
        <button className="button secondary" type="button" disabled={status === "working"} onClick={() => { void turnOn(); }}>Turn on notifications on this phone</button>
      ) : null}
      {status === "on" ? (
        <p className="muted small">Notifications are on for this phone. <button className="button link" type="button" onClick={() => { void turnOff(); }}>Turn off</button></p>
      ) : null}
      {error ? <p className="muted small" role="status">{error}</p> : null}
    </div>
  );
}
