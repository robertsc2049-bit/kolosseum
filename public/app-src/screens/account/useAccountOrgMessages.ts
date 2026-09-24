import { useCallback, useEffect, useState } from "react";

import { loadAccountDetail } from "../../api/client";
import {
  loadAthleteOrgContextMine,
  loadAthleteOrgMessageThreadsMine,
  type OrgMessageThreadEntry,
  sendAthleteOrgMessage,
  validateAttachmentClientSide
} from "../../api/accountRelationshipsClient";
import { type JsonRecord } from "../../api/transport";

// DEV NOTE: ported from app.js's refreshAthleteOrgMessages()/
// combinedAthleteOrgEntries()/renderAthleteOrgMessages()/
// confirmSendAthleteOrgMessage() - Part D.4/O.6, the athlete's own
// org-owner<->athlete team messaging (plural: an athlete could in
// principle be reached by more than one team org). Merges org-context
// entries (always available once an accepted relationship + active org
// coach exists) with thread entries (only once a message has actually been
// sent) by org_id, so every team the athlete is genuinely part of appears -
// not just ones with prior messages. app.js's WebSocket handler now
// dispatches MESSAGE_RECEIVED_EVENT for org_athlete_message pushes instead
// of calling the removed renderAthleteOrgMessages() directly.
export const MESSAGE_RECEIVED_EVENT = "kolosseum:athlete-org-message-received";

export type OrgMessageEntry = { org_id: string; org_name: string; visibility_mode: string; threadEntry: OrgMessageThreadEntry | null };

function combineEntries(threadEntries: OrgMessageThreadEntry[], contexts: JsonRecord[]): OrgMessageEntry[] {
  const threadEntryByOrgId = new Map(threadEntries.map((entry) => [String(entry.thread.org_id), entry]));
  const combined: OrgMessageEntry[] = [];
  const seenOrgIds = new Set<string>();

  for (const context of contexts) {
    const orgId = String(context.org_id);
    const threadEntry = threadEntryByOrgId.get(orgId) ?? null;
    combined.push({
      org_id: orgId,
      org_name: threadEntry ? String(threadEntry.thread.org_name) : String(context.org_name ?? ""),
      visibility_mode: String(context.visibility_mode ?? ""),
      threadEntry
    });
    seenOrgIds.add(orgId);
  }

  for (const entry of threadEntries) {
    const orgId = String(entry.thread.org_id);
    if (seenOrgIds.has(orgId)) continue;
    combined.push({ org_id: orgId, org_name: String(entry.thread.org_name ?? ""), visibility_mode: "shared", threadEntry: entry });
  }

  return combined;
}

export type AccountOrgMessagesState = {
  loading: boolean;
  error: string | null;
  entries: OrgMessageEntry[];
  sendingOrgId: string | null;
  sendErrorOrgId: string | null;
  sendError: string | null;
};

const initialState: AccountOrgMessagesState = {
  loading: true,
  error: null,
  entries: [],
  sendingOrgId: null,
  sendErrorOrgId: null,
  sendError: null
};

export function useAccountOrgMessages() {
  const [state, setState] = useState<AccountOrgMessagesState>(initialState);

  const refresh = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const [threadEntries, contexts] = await Promise.all([
        loadAthleteOrgMessageThreadsMine(),
        loadAthleteOrgContextMine()
      ]);
      setState((current) => ({ ...current, loading: false, entries: combineEntries(threadEntries, contexts) }));
    }
    catch {
      setState((current) => ({
        ...current,
        loading: false,
        error: "Team messages could not be loaded. Check your connection and try again."
      }));
    }
  }, []);

  useEffect(() => {
    refresh();
    // A same-tab sign-in/register never fires "storage", so the panel's
    // role gate can flip athlete-on without this hook ever re-fetching -
    // see utils/role.ts's useRole().
    document.addEventListener("kolosseum:account-role-known", refresh);
    return () => document.removeEventListener("kolosseum:account-role-known", refresh);
  }, [refresh]);

  useEffect(() => {
    function handleMessageReceived(event: Event) {
      const detail = (event as CustomEvent).detail as { thread?: JsonRecord; message?: JsonRecord } | undefined;
      const thread = detail?.thread;
      const message = detail?.message;
      if (!thread || !message) return;
      const orgId = String(thread.org_id);

      setState((current) => {
        const existingIndex = current.entries.findIndex((entry) => entry.org_id === orgId);
        if (existingIndex === -1) {
          const newEntry: OrgMessageEntry = {
            org_id: orgId,
            org_name: String(thread.org_name ?? ""),
            visibility_mode: "shared",
            threadEntry: { thread, messages: [message] }
          };
          return { ...current, entries: [...current.entries, newEntry] };
        }

        const existing = current.entries[existingIndex];
        const existingMessages = existing.threadEntry?.messages ?? [];
        if (existingMessages.some((entry) => entry.message_id === message.message_id)) return current;

        const updatedEntry: OrgMessageEntry = {
          ...existing,
          threadEntry: { thread, messages: [...existingMessages, message] }
        };
        const entries = [...current.entries];
        entries[existingIndex] = updatedEntry;
        return { ...current, entries };
      });
    }
    document.addEventListener(MESSAGE_RECEIVED_EVENT, handleMessageReceived);
    return () => document.removeEventListener(MESSAGE_RECEIVED_EVENT, handleMessageReceived);
  }, []);

  const sendMessage = useCallback(async (orgId: string, bodyText: string, attachmentFile: File | null) => {
    const trimmed = bodyText.trim();
    if (!trimmed && !attachmentFile) {
      setState((current) => ({ ...current, sendErrorOrgId: orgId, sendError: "Enter a message or attach a photo/video before sending." }));
      return false;
    }
    const attachmentError = validateAttachmentClientSide(attachmentFile);
    if (attachmentError) {
      setState((current) => ({ ...current, sendErrorOrgId: orgId, sendError: attachmentError }));
      return false;
    }

    setState((current) => ({ ...current, sendingOrgId: orgId, sendErrorOrgId: null, sendError: null }));
    try {
      const account = await loadAccountDetail();
      const csrfToken = typeof account.csrf_token === "string" ? account.csrf_token : "";
      await sendAthleteOrgMessage(orgId, trimmed, attachmentFile, csrfToken);
      setState((current) => ({ ...current, sendingOrgId: null }));
      await refresh();
      return true;
    }
    catch (error) {
      setState((current) => ({
        ...current,
        sendingOrgId: null,
        sendErrorOrgId: orgId,
        sendError: error instanceof Error ? error.message : "The message could not be sent."
      }));
      return false;
    }
  }, [refresh]);

  return { ...state, sendMessage };
}
