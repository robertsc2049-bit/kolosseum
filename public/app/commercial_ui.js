import {
  loadAccountDetail,
  loadCommercialAccount,
  recordCommercialPaymentReturn,
  requestCommercialBillingPortal,
  requestCommercialCheckout
} from "./account_ui.js";

const elements = {
  view: document.getElementById(
    "view-account"
  ),
  panel: document.getElementById(
    "accountCommercialPanel"
  ),
  subscriptionState:
    document.getElementById(
      "commercialSubscriptionState"
    ),
  accessState:
    document.getElementById(
      "commercialAccessState"
    ),
  billingStatus:
    document.getElementById(
      "commercialBillingStatus"
    ),
  plan:
    document.getElementById(
      "commercialPlan"
    ),
  seatAllowance:
    document.getElementById(
      "commercialSeatAllowance"
    ),
  seatUsage:
    document.getElementById(
      "commercialSeatUsage"
    ),
  seatAvailable:
    document.getElementById(
      "commercialSeatAvailable"
    ),
  checkoutButton:
    document.getElementById(
      "commercialCheckoutButton"
    ),
  portalButton:
    document.getElementById(
      "commercialPortalButton"
    ),
  result:
    document.getElementById(
      "commercialResult"
    ),
  entitlementError:
    document.getElementById(
      "commercialEntitlementError"
    ),
  history:
    document.getElementById(
      "commercialHistory"
    ),
  refreshAccountButton:
    document.getElementById(
      "refreshAccountButton"
    )
};

let busy = false;
let returnHandled = false;
let lastRenderedSignature = "";

function clean(value) {
  return String(value ?? "").trim();
}

function humanise(value) {
  const text = clean(value);

  return text
    ? text
        .replaceAll("_", " ")
        .replace(/\b\w/gu, (letter) =>
          letter.toUpperCase()
        )
    : "—";
}

function dateTime(value) {
  const candidate = clean(value);

  if (!candidate) {
    return "—";
  }

  const date = new Date(candidate);

  return Number.isNaN(date.getTime())
    ? candidate
    : date.toLocaleString();
}

function showMessage(
  element,
  message,
  tone = "neutral"
) {
  if (!element) {
    return;
  }

  element.hidden = !message;
  element.textContent = message;
  element.dataset.tone = tone;
}

function errorCode(error) {
  return clean(
    error?.payload?.error ??
    error?.message ??
    "commercial_request_failed"
  );
}

function errorMessage(error) {
  const code = errorCode(error);

  const messages = {
    account_session_missing:
      "Sign in to view commercial account state.",
    account_session_invalid:
      "The sign-in session has expired.",
    commercial_configuration_missing:
      "Controlled-launch checkout is not configured on this server.",
    commercial_coach_account_required:
      "Commercial controls are available to coach accounts only.",
    commercial_checkout_record_missing:
      "No checkout request exists for this account.",
    commercial_billing_record_missing:
      "No billing record exists for this account.",
    commercial_portal_unavailable:
      "The billing portal is unavailable until trusted payment confirmation is recorded.",
    commercial_portal_configuration_missing:
      "The billing portal has not been configured on this server.",
    commercial_payment_return_invalid:
      "The payment return status is invalid."
  };

  return (
    messages[code] ??
    humanise(code)
  );
}

function currentRequestId(prefix) {
  const suffix =
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}_${Math.random()
      .toString(16)
      .slice(2)}`;

  return `${prefix}_${suffix}`
    .replace(/[^A-Za-z0-9_.:-]/gu, "_");
}

function renderHistory(history) {
  if (!elements.history) {
    return;
  }

  const records = Array.isArray(history)
    ? history
    : [];

  elements.history.replaceChildren();

  if (records.length === 0) {
    const empty = document.createElement("div");

    empty.className =
      "empty-state compact-empty";
    empty.innerHTML =
      "<p>No commercial account records.</p>";
    elements.history.append(empty);
    return;
  }

  for (const record of records) {
    const item = document.createElement("article");
    const heading = document.createElement("strong");
    const facts = document.createElement("p");

    item.className =
      "commercial-history-record";
    heading.textContent =
      humanise(record.record_type);

    const state =
      clean(record.billing_status) ||
      clean(record.billing_access_state) ||
      clean(record.return_outcome) ||
      "recorded";

    facts.className = "muted";
    facts.textContent =
      `${dateTime(
        record.effective_at_iso8601
      )} · ${humanise(state)}`;

    item.append(heading, facts);
    elements.history.append(item);
  }
}

function renderCommercial(payload) {
  const commercial =
    payload?.commercial &&
    typeof payload.commercial === "object"
      ? payload.commercial
      : {};

  const signature = JSON.stringify({
    commercial,
    history: payload?.history ?? []
  });

  if (signature === lastRenderedSignature) {
    return;
  }

  lastRenderedSignature = signature;

  if (elements.subscriptionState) {
    elements.subscriptionState.textContent =
      humanise(
        commercial.subscription_state
      );
  }

  if (elements.accessState) {
    elements.accessState.textContent =
      humanise(
        commercial.product_access_state
      );
  }

  if (elements.billingStatus) {
    elements.billingStatus.textContent =
      humanise(
        commercial.billing_status
      );
  }

  if (elements.plan) {
    elements.plan.textContent =
      clean(commercial.plan_id) || "—";
  }

  if (elements.seatAllowance) {
    elements.seatAllowance.textContent =
      Number.isInteger(
        commercial.seat_limit
      )
        ? String(commercial.seat_limit)
        : "—";
  }

  if (elements.seatUsage) {
    elements.seatUsage.textContent =
      Number.isInteger(
        commercial.occupied_seat_count
      )
        ? String(
            commercial.occupied_seat_count
          )
        : "—";
  }

  if (elements.seatAvailable) {
    elements.seatAvailable.textContent =
      Number.isInteger(
        commercial.available_seat_count
      )
        ? String(
            commercial.available_seat_count
          )
        : "—";
  }

  const entitlement =
    commercial.entitlement_error &&
    typeof commercial.entitlement_error ===
      "object"
      ? commercial.entitlement_error
      : null;

  showMessage(
    elements.entitlementError,
    entitlement
      ? clean(entitlement.message) ||
        humanise(entitlement.code)
      : "",
    entitlement ? "warning" : "neutral"
  );

  if (elements.checkoutButton) {
    elements.checkoutButton.disabled =
      busy ||
      commercial.checkout_available !== true;

    elements.checkoutButton.textContent =
      commercial.checkout_redirect_available ===
      true
        ? "Open checkout"
        : "Prepare checkout";
  }

  if (elements.portalButton) {
    elements.portalButton.disabled =
      busy ||
      commercial.portal_available !== true;
  }

  renderHistory(payload?.history);
}

async function csrfToken() {
  const detail = await loadAccountDetail();
  const token = clean(detail?.csrf_token);

  if (!token) {
    throw new Error(
      "account_csrf_invalid"
    );
  }

  return token;
}

async function refreshCommercial({
  quiet = false
} = {}) {
  if (!elements.panel) {
    return;
  }

  try {
    const payload =
      await loadCommercialAccount();

    renderCommercial(payload);

    if (!quiet) {
      showMessage(
        elements.result,
        "Commercial account state refreshed.",
        "success"
      );
    }
  }
  catch (error) {
    showMessage(
      elements.result,
      errorMessage(error),
      "error"
    );
  }
}

async function runAction(action) {
  if (busy) {
    return;
  }

  busy = true;

  if (elements.checkoutButton) {
    elements.checkoutButton.disabled = true;
  }

  if (elements.portalButton) {
    elements.portalButton.disabled = true;
  }

  try {
    const result = await action();

    await refreshCommercial({ quiet: true });

    return result;
  }
  catch (error) {
    showMessage(
      elements.result,
      errorMessage(error),
      "error"
    );

    throw error;
  }
  finally {
    busy = false;

    await refreshCommercial({
      quiet: true
    }).catch(() => {});
  }
}

async function openCheckout() {
  const result = await runAction(
    async () => {
      const token = await csrfToken();

      return requestCommercialCheckout(
        {
          request_id:
            currentRequestId(
              "commercial_checkout"
            )
        },
        token
      );
    }
  );

  const checkoutUrl =
    clean(result?.checkout_url);

  if (checkoutUrl) {
    showMessage(
      elements.result,
      "Checkout request recorded. Opening the configured provider page.",
      "success"
    );

    window.location.assign(checkoutUrl);
    return;
  }

  showMessage(
    elements.result,
    "Checkout request recorded. No live provider call was performed.",
    "success"
  );
}

async function openBillingPortal() {
  const result = await runAction(
    async () => {
      const token = await csrfToken();

      return requestCommercialBillingPortal(
        {
          request_id:
            currentRequestId(
              "commercial_portal"
            )
        },
        token
      );
    }
  );

  const portalUrl =
    clean(result?.portal_url);

  if (portalUrl) {
    showMessage(
      elements.result,
      "Portal request recorded. Opening the configured provider page.",
      "success"
    );

    window.location.assign(portalUrl);
    return;
  }

  showMessage(
    elements.result,
    "Portal request recorded. No live provider call was performed.",
    "success"
  );
}

async function handlePaymentReturn() {
  if (returnHandled) {
    return;
  }

  const parameters =
    new URLSearchParams(
      window.location.search
    );

  const outcome =
    clean(
      parameters.get("checkout_return")
    );

  if (
    outcome !== "success" &&
    outcome !== "cancelled"
  ) {
    returnHandled = true;
    return;
  }

  returnHandled = true;

  try {
    await runAction(async () => {
      const token = await csrfToken();
      const providerSessionId =
        clean(
          parameters.get(
            "provider_session_id"
          )
        );

      return recordCommercialPaymentReturn(
        {
          request_id:
            `commercial_return_${outcome}_${
              providerSessionId || "no_session"
            }`,
          outcome,
          provider_session_id:
            providerSessionId || null
        },
        token
      );
    });

    showMessage(
      elements.result,
      outcome === "success"
        ? "Checkout return recorded. Trusted provider confirmation is still required."
        : "Checkout cancellation recorded.",
      outcome === "success"
        ? "warning"
        : "neutral"
    );

    parameters.delete("checkout_return");
    parameters.delete(
      "provider_session_id"
    );

    const query = parameters.toString();
    const nextUrl =
      `${window.location.pathname}${
        query ? `?${query}` : ""
      }${window.location.hash}`;

    window.history.replaceState(
      null,
      "",
      nextUrl
    );
  }
  catch {
  }
}

function accountViewVisible() {
  return Boolean(
    elements.view &&
    elements.view.hidden === false
  );
}

function activateAccountCommercialView() {
  if (!accountViewVisible()) {
    return;
  }

  void refreshCommercial({
    quiet: true
  });

  void handlePaymentReturn();
}

function initialise() {
  if (!elements.panel) {
    return;
  }

  elements.checkoutButton?.addEventListener(
    "click",
    () => {
      void openCheckout();
    }
  );

  elements.portalButton?.addEventListener(
    "click",
    () => {
      void openBillingPortal();
    }
  );

  elements.refreshAccountButton
    ?.addEventListener(
      "click",
      () => {
        window.setTimeout(() => {
          void refreshCommercial({
            quiet: true
          });
        }, 0);
      }
    );

  if (elements.view) {
    const observer = new MutationObserver(
      activateAccountCommercialView
    );

    observer.observe(elements.view, {
      attributes: true,
      attributeFilter: ["hidden"]
    });
  }

  activateAccountCommercialView();
}

initialise();
