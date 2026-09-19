import React, { useRef } from "react";

import { type JsonRecord } from "../../api/transport";
import { formatAttachmentSize, formatDate } from "../../utils/format";
import { useRole } from "../../utils/role";
import { useCoachOrgMessages, type CoachOrgMessageEntry } from "./useCoachOrgMessages";

// DEV NOTE: Part O.9 - the coach's own org-owner<->coach team messaging
// (org_coach_messaging_service.ts), previously API-only. Mirrors
// AccountOrgMessagesPanel.tsx (the athlete-side org_owner<->athlete
// original) as closely as the underlying data allows. Plural by
// construction: a coach could belong to more than one org.
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

function OrgThread({ entry, sending, sendError, onSend }: {
  entry: CoachOrgMessageEntry;
  sending: boolean;
  sendError: string | null;
  onSend: (orgId: string, bodyText: string, file: File | null) => Promise<boolean>;
}) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messages = entry.threadEntry?.messages ?? [];
  const orgName = entry.org_name || "Organisation";
  const canSend = entry.membership_status === "active" && entry.visibility_mode === "shared";

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const ok = await onSend(entry.org_id, textareaRef.current?.value ?? "", fileInputRef.current?.files?.[0] ?? null);
    if (ok) {
      if (textareaRef.current) textareaRef.current.value = "";
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="record-row org-message-thread">
      <strong>{orgName}</strong>
      <div className="record-list">
        {messages.length > 0 ? messages.map((message: JsonRecord, index) => (
          <article className="review-note-card" key={String(message.message_id ?? index)}>
            <div className="record-meta">
              <span className="badge neutral">{message.sender_role === "coach" ? "You" : orgName}</span>
              <span className="muted small">{formatDate(message.created_at_iso8601)}</span>
            </div>
            <MessageAttachment attachment={message.attachment as JsonRecord | null | undefined} />
            {message.body_text ? <p>{String(message.body_text)}</p> : null}
          </article>
        )) : <p className="muted small">No messages yet.</p>}
      </div>
      {canSend ? (
        <form className="athlete-detail-note-form" onSubmit={handleSubmit}>
          <label className="field">
            <span>{`Reply to ${orgName}`}</span>
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
      ) : entry.membership_status === "invited" ? (
        <p className="muted small">Accept this organisation's invitation from your Account page to message them.</p>
      ) : entry.membership_status !== "active" ? (
        <p className="muted small">You're no longer an active member of this organisation.</p>
      ) : (
        <p className="muted small">Independent gym - no organisation messaging.</p>
      )}
    </div>
  );
}

export function CoachOrgMessagesPanel() {
  const isCoach = useRole() === "coach";
  const { loading, error, entries, sendingOrgId, sendErrorOrgId, sendError, sendMessage } = useCoachOrgMessages();

  if (!isCoach) return null;
  if (loading && entries.length === 0) return null;
  if (error) return <p role="status" className="muted small error">{error}</p>;
  if (entries.length === 0) return null;

  return (
    <article className="panel">
      <p className="eyebrow">Organisation messages</p>
      <h3>Messages from your organisations</h3>
      {entries.map((entry) => (
        <OrgThread
          key={entry.org_id}
          entry={entry}
          sending={sendingOrgId === entry.org_id}
          sendError={sendErrorOrgId === entry.org_id ? sendError : null}
          onSend={sendMessage}
        />
      ))}
    </article>
  );
}
