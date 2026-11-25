import { elements } from "./elements.js";
import { state } from "./state.js";

// Part E - live delivery for messaging. Server->client push only: this
// socket never sends application data, it only reflects messages already
// persisted and returned by the existing POST /messages/... routes, so a
// dropped/never-established connection is never a correctness problem -
// React's own useCoachAthleteMessages.ts (coach side) and
// useAccountCoachRelationship.ts/useAccountOrgMessages.ts (athlete side)
// all refresh on mount and remain the source of truth. Native WebSocket
// has no built-in reconnect, unlike EventSource, so a capped exponential
// backoff is handled here manually.
let messagingSocket = null;
let messagingReconnectTimer = null;
let messagingReconnectDelayMs = 2000;
const MESSAGING_RECONNECT_MAX_DELAY_MS = 30000;

function setLiveConnectionStatus(connected) {
  elements.connectionStatus.textContent = connected ? "Connected" : "Offline";
  elements.connectionStatus.classList.toggle("offline", !connected);
}

export function connectMessagingSocket() {
  if (state.role !== "coach" && state.role !== "athlete") return;

  if (messagingReconnectTimer) {
    clearTimeout(messagingReconnectTimer);
    messagingReconnectTimer = null;
  }

  const wsUrl = `${location.origin.replace(/^http/u, "ws")}/ws/messages`;
  const socket = new WebSocket(wsUrl);
  messagingSocket = socket;

  socket.addEventListener("open", () => {
    if (messagingSocket !== socket) return;
    messagingReconnectDelayMs = 2000;
    setLiveConnectionStatus(true);
  });

  socket.addEventListener("message", (event) => {
    if (messagingSocket !== socket) return;
    let envelope = null;
    try { envelope = JSON.parse(event.data); }
    catch { return; }
    handleMessagingSocketPayload(envelope);
  });

  socket.addEventListener("close", () => {
    if (messagingSocket !== socket) return;
    setLiveConnectionStatus(false);
    scheduleMessagingReconnect();
  });

  socket.addEventListener("error", () => {
    if (messagingSocket !== socket) return;
    setLiveConnectionStatus(false);
  });
}

function scheduleMessagingReconnect() {
  if (messagingReconnectTimer) return;
  messagingReconnectTimer = setTimeout(() => {
    messagingReconnectTimer = null;
    connectMessagingSocket();
  }, messagingReconnectDelayMs);
  messagingReconnectDelayMs = Math.min(messagingReconnectDelayMs * 2, MESSAGING_RECONNECT_MAX_DELAY_MS);
}

// coach<->athlete only live-updates the single thread the user currently
// has open (React's own threadIdRef on the coach side, state.
// liveMessageThreadId's React-hook equivalent - see
// useCoachAthleteMessages.ts/useAccountCoachRelationship.ts) - cross-thread
// notification is out of scope there, same as the original D.1/D.2 plan.
// org_athlete_message (part D.4) and org_coach_message (part O.9) are the
// two exceptions with no "currently open" gate at all, since both sides'
// UI renders every org thread simultaneously - see the branches below.
// The org owner side of both push types still has no live client anywhere
// (the separate org-owner dashboard has no WebSocket connection at all) -
// its own inbox is fetch-on-demand only, unchanged by this slice.
function handleMessagingSocketPayload(envelope) {
  if (!envelope) return;

  if (envelope.type === "coach_athlete_message") {
    const thread = envelope.thread;
    const message = envelope.message;
    if (!thread || !message) return;

    if (state.role === "coach") {
      // The coach-side 1:1 messaging panel is React now (see
      // CoachAthleteMessagePanel.tsx/useCoachAthleteMessages.ts) - it owns
      // its own currently-open-thread-id/message-list state and dedupes
      // the same way this used to (by message_id), so this just forwards
      // the push.
      document.dispatchEvent(new CustomEvent("kolosseum:coach-athlete-message-received", { detail: { thread, message } }));
    }
    else if (state.role === "athlete") {
      // The athlete-side coach-messaging panel is React now (see
      // AccountCoachRelationshipPanel.tsx/useAccountCoachRelationship.ts) -
      // it owns its own thread-id/message-list state and dedupes the same
      // way this used to (by message_id), so this just forwards the push.
      document.dispatchEvent(new CustomEvent("kolosseum:athlete-coach-message-received", { detail: { thread, message } }));
    }
  }
  // Part D.4 - unlike the single-thread coach<->athlete case above, an
  // athlete can have several simultaneously-rendered org threads (no
  // "currently open" gate). The athlete-side org-messaging panel is React
  // now (AccountOrgMessagesPanel.tsx/useAccountOrgMessages.ts) - it owns
  // merging a push into an existing thread entry or creating a brand new
  // one, so this just forwards the push.
  else if (envelope.type === "org_athlete_message" && state.role === "athlete") {
    const thread = envelope.thread;
    const message = envelope.message;
    if (!thread || !message) return;
    document.dispatchEvent(new CustomEvent("kolosseum:athlete-org-message-received", { detail: { thread, message } }));
  }
  // Part O.9 - the coach-side org-messaging panel is React now (see
  // CoachOrgMessagesPanel.tsx/useCoachOrgMessages.ts) - it owns merging a
  // push into an existing thread entry or creating a brand new one, so
  // this just forwards the push, mirroring the org_athlete_message branch
  // above.
  else if (envelope.type === "org_coach_message" && state.role === "coach") {
    const thread = envelope.thread;
    const message = envelope.message;
    if (!thread || !message) return;
    document.dispatchEvent(new CustomEvent("kolosseum:coach-org-message-received", { detail: { thread, message } }));
  }
}
