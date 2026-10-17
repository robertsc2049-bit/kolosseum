import React from "react";

// A weekly trend chart for the coach's Analysis page: one slot per week (a
// missing week is a gap, not a join), a y-axis with its range, the first
// and last week labelled, an optional shaded "normal" band (e.g. a load
// ratio of 0.8-1.3) and a hover value on every point. Lines or bars.

export type TrendSeries = Readonly<{
  id: string;
  label: string;
  values: readonly (number | null)[];
  color?: string;
  kind?: "line" | "bar";
}>;

export type TrendChartProps = Readonly<{
  weeks: readonly string[];
  series: readonly TrendSeries[];
  unit?: string;
  band?: Readonly<{ from: number; to: number; label: string }>;
  yMin?: number;
  yMax?: number;
  height?: number;
  title: string;
  emptyLabel?: string;
}>;

const COLORS = ["var(--k-accent)", "var(--k-warning)", "#6aa8ff", "#d98bff", "var(--k-danger)", "#7fd6c2"];
// Drawn at the width it is shown at (measured), so labels stay readable on a phone.
const DEFAULT_WIDTH = 640;
const PAD = { left: 44, right: 10, top: 10, bottom: 22 };
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function shortWeek(week: string): string {
  const d = new Date(`${week}T00:00:00Z`);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

const tidy = (value: number) => (Math.abs(value) >= 100 ? Math.round(value).toLocaleString() : String(Math.round(value * 10) / 10));

export function TrendChart({ weeks, series, unit = "", band, yMin, yMax, height = 160, title, emptyLabel = "Not enough data yet." }: TrendChartProps) {
  const holder = React.useRef<HTMLElement | null>(null);
  const [WIDTH, setWidth] = React.useState(DEFAULT_WIDTH);
  React.useEffect(() => {
    const element = holder.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const measured = Math.round(entries[0]?.contentRect.width ?? 0);
      if (measured > 0) setWidth(Math.max(260, measured));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const values = series.flatMap((entry) => entry.values.filter((value): value is number => value !== null && Number.isFinite(value)));
  if (!values.length) return <div className="empty-state compact-empty trend-empty"><p>{emptyLabel}</p></div>;

  const hasBars = series.some((entry) => entry.kind === "bar");
  let low = yMin ?? Math.min(...values, ...(band ? [band.from] : []), ...(hasBars ? [0] : []));
  let high = yMax ?? Math.max(...values, ...(band ? [band.to] : []));
  if (high === low) { high += 1; low -= low > 0 ? Math.min(1, low) : 0; }
  const span = high - low;
  const plotW = WIDTH - PAD.left - PAD.right;
  const plotH = height - PAD.top - PAD.bottom;
  const slot = plotW / Math.max(weeks.length, 1);
  const x = (index: number) => PAD.left + slot * index + slot / 2;
  const y = (value: number) => PAD.top + plotH - ((value - low) / span) * plotH;
  const barSeries = series.filter((entry) => entry.kind === "bar");
  const barWidth = Math.max(3, (slot * 0.7) / Math.max(barSeries.length, 1));

  return (
    <figure className="trend-chart" ref={holder}>
      <svg viewBox={`0 0 ${WIDTH} ${height}`} role="img" aria-label={title} style={{ width: "100%", height: `${height}px`, display: "block" }}>
        <title>{title}</title>
        {band ? (
          <rect x={PAD.left} width={plotW} y={y(Math.min(band.to, high))} height={Math.max(0, y(Math.max(band.from, low)) - y(Math.min(band.to, high)))} className="trend-band" />
        ) : null}
        <line x1={PAD.left} x2={WIDTH - PAD.right} y1={PAD.top + plotH} y2={PAD.top + plotH} className="trend-axis" />
        <text x={PAD.left - 6} y={PAD.top + 4} className="trend-label" textAnchor="end">{tidy(high)}</text>
        <text x={PAD.left - 6} y={PAD.top + plotH} className="trend-label" textAnchor="end">{tidy(low)}</text>
        <text x={x(0)} y={height - 6} className="trend-label" textAnchor="start">{shortWeek(weeks[0])}</text>
        <text x={x(weeks.length - 1)} y={height - 6} className="trend-label" textAnchor="end">{shortWeek(weeks[weeks.length - 1])}</text>
        {barSeries.map((entry, barIndex) => entry.values.map((value, index) => value === null ? null : (
          <rect key={`${entry.id}-${index}`} x={x(index) - (barWidth * barSeries.length) / 2 + barWidth * barIndex} width={barWidth - 1} y={y(Math.max(value, low))} height={Math.max(0, y(low) - y(Math.max(value, low)))} fill={entry.color ?? COLORS[series.indexOf(entry) % COLORS.length]} opacity={0.85}>
            <title>{`${entry.label}, week of ${shortWeek(weeks[index])}: ${tidy(value)}${unit}`}</title>
          </rect>
        )))}
        {series.filter((entry) => entry.kind !== "bar").map((entry) => {
          const color = entry.color ?? COLORS[series.indexOf(entry) % COLORS.length];
          // Break the line at missing weeks.
          const segments: string[] = [];
          let current = "";
          entry.values.forEach((value, index) => {
            if (value === null || !Number.isFinite(value)) { if (current) segments.push(current); current = ""; return; }
            current += `${current ? "L" : "M"}${x(index).toFixed(1)},${y(value).toFixed(1)} `;
          });
          if (current) segments.push(current);
          return (
            <g key={entry.id}>
              {segments.map((d, index) => <path key={index} d={d} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />)}
              {entry.values.map((value, index) => value === null || !Number.isFinite(value) ? null : (
                <circle key={index} cx={x(index)} cy={y(value)} r={3} fill={color}>
                  <title>{`${entry.label}, week of ${shortWeek(weeks[index])}: ${tidy(value)}${unit}`}</title>
                </circle>
              ))}
            </g>
          );
        })}
      </svg>
      <figcaption className="trend-legend">
        {series.map((entry) => (
          <span key={entry.id} className="trend-legend-item">
            <span className="trend-swatch" style={{ background: entry.color ?? COLORS[series.indexOf(entry) % COLORS.length] }} />
            {entry.label}
          </span>
        ))}
        {band ? <span className="trend-legend-item"><span className="trend-swatch trend-swatch-band" />{band.label}</span> : null}
      </figcaption>
    </figure>
  );
}
