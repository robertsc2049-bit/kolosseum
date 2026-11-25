// Settings-style screens on a phone: each panel collapses to its title, like
// a settings list, and opens on tap. Account keeps the identity card, account
// code, pending coach invitations and Sign out open; Declarations keeps the
// current declaration, today's readiness, the medical stand-down and a pain
// check-in open (each is something to act on now), and never collapses the
// onboarding forms. The panels are rendered by several React islands, so this
// works on whatever they render: a toggle button goes into each panel's
// heading (React leaves nodes it did not create alone) and the open/closed
// state is a data attribute. The collapsing itself is phone-only CSS, so wider
// screens are unchanged.
const COLLAPSIBLE_SCREENS = [
  {
    viewId: "view-account",
    panels: ".panel",
    keepOpenRoots: new Set(["account-identity-header-root", "account-code-root", "account-coach-invitations-root"]),
    keepOpen: ".account-card, .danger-panel:not(.closure-panel)"
  },
  {
    viewId: "view-onboarding",
    panels: "article.onboarding-card",
    keepOpenRoots: new Set(),
    keepOpen: "[data-declaration-status=\"current\"], .readiness, .stand-down-card, .pain-check-in, .athlete-programme"
  },
  // A coach's athlete profile: the counts, the assignment section and their
  // current programme (with "Adjust for this athlete") stay open; each record
  // (history, notes, wellbeing...) is a row to open.
  {
    viewId: "athleteProfilePanel",
    panels: "article.panel",
    keepOpenRoots: new Set(),
    keepOpen: ".metric-card, :has(> #athlete-history-current-programme-root)"
  },
  // A programme's detail: the preview stays open; assigning, versions,
  // usage, checks, marketplace and release are rows to open.
  {
    viewId: "templateDetailPanel",
    panels: ".programme-detail-section",
    keepOpenRoots: new Set(),
    keepOpen: ":has(> .programme-preview)"
  },
  // Wellbeing: the athlete's own progress stays open; each log is a row.
  {
    viewId: "historyWellbeing",
    panels: ".panel",
    keepOpenRoots: new Set(["athlete-self-progress-insights-root"]),
    keepOpen: ".progress-insights-panel"
  },
  // One athlete's analysis: what stands out stays open; each section is a row
  // with its headline.
  {
    viewId: "view-coach-progress",
    panels: ".analysis-section",
    keepOpenRoots: new Set(),
    keepOpen: ".analysis-summary"
  }
];

function collapsiblePanelHead(panel) {
  const [first, second] = panel.children;
  if (!first) return null;
  if (first.matches("p.eyebrow") && second?.matches("h3, h4")) return { count: 2, heading: second };
  const heading = first.matches("h2, h3, h4") ? first : first.querySelector("h3, h2, h4");
  if (heading) return { count: 1, heading };
  // A section titled only by its eyebrow (e.g. Marketplace) uses that as its row title.
  return first.matches("p.eyebrow") ? { count: 1, heading: first } : null;
}

function setCollapsiblePanelOpen(panel, open) {
  panel.dataset.collapsed = open ? "false" : "true";
  panel.querySelector(":scope .section-toggle")?.setAttribute("aria-expanded", String(open));
}

function enhanceCollapsibleSections(screen) {
  const view = document.getElementById(screen.viewId);
  if (!view) return;
  for (const panel of view.querySelectorAll(screen.panels)) {
    if (panel.dataset.collapsible || panel.parentElement?.closest(`#${screen.viewId} :is(${screen.panels})`)) continue;
    const root = panel.closest("[id]")?.id ?? "";
    if (screen.keepOpenRoots.has(root) || panel.matches(screen.keepOpen)) continue;
    const head = collapsiblePanelHead(panel);
    if (!head) continue;
    panel.dataset.collapsible = String(head.count);
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "section-toggle";
    toggle.setAttribute("aria-label", `Show or hide ${head.heading.textContent.trim()}`);
    head.heading.append(toggle);
    setCollapsiblePanelOpen(panel, false);
  }
}

for (const screen of COLLAPSIBLE_SCREENS) {
  const view = document.getElementById(screen.viewId);
  if (!view) continue;
  view.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const panel = target.closest("[data-collapsible]");
    if (!panel) return;
    const toggle = target.closest(".section-toggle");
    // A tap anywhere on a collapsed section's heading opens it; once open,
    // the toggle (or the heading itself) closes it again.
    const inHead = [...panel.children].slice(0, Number(panel.dataset.collapsible)).some((child) => child.contains(target));
    if (!toggle && (!inHead || target.closest("button, a, input, select, textarea, label"))) return;
    setCollapsiblePanelOpen(panel, panel.dataset.collapsed === "true");
  });
  new MutationObserver(() => enhanceCollapsibleSections(screen)).observe(view, { childList: true, subtree: true });
  enhanceCollapsibleSections(screen);
}
