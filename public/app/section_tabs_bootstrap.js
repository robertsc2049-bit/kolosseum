// DEV NOTE: generic in-page section-tabs controller. Deliberately keyed on
// data-tab-group (not hardcoded to any one screen) so the same primitive can
// be reused wherever a long stack of independently-mounted panels needs
// tabbed navigation - see index.html's #view-history for the first use.
// Toggles the hidden attribute on plain wrapper divs rather than rendering
// a React wrapper component, because the panels a tab shows/hides are each
// their own independently-mounted React root (see main.tsx's mount() calls),
// not children of one shared JSX tree - the same constraint route_bootstrap.js
// and app.js's own setView() already work within, just one level deeper.
export function initSectionTabs(root = document) {
  for (const tablist of root.querySelectorAll(".section-tabs[data-tab-group]")) {
    const group = tablist.dataset.tabGroup;
    const panels = root.querySelectorAll(`[data-tab-panel][data-tab-group="${group}"]`);
    const buttons = tablist.querySelectorAll(".section-tab");

    tablist.addEventListener("click", (event) => {
      const button = event.target.closest(".section-tab");
      if (!button) return;

      const target = button.dataset.tabTarget;
      for (const b of buttons) {
        b.classList.toggle("active", b === button);
        b.setAttribute("aria-selected", String(b === button));
      }
      for (const panel of panels) {
        panel.hidden = panel.dataset.tabPanel !== target;
      }
    });
  }
}

if (typeof document !== "undefined" && typeof window !== "undefined") {
  initSectionTabs();
}
