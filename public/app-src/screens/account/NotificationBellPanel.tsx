import React, { useEffect, useRef } from "react";

import { type JsonRecord } from "../../api/transport";
import { formatDate } from "../../utils/format";
import { notificationTypeLabel, resolveNotificationSubject } from "../../api/notificationsClient";
import { useNotifications } from "./useNotifications";

// DEV NOTE: FULL-UI-18 factual in-product notifications (bell + dropdown
// panel) - ported field-for-field from public/app/app.js's
// renderNotificationUnreadBadge()/renderNotificationList()/
// loadNotificationPanelContent()/openNotificationPanel()/
// closeNotificationPanel()/toggleNotificationPanel()/
// markAllNotificationsReadAction()/toggleNotificationReadState(), mounted
// at #notification-bell-root (replacing the whole static
// .notification-bell-wrap). Opening a notification with a real target
// still bridges to legacy via kolosseum:open-notification-target (see
// useNotifications.ts's own DEV NOTE) - resolving a deep_link into a URL
// hash needs the full PRODUCT_ROUTE_MAP/serializeProductRoute() routing
// table, which stays in route_bootstrap.js.

function NotificationItem({
  notification,
  subject,
  onOpen,
  onToggleRead
}: {
  notification: JsonRecord;
  subject: string | null;
  onOpen: () => void;
  onToggleRead: () => void;
}) {
  const isRead = notification.read_at_iso8601 !== null;
  const label = notificationTypeLabel(notification);
  const targetAvailable = notification.target_available === true;

  return (
    <li className="notification-item">
      <button type="button" className="notification-item-open" onClick={onOpen}>
        {!isRead ? <span className="notification-item-dot" aria-hidden="true" /> : null}
        <span className="notification-item-body">
          <span className="notification-item-type">{label}</span>
          {subject ? <span className="notification-item-subject">{subject}</span> : null}
          <span className="notification-item-time">{formatDate(notification.occurred_at_iso8601)}</span>
          {targetAvailable ? null : <span className="notification-item-unavailable">This item is no longer available</span>}
        </span>
      </button>
      <button
        type="button"
        className="notification-item-toggle-read"
        onClick={(event) => {
          event.stopPropagation();
          onToggleRead();
        }}
      >
        {isRead ? "Mark unread" : "Mark read"}
      </button>
    </li>
  );
}

export function NotificationBellPanel() {
  const {
    unreadCount,
    panelOpen,
    loading,
    error,
    notifications,
    coachRelationships,
    athleteRelationships,
    pendingInvitations,
    open,
    close,
    toggle,
    markRead,
    markUnread,
    markAllRead,
    openTarget,
    retry
  } = useNotifications();

  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!panelOpen) return undefined;

    function handleDocumentClick(event: MouseEvent) {
      if (wrapRef.current?.contains(event.target as Node)) return;
      close();
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }

    document.addEventListener("click", handleDocumentClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("click", handleDocumentClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [panelOpen, close]);

  return (
    <div className="notification-bell-wrap" ref={wrapRef}>
      <button
        className="icon-button notification-bell"
        type="button"
        aria-label="Open notifications"
        aria-haspopup="true"
        aria-expanded={panelOpen}
        onClick={(event) => {
          event.stopPropagation();
          toggle();
        }}
      >
        <span aria-hidden="true">&#128276;</span>
        <span className="notification-unread-badge" hidden={unreadCount <= 0}>
          {unreadCount > 99 ? "99+" : String(unreadCount)}
        </span>
      </button>

      {panelOpen ? (
        <div className="notification-panel" role="menu" aria-label="Notifications">
          <div className="notification-panel-header">
            <strong>Notifications</strong>
            <button className="button link" type="button" onClick={() => markAllRead()}>Mark all read</button>
          </div>

          {loading ? <div className="notification-loading">Loading notifications...</div> : null}

          {!loading && error ? (
            <div className="notification-unavailable">
              <p>Notifications are unavailable right now.</p>
              <button className="button" type="button" onClick={() => retry()}>Retry</button>
            </div>
          ) : null}

          {!loading && !error && notifications.length === 0 ? (
            <div className="notification-empty">No notifications yet.</div>
          ) : null}

          {!loading && !error && notifications.length > 0 ? (
            <ul className="notification-list">
              {notifications.map((notification) => (
                <NotificationItem
                  key={String(notification.notification_id)}
                  notification={notification}
                  subject={resolveNotificationSubject(notification, { coachRelationships, athleteRelationships, pendingInvitations })}
                  onOpen={() => openTarget(notification)}
                  onToggleRead={() => {
                    const isRead = notification.read_at_iso8601 !== null;
                    const action = isRead ? markUnread(String(notification.notification_id)) : markRead(String(notification.notification_id));
                    action.catch(() => {});
                  }}
                />
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
