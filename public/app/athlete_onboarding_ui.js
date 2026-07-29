// DEV NOTE: FULL-UI-03C server-backed athlete onboarding UI.
// Browser state is presentation-only; completion and history come from the server.

const STORAGE_KEY = "kolosseum.product.app.v1";
const ROUTE = "#/athlete/onboarding";
const RELOAD_KEY = "kolosseum.athlete_onboarding.reload_required";
const STAGES = [
  "activity", "execution_scope", "product_acknowledgement", "jurisdiction",
  "accessibility", "instruction_density", "review"
];
const TITLES = {
  activity: "Activity declaration",
  execution_scope: "Execution-scope declaration",
  product_acknowledgement: "Beta/product acknowledgement",
  jurisdiction: "Jurisdiction acknowledgement",
  accessibility: "Accessibility preferences",
  instruction_density: "Instruction-density preference",
  review: "Review and confirmation"
};
let installed = false;
let state = null;
let draft = {};
let busy = false;
let editing = false;

function stored() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") ?? {}; }
  catch { return {}; }
}
async function request(method, path, body) {
  const headers = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  if (!['GET', 'HEAD'].includes(method)) {
    const csrf = String(stored().csrfToken ?? "");
    if (csrf) headers["x-kolosseum-csrf"] = csrf;
  }
  const response = await fetch(path, {
    method, credentials: "same-origin", headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text().catch(() => "");
  let payload = null;
  try { payload = text ? JSON.parse(text) : null; }
  catch { payload = { raw: text }; }
  if (!response.ok) {
    const error = new Error(String(payload?.error ?? `athlete_onboarding_request_${response.status}`));
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

export const loadAthleteOnboardingState = () => request("GET", "/account/onboarding/");
export const saveAthleteOnboardingDraft = (input) => request("PATCH", "/account/onboarding/draft", input);
export const confirmAthleteOnboarding = () => request("POST", "/account/onboarding/confirm", { review_confirmed: true });
export const updateAthleteOnboardingPreferences = (input) => request("PATCH", "/account/onboarding/preferences", input);

function esc(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}
function checked(value) { return value === true ? " checked" : ""; }
function selected(actual, expected) { return actual === expected ? " selected" : ""; }
function fmt(value) {
  if (!value) return "not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString("en-GB");
}
function label(value) { return String(value ?? "not selected").replaceAll("_", " "); }
function accessibility(value = {}) {
  return {
    reduced_motion: value.reduced_motion === true,
    high_contrast: value.high_contrast === true,
    larger_text: value.larger_text === true,
    screen_reader_optimised: value.screen_reader_optimised === true
  };
}
function accessibilityLabel(value) {
  const chosen = Object.entries(accessibility(value)).filter(([, enabled]) => enabled)
    .map(([key]) => label(key));
  return chosen.length ? chosen.join(", ") : "No additional presentation preferences";
}

function installSurface() {
  if (!document.getElementById("athleteOnboardingStyles")) {
    const style = document.createElement("style");
    style.id = "athleteOnboardingStyles";
    style.textContent = `
      .onboarding-shell{max-width:960px;margin:auto;display:grid;gap:16px}
      .onboarding-status,.onboarding-card{border:1px solid var(--border,#34404d);border-radius:12px;background:var(--panel,#121922);padding:16px}
      .onboarding-status{display:flex;gap:12px;flex-wrap:wrap}.onboarding-status strong{margin-right:auto}
      .onboarding-status[data-state=validation_failure]{border-color:#b45309}.onboarding-status[data-state=unavailable]{border-color:#b91c1c}
      .onboarding-progress{display:grid;grid-template-columns:repeat(7,1fr);gap:5px}.onboarding-progress span{height:5px;border-radius:8px;background:#34404d}.onboarding-progress .done{background:#d5a94e}
      .onboarding-choice{display:flex;gap:10px;padding:12px;margin:8px 0;border:1px solid #34404d;border-radius:9px}.onboarding-choice small{display:block;opacity:.7}
      .onboarding-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}.onboarding-errors{border:1px solid #b45309;padding:12px;border-radius:9px}
      .declaration-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px}.declaration-fact{border:1px solid #34404d;border-radius:9px;padding:11px}.declaration-fact span{display:block;opacity:.7;font-size:.82rem}
      .onboarding-boundary{border-left:3px solid #d5a94e;padding-left:12px;opacity:.8}.declaration-history{display:grid;gap:10px}
      @media(max-width:700px){.onboarding-actions .button{width:100%}}
    `;
    document.head.append(style);
  }
  if (!document.getElementById("athleteOnboardingNav")) {
    const button = document.createElement("button");
    button.id = "athleteOnboardingNav";
    button.className = "nav-item athlete-nav";
    button.dataset.view = "onboarding";
    button.type = "button";
    button.innerHTML = '<span class="nav-icon">D</span><span>Declarations</span>';
    const account = document.querySelector('.nav-item[data-view="account"]');
    account?.parentElement?.insertBefore(button, account);
    button.addEventListener("click", () => {
      if (location.hash !== ROUTE) history.pushState({ kolosseum_route: ROUTE }, "", ROUTE);
      void openAthleteOnboardingView();
    });
  }
  if (!document.getElementById("view-onboarding")) {
    const view = document.createElement("section");
    view.id = "view-onboarding";
    view.className = "view";
    view.hidden = true;
    view.innerHTML = `<div class="page-heading"><div><p class="eyebrow">Athlete account</p><h2>Athlete onboarding and declarations</h2><p class="muted">Explicit product declarations only. No ability, safety, readiness or suitability conclusion is created.</p></div></div><div id="athleteOnboardingRoot" class="onboarding-shell" aria-live="polite"></div>`;
    document.querySelector("main.views")?.append(view);
  }
}
function visible() {
  installSurface();
  for (const view of document.querySelectorAll(".view")) view.hidden = view.id !== "view-onboarding";
  for (const button of document.querySelectorAll(".nav-item")) button.classList.toggle("active", button.dataset.view === "onboarding");
  const title = document.getElementById("topbarTitle");
  if (title) title.textContent = "Declarations";
  document.getElementById("sidebar")?.classList.remove("open");
}
function root() { return document.getElementById("athleteOnboardingRoot"); }
function status(kind = "") {
  const complete = state?.onboarding_status === "completed";
  const actual = kind || (complete ? "completed" : state?.saved_draft_state ? "saved_draft" : "incomplete");
  const heading = {
    incomplete: "Incomplete onboarding", saved_draft: "Saved draft state",
    validation_failure: "Validation failure", completed: "Completed onboarding",
    unavailable: "Unavailable service state"
  }[actual];
  const detail = actual === "saved_draft" ? `Saved ${fmt(state?.saved_draft_at_iso8601)}.`
    : actual === "completed" ? "The current effective declaration is persisted on the server."
    : actual === "validation_failure" ? "Correct the declaration fields before continuing."
    : actual === "unavailable" ? "No completion state has been assumed."
    : "Complete each stage and confirm the review.";
  return `<div class="onboarding-status" data-state="${actual}"><strong>${heading}</strong><span>${esc(detail)}</span></div>`;
}
function progress(stage) {
  const index = Math.max(0, STAGES.indexOf(stage));
  return `<div class="onboarding-progress">${STAGES.map((_, i) => `<span class="${i <= index ? "done" : ""}"></span>`).join("")}</div>`;
}
function facts(fields = {}) {
  return `<div class="declaration-grid">
    <div class="declaration-fact"><span>Activity</span><strong>${esc(label(fields.activity_id))}</strong></div>
    <div class="declaration-fact"><span>Execution scope</span><strong>${esc(label(fields.execution_scope))}</strong></div>
    <div class="declaration-fact"><span>Product acknowledgement</span><strong>${fields.product_acknowledged ? "Accepted" : "Not accepted"}</strong></div>
    <div class="declaration-fact"><span>Jurisdiction</span><strong>${esc(label(fields.jurisdiction_code))}</strong></div>
    <div class="declaration-fact"><span>Accessibility</span><strong>${esc(accessibilityLabel(fields.accessibility_preferences))}</strong></div>
    <div class="declaration-fact"><span>Instruction density</span><strong>${esc(label(fields.instruction_density))}</strong></div>
  </div>`;
}
function stageHtml(stage) {
  const a = accessibility(draft.accessibility_preferences);
  if (stage === "activity") return `<p>Declare the activity used by this account. This is not an assessment.</p><label class="field"><span>Activity</span><select id="onboardingActivity"><option value="">Choose</option><option value="powerlifting"${selected(draft.activity_id,"powerlifting")}>Powerlifting</option><option value="general_strength"${selected(draft.activity_id,"general_strength")}>General strength</option><option value="rugby_union"${selected(draft.activity_id,"rugby_union")}>Rugby union</option></select></label>`;
  if (stage === "execution_scope") return `<p>Declare where session instructions originate.</p><label class="onboarding-choice"><input type="radio" name="scope" value="individual"${checked(draft.execution_scope === "individual")}><span><strong>Individual</strong><small>Work in my athlete workspace.</small></span></label><label class="onboarding-choice"><input type="radio" name="scope" value="coach_managed"${checked(draft.execution_scope === "coach_managed")}><span><strong>Coach managed</strong><small>Work assigned through an accepted coach relationship.</small></span></label>`;
  if (stage === "product_acknowledgement") return `<p>This is a controlled-beta product. Features and availability may change. Records are not medical, safety or readiness decisions.</p><label class="onboarding-choice"><input id="productAck" type="checkbox"${checked(draft.product_acknowledged)}><span><strong>I acknowledge the controlled-beta product boundary.</strong><small>september_beta_2026</small></span></label>`;
  if (stage === "jurisdiction") return `<p>Select the jurisdiction yourself; it is not inferred from location.</p><label class="field"><span>Jurisdiction</span><select id="jurisdiction"><option value="">Choose</option><option value="england_wales"${selected(draft.jurisdiction_code,"england_wales")}>England and Wales</option><option value="scotland"${selected(draft.jurisdiction_code,"scotland")}>Scotland</option><option value="northern_ireland"${selected(draft.jurisdiction_code,"northern_ireland")}>Northern Ireland</option><option value="other"${selected(draft.jurisdiction_code,"other")}>Other</option></select></label><label class="onboarding-choice"><input id="jurisdictionAck" type="checkbox"${checked(draft.jurisdiction_acknowledged)}><span>I acknowledge the selected jurisdiction.</span></label>`;
  if (stage === "accessibility") return `<p>Presentation preferences remain editable after confirmation.</p>${[
    ["reducedMotion","Reduce motion",a.reduced_motion], ["highContrast","Higher contrast",a.high_contrast],
    ["largerText","Larger text",a.larger_text], ["screenReader","Screen-reader optimised",a.screen_reader_optimised]
  ].map(([id,text,value]) => `<label class="onboarding-choice"><input id="${id}" type="checkbox"${checked(value)}><span>${text}</span></label>`).join("")}`;
  if (stage === "instruction_density") return `<p>This presentation preference remains editable.</p>${[
    ["minimal","Concise","Essential instructions only."], ["standard","Standard","Normal context and instructions."], ["detailed","Detailed","More explanation and context."]
  ].map(([value,title,detail]) => `<label class="onboarding-choice"><input type="radio" name="density" value="${value}"${checked(draft.instruction_density === value)}><span><strong>${title}</strong><small>${detail}</small></span></label>`).join("")}`;
  return `${facts(draft)}<p class="onboarding-boundary">Confirmation does not infer ability, safety, readiness, suitability, risk or medical clearance.</p>`;
}
function collect(stage) {
  const next = { ...draft };
  if (stage === "activity") next.activity_id = document.getElementById("onboardingActivity")?.value ?? "";
  if (stage === "execution_scope") next.execution_scope = document.querySelector('input[name="scope"]:checked')?.value ?? "";
  if (stage === "product_acknowledgement") next.product_acknowledged = document.getElementById("productAck")?.checked === true;
  if (stage === "jurisdiction") {
    next.jurisdiction_code = document.getElementById("jurisdiction")?.value ?? "";
    next.jurisdiction_acknowledged = document.getElementById("jurisdictionAck")?.checked === true;
  }
  if (stage === "accessibility") next.accessibility_preferences = {
    reduced_motion: document.getElementById("reducedMotion")?.checked === true,
    high_contrast: document.getElementById("highContrast")?.checked === true,
    larger_text: document.getElementById("largerText")?.checked === true,
    screen_reader_optimised: document.getElementById("screenReader")?.checked === true
  };
  if (stage === "instruction_density") next.instruction_density = document.querySelector('input[name="density"]:checked')?.value ?? "";
  return next;
}
function errors(error) {
  const entries = Object.entries(error?.payload?.field_errors ?? {});
  return `<div class="onboarding-errors"><strong>Validation failure</strong>${entries.length ? `<ul>${entries.map(([key,value]) => `<li><strong>${esc(key)}:</strong> ${esc(value)}</li>`).join("")}</ul>` : `<p>${esc(error?.message)}</p>`}</div>`;
}
function renderDraft(error = null) {
  const stage = state?.current_stage || "activity";
  const index = Math.max(0, STAGES.indexOf(stage));
  root().innerHTML = `${status(error ? "validation_failure" : "")}${progress(stage)}${error ? errors(error) : ""}<article class="onboarding-card" data-onboarding-stage="${stage}"><p class="eyebrow">Stage ${index + 1} of ${STAGES.length}</p><h3>${TITLES[stage]}</h3>${stageHtml(stage)}<div class="onboarding-actions"><button id="onboardingBack" class="button secondary" type="button"${index === 0 ? " disabled" : ""}>Back</button>${stage === "review" ? '<button id="onboardingConfirm" class="button primary" type="button">Confirm declaration</button>' : '<button id="onboardingNext" class="button primary" type="button">Save and continue</button>'}</div></article>`;
  document.getElementById("onboardingBack")?.addEventListener("click", () => void move(-1));
  document.getElementById("onboardingNext")?.addEventListener("click", () => void move(1));
  document.getElementById("onboardingConfirm")?.addEventListener("click", () => void confirm());
}
async function move(direction) {
  if (busy) return;
  const stage = state.current_stage || "activity";
  const index = Math.max(0, STAGES.indexOf(stage));
  const target = STAGES[Math.max(0, Math.min(STAGES.length - 1, index + direction))];
  draft = direction < 0 ? { ...draft } : collect(stage);
  busy = true;
  try {
    state = await saveAthleteOnboardingDraft({ current_stage: target, fields: draft });
    draft = { ...(state.draft?.fields ?? draft) };
    renderDraft();
  }
  catch (error) { renderDraft(error); }
  finally { busy = false; }
}
async function confirm() {
  if (busy) return;
  busy = true;
  try {
    state = await confirmAthleteOnboarding();
    draft = { ...(state.current_effective_declaration?.fields ?? {}) };
    sessionStorage.setItem(RELOAD_KEY, "1");
    renderComplete();
  }
  catch (error) { renderDraft(error); }
  finally { busy = false; }
}
function preferenceEditor(fields) {
  const a = accessibility(fields.accessibility_preferences);
  return `<article class="onboarding-card"><h3>Edit lawful preferences</h3><p>Only accessibility and instruction-density preferences can be changed after confirmation. Saving creates a new declaration and preserves the old one.</p>${[
    ["editReduced","Reduce motion",a.reduced_motion], ["editContrast","Higher contrast",a.high_contrast],
    ["editLarge","Larger text",a.larger_text], ["editScreen","Screen-reader optimised",a.screen_reader_optimised]
  ].map(([id,text,value]) => `<label class="onboarding-choice"><input id="${id}" type="checkbox"${checked(value)}><span>${text}</span></label>`).join("")}<label class="field"><span>Instruction density</span><select id="editDensity"><option value="minimal"${selected(fields.instruction_density,"minimal")}>Concise</option><option value="standard"${selected(fields.instruction_density,"standard")}>Standard</option><option value="detailed"${selected(fields.instruction_density,"detailed")}>Detailed</option></select></label><div class="onboarding-actions"><button id="cancelEdit" class="button secondary">Cancel</button><button id="saveEdit" class="button primary">Save new declaration</button></div></article>`;
}
function historyHtml(items = []) {
  if (!items.length) return '<p class="muted">No superseded declarations are recorded.</p>';
  return `<div class="declaration-history">${items.map((item) => `<article class="onboarding-card" data-declaration-status="superseded"><strong>Superseded declaration</strong><span> · ${esc(fmt(item.effective_at_iso8601))}</span>${facts(item.fields)}<small>Immutable declaration ${esc(item.declaration_id)}</small></article>`).join("")}</div>`;
}
function renderComplete(error = null) {
  const current = state?.current_effective_declaration;
  if (!current) return;
  root().innerHTML = `${status(error ? "validation_failure" : "")}${error ? errors(error) : ""}<article class="onboarding-card" data-declaration-status="current"><p class="eyebrow">Current declaration</p><h3>Current effective declaration</h3><p>Version ${esc(current.declaration_version)} · effective ${esc(fmt(current.effective_at_iso8601))}</p>${facts(current.fields)}<p class="onboarding-boundary">This factual declaration does not indicate ability, safety, readiness, suitability, risk or medical clearance.</p><div class="onboarding-actions"><button id="openWorkspace" class="button primary">Open training workspace</button><button id="editPreferences" class="button secondary">Edit accessibility and instruction density</button></div></article>${editing ? preferenceEditor(current.fields) : ""}<article class="onboarding-card"><h3>Historical declarations</h3><p>Superseded declarations remain immutable.</p>${historyHtml(state.historical_declarations)}</article>`;
  document.getElementById("openWorkspace")?.addEventListener("click", () => {
    sessionStorage.removeItem(RELOAD_KEY); location.assign("/app/#/athlete/today");
  });
  document.getElementById("editPreferences")?.addEventListener("click", () => { editing = true; renderComplete(); });
  document.getElementById("cancelEdit")?.addEventListener("click", () => { editing = false; renderComplete(); });
  document.getElementById("saveEdit")?.addEventListener("click", () => void savePreferences());
}
async function savePreferences() {
  if (busy) return;
  busy = true;
  try {
    state = await updateAthleteOnboardingPreferences({
      accessibility_preferences: {
        reduced_motion: document.getElementById("editReduced")?.checked === true,
        high_contrast: document.getElementById("editContrast")?.checked === true,
        larger_text: document.getElementById("editLarge")?.checked === true,
        screen_reader_optimised: document.getElementById("editScreen")?.checked === true
      },
      instruction_density: document.getElementById("editDensity")?.value ?? ""
    });
    sessionStorage.setItem(RELOAD_KEY, "1");
    editing = false;
    renderComplete();
  }
  catch (error) { renderComplete(error); }
  finally { busy = false; }
}
function unavailable(error) {
  root().innerHTML = `${status("unavailable")}<article class="onboarding-card"><h3>Onboarding is unavailable</h3><p>No browser-only completion has been created.</p><p>${esc(error?.message)}</p><button id="retryOnboarding" class="button primary">Retry</button></article>`;
  document.getElementById("retryOnboarding")?.addEventListener("click", () => void refreshAthleteOnboarding());
}
export async function refreshAthleteOnboarding() {
  visible();
  root().innerHTML = `${status()}<article class="onboarding-card">Loading server onboarding state…</article>`;
  try {
    state = await loadAthleteOnboardingState();
    draft = { ...(state.draft?.fields ?? state.current_effective_declaration?.fields ?? {}) };
    if (state.onboarding_status === "completed") renderComplete(); else renderDraft();
    return state;
  }
  catch (error) { unavailable(error); return null; }
}
export async function openAthleteOnboardingView() { visible(); return refreshAthleteOnboarding(); }
export async function resolveAthleteOnboardingGate() {
  try { return await loadAthleteOnboardingState(); }
  catch (error) { if (error?.status === 401) return null; throw error; }
}
export function installAthleteOnboardingUi() {
  if (installed || typeof document === "undefined") return;
  installed = true;
  installSurface();
  document.addEventListener("click", (event) => {
    if (sessionStorage.getItem(RELOAD_KEY) !== "1") return;
    const control = event.target.closest("[data-view], [data-view-link]");
    const view = control?.dataset.view ?? control?.dataset.viewLink;
    if (!view || view === "onboarding" || view === "account") return;
    event.preventDefault(); event.stopImmediatePropagation();
    sessionStorage.removeItem(RELOAD_KEY);
    location.assign(view === "history" ? "/app/#/athlete/history" : "/app/#/athlete/today");
  }, true);
}
