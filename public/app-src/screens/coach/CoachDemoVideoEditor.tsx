import React, { useState } from "react";

import { loadAccountDetail } from "../../api/client";
import { removeMyExerciseDemoVideo, setMyExerciseDemoVideo } from "../../api/coachWorkspaceClient";
import { ApiRequestError, type JsonRecord } from "../../api/transport";

// A coach's own demo for an exercise: paste a YouTube or Vimeo link (an
// unlisted YouTube upload of their own works), and their athletes see it in
// place of the default. Lives under the exercise's info in the builder.
export function CoachDemoVideoEditor({ exerciseId, referenceMedia, onChanged }: {
  exerciseId: string;
  referenceMedia: JsonRecord | null;
  onChanged: () => Promise<void> | void;
}) {
  const own = referenceMedia?.source === "coach_entered" ? String(referenceMedia.video_url ?? "") : "";
  const [link, setLink] = useState(own);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const csrf = async () => {
    const account = await loadAccountDetail();
    return typeof account.csrf_token === "string" ? account.csrf_token : "";
  };

  const save = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await setMyExerciseDemoVideo(exerciseId, link.trim(), await csrf());
      await onChanged();
      setMessage("Saved - your athletes see this demo.");
    }
    catch (error) {
      setMessage(error instanceof ApiRequestError && /demo_video_link_invalid/u.test(`${error.code} ${error.message}`)
        ? "That isn't a YouTube or Vimeo video link."
        : "Couldn't save the demo. Check your connection and try again.");
    }
    finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await removeMyExerciseDemoVideo(exerciseId, await csrf());
      setLink("");
      await onChanged();
      setMessage("Removed - your athletes see the default demo.");
    }
    catch {
      setMessage("Couldn't remove the demo. Check your connection and try again.");
    }
    finally {
      setBusy(false);
    }
  };

  return (
    <div className="coach-demo-video-editor">
      <label>
        <span>Your demo video (YouTube or Vimeo link)</span>
        <input type="url" inputMode="url" placeholder="https://youtu.be/..." value={link} onChange={(event) => setLink(event.target.value)} />
      </label>
      <p className="muted small">Your athletes see your demo instead of the default. An unlisted YouTube upload of your own works.</p>
      <div className="button-row">
        <button className="button secondary small-button" type="button" disabled={busy || !link.trim() || link.trim() === own} onClick={() => { void save(); }}>Save demo</button>
        {own ? <button className="button link" type="button" disabled={busy} onClick={() => { void remove(); }}>Remove my demo</button> : null}
      </div>
      {message ? <p className="muted small" role="status">{message}</p> : null}
    </div>
  );
}
