// "Show me around" tours for the organisation app (engine:
// /app/guided_tour.js). Kept out of org.js, which stays wholly separate from
// the athlete/coach app: org.js only announces when the workspace is shown
// (kolosseum:org-workspace-shown) and when the organisations list is drawn
// (kolosseum:org-organisations-rendered); this module listens.
//
//   org_owner - the account itself, the first time an owner signs in;
//   team      - the first time a team (shared) organisation is listed;
//   gym       - the first time a gym (individual) organisation is listed.
// "Show me around" replays the owner tour, then the team and gym tours for
// whichever kinds of organisation the owner has.

import { markTourSeen, startTour, tourOpen, tourSeen } from "/app/guided_tour.js";

let ownerUserId = "";
let organisations = [];
let running = false;

const card = (orgId) => () => document.querySelector(`#orgList [data-manage-roster="${CSS.escape(orgId)}"]`)?.closest(".record-card") ?? null;
const button = (attribute, orgId) => `#orgList [${attribute}="${CSS.escape(orgId)}"]`;

function ownerSteps() {
  return [
    { title: "Welcome to your organisation account", body: "This is where you run your gyms and teams: their coaches, athletes, billing and messages. Here's a quick look round - \"Show me around\" at the top replays it." },
    { target: "#orgCreateSection", title: "Create an organisation", body: "Choose Gym or Team - it can't be changed later. A gym has independent coaches, and each athlete's training stays private to their own coach. In a team you're the coaching authority over the whole roster." },
    { target: "#orgListSection", title: "Your organisations", body: "Each organisation has its coach roster, athletes, progress, attendance, messages, billing and activity log, opened from its buttons here." },
    { target: "#orgNotificationBellButton", title: "Notifications", body: "New messages from your coaches and athletes, grouped by organisation." },
    { target: "#orgSupportSection", title: "Help", body: "Report a problem and see what you've reported, with replies." },
    { target: "#orgAccountSection", title: "Your account and data", body: "Download a copy of your data, or close the account." },
    { title: "You're set", body: "Create your first organisation, then invite your coaches from its roster.", doneLabel: "Get started" }
  ];
}

function teamSteps(organisation) {
  const id = organisation.org_id;
  return [
    { target: card(id), title: `Your team: ${organisation.org_name}`, body: "In a team you're the coaching authority over the whole roster: you see every athlete across your coaches." },
    { target: button("data-manage-roster", id), title: "Invite your coaches", body: "Invite coaches by email. They join the team when they accept from their coach account, and bring their athletes with them." },
    { target: button("data-view-athletes", id), title: "Your athletes", body: "Every athlete in the team, by coach, with their positions - set or correct a position here. Export the roster as a spreadsheet." },
    { target: button("data-view-progress", id), title: "Progress and staff", body: "Team progress by coach and position. Choose a head coach, who can open every athlete in full, and a medical lead." },
    { target: button("data-view-attendance", id), title: "Team events", body: "Schedule team-wide sessions and events - every athlete in the team is invited - and see who's coming." },
    { target: button("data-view-messages", id), title: "Messages", body: "Message your coaches, and your athletes too in a team." },
    { target: button("data-manage-billing", id), title: "Billing", body: "Your seat plan for the team's coaches." },
    { target: button("data-view-audit", id), title: "Activity log", body: "Who joined, left or changed what, and when.", doneLabel: "Done" }
  ];
}

function gymSteps(organisation) {
  const id = organisation.org_id;
  return [
    { target: card(id), title: `Your gym: ${organisation.org_name}`, body: "In a gym your coaches are independent: each athlete's training stays private to their own coach. You see numbers, never an athlete's training." },
    { target: button("data-gym-listing", id), title: "List your gym - free", body: "Add your gym's name, area and equipment. Once we've checked it, athletes can find it and choose it as their gym, and their sessions use the kit you list. You see how many chose it, never who." },
    { target: button("data-manage-roster", id), title: "Invite your coaches", body: "Invite the coaches who work from your gym by email. They join when they accept from their coach account." },
    { target: button("data-view-athletes", id), title: "Coaches and athlete numbers", body: "How many active and invited athletes each coach has - counts only." },
    { target: button("data-view-progress", id), title: "Progress", body: "Averages across your coaches' athletes, and nothing for a coach with fewer than 3 athletes training - so no one can be picked out." },
    { target: button("data-view-attendance", id), title: "Gym events", body: "Schedule gym-wide classes and events, and see who's coming." },
    { target: button("data-view-messages", id), title: "Messages", body: "Message the coaches at your gym." },
    { target: button("data-manage-billing", id), title: "Billing", body: "Your seat plan for the gym's coaches." },
    { target: button("data-view-audit", id), title: "Activity log", body: "Who joined, left or changed what, and when.", doneLabel: "Done" }
  ];
}

async function runTour(tourId, steps) {
  markTourSeen(tourId, ownerUserId);
  await startTour({ steps, label: "Show me around" });
}

// The tours not yet seen, in order: the account first, then the first team
// and the first gym. With `all`, every tour that applies (replay).
function toursDue(all) {
  const due = [];
  const team = organisations.find((organisation) => organisation.visibility_mode === "shared");
  const gym = organisations.find((organisation) => organisation.visibility_mode === "individual");
  if (all || !tourSeen("org_owner", ownerUserId)) due.push(["org_owner", ownerSteps()]);
  if (team && (all || !tourSeen("team", ownerUserId))) due.push(["team", teamSteps(team)]);
  if (gym && (all || !tourSeen("gym", ownerUserId))) due.push(["gym", gymSteps(gym)]);
  return due;
}

async function runDue(all = false) {
  if (!ownerUserId || running || tourOpen()) return;
  running = true;
  try {
    for (const [tourId, steps] of toursDue(all)) {
      if (document.getElementById("orgListSection")?.hidden) break;
      await runTour(tourId, steps);
    }
  }
  finally {
    running = false;
  }
}

document.addEventListener("kolosseum:org-workspace-shown", (event) => {
  ownerUserId = String(event.detail?.ownerUserId ?? "");
});
document.addEventListener("kolosseum:org-organisations-rendered", (event) => {
  organisations = Array.isArray(event.detail?.organisations) ? event.detail.organisations : [];
  // Only on the organisations list itself, not while a section is open.
  if (!document.getElementById("orgListSection")?.hidden) setTimeout(() => { void runDue(); }, 600);
});
document.getElementById("orgShowMeAroundButton")?.addEventListener("click", () => { void runDue(true); });
