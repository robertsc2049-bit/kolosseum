// The coach whose share link brought someone here (/app/?coach=<slug>, from
// the public page at /c/<slug>). Kept in this browser through sign-up or
// sign-in, until the athlete asks that coach to coach them or says not now.
import { useEffect, useState } from "react";

const STORAGE_KEY = "kolosseum.pendingCoach";
const CHANGED_EVENT = "kolosseum:pending-coach-changed";
const SLUG = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;

export function readPendingCoach(): string {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY) ?? "";
    return SLUG.test(value) ? value : "";
  }
  catch {
    return "";
  }
}

export function clearPendingCoach(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  }
  catch {
    // nothing kept
  }
  document.dispatchEvent(new Event(CHANGED_EVENT));
}

// Run once at load: keep ?coach=<slug> and take it out of the address bar.
export function capturePendingCoachFromUrl(): void {
  const url = new URL(window.location.href);
  const slug = (url.searchParams.get("coach") ?? "").trim().toLowerCase();
  if (!url.searchParams.has("coach")) return;
  url.searchParams.delete("coach");
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  if (!SLUG.test(slug)) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, slug);
  }
  catch {
    return;
  }
  document.dispatchEvent(new Event(CHANGED_EVENT));
}

export function usePendingCoach(): string {
  const [slug, setSlug] = useState(() => readPendingCoach());
  useEffect(() => {
    const update = () => setSlug(readPendingCoach());
    document.addEventListener(CHANGED_EVENT, update);
    window.addEventListener("storage", update);
    return () => {
      document.removeEventListener(CHANGED_EVENT, update);
      window.removeEventListener("storage", update);
    };
  }, []);
  return slug;
}
