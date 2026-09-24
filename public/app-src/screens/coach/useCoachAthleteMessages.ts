import { useCallback, useEffect, useRef, useState } from "react";

import { loadAccountDetail } from "../../api/client";
// validateAttachmentClientSide is generic (fast client-side feedback only,
// never the actual security boundary) and already exported for reuse - see
// its own DEV NOTE in accountRelationshipsClient.ts.
import { validateAttachmentClientSide } from "../../api/accountRelationshipsClient";
import {
  loadCoachMessageThreads,
  loadCoachMessagesForThread,
  sendCoachAthleteMessage
} from "../../api/coachWorkspaceClient";
import { type JsonRecord } from "../../api/transport";

// DEV NOTE: ported from app.js's (removed) refreshCoachAthleteMessages()/
// renderCoachAthleteMessages()/confirmSendAthleteMessage() - the "Message
// this athlete" 1:1 widget embedded in the athlete training-profile shell.
// Shares the same open/close bridge events as
// AthleteProfileAssignmentPanel.tsx/useAthleteStrengthProfile.ts. app.js's
// WebSocket handler now dispatches MESSAGE_RECEIVED_EVENT for a
// coach_athlete_message push instead of mutating legacy state and calling
// the removed renderCoachAthleteMessages() directly - see
// handleMessagingSocketPayload()'s coach branch.
const OPENED_EVENT = "kolosseum:coach-athlete-profile-opened";
const CLOSED_EVENT = "kolosseum:coach-athlete-profile-closed";
export const MESSAGE_RECEIVED_EVENT = "kolosseum:coach-athlete-message-received";

export type CoachAthleteMessagesState = {
  loading: boolean;
  messages: JsonRecord[];
  sending: boolean;
  sendError: string | null;
};

const initialState: CoachAthleteMessagesState = {
  loading: true,
  messages: [],
  sending: false,
  sendError: null
};

export function useCoachAthleteMessages() {
  const [athleteUserId, setAthleteUserId] = useState<string | null>(null);
  const [state, setState] = useState<CoachAthleteMessagesState>(initialState);
  const threadIdRef = useRef<string | null>(null);

  const refresh = useCallback(async (id: string) => {
    setState((current) => ({ ...current, loading: true }));
    try {
      const threads = await loadCoachMessageThreads();
      const thread = threads.find((entry) => String(entry.athlete_user_id ?? "") === id) ?? null;

      if (!thread) {
        threadIdRef.current = null;
        setState({ loading: false, messages: [], sending: false, sendError: null });
        return;
      }

      threadIdRef.current = String(thread.thread_id);
      // Fetching a thread's messages marks it read server-side - refresh
      // the directory's unread badge to reflect that immediately, same as
      // legacy's refreshCoachMessageUnreadCounts()+renderCoachAthleteDirectory().
      const messages = await loadCoachMessagesForThread(String(thread.thread_id));
      setState({ loading: false, messages, sending: false, sendError: null });
      document.dispatchEvent(new CustomEvent("kolosseum:athlete-directory-changed"));
    }
    catch {
      setState((current) => ({ ...current, loading: false }));
    }
  }, []);

  useEffect(() => {
    function handleOpened(event: Event) {
      const detail = (event as CustomEvent).detail as { athlete_user_id?: string } | undefined;
      if (detail?.athlete_user_id) setAthleteUserId(detail.athlete_user_id);
    }
    function handleClosed() {
      setAthleteUserId(null);
    }
    document.addEventListener(OPENED_EVENT, handleOpened);
    document.addEventListener(CLOSED_EVENT, handleClosed);
    return () => {
      document.removeEventListener(OPENED_EVENT, handleOpened);
      document.removeEventListener(CLOSED_EVENT, handleClosed);
    };
  }, []);

  useEffect(() => {
    if (athleteUserId) {
      refresh(athleteUserId);
    }
    else {
      threadIdRef.current = null;
      setState(initialState);
    }
  }, [athleteUserId, refresh]);

  useEffect(() => {
    function handleMessageReceived(event: Event) {
      const detail = (event as CustomEvent).detail as { thread?: JsonRecord; message?: JsonRecord } | undefined;
      const thread = detail?.thread;
      const message = detail?.message;
      if (!thread || !message) return;
      // This coach may have several athletes' threads exist, but only the
      // currently-open one is rendered - matches legacy's exact
      // state.liveMessageThreadId gate.
      if (String(thread.thread_id) !== threadIdRef.current) return;

      setState((current) => {
        if (current.messages.some((entry) => entry.message_id === message.message_id)) return current;
        return { ...current, messages: [...current.messages, message] };
      });
    }
    document.addEventListener(MESSAGE_RECEIVED_EVENT, handleMessageReceived);
    return () => document.removeEventListener(MESSAGE_RECEIVED_EVENT, handleMessageReceived);
  }, []);

  const send = useCallback(async (bodyText: string, attachmentFile: File | null) => {
    if (!athleteUserId) return false;

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
      await sendCoachAthleteMessage(athleteUserId, trimmed, attachmentFile, csrfToken);
      setState((current) => ({ ...current, sending: false }));
      await refresh(athleteUserId);
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
  }, [athleteUserId, refresh]);

  return { athleteUserId, ...state, send };
}
