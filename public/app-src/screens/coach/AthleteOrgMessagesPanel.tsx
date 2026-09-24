import React from "react";

import { type JsonRecord } from "../../api/transport";
import { formatAttachmentSize, formatDate } from "../../utils/format";
import { useAthleteOrgMessages } from "./useAthleteOrgMessages";

// DEV NOTE: Part O.8 - read-only coach visibility into an athlete's
// org-owner threads (see org_athlete_messaging_coach_visibility_surface.
// test.mjs). A list, not a single thread, since a coach could in principle
// see threads across more than one shared org. No send form - the coach
// never writes into this thread, it stays exactly two-party for writes.
export function AthleteOrgMessagesPanel() {
  const { athleteUserId, loading, error, threads } = useAthleteOrgMessages();

  if (!athleteUserId) return null;

  if (loading && threads.length === 0) {
    return <p className="muted small">Loading team messages…</p>;
  }

  if (error) {
    return <p role="status" className="muted small error">{error}</p>;
  }

  if (threads.length === 0) {
    return (
      <div className="empty-state compact-empty">
        <p>No team messages yet.</p>
      </div>
    );
  }

  return (
    <>
      {threads.map((entry, index) => (
        <ThreadCard key={String(entry.thread.thread_id ?? index)} entry={entry} />
      ))}
    </>
  );
}

function ThreadCard({ entry }: { entry: { thread: JsonRecord; messages: JsonRecord[] } }) {
  return (
    <div className="record-row org-message-thread">
      <strong>{String(entry.thread.org_name ?? "")}</strong>
      <div className="record-list">
        {entry.messages.map((message, index) => (
          <MessageCard key={String(message.message_id ?? index)} message={message} orgName={String(entry.thread.org_name ?? "")} />
        ))}
      </div>
    </div>
  );
}

function MessageCard({ message, orgName }: { message: JsonRecord; orgName: string }) {
  return (
    <article className="review-note-card">
      <div className="record-meta">
        <span className="badge neutral">{message.sender_role === "org_owner" ? orgName : "Athlete"}</span>
        <span className="muted small">{formatDate(message.created_at_iso8601)}</span>
      </div>
      <MessageAttachment attachment={message.attachment as JsonRecord | null | undefined} />
      {message.body_text ? <p>{String(message.body_text)}</p> : null}
    </article>
  );
}

function MessageAttachment({ attachment }: { attachment: JsonRecord | null | undefined }) {
  if (!attachment) return null;
  const sizeLabel = formatAttachmentSize(attachment.byte_size);
  const sizeCaption = sizeLabel ? <p className="message-attachment-size muted">{sizeLabel}</p> : null;

  if (attachment.media_type === "image") {
    return (
      <>
        <img className="message-attachment-image" src={String(attachment.url ?? "")} alt="Attached photo" loading="lazy" />
        {sizeCaption}
      </>
    );
  }

  return (
    <>
      <video
        className="message-attachment-video"
        controls
        preload="metadata"
        poster={attachment.thumbnail_url ? String(attachment.thumbnail_url) : undefined}
      >
        <source src={String(attachment.url ?? "")} />
      </video>
      {sizeCaption}
    </>
  );
}
