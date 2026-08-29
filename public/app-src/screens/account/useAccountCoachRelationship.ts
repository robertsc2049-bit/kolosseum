import { useCallback, useEffect, useRef, useState } from "react";

import { loadAccountDetail } from "../../api/client";
import {
  endAthleteRelationship,
  loadAthleteOwnMessageThreadsMine,
  loadAthleteOwnMessages,
  loadAthleteRelationshipsMine,
  sendAthleteOwnMessage,
  validateAttachmentClientSide
} from "../../api/accountRelationshipsClient";
import { type JsonRecord } from "../../api/transport";
import { RELATIONSHIP_CHANGED_EVENT } from "./useAccountCoachInvitations";

// DEV NOTE: ported from app.js's refreshAthleteRelationships()/
// renderAthleteRelationships() plus the embedded coach-messaging widget
// (refreshAthleteOwnMessages()/renderAthleteOwnMessages()/
// confirmSendAthleteOwnMessage()) it renders once a current coach exists -
// legacy renders both from one panel, so this hook owns both.
// refreshAthleteRelationships() itself was deleted from app.js (FULL-UI-18
// notification bell slice) once notificationCoachName() - its only other
// reader of state.athleteRelationships - moved to React too (see
// NotificationBellPanel.tsx's useNotifications.ts, which fetches its own
// independent copy); this hook's endRelationship() dispatches
// RELATIONSHIP_CHANGED_EVENT so the invitations panel stays in sync, and
// app.js's WebSocket handler now dispatches MESSAGE_RECEIVED_EVENT instead
// of calling the removed renderAthleteOwnMessages() directly - see
// handleMessagingSocketPayload()'s athlete branch.
export const MESSAGE_RECEIVED_EVENT = "kolosseum:athlete-coach-message-received";

export type AccountCoachRelationshipState = {
  loading: boolean;
  error: string | null;
  relationships: JsonRecord[];
  endingId: string | null;
  endError: string | null;
  messages: JsonRecord[];
  messagesLoading: boolean;
  sending: boolean;
  sendError: string | null;
};

const initialState: AccountCoachRelationshipState = {
  loading: true,
  error: null,
  relationships: [],
  endingId: null,
  endError: null,
  messages: [],
  messagesLoading: true,
  sending: false,
  sendError: null
};

export function useAccountCoachRelationship() {
  const [state, setState] = useState<AccountCoachRelationshipState>(initialState);
  const threadIdRef = useRef<string | null>(null);

  const refreshMessages = useCallback(async () => {
    setState((current) => ({ ...current, messagesLoading: true }));
    try {
      const threads = await loadAthleteOwnMessageThreadsMine();
      const thread = threads[0] ?? null;
      if (!thread) {
        threadIdRef.current = null;
        setState((current) => ({ ...current, messagesLoading: false, messages: [] }));
        return;
      }
      threadIdRef.current = String(thread.thread_id);
      const messages = await loadAthleteOwnMessages(String(thread.thread_id));
      setState((current) => ({ ...current, messagesLoading: false, messages }));
    }
    catch {
      setState((current) => ({ ...current, messagesLoading: false }));
    }
  }, []);

  const refresh = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const relationships = await loadAthleteRelationshipsMine();
      setState((current) => ({ ...current, loading: false, relationships }));
      await refreshMessages();
    }
    catch {
      setState((current) => ({
        ...current,
        loading: false,
        error: "Relationship records could not be loaded. Check your connection and try again."
      }));
    }
  }, [refreshMessages]);

  useEffect(() => {
    refresh();
    // A same-tab sign-in/register never fires "storage", so the panel's
    // role gate can flip athlete-on without this hook ever re-fetching -
    // see utils/role.ts's useRole().
    document.addEventListener(RELATIONSHIP_CHANGED_EVENT, refresh);
    document.addEventListener("kolosseum:account-role-known", refresh);
    return () => {
      document.removeEventListener(RELATIONSHIP_CHANGED_EVENT, refresh);
      document.removeEventListener("kolosseum:account-role-known", refresh);
    };
  }, [refresh]);

  useEffect(() => {
    function handleMessageReceived(event: Event) {
      const detail = (event as CustomEvent).detail as { thread?: JsonRecord; message?: JsonRecord } | undefined;
      const thread = detail?.thread;
      const message = detail?.message;
      if (!thread || !message) return;
      // An athlete has at most one current coach thread open at a time. A
      // still-unknown thread id means no message has been sent yet - adopt
      // the pushed thread's id rather than discard the push (matches
      // legacy's exact comment/behavior).
      if (threadIdRef.current && String(thread.thread_id) !== threadIdRef.current) return;
      threadIdRef.current = String(thread.thread_id);
      setState((current) => {
        if (current.messages.some((entry) => entry.message_id === message.message_id)) return current;
        return { ...current, messages: [...current.messages, message] };
      });
    }
    document.addEventListener(MESSAGE_RECEIVED_EVENT, handleMessageReceived);
    return () => document.removeEventListener(MESSAGE_RECEIVED_EVENT, handleMessageReceived);
  }, []);

  const endRelationship = useCallback(async (relationshipId: string) => {
    setState((current) => ({ ...current, endingId: relationshipId, endError: null }));
    try {
      const account = await loadAccountDetail();
      const csrfToken = typeof account.csrf_token === "string" ? account.csrf_token : "";
      await endAthleteRelationship(relationshipId, csrfToken);
      setState((current) => ({ ...current, endingId: null }));
      await refresh();
      document.dispatchEvent(new CustomEvent(RELATIONSHIP_CHANGED_EVENT));
      return true;
    }
    catch {
      setState((current) => ({ ...current, endingId: null, endError: "The relationship could not be ended." }));
      return false;
    }
  }, [refresh]);

  const sendMessage = useCallback(async (coachUserId: string, bodyText: string, attachmentFile: File | null) => {
    const trimmed = bodyText.trim();
    if (!trimmed && !attachmentFile) {
      setState((current) => ({ ...current, sendError: "Enter a message or attach a photo/video before sending." }));
      return false;
    }
    const attachmentError = validateAttachmentClientSide(attachmentFile);
    if (attachmentError) {
      setState((current) => ({ ...current, sendError: attachmentError }));
      return false;
    }

    setState((current) => ({ ...current, sending: true, sendError: null }));
    try {
      const account = await loadAccountDetail();
      const csrfToken = typeof account.csrf_token === "string" ? account.csrf_token : "";
      await sendAthleteOwnMessage(coachUserId, trimmed, attachmentFile, csrfToken);
      setState((current) => ({ ...current, sending: false }));
      await refreshMessages();
      return true;
    }
    catch (error) {
      setState((current) => ({
        ...current,
        sending: false,
        sendError: error instanceof Error ? error.message : "The message could not be sent."
      }));
      return false;
    }
  }, [refreshMessages]);

  return { ...state, endRelationship, sendMessage };
}
