import { useCallback, useEffect, useState } from "react";

import { loadAccountDetail } from "../../api/client";
import { loadPendingRelationshipInvitations, loadAthleteRelationshipsMine } from "../../api/accountRelationshipsClient";
import { loadCoachRelationships } from "../../api/coachWorkspaceClient";
import {
  loadNotifications,
  loadUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
  markNotificationUnread
} from "../../api/notificationsClient";
import { type JsonRecord } from "../../api/transport";

// DEV NOTE: FULL-UI-18 factual in-product notifications (bell + dropdown
// panel) - ported from public/app/app.js's notification functions (see
// NotificationBellPanel.tsx's own DEV NOTE for the full list of what
// moved). Fetches the unread count once on mount (matching legacy's
// bootstrap-time refreshNotificationUnreadCount() call) and the full
// panel content (notifications + the current role's own relationship
// data, for resolveNotificationSubject()'s coach/athlete name lookup)
// only when the panel is actually opened, matching legacy's own
// load-on-open behaviour. Opening a notification with a real target
// still bridges to legacy via kolosseum:open-notification-target,
// since resolving a deep_link into a URL hash needs the full
// PRODUCT_ROUTE_MAP/serializeProductRoute() machinery in
// route_bootstrap.js, which stays legacy - see app.js's own DEV NOTE
// for that one remaining listener.
//
// refreshPendingRelationshipInvitations()/refreshAthleteRelationships()
// in app.js were deleted as a direct consequence of this hook fetching
// its own copy of the same data independently (loadPendingRelationshipInvitations()/
// loadAthleteRelationshipsMine() below) - those two legacy functions had
// zero other callers once notificationCoachName() (their only reason to
// keep running) moved here.
const OPEN_TARGET_EVENT = "kolosseum:open-notification-target";

export type NotificationsState = {
  unreadCount: number;
  panelOpen: boolean;
  loading: boolean;
  error: boolean;
  notifications: JsonRecord[];
  coachRelationships: JsonRecord[];
  athleteRelationships: JsonRecord[];
  pendingInvitations: JsonRecord[];
};

const initialState: NotificationsState = {
  unreadCount: 0,
  panelOpen: false,
  loading: false,
  error: false,
  notifications: [],
  coachRelationships: [],
  athleteRelationships: [],
  pendingInvitations: []
};

export function useNotifications() {
  const [state, setState] = useState<NotificationsState>(initialState);

  useEffect(() => {
    loadUnreadNotificationCount()
      .then((unreadCount) => setState((current) => ({ ...current, unreadCount })))
      .catch(() => {});
  }, []);

  const csrfToken = useCallback(async () => {
    const account = await loadAccountDetail();
    return typeof account.csrf_token === "string" ? account.csrf_token : "";
  }, []);

  const loadPanelContent = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: false }));
    try {
      const account = await loadAccountDetail();
      const actorType = String((account.account as JsonRecord | undefined)?.actor_type ?? "");
      const coachUserId = String((account.account as JsonRecord | undefined)?.user_id ?? "");

      const [{ notifications, unreadCount }, coachRelationships, athleteRelationships, pendingInvitations] = await Promise.all([
        loadNotifications(),
        actorType === "coach" ? loadCoachRelationships(coachUserId) : Promise.resolve([]),
        actorType === "athlete" ? loadAthleteRelationshipsMine() : Promise.resolve([]),
        actorType === "athlete" ? loadPendingRelationshipInvitations() : Promise.resolve([])
      ]);

      setState((current) => ({
        ...current,
        loading: false,
        error: false,
        notifications,
        unreadCount,
        coachRelationships,
        athleteRelationships,
        pendingInvitations
      }));
    }
    catch {
      setState((current) => ({ ...current, loading: false, error: true }));
    }
  }, []);

  const open = useCallback(() => {
    setState((current) => ({ ...current, panelOpen: true }));
    loadPanelContent();
  }, [loadPanelContent]);

  const close = useCallback(() => {
    setState((current) => ({ ...current, panelOpen: false }));
  }, []);

  const toggle = useCallback(() => {
    setState((current) => {
      if (current.panelOpen) return { ...current, panelOpen: false };
      loadPanelContent();
      return { ...current, panelOpen: true };
    });
  }, [loadPanelContent]);

  const markRead = useCallback(async (notificationId: string) => {
    const token = await csrfToken();
    await markNotificationRead(notificationId, token);
    await loadPanelContent();
  }, [csrfToken, loadPanelContent]);

  const markUnread = useCallback(async (notificationId: string) => {
    const token = await csrfToken();
    await markNotificationUnread(notificationId, token);
    await loadPanelContent();
  }, [csrfToken, loadPanelContent]);

  const markAllRead = useCallback(async () => {
    const token = await csrfToken();
    await markAllNotificationsRead(token);
    await loadPanelContent();
  }, [csrfToken, loadPanelContent]);

  const openTarget = useCallback((notification: JsonRecord) => {
    if (notification.target_available !== true) return;

    setState((current) => ({ ...current, panelOpen: false }));

    if (notification.read_at_iso8601 === null) {
      csrfToken()
        .then((token) => markNotificationRead(String(notification.notification_id), token))
        .then(() => loadUnreadNotificationCount())
        .then((unreadCount) => setState((current) => ({ ...current, unreadCount })))
        .catch(() => {});
    }

    document.dispatchEvent(new CustomEvent(OPEN_TARGET_EVENT, {
      detail: {
        route_id: (notification.deep_link as JsonRecord | undefined)?.route_id,
        params: (notification.deep_link as JsonRecord | undefined)?.params ?? {}
      }
    }));
  }, [csrfToken]);

  return { ...state, open, close, toggle, markRead, markUnread, markAllRead, openTarget, retry: loadPanelContent };
}
