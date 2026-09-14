import { useCallback, useEffect, useState } from "react";

import { loadAccountDetail } from "../../api/client";
import {
  loadCoachOrgMemberships,
  loadCoachOrgMessageThreadsMine,
  type OrgMessageThreadEntry,
  sendCoachOrgMessage,
  validateAttachmentClientSide
} from "../../api/accountRelationshipsClient";
import { type JsonRecord } from "../../api/transport";

// DEV NOTE: Part O.9 - the coach's own org-owner<->coach team messaging,
// mirroring useAccountOrgMessages.ts's athlete-side original as closely as
// the underlying data allows. Plural by construction: a coach could belong
// to more than one org. Unlike the athlete side (loadAthleteOrgContextMine
// always available once a relationship exists), a coach's org membership
// itself carries membership_status (invited/active/removed) - only an
// "active" membership can actually send (see org_coach_messaging_service.
// ts's requireActiveCoachMembership), so that gates the send form here
// alongside visibility_mode, same spirit as the athlete panel's
// shared-vs-individual gate.
export const MESSAGE_RECEIVED_EVENT = "kolosseum:coach-org-message-received";

export type CoachOrgMessageEntry = {
  org_id: string;
  org_name: string;
  visibility_mode: string;
  membership_status: string;
  threadEntry: OrgMessageThreadEntry | null;
};

function combineEntries(threadEntries: OrgMessageThreadEntry[], memberships: JsonRecord[]): CoachOrgMessageEntry[] {
  const threadEntryByOrgId = new Map(threadEntries.map((entry) => [String(entry.thread.org_id), entry]));
  const combined: CoachOrgMessageEntry[] = [];
  const seenOrgIds = new Set<string>();

  for (const membership of memberships) {
    const orgId = String(membership.org_id);
    combined.push({
      org_id: orgId,
      org_name: String(membership.org_name ?? ""),
      visibility_mode: String(membership.visibility_mode ?? ""),
      membership_status: String(membership.membership_status ?? ""),
      threadEntry: threadEntryByOrgId.get(orgId) ?? null
    });
    seenOrgIds.add(orgId);
  }

  for (const entry of threadEntries) {
    const orgId = String(entry.thread.org_id);
    if (seenOrgIds.has(orgId)) continue;
    combined.push({ org_id: orgId, org_name: "", visibility_mode: "shared", membership_status: "active", threadEntry: entry });
  }

  return combined;
}

export type CoachOrgMessagesState = {
  loading: boolean;
  error: string | null;
  entries: CoachOrgMessageEntry[];
  sendingOrgId: string | null;
  sendErrorOrgId: string | null;
  sendError: string | null;
};

const initialState: CoachOrgMessagesState = {
  loading: true,
  error: null,
  entries: [],
  sendingOrgId: null,
  sendErrorOrgId: null,
  sendError: null
};

export function useCoachOrgMessages() {
  const [state, setState] = useState<CoachOrgMessagesState>(initialState);

  const refresh = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const [threadEntries, memberships] = await Promise.all([
        loadCoachOrgMessageThreadsMine(),
        loadCoachOrgMemberships()
      ]);
      setState((current) => ({ ...current, loading: false, entries: combineEntries(threadEntries, memberships) }));
    }
    catch {
      setState((current) => ({
        ...current,
        loading: false,
        error: "Organisation messages could not be loaded. Check your connection and try again."
      }));
    }
  }, []);

  useEffect(() => {
    refresh();
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
          const newEntry: CoachOrgMessageEntry = {
            org_id: orgId,
            org_name: "",
            visibility_mode: "shared",
            membership_status: "active",
            threadEntry: { thread, messages: [message] }
          };
          return { ...current, entries: [...current.entries, newEntry] };
        }

        const existing = current.entries[existingIndex];
        const existingMessages = existing.threadEntry?.messages ?? [];
        if (existingMessages.some((entry) => entry.message_id === message.message_id)) return current;

        const updatedEntry: CoachOrgMessageEntry = {
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
      await sendCoachOrgMessage(orgId, trimmed, attachmentFile, csrfToken);
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
