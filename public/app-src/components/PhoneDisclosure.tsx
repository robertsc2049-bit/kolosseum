import React, { useId, useState } from "react";

// Secondary controls (filters, a create form) that sit closed behind one
// button on a phone, so the screen opens on its content. On wider screens
// the toggle is hidden and the wrapper is `display: contents`, so the
// children lay out exactly as if the wrapper were not there (see
// .phone-disclosure in styles.css).
export function PhoneDisclosure({ label, openLabel, count = 0, children }: {
  label: string;
  openLabel: string;
  count?: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const bodyId = useId();
  return (
    <div className="phone-disclosure" data-open={String(open)}>
      <button
        className="button secondary phone-disclosure-toggle"
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen(!open)}
      >
        {open ? openLabel : count > 0 ? `${label} (${count})` : label}
      </button>
      <div className="phone-disclosure-body" id={bodyId}>{children}</div>
    </div>
  );
}
