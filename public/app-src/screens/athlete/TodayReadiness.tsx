import React, { useCallback, useEffect, useState } from "react";

import { loadAthleteOnboardingState } from "../../api/athleteOnboardingClient";
import { loadAccountDetail } from "../../api/client";
import { type JsonRecord } from "../../api/transport";
import { ENTRY_AUTH_SUCCEEDED_EVENT } from "../entry/useEntryAuth";
import { ReadinessCard } from "./ReadinessCard";

// The daily check-in on Today, one line until it's opened: before the session
// is when it's useful. Shown to an athlete whose setup is done; the full card
// (with a self-coached athlete's own rule) stays in Training details.

export function TodayReadiness() {
  const [athlete, setAthlete] = useState<{ userId: string; selfDirected: boolean } | null>(null);

  const refresh = useCallback(async () => {
    try {
      const account = ((await loadAccountDetail()).account ?? {}) as JsonRecord;
      if (account.actor_type !== "athlete") {
        setAthlete(null);
        return;
      }
      const onboarding = await loadAthleteOnboardingState();
      const fields = ((onboarding.current_effective_declaration ?? {}) as JsonRecord).fields as JsonRecord | undefined;
      setAthlete(fields ? { userId: String(account.user_id ?? ""), selfDirected: fields.execution_scope === "individual" } : null);
    }
    catch {
      // Signed out, or offline: an athlete already known keeps their card.
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onAuth = () => { setAthlete(null); void refresh(); };
    const onNavigate = () => { if (window.location.hash.startsWith("#/athlete/today")) void refresh(); };
    const events = [ENTRY_AUTH_SUCCEEDED_EVENT, "kolosseum:account-role-known"];
    for (const name of events) document.addEventListener(name, onAuth);
    window.addEventListener("hashchange", onNavigate);
    return () => {
      for (const name of events) document.removeEventListener(name, onAuth);
      window.removeEventListener("hashchange", onNavigate);
    };
  }, [refresh]);

  if (!athlete) return null;
  return <ReadinessCard key={athlete.userId} selfDirected={athlete.selfDirected} compact />;
}
