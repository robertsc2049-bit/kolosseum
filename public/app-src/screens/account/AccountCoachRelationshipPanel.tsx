import React, { useRef } from "react";

import { type JsonRecord } from "../../api/transport";
import { formatAttachmentSize, formatDate, titleCase } from "../../utils/format";
import { useRole } from "../../utils/role";
import { useAccountCoachRelationship } from "./useAccountCoachRelationship";

// DEV NOTE: FULL-UI-25 - the athlete's own current and past coach
// relationships. A closed relationship is never deleted, only ever
// appended to, so its history remains visible here even after the athlete
// or coach ends it.
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
      <video className="message-attachment-video" controls preload="metadata" poster={attachment.thumbnail_url ? String(attachment.thumbnail_url) : undefined}>
        <source src={String(attachment.url ?? "")} />
      </video>
      {sizeCaption}
    </>
  );
}

export function AccountCoachRelationshipPanel() {
  const isAthlete = useRole() === "athlete";
  const { loading, error, relationships, endingId, endError, messages, sending, sendError, endRelationship, sendMessage } = useAccountCoachRelationship();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isAthlete) return null;
  if (loading && relationships.length === 0) return null;
  if (error) return <p role="status" className="muted small error">{error}</p>;
  if (relationships.length === 0) return null;

  const current = relationships.filter((entry) => entry.relationship_state === "accepted");
  const past = relationships.filter((entry) => entry.relationship_state !== "accepted");
  const currentCoach = current[0] ?? null;

  const handleEnd = (relationshipId: string) => {
    if (!window.confirm("End this relationship with your coach? Historical records will be preserved.")) return;
    endRelationship(relationshipId);
  };

  const handleSend = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!currentCoach) return;
    const bodyText = textareaRef.current?.value ?? "";
    const file = fileInputRef.current?.files?.[0] ?? null;
    const ok = await sendMessage(String(currentCoach.coach_user_id), bodyText, file);
    if (ok) {
      if (textareaRef.current) textareaRef.current.value = "";
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <article className="panel">
      <p className="eyebrow">Coach relationships</p>
      <h3>My coach</h3>
      {endError ? <p role="status" className="muted small error">{endError}</p> : null}
      <div className="record-list">
        {current.length > 0 ? current.map((entry: JsonRecord) => {
          const relationshipId = String(entry.relationship_id ?? "");
          return (
            <article
              className="record-row"
              key={relationshipId}
              style={entry.coach_brand_color ? { borderLeft: `3px solid ${String(entry.coach_brand_color)}` } : undefined}
            >
              <div>
                <strong>{String(entry.coach_display_name ?? "")}</strong>
                <p className="muted small">{String(entry.coach_email ?? "")}</p>
                {entry.coach_brand_tagline ? <p className="muted small">{String(entry.coach_brand_tagline)}</p> : null}
              </div>
              <button type="button" className="button secondary" disabled={endingId === relationshipId} onClick={() => handleEnd(relationshipId)}>
                End relationship
              </button>
            </article>
          );
        }) : <p className="muted small">No current coach.</p>}
      </div>

      {past.length > 0 ? (
        <>
          <p className="eyebrow">Past relationships</p>
          <div className="record-list">
            {past.map((entry: JsonRecord, index) => (
              <article className="record-row" key={String(entry.relationship_id ?? index)}>
                <div>
                  <strong>{String(entry.coach_display_name ?? "")}</strong>
                  <p className="muted small">{titleCase(entry.relationship_state)}</p>
                </div>
              </article>
            ))}
          </div>
        </>
      ) : null}

      {currentCoach ? (
        <>
          <p className="eyebrow">Messages</p>
          <div className="record-list">
            {messages.length === 0 ? (
              <div className="empty-state compact-empty"><p>No messages yet.</p></div>
            ) : messages.map((message: JsonRecord, index) => (
              <article className="review-note-card" key={String(message.message_id ?? index)}>
                <div className="record-meta">
                  <span className="badge neutral">{message.sender_role === "athlete" ? "You" : "Coach"}</span>
                  <span className="muted small">{formatDate(message.created_at_iso8601)}</span>
                </div>
                <MessageAttachment attachment={message.attachment as JsonRecord | null | undefined} />
                {message.body_text ? <p>{String(message.body_text)}</p> : null}
              </article>
            ))}
          </div>
          <form className="athlete-detail-note-form" onSubmit={handleSend}>
            <label className="field">
              <span>Message your coach</span>
              <textarea ref={textareaRef} maxLength={4000}></textarea>
            </label>
            <label className="field">
              <span>Attach photo or video (optional)</span>
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime" capture="environment" />
            </label>
            {sendError ? <p role="status" className="muted small error">{sendError}</p> : null}
            <div className="inline-controls">
              <button className="button primary" type="submit" disabled={sending}>Send</button>
            </div>
          </form>
        </>
      ) : null}
    </article>
  );
}
