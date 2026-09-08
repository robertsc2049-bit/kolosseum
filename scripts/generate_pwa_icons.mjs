// DEV NOTE: one-off PWA icon generator. Run manually
// (`node scripts/generate_pwa_icons.mjs`) whenever the icon design or brand
// colors change - it is not part of the build pipeline and adds no runtime
// or dev dependency. Hand-encodes PNGs with Node's built-in zlib only
// (raw IHDR/IDAT/IEND chunks), drawing a geometric "K" monogram in the same
// --k-canvas/--k-accent-bright brand colors already used by index.html's
// .brand-mark, so no external image library or font renderer is needed.

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const OUT_DIR = path.join(process.cwd(), "public", "app", "icons");

const CANVAS = [0x0a, 0x0c, 0x0a]; // --k-canvas
const GLYPH = [0x9a, 0xd6, 0x00]; // --k-accent-bright

// --- Minimal PNG encoder -----------------------------------------------

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    crc ^= buf[i];
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 1) ? (0xedb88320 ^ (crc >>> 1)) : (crc >>> 1);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function encodePng(width, height, rgba) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // color type: RGBA
  ihdrData[10] = 0; // compression method
  ihdrData[11] = 0; // filter method
  ihdrData[12] = 0; // interlace method

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0; // per-scanline filter type: None
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idatData = zlib.deflateSync(raw, { level: 9 });

  return Buffer.concat([
    signature,
    chunk("IHDR", ihdrData),
    chunk("IDAT", idatData),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

// --- Monogram drawing ----------------------------------------------------

// Returns true if the normalized point (x, y), both in [0, 1), falls inside
// the "K" glyph: a vertical stem on the left, plus two diagonal arms that
// meet the stem at the vertical center and fan out to the top-right/
// bottom-right corners. Computed directly per output pixel (not upscaled
// from a small bitmap), so the diagonals stay clean at every icon size.
function isGlyphPixel(x, y) {
  const stemWidth = 0.22;
  if (x < stemWidth) return true;

  const armWidth = 0.16;
  const centerDist = Math.abs(y - 0.5); // 0 at vertical center, 0.5 at edges
  const armStart = stemWidth + (centerDist / 0.5) * (1 - stemWidth - armWidth);
  return x >= armStart && x < armStart + armWidth;
}

// Alpha for a rounded-rect background (used by the two non-maskable icons
// so favicons/desktop shortcuts read as a deliberate rounded app icon
// rather than a plain square swatch). Maskable/Apple variants skip this and
// stay full-bleed square, per their own platform conventions.
function roundedRectAlpha(px, py, size, radius) {
  const inLeft = px < radius;
  const inRight = px >= size - radius;
  const inTop = py < radius;
  const inBottom = py >= size - radius;
  if ((inLeft || inRight) && (inTop || inBottom)) {
    const cx = inLeft ? radius : size - radius;
    const cy = inTop ? radius : size - radius;
    const dx = px - cx + 0.5;
    const dy = py - cy + 0.5;
    return Math.hypot(dx, dy) <= radius ? 255 : 0;
  }
  return 255;
}

function buildIcon({ size, rounded, insetFraction = 0 }) {
  const rgba = Buffer.alloc(size * size * 4);
  const radius = Math.round(size * 0.18);
  const inset = size * insetFraction;
  const drawSize = size - inset * 2;

  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      const offset = (py * size + px) * 4;

      const alpha = rounded ? roundedRectAlpha(px, py, size, radius) : 255;

      const gx = (px - inset) / drawSize;
      const gy = (py - inset) / drawSize;
      const withinDrawArea = gx >= 0 && gx < 1 && gy >= 0 && gy < 1;
      const isGlyph = withinDrawArea && isGlyphPixel(gx, gy);

      const color = isGlyph ? GLYPH : CANVAS;
      rgba[offset] = color[0];
      rgba[offset + 1] = color[1];
      rgba[offset + 2] = color[2];
      rgba[offset + 3] = alpha;
    }
  }

  return encodePng(size, size, rgba);
}

// --- Write the four required assets --------------------------------------

fs.mkdirSync(OUT_DIR, { recursive: true });

const outputs = [
  { file: "icon-192.png", size: 192, rounded: true, insetFraction: 0.08 },
  { file: "icon-512.png", size: 512, rounded: true, insetFraction: 0.08 },
  { file: "icon-maskable-512.png", size: 512, rounded: false, insetFraction: 0.16 },
  { file: "apple-touch-icon.png", size: 180, rounded: false, insetFraction: 0.1 }
];

for (const { file, size, rounded, insetFraction } of outputs) {
  const png = buildIcon({ size, rounded, insetFraction });
  fs.writeFileSync(path.join(OUT_DIR, file), png);
  console.log(`wrote ${path.join("public", "app", "icons", file)} (${png.length} bytes)`);
}
