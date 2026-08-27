import React, { useEffect, useRef, useState } from "react";

import { type JsonRecord } from "../../api/transport";
import { formatAttachmentSize, formatDate } from "../../utils/format";
import { useCoachAthleteMessages } from "./useCoachAthleteMessages";

// DEV NOTE: ported from index.html's .athlete-detail-messages-panel
// ("Messages / Message this athlete"). See useCoachAthleteMessages.ts for
// the fetch/send/WebSocket-push wiring.
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

export function CoachAthleteMessagePanel() {
  const { athleteUserId, loading, messages, sending, sendError, send } = useCoachAthleteMessages();
  const [composing, setComposing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (composing) textareaRef.current?.focus();
  }, [composing]);

  if (!athleteUserId || loading) return null;

  async function handleSend(event: React.FormEvent) {
    event.preventDefault();
    const bodyText = textareaRef.current?.value ?? "";
    const attachmentFile = fileInputRef.current?.files?.[0] ?? null;
    const ok = await send(bodyText, attachmentFile);
    if (ok) {
      setComposing(false);
      if (textareaRef.current) textareaRef.current.value = "";
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <article className="panel athlete-detail-messages-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Messages</p>
          <h3>Message this athlete</h3>
        </div>
        <button className="button secondary" type="button" onClick={() => setComposing(true)}>Send message</button>
      </div>

      <div className="record-list athlete-detail-list">
        {messages.length === 0 ? (
          <div className="empty-state compact-empty"><p>No messages yet.</p></div>
        ) : (
          messages.map((message) => (
            <article className="review-note-card" key={String(message.message_id)}>
              <div className="record-meta">
                <span className="badge neutral">{message.sender_role === "coach" ? "You" : "Athlete"}</span>
                <span className="muted small">{formatDate(message.created_at_iso8601)}</span>
              </div>
              <MessageAttachment attachment={message.attachment as JsonRecord | null | undefined} />
              {message.body_text ? <p>{String(message.body_text)}</p> : null}
            </article>
          ))
        )}
      </div>

      {composing ? (
        <form className="athlete-detail-note-form" onSubmit={(event) => { handleSend(event).catch(() => {}); }}>
          <label className="field">
            <span>Message</span>
            <textarea ref={textareaRef} maxLength={4000}></textarea>
          </label>

          <label className="field">
            <span>Attach photo or video (optional)</span>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime" capture="environment" />
          </label>

          {sendError ? <p role="status" className="muted small error">{sendError}</p> : null}

          <div className="inline-controls">
            <button className="button secondary" type="button" onClick={() => setComposing(false)}>Cancel</button>
            <button className="button primary" type="submit" disabled={sending}>Send</button>
          </div>
        </form>
      ) : null}
    </article>
  );
}
