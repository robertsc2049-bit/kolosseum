// "Show me around" tours for the main app (engine: guided_tour.js).
//
// Three tours, picked from the signed-in account:
//   coach            - a coach, once their setup is complete;
//   athlete_coached  - an athlete with an accepted coach (or who chose to
//                      train with one and is waiting on the invite);
//   athlete_self     - an athlete training without a coach.
// Each runs once, automatically, the first time the account reaches its home
// screen (Overview / Today) - which the app only shows once setup is done -
// and again whenever "Show me around" on the Account screen is pressed.

import { closeTour, markTourSeen, startTour, tourOpen, tourSeen } from "./guided_tour.js";

const SETTLE_MS = 1200;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function openView(view) {
  return async () => {
    const item = document.querySelector(`.nav-item[data-view="${view}"]`) || document.querySelector(`[data-view="${view}"]`);
    if (item) item.click();
    await wait(250);
  };
}

async function openSetup() {
  document.getElementById("athleteOnboardingNav")?.click();
  await wait(250);
}

async function getJson(path) {
  const response = await fetch(path, { credentials: "same-origin", headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`${path} ${response.status}`);
  return response.json();
}

function firstName(account) {
  const name = String(account?.display_name ?? "").trim();
  return name ? name.split(/\s+/u)[0] : "";
}

function coachSteps(account) {
  const name = firstName(account);
  return [
    { before: openView("coach-overview"), title: name ? `Welcome to Kolosseum, ${name}` : "Welcome to Kolosseum", body: "Here's a two-minute look at how you coach here. Skip it whenever you like - you can replay it from Account at any time." },
    { before: openView("coach-overview"), target: "#coach-overview-metrics-root", title: "Your Overview", body: "Everything at a glance: connected athletes, programmes assigned, sessions waiting for your review and competitions coming up." },
    { before: openView("athletes"), target: "#view-athletes .athlete-actions", title: "Bring your athletes in", body: "Invite athletes by email, or add one with their account code. They join your roster as soon as they accept." },
    { before: openView("athletes"), target: ["#athlete-directory-root .record-card", "#athlete-directory-root .metric-cards"], title: "Your roster", body: "Open an athlete's profile to assign a programme, record their maxes and bodyweight, see pain flags and leave notes and messages." },
    { before: openView("templates"), target: "#newTemplateButton", title: "Build programmes", body: "A programme is blocks of weeks, each with sessions of exercises - sets, reps, % of max, RPE or weight, and rest. Start from scratch or from a Kolosseum programme, then check it's ready and make it active to assign it." },
    { before: openView("events"), target: "#view-events .page-heading", title: "Competitions", body: "Add meets, races and match days. Assign a programme against one and it's timed to peak for that date." },
    { before: openView("review"), target: "#coach-review-root .page-heading", title: "Review sessions", body: "Every completed session lands here: what was lifted, how hard it felt, pain flags, swaps and anything skipped. Mark it reviewed and leave a note the athlete sees." },
    { before: openView("coach-progress"), target: ["[data-testid=\"analysis-roster\"]", "#coach-progress-overview-root h2"], title: "Analysis", body: "Who needs a look: each athlete's trends, load against their own normal and readiness, with the ones needing attention first. Reports you write here go to the athlete." },
    { before: openView("coach-attendance"), target: "#attendance-event-create-root .panel-header", title: "Classes", body: "Schedule a class, squad session or practice, invite athletes and see who's coming." },
    { before: openView("marketplace"), target: "#view-marketplace .page-heading h2", title: "Marketplace", body: "Browse programmes other coaches share, and share or sell your own." },
    { before: openView("account"), target: "#account-code-root", title: "Your account", body: "Your account code lets an athlete connect with you. Branding, billing, your data and \"Show me around\" are all here." },
    { before: openView("coach-overview"), title: "You're set", body: "A good first step: invite an athlete, then build or pick a programme and assign it from their profile.", doneLabel: "Get started" }
  ];
}

function coachedAthleteSteps(account, coachName) {
  const name = firstName(account);
  const coach = coachName || "your coach";
  return [
    { before: openView("today"), title: name ? `Welcome to Kolosseum, ${name}` : "Welcome to Kolosseum", body: `${coachName ? `${coachName} writes` : "Your coach writes"} your programme; you train it and log it here. Here's a quick look round - you can replay it from Account at any time.` },
    { before: openView("today"), target: "#athlete-today-session-root", title: "Today", body: `Your next session from ${coach}'s programme. Start it here when you're ready to train.` },
    { before: openView("session"), target: "#athlete-session-root", title: "Logging a session", body: `Log each set as you go - weight, reps and how hard it felt. Flag pain, or swap or skip an exercise if you need to; ${coach} sees all of it.` },
    { before: openView("today"), target: "#athlete-other-training-root", title: "Other training", body: `Practices, matches and conditioning count towards your load too - log them here so ${coach} sees your whole week.` },
    { before: openView("programme"), target: "#athlete-my-programme-root", title: "My programme", body: "The whole programme, block by block, and where you are in it." },
    { before: openView("history"), target: "#athlete-history-root", title: "History", body: `Every session you've logged, and reports from ${coach}. The Wellbeing tab holds body metrics, nutrition, habits, goals and weekly check-ins.` },
    { before: openView("attendance"), target: "#athlete-attendance-events-root", title: "Attendance", body: "Classes and squad sessions you're invited to - say whether you're coming." },
    { before: openSetup, target: "[data-testid=\"athlete-equipment\"]", optional: true, title: "Your setup", body: "Your gym and equipment, your maxes, match days and how you're feeling today. Keep it current and your sessions fit what you have." },
    { before: openView("account"), target: ["#account-coach-relationship-root .panel", "#account-coach-relationship-root"], title: "Your coach", body: "Your coach and your messages with them. An invitation from a coach shows up here to accept." },
    { before: openView("today"), title: "You're set", body: "When a session's ready it's waiting on Today. Train, log it, and your coach takes it from there.", doneLabel: "Get started" }
  ];
}

function selfCoachedAthleteSteps(account) {
  const name = firstName(account);
  return [
    { before: openView("today"), title: name ? `Welcome to Kolosseum, ${name}` : "Welcome to Kolosseum", body: "You're training without a coach, so you set up your own training week and Kolosseum fills in the weights. Here's a quick look round - replay it from Account any time." },
    { before: openSetup, target: "[data-testid=\"my-training\"]", title: "Build your training", body: "Choose your training days and the exercises for each, with sets and reps. Your sessions follow it in order, week after week. Until you do, Kolosseum's generated programme for your sport and level fills in." },
    { before: openSetup, target: "[data-testid=\"athlete-programme\"]", optional: true, title: "Your Kolosseum programme", body: "The coach-written programme you're running, and where you are in it." },
    { before: openSetup, target: "[data-testid=\"programme-exercises\"]", optional: true, title: "Choose your exercises", body: "Your competition lifts are set. Pick the rest yourself - we suggest ones that train the same thing - add your own, or repeat one." },
    { before: openSetup, target: "[data-testid=\"athlete-maxes\"]", title: "How your weights are set", body: "Build from what you lift, work from your max, or train by effort (RPE). Enter a max for a lift and every weight is worked out from it." },
    { before: openSetup, target: "[data-testid=\"athlete-equipment\"]", title: "Your gym and kit", body: "Choose your gym and its listed equipment counts as yours, then add any kit you have at home. Anything you can't do is swapped for something that fits." },
    { before: openView("today"), target: "#athlete-today-session-root", title: "Today", body: "Your next session. Start it here when you're ready to train." },
    { before: openView("session"), target: "#athlete-session-root", title: "Logging a session", body: "Log each set as you go - weight, reps and how hard it felt. Flag pain, or swap or skip an exercise; your next sessions adjust to what you log." },
    { before: openView("programme"), target: "#athlete-my-programme-root", title: "My programme", body: "Your training, week by week, and where you are in it." },
    { before: openView("history"), target: "#athlete-history-root", title: "History", body: "Every session you've logged. The Wellbeing tab holds body metrics, nutrition, habits, goals and weekly check-ins." },
    { before: openView("account"), target: "#account-code-root", title: "Want a coach later?", body: "Share your account code with a coach, or accept their invitation here - your history comes with you." },
    { before: openView("today"), title: "You're set", body: "Build your training on Declarations, then your first session is waiting on Today.", doneLabel: "Get started" }
  ];
}

// Which tour fits this account, and its steps. Null when there's none (e.g.
// an athlete still in onboarding has no declaration yet).
async function tourFor(detail) {
  const account = detail?.account;
  const userId = String(account?.user_id ?? "");
  if (!userId) return null;
  if (account.actor_type === "coach") return { id: "coach", userId, steps: coachSteps(account) };
  if (account.actor_type !== "athlete" || !detail.bootstrap?.declaration_record) return null;

  let coachName = "";
  let coached = false;
  try {
    const mine = await getJson("/coach-workspace/relationships/mine");
    const accepted = (Array.isArray(mine.relationships) ? mine.relationships : []).find((relationship) => relationship.relationship_state === "accepted");
    if (accepted) { coached = true; coachName = String(accepted.coach_display_name ?? "").trim(); }
  }
  catch { /* fall back to what the athlete declared */ }
  if (!coached) coached = JSON.stringify(detail.bootstrap.declaration_record.declaration_payload ?? {}).includes("\"execution_scope\":\"coach_managed\"");

  return coached
    ? { id: "athlete_coached", userId, steps: coachedAthleteSteps(account, coachName) }
    : { id: "athlete_self", userId, steps: selfCoachedAthleteSteps(account) };
}

async function run(tour) {
  markTourSeen(tour.id, tour.userId);
  await startTour({ steps: tour.steps, label: "Show me around" });
}

function onHomeScreen() {
  const overview = document.getElementById("view-coach-overview");
  const today = document.getElementById("view-today");
  return Boolean((overview && !overview.hidden) || (today && !today.hidden));
}

let checking = false;
async function maybeAutoStart() {
  if (checking || tourOpen()) return;
  checking = true;
  try {
    await wait(SETTLE_MS);
    if (!onHomeScreen() || tourOpen()) return;
    const detail = await getJson("/account/detail");
    const tour = await tourFor(detail);
    if (!tour || tourSeen(tour.id, tour.userId) || !onHomeScreen()) return;
    await run(tour);
  }
  catch { /* signed out or offline: try again on the next sign-in or navigation */ }
  finally {
    checking = false;
  }
}

async function replay() {
  try {
    const tour = await tourFor(await getJson("/account/detail"));
    if (tour) await run(tour);
  }
  catch { /* signed out: nothing to show */ }
}

document.getElementById("showMeAroundButton")?.addEventListener("click", () => { void replay(); });
document.addEventListener("kolosseum:entry-auth-succeeded", () => { void maybeAutoStart(); });
document.addEventListener("kolosseum:account-session-ended", closeTour);
window.addEventListener("hashchange", () => { void maybeAutoStart(); });
void maybeAutoStart();
