import React, { useId } from "react";

import { FRACTIONAL_PLATE_RANK_STYLES, PLATE_RANK_STYLES, plateVisual, type PlatePair, type WeightUnit } from "../utils/plateCalculator";

// DEV NOTE: PlateWarmupCalculator.tsx's visual companion to the existing
// text "Plates per side" badge list - ported from the real, already-shipped
// diagram at kolosseum.tools/ironclock (renderBarbell()/ic-plate*/
// ic-bar-collar in that repo's IronClock.jsx/.css), adapted from a
// div/flexbox layout to hand-rolled SVG to match this app's own existing
// visual convention (see LineChart.tsx's DEV NOTE - no charting/graphics
// library). Shows one side only, same as the reference: both sides carry
// the same plates, so a second mirrored half would be pure repetition.
// Rendered at a fixed pixel size (not scaled to 100% width) inside a
// horizontally-scrolling wrapper (.barbell-diagram-wrap in styles.css),
// so a heavy load with many plates scrolls instead of shrinking labels
// into illegibility.
const SHAFT_WIDTH = 70;
const SHAFT_HEIGHT = 8;
const SLEEVE_SIZE = 22;
const COLLAR_WIDTH = 14;
const COLLAR_HEIGHT = 44;
const COLLAR_MARGIN = 2;
const SLEEVE_END_WIDTH = 5;
const SLEEVE_END_HEIGHT = 18;
const SLEEVE_END_MARGIN = 2;
const PLATE_GAP = 1;
const PADDING = 16;
const ALL_PLATE_STYLES = [...PLATE_RANK_STYLES, ...FRACTIONAL_PLATE_RANK_STYLES];
const MAX_PLATE_HEIGHT = Math.max(...ALL_PLATE_STYLES.map((style) => style.height));

type ExpandedPlate = { key: string; label: string } & ReturnType<typeof plateVisual>;

function expandPlates(perSide: readonly PlatePair[], unit: WeightUnit): ExpandedPlate[] {
  return perSide.flatMap(({ plate, count }) => {
    const visual = plateVisual(plate, unit);
    return Array.from({ length: count }, (_, index) => ({ key: `${plate}-${index}`, label: String(plate), ...visual }));
  });
}

export function BarbellDiagram({ perSide, barWeight, collarWeight, unit }: {
  perSide: readonly PlatePair[];
  barWeight: number;
  collarWeight: number;
  unit: WeightUnit;
}) {
  // DEV NOTE: gradient ids must be unique per instance, not just per
  // component - a session can have several exercises' plate calculators
  // expanded at once, each mounting its own BarbellDiagram, and SVG <defs>
  // ids are scoped to the whole document, not to their own <svg> root.
  const instanceId = useId();
  const gradientId = (suffix: string) => `${instanceId}-${suffix}`;
  const hasCollar = collarWeight > 0;

  const plates = expandPlates(perSide, unit);
  const platesWidth = plates.reduce((sum, plate) => sum + plate.width + PLATE_GAP, 0);
  const collarSpan = hasCollar ? COLLAR_MARGIN * 2 + COLLAR_WIDTH : 0;
  const contentWidth = SHAFT_WIDTH + SLEEVE_SIZE + platesWidth + collarSpan + SLEEVE_END_MARGIN + SLEEVE_END_WIDTH;
  const viewBoxWidth = contentWidth + PADDING * 2;
  const viewBoxHeight = MAX_PLATE_HEIGHT + PADDING * 2;
  const centerY = viewBoxHeight / 2;

  const shaftX = PADDING;
  const sleeveX = shaftX + SHAFT_WIDTH;
  let cursor = sleeveX + SLEEVE_SIZE;
  const positionedPlates = plates.map((plate) => {
    const x = cursor;
    cursor += plate.width + PLATE_GAP;
    return { ...plate, x };
  });
  const collarX = cursor + COLLAR_MARGIN;
  if (hasCollar) cursor = collarX + COLLAR_WIDTH + COLLAR_MARGIN;
  const sleeveEndX = cursor + SLEEVE_END_MARGIN;

  const plateCountLabel = plates.length === 0
    ? "no plates loaded"
    : plates.length === 1
      ? "1 plate per side"
      : `${plates.length} plates per side`;
  const collarLabel = hasCollar ? ` and weighted collars` : "";

  return (
    <div className="barbell-diagram-wrap">
      <svg
        className="barbell-diagram"
        width={viewBoxWidth}
        height={viewBoxHeight}
        viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
        role="img"
        aria-label={`Barbell loaded with a ${barWeight}${unit} bar, ${plateCountLabel}${collarLabel}`}
      >
        <defs>
          <linearGradient id={gradientId("shaft")} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4A4F57" />
            <stop offset="100%" stopColor="#2A2D31" />
          </linearGradient>
          <linearGradient id={gradientId("sleeve")} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6B7079" />
            <stop offset="100%" stopColor="#3A3D42" />
          </linearGradient>
          <linearGradient id={gradientId("collar")} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#888888" />
            <stop offset="100%" stopColor="#444444" />
          </linearGradient>
          <linearGradient id={gradientId("sleeve-end")} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#5A5F67" />
            <stop offset="100%" stopColor="#2F3236" />
          </linearGradient>
          {ALL_PLATE_STYLES.map((style) => (
            <linearGradient key={style.gradientId} id={gradientId(style.gradientId)} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={style.gradientStops[0]} />
              <stop offset="100%" stopColor={style.gradientStops[1]} />
            </linearGradient>
          ))}
        </defs>

        <rect x={shaftX} y={centerY - SHAFT_HEIGHT / 2} width={SHAFT_WIDTH} height={SHAFT_HEIGHT} rx={1} fill={`url(#${gradientId("shaft")})`} />
        <rect x={sleeveX} y={centerY - SLEEVE_SIZE / 2} width={SLEEVE_SIZE} height={SLEEVE_SIZE} rx={1} fill={`url(#${gradientId("sleeve")})`} />

        {positionedPlates.map((plate) => (
          <g key={plate.key}>
            <rect
              x={plate.x}
              y={centerY - plate.height / 2}
              width={plate.width}
              height={plate.height}
              rx={3}
              fill={`url(#${gradientId(plate.gradientId)})`}
              className="barbell-diagram-plate"
            />
            <text
              x={plate.x + plate.width / 2}
              y={centerY}
              fill={plate.textColor}
              fontSize={plate.fontSize}
              textAnchor="middle"
              dominantBaseline="central"
              transform={`rotate(-90 ${plate.x + plate.width / 2} ${centerY})`}
              className={plate.textShadow ? "barbell-diagram-plate-label barbell-diagram-plate-label-shadow" : "barbell-diagram-plate-label"}
            >
              {plate.label}
            </text>
          </g>
        ))}

        {hasCollar ? (
          <rect x={collarX} y={centerY - COLLAR_HEIGHT / 2} width={COLLAR_WIDTH} height={COLLAR_HEIGHT} rx={2} fill={`url(#${gradientId("collar")})`} />
        ) : null}

        <rect x={sleeveEndX} y={centerY - SLEEVE_END_HEIGHT / 2} width={SLEEVE_END_WIDTH} height={SLEEVE_END_HEIGHT} rx={1} fill={`url(#${gradientId("sleeve-end")})`} />
      </svg>
    </div>
  );
}
