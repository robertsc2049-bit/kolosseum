import React, { useState } from "react";

import { type JsonRecord } from "../../api/transport";
import { formatAttachmentSize, formatDate } from "../../utils/format";
import { useAthleteProgressPhotos } from "./useAthleteProgressPhotos";

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

export function AthleteProgressPhotosPanel() {
  const { athleteUserId, loading, error, photos } = useAthleteProgressPhotos();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  if (!athleteUserId) return null;

  if (loading && photos.length === 0) {
    return <p className="muted small">Loading progress photos…</p>;
  }

  if (error) {
    return <p role="status" className="muted small error">{error}</p>;
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
    <>
      <div className="progress-photo-grid athlete-detail-list">
        {photos.length === 0 ? (
          <div className="empty-state compact-empty">
            <p>No progress photos yet.</p>
          </div>
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
    </>
  );
}
