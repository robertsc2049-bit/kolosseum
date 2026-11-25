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

    // Each tab names its panels; arrow keys move between tabs (only the chosen
    // one is a Tab stop), as the tab pattern expects.
    buttons.forEach((button, index) => {
      const owned = [...panels].filter((panel) => panel.dataset.tabPanel === button.dataset.tabTarget);
      button.id ||= `section-tab-${group}-${index}`;
      button.tabIndex = button.classList.contains("active") ? 0 : -1;
      owned.forEach((panel, at) => {
        panel.id ||= `section-panel-${group}-${button.dataset.tabTarget}-${at}`;
        panel.setAttribute("role", "tabpanel");
        panel.setAttribute("aria-labelledby", button.id);
      });
      if (owned.length) button.setAttribute("aria-controls", owned.map((panel) => panel.id).join(" "));
    });
    tablist.addEventListener("keydown", (event) => {
      const list = [...buttons].filter((button) => !button.hidden);
      const at = list.indexOf(document.activeElement);
      if (at < 0) return;
      const to = { ArrowRight: at + 1, ArrowLeft: at - 1, Home: 0, End: list.length - 1 }[event.key];
      if (to === undefined) return;
      event.preventDefault();
      const next = list[(to + list.length) % list.length];
      next.focus();
      next.click();
    });

    tablist.addEventListener("click", (event) => {
      const button = event.target.closest(".section-tab");
      if (!button) return;

      const target = button.dataset.tabTarget;
      for (const b of buttons) {
        b.classList.toggle("active", b === button);
        b.setAttribute("aria-selected", String(b === button));
        b.tabIndex = b === button ? 0 : -1;
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
