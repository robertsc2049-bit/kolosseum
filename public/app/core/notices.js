import { elements } from "./elements.js";
import { setView } from "./shell.js";

export function showBusy(message) {
  elements.busyText.textContent = message;
  elements.busyOverlay.hidden = false;
}

export function hideBusy() {
  elements.busyOverlay.hidden = true;
}

// FULL-UI-22 cross-product quality: a route-level service-unavailable +
// retry state, reusing whatever status line a view already has (never a
// new dedicated panel per view) so a failed load leaves a persistent,
// actionable message instead of silently going stale or only flashing
// the global toast. The global error notice (with its own "Report this
// problem" action) still fires too - this is additive, not a
// replacement.
export function catchWithViewRetry(statusElement, retryFn, message) {
  const handler = (error) => {
    if (statusElement) {
      statusElement.textContent = "";
      statusElement.classList.add("error");

      const text = document.createElement("span");
      text.textContent = message;

      const retryButton = document.createElement("button");
      retryButton.type = "button";
      retryButton.className = "button secondary status-retry-button";
      retryButton.textContent = "Retry";
      retryButton.addEventListener("click", () => {
        statusElement.classList.remove("error");
        statusElement.textContent = "Retrying...";
        retryFn().catch(handler);
      });

      statusElement.append(text, " ", retryButton);
    }
    handleError(error);
  };
  return handler;
}

let noticeTimer = null;

export function showNotice(message, type = "success", options = {}) {
  clearTimeout(noticeTimer);
  elements.notice.textContent = message;
  elements.notice.classList.toggle("error", type === "error");
  // An error is announced assertively (interrupts) since it usually
  // requires the person to notice and act; a success/status message is
  // announced politely (waits its turn) so it doesn't interrupt anything.
  elements.notice.setAttribute("aria-live", type === "error" ? "assertive" : "polite");
  elements.notice.hidden = false;

  const existingActions = elements.notice.querySelector(".notice-actions");
  if (existingActions) existingActions.remove();

  // Every notice can be dismissed: a confirmation also goes on a tap, and
  // nothing (an error with a report button included) is left covering the
  // screen with no way to close it.
  const dismiss = document.createElement("button");
  dismiss.type = "button";
  dismiss.className = "notice-dismiss";
  dismiss.setAttribute("aria-label", "Dismiss");
  dismiss.addEventListener("click", (event) => {
    event.stopPropagation();
    clearTimeout(noticeTimer);
    elements.notice.hidden = true;
  });
  elements.notice.appendChild(dismiss);

  if (type === "error" && options.failureContext) {
    const actions = document.createElement("div");
    actions.className = "notice-actions";
    const reportButton = document.createElement("button");
    reportButton.type = "button";
    reportButton.className = "button secondary notice-report-button";
    reportButton.textContent = "Report this problem";
    reportButton.addEventListener("click", () => {
      setView("account");
      document.dispatchEvent(
        new CustomEvent("kolosseum:open-support-report", { detail: { failureContext: options.failureContext } })
      );
    });
    actions.appendChild(reportButton);
    elements.notice.appendChild(actions);
    return;
  }

  // A confirmation is brief; an error stays long enough to read.
  noticeTimer = setTimeout(() => {
    elements.notice.hidden = true;
  }, type === "error" ? 8000 : 2600);
}

function buildFailureContextFromError(error) {
  if (!error?.requestPath) return null;

  const reason = String(
    error?.payload?.reason ??
    error?.payload?.failure_token ??
    error?.payload?.error ??
    ""
  ).slice(0, 200);

  return {
    status: Number.isInteger(error.status) ? error.status : null,
    reason,
    method: String(error.requestMethod ?? "").toUpperCase(),
    path: String(error.requestPath ?? "")
  };
}

export function handleError(error) {
  hideBusy();
  showNotice(
    error?.message ?? "The request could not be completed.",
    "error",
    { failureContext: buildFailureContextFromError(error) }
  );
  console.error(error);
}
