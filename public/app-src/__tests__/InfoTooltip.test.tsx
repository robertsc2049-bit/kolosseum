// DEV NOTE: InfoTooltip.tsx behavioral proof - the click/outside-click/
// Escape idiom is copied from NotificationBellPanel.tsx's own popover, so
// this test mirrors NotificationBellPanel.test.tsx's interaction-testing
// style (fire a click, await the popover content, then assert each close
// path removes it).
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import { InfoTooltip } from "../components/InfoTooltip";

test.afterEach(() => {
  cleanup();
});

test("renders only the trigger until clicked, then shows the explanation", async () => {
  render(<InfoTooltip label="About RPE">Rate of Perceived Exertion.</InfoTooltip>);

  assert.equal(document.querySelector(".info-tooltip-popover"), null);
  assert.equal(screen.queryByText("Rate of Perceived Exertion."), null);

  await act(async () => {
    fireEvent.click(screen.getByLabelText("About RPE"));
  });

  await screen.findByText("Rate of Perceived Exertion.");
});

test("the trigger button exposes aria-haspopup and toggles aria-expanded", async () => {
  render(<InfoTooltip label="About RPE">Rate of Perceived Exertion.</InfoTooltip>);
  const trigger = screen.getByLabelText("About RPE");

  assert.equal(trigger.getAttribute("aria-haspopup"), "true");
  assert.equal(trigger.getAttribute("aria-expanded"), "false");

  await act(async () => {
    fireEvent.click(trigger);
  });

  assert.equal(trigger.getAttribute("aria-expanded"), "true");
});

test("a second click on the trigger closes it", async () => {
  render(<InfoTooltip label="About RPE">Rate of Perceived Exertion.</InfoTooltip>);
  const trigger = screen.getByLabelText("About RPE");

  await act(async () => {
    fireEvent.click(trigger);
  });
  await screen.findByText("Rate of Perceived Exertion.");

  await act(async () => {
    fireEvent.click(trigger);
  });
  assert.equal(document.querySelector(".info-tooltip-popover"), null);
});

test("Escape closes it", async () => {
  render(<InfoTooltip label="About RPE">Rate of Perceived Exertion.</InfoTooltip>);

  await act(async () => {
    fireEvent.click(screen.getByLabelText("About RPE"));
  });
  await screen.findByText("Rate of Perceived Exertion.");

  await act(async () => {
    fireEvent.keyDown(document, { key: "Escape" });
  });
  assert.equal(document.querySelector(".info-tooltip-popover"), null);
});

test("a click outside the tooltip closes it", async () => {
  render(
    <div>
      <InfoTooltip label="About RPE">Rate of Perceived Exertion.</InfoTooltip>
      <button type="button">Elsewhere</button>
    </div>
  );

  await act(async () => {
    fireEvent.click(screen.getByLabelText("About RPE"));
  });
  await screen.findByText("Rate of Perceived Exertion.");

  await act(async () => {
    fireEvent.click(screen.getByText("Elsewhere"));
  });
  assert.equal(document.querySelector(".info-tooltip-popover"), null);
});

test("multiple independent tooltips on the same page don't interfere with each other", async () => {
  render(
    <div>
      <InfoTooltip label="About RPE">Rate of Perceived Exertion.</InfoTooltip>
      <InfoTooltip label="About Borg">A separate perceived-exertion scale.</InfoTooltip>
    </div>
  );

  await act(async () => {
    fireEvent.click(screen.getByLabelText("About RPE"));
  });
  await screen.findByText("Rate of Perceived Exertion.");
  assert.equal(screen.queryByText("A separate perceived-exertion scale."), null);

  await act(async () => {
    fireEvent.click(screen.getByLabelText("About Borg"));
  });
  await screen.findByText("A separate perceived-exertion scale.");
  assert.equal(screen.queryByText("Rate of Perceived Exertion."), null);
});
