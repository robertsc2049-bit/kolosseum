import React from "react";

// A first-steps checklist card: each step ticks itself off from what the
// account has actually done, and has a button that takes them to where it's
// done. Shown until every required step is done or it's hidden ("Hide this
// guide" - remembered per account in this browser).
export type GuideStep = {
  id: string;
  title: string;
  body: string;
  done: boolean;
  optional?: boolean;
  actions: { label: string; onClick: () => void; primary?: boolean }[];
};

const DISMISS_PREFIX = "kolosseum.guide.v1";

export function guideDismissed(guideId: string, userId: string): boolean {
  try { return window.localStorage.getItem(`${DISMISS_PREFIX}.${guideId}.${userId}`) === "1"; }
  catch { return false; }
}

export function dismissGuide(guideId: string, userId: string): void {
  try { window.localStorage.setItem(`${DISMISS_PREFIX}.${guideId}.${userId}`, "1"); }
  catch { /* storage unavailable: the guide shows again next time */ }
}

// Open one of the app's screens the way its navigation does.
export function openAppView(view: string): void {
  const item = document.querySelector<HTMLElement>(`.nav-item[data-view="${view}"]`) ?? document.querySelector<HTMLElement>(`[data-view="${view}"]`);
  item?.click();
}

// Bring a section into view for a guide step: open it if it's a collapsed
// section (as Account and the setup screens are on a phone) and scroll it
// clear of the sticky top bar. Runs after the screen has switched.
export function revealSection(selector: string, delayMs = 300): void {
  window.setTimeout(() => {
    const element = document.querySelector<HTMLElement>(selector);
    if (!element) return;
    const panel = element.matches("[data-collapsible]") ? element : element.closest<HTMLElement>("[data-collapsible]");
    if (panel?.dataset.collapsed === "true") panel.querySelector<HTMLElement>(".section-toggle")?.click();
    const scroll = (behavior: ScrollBehavior) => window.scrollTo({ top: Math.max(0, element.getBoundingClientRect().top + window.scrollY - 80), behavior });
    scroll("smooth");
    // A screen that's still filling in can stop the scroll short: check once more.
    window.setTimeout(() => {
      if (Math.abs(element.getBoundingClientRect().top - 80) > 40) scroll("auto");
    }, 1200);
  }, delayMs);
}

// The coach's share link and QR code (Account -> Find new athletes): the way
// in for an athlete who hasn't got a Kolosseum account yet - an email
// invitation needs one.
export function openShareLink(): void {
  openAppView("account");
  revealSection("#coachShareLinkHeading");
}

export function GuideChecklist({ testId, eyebrow, title, intro, steps, onHide }: {
  testId: string;
  eyebrow: string;
  title: string;
  intro: string;
  steps: GuideStep[];
  onHide: () => void;
}) {
  const required = steps.filter((step) => !step.optional);
  const doneCount = required.filter((step) => step.done).length;
  const next = steps.find((step) => !step.done && !step.optional) ?? null;
  return (
    <article className="panel guide-checklist" data-testid={testId} aria-labelledby={`${testId}-heading`}>
      <div className="panel-header">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h3 id={`${testId}-heading`}>{title}</h3>
          <p className="muted">{intro}</p>
        </div>
        <button className="button secondary small-button" type="button" onClick={onHide}>Hide this guide</button>
      </div>
      <p className="muted small" role="status">{`${doneCount} of ${required.length} done`}</p>
      <ol className="guide-steps">
        {steps.map((step) => {
          const current = next?.id === step.id;
          return (
            <li key={step.id} className={`guide-step${step.done ? " done" : ""}${current ? " current" : ""}`} aria-current={current ? "step" : undefined}>
              <span className="guide-step-mark" aria-hidden="true">{step.done ? "✓" : ""}</span>
              <div>
                <strong>{step.title}{step.optional ? " (optional)" : ""}</strong>
                <span className="visually-hidden">{step.done ? " - done" : " - to do"}</span>
                {current ? <p className="muted small">{step.body}</p> : null}
                {!step.done ? (
                  <div className="inline-controls">
                    {step.actions.map((action) => (
                      <button key={action.label} className={`button ${action.primary && current ? "primary" : "secondary"} small`} type="button" onClick={action.onClick}>{action.label}</button>
                    ))}
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </article>
  );
}
