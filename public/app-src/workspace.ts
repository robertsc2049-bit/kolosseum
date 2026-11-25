import { mountReady } from "./mounting";
import { readRole } from "./utils/role";

// DEV NOTE: a role's screens are downloaded when that role is known - from the
// last visit straight away, or at sign-in - and only that role's.
// app.js and route_bootstrap.js wait for kolosseumWorkspaceReady before opening
// a screen, so anything they then say to a panel finds it listening.
const loaders: Record<string, () => Promise<unknown>> = {
  athlete: () => import("./athlete"),
  coach: () => import("./coach")
};
const loading = new Map<string, Promise<void>>();
const RELOADED_KEY = "kolosseum.workspace-reloaded";

export function loadWorkspace(role: string | null = readRole()): Promise<void> {
  if (!role || !loaders[role]) return Promise.resolve();
  let started = loading.get(role);
  if (!started) {
    started = loaders[role]().then(() => {
      try { sessionStorage.removeItem(RELOADED_KEY); } catch { /* private window */ }
      mountReady();
    }, (error: unknown) => {
      loading.delete(role);
      // An old page after an update: the file it wants has gone. Once only.
      let again = false;
      try { again = sessionStorage.getItem(RELOADED_KEY) !== null; sessionStorage.setItem(RELOADED_KEY, "1"); } catch { again = true; }
      if (!again && navigator.onLine !== false) window.location.reload();
      else console.error("Kolosseum screens could not be loaded", error);
    });
    loading.set(role, started);
  }
  return started;
}

export function watchRole(): void {
  (globalThis as { kolosseumWorkspaceReady?: (role?: string | null) => Promise<void> }).kolosseumWorkspaceReady = (role) => loadWorkspace(role ?? undefined);
  document.addEventListener("kolosseum:account-role-known", () => void loadWorkspace());
}
