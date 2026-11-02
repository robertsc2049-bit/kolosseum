import React, { useCallback, useEffect, useState } from "react";

import { loadAccountDetail } from "../../api/client";
import { loadCoachAssignments, loadCoachRelationships, loadCoachTemplates } from "../../api/coachWorkspaceClient";
import { type JsonRecord } from "../../api/transport";
import { dismissGuide, guideDismissed, GuideChecklist, openAppView, type GuideStep } from "../../components/GuideChecklist";
import { ENTRY_AUTH_SUCCEEDED_EVENT } from "../entry/useEntryAuth";
import { OPEN_QUICK_BUILD_EVENT } from "./QuickBuildForm";

// A new coach's first programme, step by step, on Overview: build one (Quick
// build or from scratch), check it's ready and make it ready to send, bring
// in an athlete, assign it. Each step ticks itself off from the coach's real
// programmes, athletes and assignments.
const GUIDE_ID = "coach_first_programme";

type Progress = { userId: string; templates: JsonRecord[]; relationships: JsonRecord[]; assignments: JsonRecord[] };

function openProgramme(templateId: string) {
  openAppView("templates");
  window.location.hash = `#/coach/programmes/${encodeURIComponent(templateId)}`;
  document.dispatchEvent(new CustomEvent("kolosseum:open-programme-detail", { detail: { template_id: templateId } }));
}

const newest = (templates: JsonRecord[]) => [...templates].sort((a, b) => String(b.updated_at_iso8601 ?? "").localeCompare(String(a.updated_at_iso8601 ?? "")))[0];

export function CoachFirstProgrammeGuide() {
  const [progress, setProgress] = useState<Progress | null>(null);
  const [hidden, setHidden] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const account = await loadAccountDetail();
      const user = (account.account ?? {}) as JsonRecord;
      if (user.actor_type !== "coach") {
        setProgress(null);
        return;
      }
      const userId = String(user.user_id ?? "");
      if (guideDismissed(GUIDE_ID, userId)) {
        setHidden(true);
        return;
      }
      const [templates, relationships, assignments] = await Promise.all([loadCoachTemplates(userId), loadCoachRelationships(userId), loadCoachAssignments(userId)]);
      setHidden(false);
      setProgress({ userId, templates, relationships, assignments });
    }
    catch {
      setProgress(null);
    }
  }, []);

  useEffect(() => {
    refresh();
    const events = [ENTRY_AUTH_SUCCEEDED_EVENT, "kolosseum:account-role-known", "kolosseum:templates-changed", "kolosseum:athlete-directory-changed"];
    for (const name of events) document.addEventListener(name, refresh);
    window.addEventListener("hashchange", refresh);
    return () => {
      for (const name of events) document.removeEventListener(name, refresh);
      window.removeEventListener("hashchange", refresh);
    };
  }, [refresh]);

  if (!progress || hidden) return null;

  const { templates, relationships, assignments } = progress;
  const ready = templates.filter((t) => t.template_status === "active");
  const drafts = templates.filter((t) => t.template_status === "draft" || t.template_status === "complete");
  const athletes = relationships.filter((r) => r.relationship_state === "accepted" || r.relationship_state === "pending");
  const steps: GuideStep[] = [
    {
      id: "build",
      title: "Build a programme",
      body: "Quick build makes a whole programme from a few answers - sport, level, goal, weeks, days, session length and equipment. Or start from scratch in the builder.",
      done: templates.length > 0,
      actions: [
        { label: "Quick build", primary: true, onClick: () => { openAppView("templates"); document.dispatchEvent(new Event(OPEN_QUICK_BUILD_EVENT)); } },
        { label: "Start from scratch", onClick: () => { openAppView("templates"); document.getElementById("newTemplateButton")?.click(); } }
      ]
    },
    {
      id: "ready",
      title: "Check it and make it ready to send",
      body: "Open your draft, change anything you want, then press \"Check it's ready\" and \"Ready to send\". A programme has to be ready to send before you can assign it.",
      done: ready.length > 0,
      actions: drafts.length
        ? [{ label: "Open my draft", primary: true, onClick: () => openProgramme(String(newest(drafts).template_id)) }]
        : [{ label: "Go to programmes", primary: true, onClick: () => openAppView("templates") }]
    },
    {
      id: "athlete",
      title: "Bring in an athlete",
      body: "Invite an athlete by email, share your link or QR code (Account → Branding), or add one with their account code. They're on your roster once they accept.",
      done: athletes.length > 0,
      actions: [{ label: "Invite an athlete", primary: true, onClick: () => openAppView("athletes") }]
    },
    {
      id: "assign",
      title: "Assign the programme",
      body: "Open the programme and assign it to your athlete (or a group), or open the athlete's profile and pick it there. Their first session is then waiting on their Today.",
      done: assignments.length > 0,
      actions: ready.length
        ? [{ label: "Open my programme", primary: true, onClick: () => openProgramme(String(newest(ready).template_id)) }, { label: "Go to athletes", onClick: () => openAppView("athletes") }]
        : [{ label: "Go to athletes", primary: true, onClick: () => openAppView("athletes") }]
    }
  ];

  if (steps.every((step) => step.done)) return null;

  return (
    <GuideChecklist
      testId="coach-first-programme-guide"
      eyebrow="Getting started"
      title="Your first programme"
      intro="Four steps from an empty account to an athlete training on your programme."
      steps={steps}
      onHide={() => { dismissGuide(GUIDE_ID, progress.userId); setHidden(true); }}
    />
  );
}
