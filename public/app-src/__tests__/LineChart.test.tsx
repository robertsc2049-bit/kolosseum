// DEV NOTE: FULL-UI-36 progress graphs slice 1 - LineChart.tsx is pure/
// presentational (no fetching), so these are plain prop-driven render
// assertions, no mocked fetch needed.
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { cleanup, render } from "@testing-library/react";

import { LineChart } from "../components/LineChart";

test.afterEach(() => {
  cleanup();
});

test("renders a factual empty state when every series is empty", () => {
  const { container } = render(<LineChart series={[{ id: "a", label: "Series A", points: [] }]} />);
  assert.ok(container.querySelector(".empty-state.compact-empty"));
  assert.equal(container.querySelector("svg"), null);
});

test("renders a single dot, not a line, for a series with exactly one point", () => {
  const { container } = render(
    <LineChart series={[{ id: "a", label: "Series A", points: [{ date: "2026-01-01", value: 10 }] }]} />
  );
  assert.equal(container.querySelectorAll("circle").length, 1);
  assert.equal(container.querySelectorAll("path").length, 0);
});

test("renders a path for a series with multiple points, and no legend when there is only one series", () => {
  const { container } = render(
    <LineChart
      series={[{
        id: "a",
        label: "Series A",
        points: [
          { date: "2026-01-01", value: 10 },
          { date: "2026-01-08", value: 12 },
          { date: "2026-01-15", value: 11 }
        ]
      }]}
    />
  );
  const path = container.querySelector("path");
  assert.ok(path);
  assert.ok(path.getAttribute("d")?.startsWith("M"));
  assert.equal(container.querySelector(".line-chart-legend"), null);
});

test("renders one path per non-empty series, a legend entry per series, and skips empty series entirely", () => {
  const { container } = render(
    <LineChart
      series={[
        { id: "a", label: "Series A", points: [{ date: "2026-01-01", value: 10 }, { date: "2026-01-08", value: 12 }] },
        { id: "b", label: "Series B", points: [] },
        { id: "c", label: "Series C", points: [{ date: "2026-01-01", value: 5 }, { date: "2026-01-08", value: 6 }] }
      ]}
    />
  );
  assert.equal(container.querySelectorAll("path").length, 2);
  const legendItems = container.querySelectorAll(".line-chart-legend-item");
  assert.equal(legendItems.length, 2);
  assert.ok([...legendItems].some((item) => item.textContent?.includes("Series A")));
  assert.ok([...legendItems].some((item) => item.textContent?.includes("Series C")));
  assert.ok(![...legendItems].some((item) => item.textContent?.includes("Series B")));
});

test("cycles through the default color palette when a series has no explicit color", () => {
  const { container } = render(
    <LineChart
      series={[
        { id: "a", label: "A", points: [{ date: "2026-01-01", value: 1 }, { date: "2026-01-02", value: 2 }] },
        { id: "b", label: "B", points: [{ date: "2026-01-01", value: 3 }, { date: "2026-01-02", value: 4 }] }
      ]}
    />
  );
  const paths = [...container.querySelectorAll("path")];
  const strokes = paths.map((path) => path.getAttribute("stroke"));
  assert.equal(new Set(strokes).size, 2, "expected two distinct colors");
});

test("respects an explicit series color over the default palette", () => {
  const { container } = render(
    <LineChart
      series={[{
        id: "a",
        label: "A",
        color: "var(--k-danger)",
        points: [{ date: "2026-01-01", value: 1 }, { date: "2026-01-02", value: 2 }]
      }]}
    />
  );
  assert.equal(container.querySelector("path")?.getAttribute("stroke"), "var(--k-danger)");
});

test("compact mode never renders a legend, even with multiple series", () => {
  const { container } = render(
    <LineChart
      compact
      series={[
        { id: "a", label: "A", points: [{ date: "2026-01-01", value: 1 }, { date: "2026-01-02", value: 2 }] },
        { id: "b", label: "B", points: [{ date: "2026-01-01", value: 3 }, { date: "2026-01-02", value: 4 }] }
      ]}
    />
  );
  assert.equal(container.querySelector(".line-chart-legend"), null);
  assert.ok(container.querySelector(".line-chart-compact"));
});

test("a custom empty label is shown when provided", () => {
  const { getByText } = render(<LineChart series={[]} emptyLabel="Log a value to see this trend." />);
  assert.ok(getByText("Log a value to see this trend."));
});
