import React from "react";

// The house: two pillars joined above and below, the Split K between them.
// It is earned - only ever shown for a finished block, with what was earned
// beside it (brand book, The emblem). The full drawing is for 96px wide and
// up; the simple one (plain pillars) for anything smaller.
export const EMBLEM_WIDTH = 226;
export const EMBLEM_HEIGHT = 170;
export const EMBLEM_K = "M0 0 27 0 27 100 0 100zM34 32 62.2 0 98.2 0 54.2 50 98.2 100 62.2 100 34 68z";
export const EMBLEM_PILLARS = "M0 0 226 0 226 20 0 20zM8 24 48 24 48 32 41 41 15 41 8 32zM15 44 21.67 44 21.67 125 15 125zM24.67 44 31.33 44 31.33 125 24.67 125zM34.33 44 41 44 41 125 34.33 125zM5 128 51 128 51 146 5 146zM178 24 218 24 218 32 211 41 185 41 178 32zM185 44 191.67 44 191.67 125 185 125zM194.67 44 201.33 44 201.33 125 194.67 125zM204.33 44 211 44 211 125 204.33 125zM175 128 221 128 221 146 175 146zM0 150 226 150 226 170 0 170z";
const SIMPLE_PILLARS = "M0 0 226 0 226 20 0 20zM8 20 48 20 48 28 41 37 41 136 51 136 51 150 5 150 5 136 15 136 15 37 8 28zM178 20 218 20 218 28 211 37 211 136 221 136 221 150 175 150 175 136 185 136 185 37 178 28zM0 150 226 150 226 170 0 170z";
export const EMBLEM_K_PLACE = { x: 59, y: 36, scale: 1.1 };

export function HouseEmblem({ width, pillars = "#F1F4F6", mark = "#9AD600" }: { width: number; pillars?: string; mark?: string }) {
  const simple = width < 96;
  return (
    <svg viewBox={`0 0 ${EMBLEM_WIDTH} ${EMBLEM_HEIGHT}`} width={width} height={Math.round((width * EMBLEM_HEIGHT) / EMBLEM_WIDTH)} aria-hidden="true" focusable="false">
      <path fill={pillars} d={simple ? SIMPLE_PILLARS : EMBLEM_PILLARS} />
      <path fill={mark} d={EMBLEM_K} transform={`translate(${EMBLEM_K_PLACE.x} ${simple ? 30 : EMBLEM_K_PLACE.y}) scale(${EMBLEM_K_PLACE.scale})`} />
    </svg>
  );
}
