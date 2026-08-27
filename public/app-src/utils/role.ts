// DEV NOTE: extracted once a fourth consumer (AccountCoachInvitationsPanel.
// tsx/AccountCoachRelationshipPanel.tsx/AccountOrgMessagesPanel.tsx/
// AccountOrgContextPanel.tsx) needed the same role check
// AccountBrandingPanel.tsx already had - reads the same localStorage key
// legacy's own readRole() reads.
import { useEffect, useState } from "react";

const STORAGE_KEY = "kolosseum.product.app.v1";

export function readRole(): string {
  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}") as { role?: unknown };
    return typeof stored.role === "string" ? stored.role : "";
  }
  catch {
    return "";
  }
}

// DEV NOTE: a same-tab sign-in/register never fires the browser's own
// "storage" event (it only fires in *other* tabs/windows for the same
// origin) - legacy's enterApplication() dispatches
// kolosseum:account-role-known right after every sign-in/register AND on
// every fresh boot with a restored session, which is the only reliable
// same-tab signal that state.role in localStorage just became current.
// Listening for both this event and "storage" covers same-tab and
// cross-tab role changes respectively.
const ROLE_KNOWN_EVENT = "kolosseum:account-role-known";

export function useRole(): string {
  const [role, setRole] = useState(() => readRole());

  useEffect(() => {
    function handleRoleChange() {
      setRole(readRole());
    }
    document.addEventListener(ROLE_KNOWN_EVENT, handleRoleChange);
    window.addEventListener("storage", handleRoleChange);
    return () => {
      document.removeEventListener(ROLE_KNOWN_EVENT, handleRoleChange);
      window.removeEventListener("storage", handleRoleChange);
    };
  }, []);

  return role;
}
