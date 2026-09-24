import React, { useEffect, useRef, useState } from "react";

// DEV NOTE: shared across athlete and coach screens (RPE/Borg/CR10 scales,
// commercial seat terms, programme-builder fields, etc.), hence living in
// components/ rather than screens/ like the rest of this codebase's
// screen-local pieces. Click/outside-click/Escape handling is copied from
// NotificationBellPanel.tsx's own popover, the only existing precedent for
// this interaction in the app - open state is local (no data to fetch).
// Unlike that precedent, the trigger's own onClick deliberately does NOT
// call event.stopPropagation(): several screens show more than one
// InfoTooltip at once (e.g. "Execution scope" and "Jurisdiction" side by
// side), and stopping propagation would keep an already-open tooltip from
// ever seeing a later click on a sibling tooltip's trigger as "outside" -
// leaving both open. Each wrapper's own contains() check already prevents
// a tooltip from closing itself when its own trigger is clicked again, so
// stopPropagation was never actually load-bearing for that case.
// The trigger is a <span role="button"> with an explicit key handler, not a
// real <button>, because most placements sit inside a <label> alongside the
// field's own <input>/<select> - a real <button> there is itself a
// "labelable" element, so @testing-library/dom's getByLabelText resolves the
// label to the tooltip trigger instead of the actual field (confirmed via
// the library's own label-helpers.js: any button/input/select/etc. inside a
// <label> can hijack that label's associated form control). A span with
// role="button" keeps full keyboard operability (focusable, Enter/Space
// activate it) without being a labelable element itself. The "i" glyph is
// drawn via CSS (.info-tooltip-trigger::after) rather than a text node for
// the same reason: getByLabelText computes a <label>'s matched text from its
// descendants' literal DOM text (skipping only button/input/select/etc.), so
// a text node here would get appended to the field's own label text and
// break exact-text label lookups in already-existing tests.
export function InfoTooltip({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return undefined;

    function handleDocumentClick(event: MouseEvent) {
      if (wrapRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("click", handleDocumentClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("click", handleDocumentClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function toggleOpen() {
    setOpen((current) => !current);
  }

  return (
    <span className="info-tooltip-wrap" ref={wrapRef}>
      <span
        role="button"
        tabIndex={0}
        className="info-tooltip-trigger"
        aria-label={label}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={toggleOpen}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          toggleOpen();
        }}
      />
      {open ? (
        <span className="info-tooltip-popover" role="tooltip">
          {children}
        </span>
      ) : null}
    </span>
  );
}
