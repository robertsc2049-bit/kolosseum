import {
  acceptCoachOnboardingTerms,
  completeCoachOnboarding,
  loadAccountDetail,
  loadCoachOnboardingState,
  saveCoachOnboardingProfile
} from "./account_ui.js";

const ONBOARDING_ROUTE =
  "#/coach/onboarding";

const WORKSPACE_ROUTE =
  "#/coach/overview";

let installed = false;
let state = null;
let busy = false;
let elements = null;

function clean(value) {
  return String(
    value ?? ""
  ).trim();
}

function humanise(value) {
  const text = clean(value);

  return text
    ? text
        .replaceAll("_", " ")
        .replace(
          /\b\w/gu,
          (letter) =>
            letter.toUpperCase()
        )
    : "—";
}

function showMessage(
  message,
  tone = "neutral"
) {
  if (!elements?.result) {
    return;
  }

  elements.result.hidden =
    !message;

  elements.result.textContent =
    message;

  elements.result.dataset.tone =
    tone;
}

function errorMessage(error) {
  const code = clean(
    error?.payload?.error ??
    error?.message ??
    "coach_onboarding_unavailable"
  );

  const messages = {
    account_session_missing:
      "Sign in to continue coach onboarding.",
    account_session_invalid:
      "The sign-in session has expired.",
    coach_onboarding_coach_required:
      "Coach onboarding is available to coach accounts only.",
    coach_onboarding_profile_invalid:
      "Check the coach profile details.",
    coach_onboarding_profile_required:
      "Save the coach profile before accepting coach terms.",
    coach_terms_invalid:
      "The current coach terms must be explicitly accepted.",
    coach_onboarding_incomplete:
      "Complete every coach onboarding step.",
    account_email_already_registered:
      "That email address is already registered."
  };

  return (
    messages[code] ??
    humanise(code)
  );
}

function sectionMarkup() {
  return `
    <section
      id="view-coach-onboarding"
      class="view coach-onboarding-view"
      hidden
    >
      <div class="page-heading">
        <div>
          <p class="eyebrow">
            Coach onboarding
          </p>
          <h2>
            Coach profile and access
          </h2>
          <p class="muted">
            Persistent product-account setup only.
            Coach onboarding and commercial state
            cannot alter engine truth.
          </p>
        </div>
        <span
          id="coachOnboardingStatus"
          class="badge neutral"
        >
          Loading
        </span>
      </div>

      <div
        id="coachOnboardingProgress"
        class="panel coach-onboarding-progress"
      ></div>

      <form
        id="coachOnboardingProfileForm"
        class="panel form-panel"
        hidden
      >
        <div>
          <p class="eyebrow">
            Coach profile
          </p>
          <h3>
            Identity details
          </h3>
          <p class="muted">
            This profile is product identity state.
            It is not an engine input.
          </p>
        </div>

        <label class="field">
          <span>Display name</span>
          <input
            id="coachOnboardingDisplayName"
            autocomplete="name"
            required
          />
        </label>

        <label class="field">
          <span>Email</span>
          <input
            id="coachOnboardingEmail"
            type="email"
            autocomplete="email"
            required
          />
        </label>

        <button
          class="button primary"
          type="submit"
        >
          Save coach profile
        </button>
      </form>

      <form
        id="coachOnboardingTermsForm"
        class="panel form-panel"
        hidden
      >
        <div>
          <p class="eyebrow">
            Coach terms
          </p>
          <h3>
            Explicit acceptance
          </h3>
          <p
            id="coachOnboardingTermsVersion"
            class="muted"
          ></p>
        </div>

        <label class="checkbox-field">
          <input
            id="coachOnboardingTermsAccepted"
            type="checkbox"
            required
          />
          <span>
            I accept the current coach terms
            for product access.
          </span>
        </label>

        <button
          class="button primary"
          type="submit"
        >
          Accept coach terms
        </button>
      </form>

      <section
        id="coachOnboardingReview"
        class="panel"
        hidden
      >
        <p class="eyebrow">
          Review
        </p>
        <h3>
          Confirm coach onboarding
        </h3>

        <div class="commercial-fact-grid">
          <div class="commercial-fact">
            <span>Profile</span>
            <strong id="coachReviewProfile">
              —
            </strong>
          </div>
          <div class="commercial-fact">
            <span>Coach terms</span>
            <strong id="coachReviewTerms">
              —
            </strong>
          </div>
          <div class="commercial-fact">
            <span>Workspace</span>
            <strong>
              Coach overview
            </strong>
          </div>
        </div>

        <p class="muted">
          Completion grants access to existing
          coach product surfaces only. It does not
          grant registry, compile, legality or
          engine authority.
        </p>

        <button
          id="completeCoachOnboardingButton"
          class="button primary"
          type="button"
        >
          Complete coach onboarding
        </button>
      </section>

      <section
        id="coachOnboardingComplete"
        class="panel"
        hidden
      >
        <p class="eyebrow">
          Completed onboarding
        </p>
        <h3>
          Coach workspace available
        </h3>
        <p class="muted">
          The completion state is stored on the
          server and survives refresh and restart.
        </p>

        <div class="commercial-actions">
          <button
            id="openCoachWorkspaceButton"
            class="button primary"
            type="button"
          >
            Open coach workspace
          </button>

          <button
            id="editCompletedCoachProfileButton"
            class="button secondary"
            type="button"
          >
            Update coach profile
          </button>

          <button
            id="openCoachCommercialButton"
            class="button secondary"
            type="button"
          >
            Open commercial account
          </button>
        </div>
      </section>

      <section class="panel">
        <p class="eyebrow">
          Onboarding history
        </p>
        <div
          id="coachOnboardingHistory"
          class="record-list compact-record-list"
        >
          <div class="empty-state compact-empty">
            <p>Loading coach onboarding history…</p>
          </div>
        </div>
      </section>

      <p
        id="coachOnboardingResult"
        class="inline-result"
        hidden
      ></p>
    </section>
  `;
}

function installSurface() {
  if (installed) {
    return;
  }

  const views =
    document.querySelector(
      ".views"
    );

  if (!views) {
    return;
  }

  const accountNavigation =
    document.querySelector(
      '[data-view="account"]'
    );

  if (
    !document.getElementById(
      "coachOnboardingNav"
    )
  ) {
    const navigation =
      document.createElement(
        "button"
      );

    navigation.id =
      "coachOnboardingNav";

    navigation.className =
      "nav-item coach-nav";

    navigation.type =
      "button";

    navigation.dataset.view =
      "coach-onboarding";

    navigation.textContent =
      "Setup";

    navigation.addEventListener(
      "click",
      () => {
        window.location.hash =
          ONBOARDING_ROUTE;
      }
    );

    accountNavigation
      ?.parentElement
      ?.insertBefore(
        navigation,
        accountNavigation
      );
  }

  if (
    !document.getElementById(
      "view-coach-onboarding"
    )
  ) {
    const wrapper =
      document.createElement(
        "div"
      );

    wrapper.innerHTML =
      sectionMarkup();

    const section =
      wrapper.firstElementChild;

    if (section) {
      views.append(section);
    }
  }

  elements = {
    view:
      document.getElementById(
        "view-coach-onboarding"
      ),
    status:
      document.getElementById(
        "coachOnboardingStatus"
      ),
    progress:
      document.getElementById(
        "coachOnboardingProgress"
      ),
    profileForm:
      document.getElementById(
        "coachOnboardingProfileForm"
      ),
    displayName:
      document.getElementById(
        "coachOnboardingDisplayName"
      ),
    email:
      document.getElementById(
        "coachOnboardingEmail"
      ),
    termsForm:
      document.getElementById(
        "coachOnboardingTermsForm"
      ),
    termsVersion:
      document.getElementById(
        "coachOnboardingTermsVersion"
      ),
    termsAccepted:
      document.getElementById(
        "coachOnboardingTermsAccepted"
      ),
    review:
      document.getElementById(
        "coachOnboardingReview"
      ),
    reviewProfile:
      document.getElementById(
        "coachReviewProfile"
      ),
    reviewTerms:
      document.getElementById(
        "coachReviewTerms"
      ),
    completeButton:
      document.getElementById(
        "completeCoachOnboardingButton"
      ),
    completed:
      document.getElementById(
        "coachOnboardingComplete"
      ),
    workspaceButton:
      document.getElementById(
        "openCoachWorkspaceButton"
      ),
    editProfileButton:
      document.getElementById(
        "editCompletedCoachProfileButton"
      ),
    commercialButton:
      document.getElementById(
        "openCoachCommercialButton"
      ),
    history:
      document.getElementById(
        "coachOnboardingHistory"
      ),
    result:
      document.getElementById(
        "coachOnboardingResult"
      )
  };

  elements.profileForm
    ?.addEventListener(
      "submit",
      (event) => {
        event.preventDefault();
        void saveProfile();
      }
    );

  elements.termsForm
    ?.addEventListener(
      "submit",
      (event) => {
        event.preventDefault();
        void acceptTerms();
      }
    );

  elements.completeButton
    ?.addEventListener(
      "click",
      () => {
        void completeOnboarding();
      }
    );

  elements.workspaceButton
    ?.addEventListener(
      "click",
      () => {
        window.location.hash =
          WORKSPACE_ROUTE;
      }
    );

  elements.editProfileButton
    ?.addEventListener(
      "click",
      () => {
        if (
          elements.profileForm
        ) {
          elements.profileForm.hidden =
            false;

          elements.profileForm
            .scrollIntoView({
              block: "start",
              behavior: "smooth"
            });
        }
      }
    );

  elements.commercialButton
    ?.addEventListener(
      "click",
      () => {
        window.location.hash =
          "#/account";
      }
    );

  installed = true;
}

function renderHistory() {
  if (!elements?.history) {
    return;
  }

  const history =
    Array.isArray(state?.history)
      ? state.history
      : [];

  elements.history
    .replaceChildren();

  if (history.length === 0) {
    const empty =
      document.createElement(
        "div"
      );

    empty.className =
      "empty-state compact-empty";

    empty.innerHTML =
      "<p>No coach onboarding records.</p>";

    elements.history
      .append(empty);

    return;
  }

  for (const record of history) {
    const item =
      document.createElement(
        "article"
      );

    const title =
      document.createElement(
        "strong"
      );

    const detail =
      document.createElement(
        "p"
      );

    title.textContent =
      humanise(
        record.event_type
      );

    detail.className =
      "muted";

    const date =
      new Date(
        clean(
          record
            .occurred_at_iso8601
        )
      );

    detail.textContent =
      Number.isNaN(
        date.getTime()
      )
        ? clean(
            record
              .occurred_at_iso8601
          )
        : date.toLocaleString();

    item.append(
      title,
      detail
    );

    elements.history
      .append(item);
  }
}

function render() {
  installSurface();

  if (!elements || !state) {
    return;
  }

  const completed =
    state.onboarding_status ===
    "completed";

  const stage =
    clean(
      state.current_stage
    ) || "profile";

  elements.status.textContent =
    completed
      ? "Completed onboarding"
      : "Incomplete onboarding";

  elements.status.className =
    completed
      ? "badge success"
      : "badge warning";

  elements.progress.textContent =
    completed
      ? "Coach profile saved · Coach terms accepted · Completion persisted"
      : `Current step: ${humanise(stage)}`;

  elements.profileForm.hidden =
    stage !== "profile" &&
    !completed;

  elements.termsForm.hidden =
    stage !== "terms";

  elements.review.hidden =
    stage !== "review";

  elements.completed.hidden =
    !completed;

  const profile =
    state.profile &&
    typeof state.profile ===
      "object"
      ? state.profile
      : {};

  elements.displayName.value =
    clean(
      profile.display_name
    );

  elements.email.value =
    clean(profile.email);

  elements.termsVersion.textContent =
    `Current version: ${
      clean(
        state.current_terms_version
      ) || "Unavailable"
    }`;

  elements.reviewProfile.textContent =
    clean(
      profile.display_name
    ) || "Not saved";

  elements.reviewTerms.textContent =
    state.terms_accepted === true
      ? clean(
          state
            .accepted_terms_version
        )
      : "Not accepted";

  renderHistory();
}

async function csrfToken() {
  const detail =
    await loadAccountDetail();

  const token =
    clean(
      detail?.csrf_token
    );

  if (!token) {
    throw new Error(
      "account_csrf_invalid"
    );
  }

  return token;
}

async function refreshState({
  quiet = false
} = {}) {
  installSurface();

  try {
    state =
      await loadCoachOnboardingState();

    render();

    if (!quiet) {
      showMessage(
        "Coach onboarding state refreshed.",
        "success"
      );
    }

    return state;
  }
  catch (error) {
    showMessage(
      errorMessage(error),
      "error"
    );

    throw error;
  }
}

async function runMutation(
  action
) {
  if (busy) {
    return null;
  }

  busy = true;

  try {
    const token =
      await csrfToken();

    state =
      await action(token);

    render();

    return state;
  }
  catch (error) {
    showMessage(
      errorMessage(error),
      "error"
    );

    throw error;
  }
  finally {
    busy = false;
  }
}

async function saveProfile() {
  const displayName =
    clean(
      elements.displayName.value
    );

  const email =
    clean(
      elements.email.value
    );

  await runMutation(
    (token) =>
      saveCoachOnboardingProfile(
        {
          display_name:
            displayName,
          email
        },
        token
      )
  );

  showMessage(
    state?.onboarding_status ===
      "completed"
      ? "Coach profile updated. Completion remains persisted."
      : "Coach profile saved.",
    "success"
  );
}

async function acceptTerms() {
  await runMutation(
    (token) =>
      acceptCoachOnboardingTerms(
        {
          accepted:
            elements
              .termsAccepted
              .checked,
          terms_version:
            clean(
              state
                ?.current_terms_version
            )
        },
        token
      )
  );

  showMessage(
    "Coach terms accepted.",
    "success"
  );
}

async function completeOnboarding() {
  await runMutation(
    (token) =>
      completeCoachOnboarding(
        {
          completion_confirmed:
            true
        },
        token
      )
  );

  showMessage(
    "Coach onboarding completed. Opening the coach workspace.",
    "success"
  );

  window.location.hash =
    WORKSPACE_ROUTE;
}

export function
installCoachOnboardingUi() {
  installSurface();
}

export async function
resolveCoachOnboardingGate() {
  installSurface();

  try {
    return await refreshState({
      quiet: true
    });
  }
  catch {
    return null;
  }
}

export async function
openCoachOnboardingView() {
  installSurface();

  for (
    const section
    of document.querySelectorAll(
      ".view"
    )
  ) {
    section.hidden =
      section.id !==
      "view-coach-onboarding";
  }

  for (
    const navigation
    of document.querySelectorAll(
      ".nav-item"
    )
  ) {
    navigation.classList.toggle(
      "active",
      navigation.id ===
        "coachOnboardingNav"
    );
  }

  document
    .getElementById(
      "sidebar"
    )
    ?.classList.remove(
      "open"
    );

  return refreshState({
    quiet: true
  });
}