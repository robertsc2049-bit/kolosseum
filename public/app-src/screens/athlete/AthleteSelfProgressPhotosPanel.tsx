import React, { useRef, useState } from "react";

import { validateProgressPhotoClientSide } from "../../api/athleteProgressPhotosClient";
import { type JsonRecord } from "../../api/transport";
import { formatAttachmentSize, formatDate } from "../../utils/format";
import { useAthleteProgressPhotosSelf } from "./useAthleteProgressPhotosSelf";

// DEV NOTE: FULL-UI-28 athlete's own progress-photo upload/history/compare
// - ported from app.js's uploadProgressPhoto()/renderProgressPhotoCard()/
// renderProgressPhotoComparisonPanel(). No delete route exists anywhere in
// this product - nothing to port there. Compare-selection is local React
// state, same deliberate simplification the coach mirror
// (AthleteProgressPhotosPanel.tsx) already made, rather than porting
// legacy's localStorage-persisted state.progressPhotoCompareIds - losing
// "survives a page reload" for a two-photo scratch selection isn't worth
// inventing this migration's only localStorage-backed hook for.
function PhotoCard({
  photo,
  selected,
  onToggle
}: {
  photo: JsonRecord;
  selected: boolean;
  onToggle: (photoId: string) => void;
}) {
  const sizeLabel = formatAttachmentSize(photo.byte_size);

  return (
    <article className={`progress-photo-card${selected ? " selected" : ""}`}>
      <img src={String(photo.url)} alt="Progress photo" loading="lazy" />
      <span className="muted small">{formatDate(photo.taken_at_iso8601)}</span>
      {sizeLabel ? <span className="muted small">{sizeLabel}</span> : null}
      {photo.caption ? <p>{String(photo.caption)}</p> : null}
      <button
        type="button"
        className="button secondary small-button progress-photo-compare-toggle"
        aria-pressed={selected}
        onClick={() => onToggle(String(photo.photo_id))}
      >
        {selected ? "Selected for comparison" : "Compare"}
      </button>
    </article>
  );
}

function ComparisonSide({ photo }: { photo: JsonRecord }) {
  return (
    <figure className="progress-photo-comparison-side">
      <img src={String(photo.url)} alt="Progress photo" />
      <figcaption>
        <span className="muted small">{formatDate(photo.taken_at_iso8601)}</span>
        {photo.caption ? <p>{String(photo.caption)}</p> : null}
      </figcaption>
    </figure>
  );
}

export function AthleteSelfProgressPhotosPanel() {
  const { photos, submitError, upload } = useAthleteProgressPhotosSelf();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [takenAt, setTakenAt] = useState("");
  const [caption, setCaption] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const file = fileInputRef.current?.files?.[0];
    const clientError = validateProgressPhotoClientSide(file);
    if (clientError || !file) {
      setValidationError(clientError ?? "Choose a photo to upload.");
      return;
    }

    setValidationError(null);

    const ok = await upload({
      file,
      takenAtIso8601: takenAt ? new Date(takenAt).toISOString() : undefined,
      caption: caption || undefined
    });

    if (ok) {
      if (fileInputRef.current) fileInputRef.current.value = "";
      setTakenAt("");
      setCaption("");
    }
  }

  function toggle(photoId: string) {
    setSelectedIds((current) => {
      const index = current.indexOf(photoId);
      if (index >= 0) {
        return current.filter((id) => id !== photoId);
      }
      const next = [...current, photoId];
      // Selecting a third photo drops the oldest selection rather than
      // refusing the click, so the control never needs a disabled state.
      return next.length > 2 ? next.slice(1) : next;
    });
  }

  const statusText = validationError ?? submitError;

  const selectedPhotos = selectedIds.length === 2
    ? selectedIds
        .map((id) => photos.find((photo) => String(photo.photo_id) === id))
        .filter((photo): photo is JsonRecord => Boolean(photo))
    : [];

  // Always shown oldest-taken first, regardless of click order, so the
  // comparison always reads as a "before -> after" progression.
  const [earlier, later] = selectedPhotos.length === 2
    ? [...selectedPhotos].sort(
        (left, right) => new Date(String(left.taken_at_iso8601)).getTime() - new Date(String(right.taken_at_iso8601)).getTime()
      )
    : [];

  return (
    <div className="panel athlete-progress-photos-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Progress</p>
          <h3>Progress photos</h3>
          <p className="muted">Dated photos you choose to keep, visible to your coach.</p>
        </div>
      </div>

      <form className="athlete-detail-note-form" onSubmit={handleSubmit}>
        <label className="field">
          <span>Photo</span>
          <input type="file" ref={fileInputRef} accept="image/jpeg,image/png,image/webp" required />
        </label>

        <label className="field">
          <span>Date taken</span>
          <input type="date" value={takenAt} onChange={(event) => setTakenAt(event.target.value)} />
        </label>

        <label className="field">
          <span>Caption (optional)</span>
          <input type="text" maxLength={280} value={caption} onChange={(event) => setCaption(event.target.value)} />
        </label>

        <div className="inline-controls">
          <button className="button primary" type="submit">Upload photo</button>
        </div>
      </form>

      {statusText ? <p className="dashboard-status" role="status" aria-live="polite">{statusText}</p> : null}

      <p className="muted small">Select two photos below to compare them side by side.</p>

      <div className="progress-photo-grid">
        {photos.length === 0 ? (
          <div className="empty-state compact-empty"><p>No progress photos yet.</p></div>
        ) : (
          photos.map((photo) => (
            <PhotoCard
              key={String(photo.photo_id)}
              photo={photo}
              selected={selectedIds.includes(String(photo.photo_id))}
              onToggle={toggle}
            />
          ))
        )}
      </div>

      {earlier && later ? (
        <div className="progress-photo-comparison">
          <h4>Comparing two photos</h4>
          <div className="progress-photo-comparison-grid">
            <ComparisonSide photo={earlier} />
            <ComparisonSide photo={later} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
