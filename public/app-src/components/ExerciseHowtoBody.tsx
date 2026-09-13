import React from "react";

import { type JsonRecord } from "../api/transport";

// DEV NOTE: shared across athlete and coach screens - the instructional
// content (detailed steps/coaching cues/common faults/reference video)
// shown by both the athlete's session focus panel
// (AthleteSessionExecutionPanel.tsx) and the coach's programme-builder
// per-exercise info toggle (CoachWorkItemHowto.tsx), hence living in
// components/ rather than screens/. Extracted from
// AthleteSessionExecutionPanel.tsx once the coach's builder call site
// (formerly app.js's legacy renderExerciseHowto()) needed the identical
// rendering. instructionDensity is an athlete-only declared onboarding
// preference - the coach's call site passes respectDensity={false} to
// always see full content regardless of any athlete's setting, matching
// legacy's respectDensity parameter.
export function ExerciseHowtoBody({
  content,
  referenceMedia,
  respectDensity = true
}: {
  content: JsonRecord;
  referenceMedia: JsonRecord | null;
  respectDensity?: boolean;
}) {
  const instruction = content?.instruction as JsonRecord | undefined;
  const detailedSteps = Array.isArray(instruction?.detailed) ? (instruction!.detailed as string[]) : [];
  const density = respectDensity ? (document.documentElement.dataset.instructionDensity || "standard") : "detailed";
  const cues = density !== "minimal" && Array.isArray(content?.coaching_cues) ? (content.coaching_cues as string[]) : [];
  const faults = density === "detailed" && Array.isArray(content?.common_faults) ? (content.common_faults as string[]) : [];
  const videoUrl = typeof referenceMedia?.video_url === "string" ? referenceMedia.video_url : "";

  if (!detailedSteps.length && !cues.length && !faults.length && !videoUrl) {
    return <p className="muted">No written instructions are available for this exercise yet.</p>;
  }

  return (
    <>
      {detailedSteps.length ? (
        <ol className="exercise-howto-steps">
          {detailedSteps.map((step, index) => <li key={index}>{step}</li>)}
        </ol>
      ) : null}
      {cues.length ? (
        <>
          <p className="exercise-howto-heading">Coaching cues</p>
          <ul className="exercise-howto-list">
            {cues.map((cue, index) => <li key={index}>{cue}</li>)}
          </ul>
        </>
      ) : null}
      {faults.length ? (
        <>
          <p className="exercise-howto-heading">Common faults</p>
          <ul className="exercise-howto-list">
            {faults.map((fault, index) => <li key={index}>{fault}</li>)}
          </ul>
        </>
      ) : null}
      {videoUrl ? (
        <>
          <p className="exercise-howto-heading">Reference video</p>
          <a className="exercise-reference-media-link" href={videoUrl} target="_blank" rel="noopener noreferrer">
            {typeof referenceMedia?.thumbnail_url === "string" ? (
              <img className="exercise-reference-media-thumbnail" src={referenceMedia.thumbnail_url} alt="Reference video thumbnail" loading="lazy" />
            ) : null}
            <span>Watch reference video</span>
          </a>
        </>
      ) : null}
    </>
  );
}
