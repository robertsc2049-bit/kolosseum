import React, { useEffect, useState } from "react";

// Put Kolosseum on the home screen: full screen, its own icon, and (on an
// iPhone) the only way to get notifications from a web app. Android/Chrome
// offers a one-tap install (the browser's beforeinstallprompt, captured early
// by pwa_bootstrap.js); an iPhone needs Share > Add to Home Screen, so it gets
// the steps. Hidden once installed or dismissed.

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice?: Promise<{ outcome: string }> };
declare global {
  interface Window { kolosseumInstallPrompt?: InstallPromptEvent | null }
}

const DISMISSED_KEY = "kolosseum.install_prompt_dismissed";
export const INSTALL_AVAILABLE_EVENT = "kolosseum:install-available";

export function isInstalledApp(): boolean {
  try {
    if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
  }
  catch {
    // matchMedia unavailable - fall through.
  }
  return (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function isIosBrowser(userAgent = navigator.userAgent): boolean {
  return /iPhone|iPad|iPod/u.test(userAgent);
}

function wasDismissed(): boolean {
  try { return window.localStorage.getItem(DISMISSED_KEY) === "1"; }
  catch { return false; }
}

export function InstallAppPrompt() {
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(() => window.kolosseumInstallPrompt ?? null);
  const [hidden, setHidden] = useState(() => isInstalledApp() || wasDismissed());

  useEffect(() => {
    const onAvailable = () => setInstallEvent(window.kolosseumInstallPrompt ?? null);
    const onInstalled = () => setHidden(true);
    document.addEventListener(INSTALL_AVAILABLE_EVENT, onAvailable);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      document.removeEventListener(INSTALL_AVAILABLE_EVENT, onAvailable);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismiss = () => {
    try { window.localStorage.setItem(DISMISSED_KEY, "1"); }
    catch { /* not remembered - still hidden for this visit */ }
    setHidden(true);
  };

  const install = async () => {
    if (!installEvent) return;
    try {
      await installEvent.prompt();
      const choice = await installEvent.userChoice;
      if (choice?.outcome === "accepted") setHidden(true);
    }
    catch {
      // The browser declined to show it again; the athlete can use its menu.
    }
    window.kolosseumInstallPrompt = null;
    setInstallEvent(null);
  };

  if (hidden) return null;
  const ios = isIosBrowser();
  if (!installEvent && !ios) return null;

  return (
    <div className="install-app-prompt" data-testid="install-app-prompt">
      <p><strong>Add Kolosseum to your home screen</strong></p>
      {installEvent ? (
        <p className="muted small">Opens full screen like an app, straight to today's session.</p>
      ) : (
        <p className="muted small">In Safari, tap the Share button, then <strong>Add to Home Screen</strong>. It opens full screen like an app, and it's how your iPhone shows Kolosseum notifications.</p>
      )}
      <div className="button-row">
        {installEvent ? <button className="button primary" type="button" onClick={() => { void install(); }}>Install</button> : null}
        <button className="button secondary" type="button" onClick={dismiss}>Not now</button>
      </div>
    </div>
  );
}
