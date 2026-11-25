import React from "react";

// A phone-sized screen, as the stylesheet counts it.
export function isPhone(): boolean {
  return typeof globalThis.matchMedia === "function" && globalThis.matchMedia("(max-width: 759px)").matches;
}

// On a phone, part of a screen kept behind a row with its name; on a wider
// screen it's simply there (styles.css). What's inside stays in the page, so
// what's typed in it is kept, and it can start open when it's already in use.
export function PhoneMore({ label, open: startsOpen = false, className = "", icon, children }: { label: string; open?: boolean; className?: string; icon?: string; children: React.ReactNode }) {
  const [open, setOpen] = React.useState(startsOpen);
  return (
    <div className={`phone-more ${className}`.trim()} data-open={String(open)}>
      <button className="phone-more-toggle" type="button" aria-expanded={open} aria-label={icon ? label : undefined} title={icon ? label : undefined} onClick={() => setOpen(!open)}>{icon ?? label}</button>
      <div className="phone-more-body">{children}</div>
    </div>
  );
}
