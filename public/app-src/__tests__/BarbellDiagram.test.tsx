import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { cleanup, render } from "@testing-library/react";

import { BarbellDiagram } from "../components/BarbellDiagram";

test.afterEach(() => {
  cleanup();
});

test("renders one plate rect per plate, expanding counts (one side only, mirroring kolosseum.tools/ironclock's own single-side diagram)", () => {
  const { container } = render(
    <BarbellDiagram perSide={[{ plate: 25, count: 2 }, { plate: 15, count: 1 }]} barWeight={20} collarWeight={0} unit="kg" />
  );
  const rects = container.querySelectorAll(".barbell-diagram-plate");
  assert.equal(rects.length, 3);
});

test("renders just the shaft/sleeve/end-cap, with no plate rects, for an empty perSide (bar-only load)", () => {
  const { container } = render(<BarbellDiagram perSide={[]} barWeight={20} collarWeight={0} unit="kg" />);
  assert.equal(container.querySelectorAll(".barbell-diagram-plate").length, 0);
  assert.ok(container.querySelector("svg"));
});

test("prints the plate's own weight as a label on each plate, largest plate first", () => {
  const { container } = render(
    <BarbellDiagram perSide={[{ plate: 25, count: 1 }, { plate: 10, count: 1 }]} barWeight={20} collarWeight={0} unit="kg" />
  );
  const labels = Array.from(container.querySelectorAll(".barbell-diagram-plate-label")).map((node) => node.textContent);
  assert.deepEqual(labels, ["25", "10"]);
});

test("positions plates left-to-right in load order, largest (innermost) first", () => {
  const { container } = render(
    <BarbellDiagram perSide={[{ plate: 25, count: 1 }, { plate: 10, count: 1 }]} barWeight={20} collarWeight={0} unit="kg" />
  );
  const rects = Array.from(container.querySelectorAll(".barbell-diagram-plate")) as SVGRectElement[];
  const [first, second] = rects;
  assert.ok(Number(first.getAttribute("x")) < Number(second.getAttribute("x")));
});

test("carries an accessible label summarizing the load, and expands the viewBox to fit a heavier load", () => {
  const light = render(<BarbellDiagram perSide={[{ plate: 1.25, count: 1 }]} barWeight={20} collarWeight={0} unit="kg" />);
  const lightSvg = light.container.querySelector("svg")!;
  assert.match(lightSvg.getAttribute("aria-label") ?? "", /20kg bar, 1 plate per side/u);
  const lightWidth = Number(lightSvg.getAttribute("viewBox")!.split(" ")[2]);
  light.unmount();

  const heavy = render(
    <BarbellDiagram perSide={[{ plate: 25, count: 4 }, { plate: 20, count: 2 }]} barWeight={20} collarWeight={0} unit="kg" />
  );
  const heavySvg = heavy.container.querySelector("svg")!;
  assert.match(heavySvg.getAttribute("aria-label") ?? "", /6 plates per side/u);
  const heavyWidth = Number(heavySvg.getAttribute("viewBox")!.split(" ")[2]);

  assert.ok(heavyWidth > lightWidth);
});

test("uses instance-unique gradient ids, so two diagrams rendered at once (e.g. two expanded exercise calculators) never collide", () => {
  const { container } = render(
    <>
      <BarbellDiagram perSide={[{ plate: 25, count: 1 }]} barWeight={20} collarWeight={0} unit="kg" />
      <BarbellDiagram perSide={[{ plate: 25, count: 1 }]} barWeight={20} collarWeight={0} unit="kg" />
    </>
  );
  const gradientIds = Array.from(container.querySelectorAll("linearGradient")).map((node) => node.id);
  assert.equal(gradientIds.length, new Set(gradientIds).size, "expected every gradient id in the document to be unique");

  const [firstPlate, secondPlate] = Array.from(container.querySelectorAll(".barbell-diagram-plate")) as SVGRectElement[];
  assert.notEqual(firstPlate.getAttribute("fill"), secondPlate.getAttribute("fill"), "each diagram instance must reference its own gradient ids");
});

test("renders a collar element only when collarWeight is positive, and mentions it in the accessible label", () => {
  const withoutCollars = render(<BarbellDiagram perSide={[{ plate: 25, count: 1 }]} barWeight={20} collarWeight={0} unit="kg" />);
  assert.equal(withoutCollars.container.querySelectorAll("rect").length, 4, "expected shaft + sleeve + plate + sleeve-end, no collar");
  assert.doesNotMatch(withoutCollars.container.querySelector("svg")!.getAttribute("aria-label") ?? "", /collar/u);
  withoutCollars.unmount();

  const withCollars = render(<BarbellDiagram perSide={[{ plate: 25, count: 1 }]} barWeight={20} collarWeight={5} unit="kg" />);
  assert.equal(withCollars.container.querySelectorAll("rect").length, 5, "expected shaft + sleeve + plate + collar + sleeve-end");
  assert.match(withCollars.container.querySelector("svg")!.getAttribute("aria-label") ?? "", /weighted collars/u);

  // The collar element itself carries no text label, matching
  // kolosseum.tools/ironclock's own <div className="ic-bar-collar" />
  // exactly - it's a plain block, unlike plates (which do print their own
  // weight). The per-collar (2.5kg) figure is surfaced elsewhere instead
  // (the checkbox's own "2.5kg each / 5kg pair" copy).
  const labels = Array.from(withCollars.container.querySelectorAll(".barbell-diagram-plate-label")).map((node) => node.textContent);
  assert.deepEqual(labels, ["25"]);
});

test("renders a fractional (micro) plate with its own distinct, smaller style", () => {
  const { container } = render(
    <BarbellDiagram perSide={[{ plate: 25, count: 1 }, { plate: 0.25, count: 1 }]} barWeight={20} collarWeight={0} unit="kg" />
  );
  const rects = Array.from(container.querySelectorAll(".barbell-diagram-plate")) as SVGRectElement[];
  assert.equal(rects.length, 2);
  const [main, fractional] = rects;
  assert.ok(Number(fractional.getAttribute("height")) < Number(main.getAttribute("height")));
  assert.notEqual(main.getAttribute("fill"), fractional.getAttribute("fill"));

  const labels = Array.from(container.querySelectorAll(".barbell-diagram-plate-label")).map((node) => node.textContent);
  assert.deepEqual(labels, ["25", "0.25"]);
});
