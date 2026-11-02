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
                {!step.done || current ? <p className="muted small">{step.body}</p> : null}
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
