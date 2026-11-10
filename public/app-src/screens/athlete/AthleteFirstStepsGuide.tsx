import React, { useCallback, useEffect, useState } from "react";

import { loadAthleteRelationshipsMine } from "../../api/accountRelationshipsClient";
import { loadAthleteEquipment, loadAthleteMaxes, loadAthleteOnboardingState, loadTrainingWeek } from "../../api/athleteOnboardingClient";
import { loadAthleteHistoryList } from "../../api/athleteHistoryClient";
import { loadAccountDetail } from "../../api/client";
import { type JsonRecord } from "../../api/transport";
import { dismissGuide, guideDismissed, GuideChecklist, openAppView, revealSection, type GuideStep } from "../../components/GuideChecklist";
import { ENTRY_AUTH_SUCCEEDED_EVENT } from "../entry/useEntryAuth";

// An athlete training without a coach, setting up their own training, step
// by step on Today: build their training week (or run a Kolosseum
// programme), choose how their weights are set, check their gym and kit,
// do their first session. Each step ticks itself off from what they've
// saved and logged. An athlete with a coach, or who chose to have one,
// doesn't see it - their coach writes the programme.
const GUIDE_ID = "athlete_first_steps";

type Progress = { userId: string; week: boolean; weights: boolean; kit: boolean; sessions: number };

function openSetup(testId: string) {
  document.getElementById("athleteOnboardingNav")?.click();
  revealSection(`[data-testid="${testId}"]`);
}

export function AthleteFirstStepsGuide() {
  const [progress, setProgress] = useState<Progress | null>(null);
  const [hidden, setHidden] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const account = await loadAccountDetail();
      const user = (account.account ?? {}) as JsonRecord;
      if (user.actor_type !== "athlete") {
        setProgress(null);
        return;
      }
      const userId = String(user.user_id ?? "");
      if (guideDismissed(GUIDE_ID, userId)) {
        setHidden(true);
        return;
      }
      const relationships = await loadAthleteRelationshipsMine().catch(() => [] as JsonRecord[]);
      if (relationships.some((r) => r.relationship_state === "accepted")) {
        setProgress(null);
        return;
      }
      // Chose "My coach sets them" and waiting for a coach: building their
      // own week isn't their next step (walkthrough 10).
      const onboarding = await loadAthleteOnboardingState().catch(() => ({} as JsonRecord));
      const current = (onboarding.current_effective_declaration ?? {}) as JsonRecord;
      if (((current.fields ?? {}) as JsonRecord).execution_scope === "coach_managed") {
        setProgress(null);
        return;
      }
      const [week, maxes, equipment, history] = await Promise.all([
        loadTrainingWeek().catch(() => ({} as JsonRecord)),
        loadAthleteMaxes().catch(() => ({} as JsonRecord)),
        loadAthleteEquipment().catch(() => ({} as JsonRecord)),
        loadAthleteHistoryList(userId).catch(() => ({} as JsonRecord))
      ]);
      const lifts = Array.isArray(maxes.lifts) ? (maxes.lifts as JsonRecord[]) : [];
      setHidden(false);
      setProgress({
        userId,
        week: !!week.week || week.programme_in_progress === true,
        weights: maxes.loading_method_chosen === true || lifts.some((lift) => !!lift.entered),
        kit: equipment.full_gym === false || (Array.isArray(equipment.gyms) && equipment.gyms.length > 0),
        sessions: Array.isArray(history.sessions) ? history.sessions.length : 0
      });
    }
    catch {
      setProgress(null);
    }
  }, []);

  useEffect(() => {
    refresh();
    const events = [ENTRY_AUTH_SUCCEEDED_EVENT, "kolosseum:account-role-known"];
    for (const name of events) document.addEventListener(name, refresh);
    window.addEventListener("hashchange", refresh);
    return () => {
      for (const name of events) document.removeEventListener(name, refresh);
      window.removeEventListener("hashchange", refresh);
    };
  }, [refresh]);

  if (!progress || hidden) return null;

  const steps: GuideStep[] = [
    {
      id: "week",
      title: "Build your training week",
      body: "Choose your training days and the exercises for each, with sets and reps - or start a Kolosseum programme. Your sessions follow it in order, week after week.",
      done: progress.week,
      actions: [{ label: "Build my week", primary: true, onClick: () => openSetup("my-training") }]
    },
    {
      id: "weights",
      title: "Choose how your weights are set",
      body: "Build from what you lift, work from a max, or train by effort (RPE). Enter a max for a lift and its weights are worked out from it.",
      done: progress.weights,
      actions: [{ label: "Set my weights", primary: true, onClick: () => openSetup("athlete-maxes") }]
    },
    {
      id: "kit",
      title: "Check your gym and kit",
      body: "You're set to a full gym. If you train somewhere smaller or at home, choose your gym or tick your kit - anything you can't do is swapped for something you can.",
      done: progress.kit,
      optional: true,
      actions: [{ label: "Check my kit", onClick: () => openSetup("athlete-equipment") }]
    },
    {
      id: "session",
      title: "Do your first session",
      body: "Your first session is waiting on Today. Start it, log each set as you go, and the next ones adjust to what you lift.",
      done: progress.sessions > 0,
      actions: [{ label: "Go to today's session", primary: true, onClick: () => { openAppView("today"); revealSection("#athlete-today-session-root"); } }]
    }
  ];

  if (steps.filter((step) => !step.optional).every((step) => step.done)) return null;

  return (
    <GuideChecklist
      testId="athlete-first-steps-guide"
      eyebrow="Getting started"
      title="Set up your training"
      intro="A few steps and your first session is ready to train."
      steps={steps}
      onHide={() => { dismissGuide(GUIDE_ID, progress.userId); setHidden(true); }}
    />
  );
}
