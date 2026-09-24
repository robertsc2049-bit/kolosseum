import React from "react";

// DEV NOTE: progress graphs (FULL-UI-36 slice 2) - the first hand-rolled
// SVG chart in this codebase (no charting library dependency, matching
// the app's existing minimalist, hand-built visual style). Pure/
// presentational only - no fetching, no persisted UI state. Reused across
// the athlete-self, coach per-athlete, and coach roster-overview progress
// screens, hence living in a shared components/ folder rather than under
// screens/ like every other component in this codebase.
//
// The x-axis spaces points evenly by rank, not true date-proportionally -
// a deliberate simplification for sparse/irregular logging data (a real
// date scale would make gaps look identical to dense clusters look
// identical, which is more misleading than helpful for this data shape).
// No hover/tooltip interactivity in this pass.

export type ChartPoint = Readonly<{ date: string; value: number }>;

export type ChartSeries = Readonly<{
  id: string;
  label: string;
  color?: string;
  points: readonly ChartPoint[];
}>;

export type LineChartProps = Readonly<{
  series: readonly ChartSeries[];
  height?: number;
  compact?: boolean;
  emptyLabel?: string;
}>;

const DEFAULT_COLORS = ["var(--k-accent)", "var(--k-warning)", "var(--k-danger)", "var(--k-accent-bright)"];
const VIEWBOX_WIDTH = 300;

function seriesColor(series: ChartSeries, seriesIndex: number): string {
  return series.color ?? DEFAULT_COLORS[seriesIndex % DEFAULT_COLORS.length];
}

export function LineChart({ series, height = 80, compact = false, emptyLabel = "Not enough data yet." }: LineChartProps) {
  const nonEmptySeries = series.filter((entry) => entry.points.length > 0);

  if (nonEmptySeries.length === 0) {
    return (
      <div className="empty-state compact-empty">
        <p>{emptyLabel}</p>
      </div>
    );
  }

  const allValues = nonEmptySeries.flatMap((entry) => entry.points.map((point) => point.value));
  const minValue = Math.min(...allValues);
  const maxValue = Math.max(...allValues);
  const valueRange = maxValue - minValue || 1;
  const paddingY = compact ? 4 : 10;

  function coordinate(point: ChartPoint, index: number, total: number): { x: number; y: number } {
    const x = total > 1 ? (index / (total - 1)) * VIEWBOX_WIDTH : VIEWBOX_WIDTH / 2;
    const y = height - paddingY - ((point.value - minValue) / valueRange) * (height - paddingY * 2);
    return { x, y };
  }

  function pathFor(points: readonly ChartPoint[]): string {
    return points
      .map((point, index) => {
        const { x, y } = coordinate(point, index, points.length);
        return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(" ");
  }

  return (
    <div className={`line-chart${compact ? " line-chart-compact" : ""}`}>
      <svg
        viewBox={`0 0 ${VIEWBOX_WIDTH} ${height}`}
        preserveAspectRatio="none"
        style={{ width: "100%", height: `${height}px`, display: "block" }}
        role="img"
        aria-label={nonEmptySeries.map((entry) => entry.label).join(", ")}
      >
        {nonEmptySeries.map((entry, seriesIndex) =>
          entry.points.length === 1 ? (
            <circle
              key={entry.id}
              cx={coordinate(entry.points[0], 0, 1).x}
              cy={coordinate(entry.points[0], 0, 1).y}
              r={3}
              fill={seriesColor(entry, seriesIndex)}
            />
          ) : (
            <path
              key={entry.id}
              d={pathFor(entry.points)}
              fill="none"
              stroke={seriesColor(entry, seriesIndex)}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )
        )}
      </svg>

      {!compact && nonEmptySeries.length > 1 ? (
        <div className="line-chart-legend">
          {nonEmptySeries.map((entry, seriesIndex) => (
            <span key={entry.id} className="line-chart-legend-item">
              <span className="line-chart-legend-swatch" style={{ background: seriesColor(entry, seriesIndex) }} />
              {entry.label}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
