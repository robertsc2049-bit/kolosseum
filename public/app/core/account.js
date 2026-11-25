import { loadAccountDetail as fetchAccountDetail, restoreAccountSession } from "../account_ui.js";
import { friendlyError } from "./api.js";
import { coachPart, loadCoachPart } from "./coachPart.js";
import { elements } from "./elements.js";
import { connectMessagingSocket } from "./messaging.js";
import { handleError, hideBusy, showBusy, showNotice } from "./notices.js";
import { loadAthleteToday, refreshHistory } from "./sessions.js";
import { actorHomeView, renderIdentity, renderRoleNavigation, setView, showConnection } from "./shell.js";
import { STORAGE_KEY, cloneDefaultState, currentTemplateDraftOwnerUserId, dropTemplateDraft, saveState, state } from "./state.js";

function applyAccountIdentity(
  account
) {
  if (
    !account ||
    typeof account !== "object"
  ) {
    throw new Error(
      "The server did not return an account."
    );
  }

  state.serverAccount = account;
  state.role = account.actor_type;

  if (account.actor_type === "coach") {
    state.profile = {
      coachUserId: account.user_id,
      displayName: account.display_name,
      email: account.email
    };
  }
  else {
    state.profile = {
      userId: account.user_id,
      displayName: account.display_name,
      email: account.email,
      activityId:
        state.phase1Input?.activity_id ??
        state.profile?.activityId ??
        "powerlifting"
    };
  }

  // The unsaved programme draft is kept in this browser's localStorage, so
  // a different account signing in on the same device (or a stale session
  // that expired without a sign-out) must never inherit it - it is another
  // coach's private work, and resuming it would save it against the wrong
  // coach.
  if (
    state.templateDraft &&
    state.templateDraftOwnerUserId !== currentTemplateDraftOwnerUserId()
  ) {
    if (coachPart()) coachPart().clearTemplateDraftState();
    else dropTemplateDraft();
  }
}

function applyAccountSession(
  response
) {
  applyAccountIdentity(
    response.account
  );

  state.csrfToken =
    response.csrf_token ??
    state.csrfToken ??
    "";

  const bootstrap =
    response.bootstrap &&
    typeof response.bootstrap === "object"
      ? response.bootstrap
      : {};

  if (state.role === "coach") {
    state.coachProfile =
      bootstrap.coach_profile ??
      state.coachProfile;

    if (!state.coachProfile) {
      throw new Error(
        "The coach profile could not be restored."
      );
    }

    state.view =
      state.view === "account"
        ? "account"
        : actorHomeView(state.role);
  }
  else {
    state.authRecord =
      bootstrap.auth_record ??
      state.authRecord;

    state.acknowledgementRecord =
      bootstrap.acknowledgement_record ??
      state.acknowledgementRecord;

    state.declarationRecord =
      bootstrap.declaration_record ??
      state.declarationRecord;

    state.phase1Input =
      state.declarationRecord
        ?.engine_phase1_input ??
      state.phase1Input;

    if (
      !state.authRecord ||
      !state.acknowledgementRecord
    ) {
      throw new Error(
        "The athlete declaration could not be restored."
      );
    }

    // A missing declarationRecord/phase1Input is a real, supported state
    // now - sport is optional at signup and can be declared later (see
    // the self-service activity-change flow). Compile itself already
    // rejects a missing activity_id with a clear error; the app shell
    // must still load so the athlete can reach that self-service flow.
    state.profile.activityId =
      state.phase1Input?.activity_id ??
      null;

    state.view =
      state.view === "account"
        ? "account"
        : actorHomeView(state.role);
  }

  saveState();
}

function resetAccountState() {
  Object.assign(
    state,
    cloneDefaultState()
  );

  localStorage.removeItem(
    STORAGE_KEY
  );
}

// DEV NOTE: FULL-UI-02D the entry (sign-up/sign-in/password-reset) screen
// moved to React - see EntryAuthPanel.tsx/useEntryAuth.ts, mounted at
// #entry-auth-root. setEntryMode()/showEntryMessage()/
// showPasswordResetRequest()/showPasswordResetComplete()/showSignInForm()/
// handleEntrySubmit()/handleResetRequest()/handleResetComplete() (and
// currentTermsAvailable()/renderTermsState()/loadServerTerms(), see below)
// are gone - React owns all of that now, independently fetching its own
// terms via authClient.ts. This listener replaces handleEntrySubmit()'s
// success path only: applyAccountSession()/enterApplication() are
// otherwise unchanged. If applyAccountSession() throws (a data-integrity
// edge case - a coach profile or athlete declaration that couldn't be
// restored), the rejection is reported back to React rather than left
// silent, since the error display now lives there.
document.addEventListener("kolosseum:entry-auth-succeeded", (event) => {
  const { response, mode } = event.detail ?? {};

  try {
    applyAccountSession(response);
  }
  catch (error) {
    document.dispatchEvent(
      new CustomEvent("kolosseum:entry-auth-session-rejected", { detail: { message: error.message } })
    );
    return;
  }

  enterApplication().then(() => {
    // The sign-up form is long on a phone: start the app at the top, not
    // wherever the "Create account" button was scrolled to.
    window.scrollTo(0, 0);
    showNotice(
      mode === "create"
        ? "Account created."
        : "Signed in."
    );
  });
});

export async function loadPersistentAccountDetail(
  options = {}
) {
  const detail =
    await fetchAccountDetail();

  state.accountDetail = detail;

  state.csrfToken =
    detail.csrf_token ??
    state.csrfToken;

  if (detail.account) {
    applyAccountIdentity(
      detail.account
    );
  }

  saveState();
  renderIdentity();

  // AccountIdentityHeaderPanel.tsx/useAccountIdentityHeader.ts (a separate
  // React root from the rest of the identity form) refetches on this signal
  // too, covering both this function's callers: the "Refresh account"
  // button and account-view entry.
  document.dispatchEvent(new CustomEvent("kolosseum:account-detail-refreshed"));

  if (!options.quiet) {
    showNotice(
      "Account refreshed."
    );
  }

  return detail;
}

async function enterApplication() {
  elements.bootScreen.hidden = true;
  elements.entryView.hidden = true;
  elements.appShell.hidden = false;

  renderRoleNavigation();
  renderIdentity();

  // React's own role-gated #view-account panels (AccountBrandingPanel.tsx
  // and friends) read state.role from localStorage at mount time, which is
  // stale after a same-tab sign-in/register (no page reload - "storage"
  // events only fire cross-tab, never for the tab that made the change).
  // enterApplication() runs after every sign-in/register AND on every
  // fresh boot with a restored session, so this is the one place both
  // cases are covered.
  document.dispatchEvent(new CustomEvent("kolosseum:account-role-known"));
  // This role's screens, in their own file (app-src/workspace.ts).
  await globalThis.kolosseumWorkspaceReady?.(state.role);

  if (state.role === "athlete") {
    // FULL-UI-22 cross-product quality: server authority over local cache.
    // The locally-cached today/history/session state is never shown on
    // its own on a fresh boot/refresh - it's covered by the busy overlay
    // until the corresponding server call has actually confirmed or
    // superseded it, so a stale cached session/assignment/completion
    // state is never visible, even briefly, as if it were current.
    showBusy("Loading your training data...");

    try {
      // Server state after refresh decides which session is current - a
      // locally-cached activeSessionId (from a previous programme, a since-
      // replaced assignment, or a stale reload) must never be trusted on
      // its own. loadAthleteToday() re-derives it from the athlete's actual
      // current assignment/session every time.
      await refreshHistory({ quiet: true });
      await loadAthleteToday();
    }
    catch (error) {
      showNotice(error.message, "error");
    }
    finally {
      hideBusy();
    }
  }
  else {
    try {
      await (await loadCoachPart()).loadCoachWorkspace();
    }
    catch {
      showNotice("Part of the app could not be loaded. Check your connection and reload the page.", "error");
    }
  }

  setView(state.view);
  showConnection(navigator.onLine !== false);
  connectMessagingSocket();
}

function showEntry() {
  elements.bootScreen.hidden = true;
  elements.appShell.hidden = true;
  elements.entryView.hidden = false;
  // The sign-in panel mounts now, before anything is said to it.
  document.dispatchEvent(new CustomEvent("kolosseum:view-shown", { detail: { view: "entry" } }));
}

elements.refreshAccountButton.addEventListener(
  "click",
  () => {
    loadPersistentAccountDetail()
      .catch(handleError);
  }
);

// DEV NOTE: React drives accountProfileForm/requestVerificationButton/
// completeVerificationButton/accountPasswordForm submits directly now (see
// public/app-src/screens/account/) - this legacy listener block is retired.
// applyAccountIdentity/renderIdentity for a React-driven update instead
// run from the bridge listener below.
document.addEventListener(
  "kolosseum:account-identity-updated",
  (event) => {
    applyAccountIdentity(event.detail);
    state.accountDetail = null;
    saveState();
    renderIdentity();
  }
);

// DEV NOTE: React's SignOutPanel.tsx/AccountClosurePanel.tsx dispatch this
// once the session has ended (sign-out always; closure only on a
// successfully recorded request) - resetAccountState()/redirect stay here
// since bootstrapApplication's own failure path also calls
// resetAccountState() directly and must keep doing so independent of this
// bridge.
document.addEventListener(
  "kolosseum:account-session-ended",
  () => {
    resetAccountState();
    location.assign("/app/");
  }
);

// DEV NOTE: FULL-UI-02D EntryAuthPanel.tsx/useEntryAuth.ts independently
// fetches its own terms (authClient.ts's loadCurrentTerms()) and shows its
// own "terms unavailable" notice - this function no longer needs to fetch
// terms itself just to gate/decorate the (now React) entry form. A non-401
// restoreAccountSession() failure is still a real, distinct case worth
// surfacing (e.g. a suspended account whose session cookie is otherwise
// valid-shaped) - reported to React via a bridge event since the error
// display now lives there too.
export async function bootstrapApplication() {
  try {
    const response =
      await restoreAccountSession();

    applyAccountSession(response);

    await enterApplication();
  }
  catch (error) {
    resetAccountState();
    showEntry();

    if (
      error?.status &&
      error.status !== 401
    ) {
      document.dispatchEvent(
        new CustomEvent("kolosseum:entry-bootstrap-notice", {
          detail: {
            message: friendlyError(
              error.payload,
              error.status
            )
          }
        })
      );
    }
  }
}
