'use strict';

// Day 1 — image loading: fileToCanvas
// Day 2 — Standard mode rendering: renderASCII, TERM16, nearestTerminal16
// Day 3 — Edge, Braille, Blocks renderers: renderEdge, renderBraille, renderBlocks

// ─── Terminal-16 palette ──────────────────────────────────────────────────────

const TERM16 = [
  [0,0,0],[170,0,0],[0,170,0],[170,85,0],
  [0,0,170],[170,0,170],[0,170,170],[170,170,170],
  [85,85,85],[255,85,85],[85,255,85],[255,255,85],
  [85,85,255],[255,85,255],[85,255,255],[255,255,255],
];

function nearestTerminal16(r, g, b) {
  let best = TERM16[0], bestD = Infinity;
  for (const c of TERM16) {
    const d = (r - c[0]) ** 2 + (g - c[1]) ** 2 + (b - c[2]) ** 2;
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

// ─── Standard ASCII renderer ──────────────────────────────────────────────────

/**
 * Renders Standard-mode ASCII art from srcCanvas using opts.
 * Returns a new HTMLCanvasElement with the result.
 */
function renderASCII(srcCanvas, opts) {
  const {
    chars, scale, fontSize, charW, charH,
    colorMode, tintR, tintG, tintB,
    saturation, brightness, contrast, bgColor,
  } = opts;

  const safeChars = (chars && chars.length) ? chars : PRESETS.classic.chars;
  const N = safeChars.length;

  // ── Grid dimensions ────────────────────────────────────────────────────────
  // numCols derived from scale; numRows corrected for cell aspect ratio
  const numCols = Math.max(1, Math.round(srcCanvas.width  * scale));
  const numRows = Math.max(1, Math.round(srcCanvas.height * scale * (charW / charH)));

  // ── Downsample source to grid resolution ──────────────────────────────────
  const tmp = document.createElement('canvas');
  tmp.width  = numCols;
  tmp.height = numRows;
  tmp.getContext('2d').drawImage(srcCanvas, 0, 0, numCols, numRows);
  const px = tmp.getContext('2d').getImageData(0, 0, numCols, numRows).data;

  // ── Output canvas ─────────────────────────────────────────────────────────
  const out = document.createElement('canvas');
  out.width  = numCols * charW;
  out.height = numRows * charH;
  const ctx = out.getContext('2d');

  ctx.fillStyle = bgColor || '#000000';
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.font         = `${fontSize}px 'Courier New', Courier, monospace`;
  ctx.textBaseline = 'top';

  // ── Per-cell render ───────────────────────────────────────────────────────
  for (let row = 0; row < numRows; row++) {
    for (let col = 0; col < numCols; col++) {
      const i = (row * numCols + col) * 4;
      let r = px[i], g = px[i + 1], b = px[i + 2];

      // Luma (0 = dark, 1 = bright)
      let luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

      // Apply brightness then contrast
      luma = Math.min(1, Math.max(0, luma * brightness));
      luma = Math.min(1, Math.max(0, (luma - 0.5) * contrast + 0.5));

      // Map to char: chars[0] = lightest (space), chars[N-1] = densest
      const ch = safeChars[Math.min(N - 1, Math.floor(luma * N))];
      if (ch === ' ') continue; // background shows through

      // Resolve fill colour
      let fr, fg, fb;
      if (colorMode === 'mono' || colorMode === 'tint') {
        fr = tintR; fg = tintG; fb = tintB;
      } else if (colorMode === 'sepia') {
        fr = Math.min(255, 0.393 * r + 0.769 * g + 0.189 * b);
        fg = Math.min(255, 0.349 * r + 0.686 * g + 0.168 * b);
        fb = Math.min(255, 0.272 * r + 0.534 * g + 0.131 * b);
      } else if (colorMode === 'terminal') {
        [fr, fg, fb] = nearestTerminal16(r, g, b);
      } else {
        // 'auto' — use source colour, apply saturation / brightness / contrast
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        fr = gray + (r - gray) * saturation;
        fg = gray + (g - gray) * saturation;
        fb = gray + (b - gray) * saturation;
        fr = Math.min(255, Math.max(0, (fr - 128) * contrast + 128)) * brightness;
        fg = Math.min(255, Math.max(0, (fg - 128) * contrast + 128)) * brightness;
        fb = Math.min(255, Math.max(0, (fb - 128) * contrast + 128)) * brightness;
        fr = Math.min(255, Math.max(0, fr));
        fg = Math.min(255, Math.max(0, fg));
        fb = Math.min(255, Math.max(0, fb));
      }

      ctx.fillStyle = `rgb(${fr | 0},${fg | 0},${fb | 0})`;
      ctx.fillText(ch, col * charW, row * charH);
    }
  }

  return out;
}

// ─── Edge renderer ───────────────────────────────────────────────────────────

/**
 * Renders Edge-detection ASCII art using Sobel operator.
 * Above-threshold pixels get a directional char (─ │ ╱ ╲); below → background.
 */
function renderEdge(srcCanvas, opts) {
  const {
    scale, fontSize, charW, charH,
    edgeThresh, edgeSourceColor, edgeTint, bgColor,
    colorMode, tintR, tintG, tintB,
  } = opts;

  const numCols = Math.max(1, Math.round(srcCanvas.width  * scale));
  const numRows = Math.max(1, Math.round(srcCanvas.height * scale * (charW / charH)));

  const tmp = document.createElement('canvas');
  tmp.width  = numCols;
  tmp.height = numRows;
  tmp.getContext('2d').drawImage(srcCanvas, 0, 0, numCols, numRows);
  const px = tmp.getContext('2d').getImageData(0, 0, numCols, numRows).data;

  // Grayscale at (col, row), clamped to borders
  const lum = (c, r) => {
    if (c < 0 || c >= numCols || r < 0 || r >= numRows) return 0;
    const i = (r * numCols + c) * 4;
    return 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
  };

  // Parse edgeTint hex (#rrggbb) → [r, g, b]
  const tintHex = edgeTint || '#00ff88';
  const tv = parseInt(tintHex.slice(1), 16);
  const [etR, etG, etB] = [(tv >> 16) & 0xff, (tv >> 8) & 0xff, tv & 0xff];

  const out = document.createElement('canvas');
  out.width  = numCols * charW;
  out.height = numRows * charH;
  const ctx = out.getContext('2d');
  ctx.fillStyle = bgColor || '#000000';
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.font         = `${fontSize}px 'Courier New', Courier, monospace`;
  ctx.textBaseline = 'top';

  // Directional edge chars — gradient angle mapped to edge orientation
  // 0°/180° → vertical edge → │, 90° → horizontal → ─, diagonals → ╱ ╲
  for (let row = 0; row < numRows; row++) {
    for (let col = 0; col < numCols; col++) {
      const gx = (
        -lum(col-1, row-1) + lum(col+1, row-1) +
        -2 * lum(col-1, row) + 2 * lum(col+1, row) +
        -lum(col-1, row+1) + lum(col+1, row+1)
      );
      const gy = (
        -lum(col-1, row-1) - 2 * lum(col, row-1) - lum(col+1, row-1) +
         lum(col-1, row+1) + 2 * lum(col, row+1) + lum(col+1, row+1)
      );
      const mag = Math.sqrt(gx * gx + gy * gy);
      if (mag < edgeThresh) continue;

      // Gradient angle [0, 180) → edge orientation char
      let angle = Math.atan2(gy, gx) * 180 / Math.PI;
      if (angle < 0) angle += 180;

      let ch;
      if      (angle < 22.5 || angle >= 157.5) ch = '│';
      else if (angle < 67.5)                   ch = '╲';
      else if (angle < 112.5)                  ch = '─';
      else                                     ch = '╱';

      // Colour
      let fr, fg, fb;
      if (!edgeSourceColor) {
        fr = etR; fg = etG; fb = etB;
      } else if (colorMode === 'mono' || colorMode === 'tint') {
        fr = tintR; fg = tintG; fb = tintB;
      } else {
        const i = (row * numCols + col) * 4;
        fr = px[i]; fg = px[i + 1]; fb = px[i + 2];
      }

      ctx.fillStyle = `rgb(${fr | 0},${fg | 0},${fb | 0})`;
      ctx.fillText(ch, col * charW, row * charH);
    }
  }

  return out;
}

// ─── Braille renderer ─────────────────────────────────────────────────────────

/**
 * Renders Braille-dot art. Each Unicode Braille char (U+2800) encodes a 2×4
 * sub-pixel block; dot on/off is decided by luma threshold.
 *
 * Bit layout (matches Unicode Braille standard):
 *   col 0: dots 1,2,3,7 → bits 0,1,2,6
 *   col 1: dots 4,5,6,8 → bits 3,4,5,7
 */
function renderBraille(srcCanvas, opts) {
  const {
    scale, fontSize, charW, charH,
    colorMode, tintR, tintG, tintB,
    saturation, brightness, contrast, bgColor,
  } = opts;

  const numCols = Math.max(1, Math.round(srcCanvas.width  * scale));
  const numRows = Math.max(1, Math.round(srcCanvas.height * scale * (charW / charH)));

  // Each braille char covers 2 source-cols × 4 source-rows
  const srcW = numCols * 2;
  const srcH = numRows * 4;

  const tmp = document.createElement('canvas');
  tmp.width  = srcW;
  tmp.height = srcH;
  tmp.getContext('2d').drawImage(srcCanvas, 0, 0, srcW, srcH);
  const px = tmp.getContext('2d').getImageData(0, 0, srcW, srcH).data;

  const out = document.createElement('canvas');
  out.width  = numCols * charW;
  out.height = numRows * charH;
  const ctx = out.getContext('2d');
  ctx.fillStyle = bgColor || '#000000';
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.font         = `${fontSize}px 'Courier New', Courier, monospace`;
  ctx.textBaseline = 'top';

  // [subCol, subRow, bitIndex]
  const DOT_MAP = [
    [0,0,0],[0,1,1],[0,2,2],[1,0,3],
    [1,1,4],[1,2,5],[0,3,6],[1,3,7],
  ];
  const THRESH = 0.35; // luma threshold for "dot on"

  for (let row = 0; row < numRows; row++) {
    for (let col = 0; col < numCols; col++) {
      let bits = 0;
      let sumR = 0, sumG = 0, sumB = 0, onCount = 0;

      for (const [sc, sr, bit] of DOT_MAP) {
        const pc = col * 2 + sc;
        const pr = row * 4 + sr;
        const i  = (pr * srcW + pc) * 4;
        const r = px[i], g = px[i + 1], b = px[i + 2];
        const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        if (luma > THRESH) {
          bits |= (1 << bit);
          sumR += r; sumG += g; sumB += b; onCount++;
        }
      }

      if (bits === 0) continue;

      // Colour — averaged over "on" dots
      let fr, fg, fb;
      if (colorMode === 'mono' || colorMode === 'tint') {
        fr = tintR; fg = tintG; fb = tintB;
      } else if (colorMode === 'sepia') {
        const r = onCount ? sumR / onCount : 128;
        const g = onCount ? sumG / onCount : 128;
        const b = onCount ? sumB / onCount : 128;
        fr = Math.min(255, 0.393*r + 0.769*g + 0.189*b);
        fg = Math.min(255, 0.349*r + 0.686*g + 0.168*b);
        fb = Math.min(255, 0.272*r + 0.534*g + 0.131*b);
      } else if (colorMode === 'terminal') {
        const r = onCount ? sumR / onCount : 128;
        const g = onCount ? sumG / onCount : 128;
        const b = onCount ? sumB / onCount : 128;
        [fr, fg, fb] = nearestTerminal16(r, g, b);
      } else {
        // auto
        const r = onCount ? sumR / onCount : 128;
        const g = onCount ? sumG / onCount : 128;
        const b = onCount ? sumB / onCount : 128;
        const gray = 0.299*r + 0.587*g + 0.114*b;
        fr = Math.min(255, Math.max(0, gray + (r - gray) * saturation)) * brightness;
        fg = Math.min(255, Math.max(0, gray + (g - gray) * saturation)) * brightness;
        fb = Math.min(255, Math.max(0, gray + (b - gray) * saturation)) * brightness;
        fr = Math.min(255, Math.max(0, (fr - 128) * contrast + 128));
        fg = Math.min(255, Math.max(0, (fg - 128) * contrast + 128));
        fb = Math.min(255, Math.max(0, (fb - 128) * contrast + 128));
      }

      ctx.fillStyle = `rgb(${fr | 0},${fg | 0},${fb | 0})`;
      ctx.fillText(String.fromCodePoint(0x2800 + bits), col * charW, row * charH);
    }
  }

  return out;
}

// ─── Blocks renderer ─────────────────────────────────────────────────────────

/**
 * Renders half-block art using ▀ ▄ █.
 * Each character cell covers 1 source-col × 2 source-rows:
 *   top lit, bottom dark  → ▀   (U+2580)
 *   top dark, bottom lit  → ▄   (U+2584)
 *   both lit              → █   (U+2588)
 *   both dark             → (skipped — background shows through)
 */
function renderBlocks(srcCanvas, opts) {
  const {
    scale, fontSize, charW, charH,
    colorMode, tintR, tintG, tintB,
    saturation, brightness, contrast, bgColor,
  } = opts;

  const numCols = Math.max(1, Math.round(srcCanvas.width  * scale));
  const numRows = Math.max(1, Math.round(srcCanvas.height * scale * (charW / charH)));

  // Each block char covers 1 col × 2 source rows
  const srcW = numCols;
  const srcH = numRows * 2;

  const tmp = document.createElement('canvas');
  tmp.width  = srcW;
  tmp.height = srcH;
  tmp.getContext('2d').drawImage(srcCanvas, 0, 0, srcW, srcH);
  const px = tmp.getContext('2d').getImageData(0, 0, srcW, srcH).data;

  const out = document.createElement('canvas');
  out.width  = numCols * charW;
  out.height = numRows * charH;
  const ctx = out.getContext('2d');
  ctx.fillStyle = bgColor || '#000000';
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.font         = `${fontSize}px 'Courier New', Courier, monospace`;
  ctx.textBaseline = 'top';

  const THRESH = 110; // luma threshold for "lit"

  for (let row = 0; row < numRows; row++) {
    for (let col = 0; col < numCols; col++) {
      const it = (row * 2       * srcW + col) * 4;
      const ib = ((row * 2 + 1) * srcW + col) * 4;

      const rT = px[it], gT = px[it+1], bT = px[it+2];
      const rB = px[ib], gB = px[ib+1], bB = px[ib+2];

      const lumaT = 0.299*rT + 0.587*gT + 0.114*bT;
      const lumaB = 0.299*rB + 0.587*gB + 0.114*bB;

      const topLit = lumaT >= THRESH;
      const botLit = lumaB >= THRESH;

      if (!topLit && !botLit) continue;

      const ch = (topLit && botLit) ? '█' : topLit ? '▀' : '▄';

      // Source colour: use the lit half(s)
      let srcR, srcG, srcB;
      if (topLit && botLit) {
        srcR = (rT + rB) / 2; srcG = (gT + gB) / 2; srcB = (bT + bB) / 2;
      } else if (topLit) {
        srcR = rT; srcG = gT; srcB = bT;
      } else {
        srcR = rB; srcG = gB; srcB = bB;
      }

      let fr, fg, fb;
      if (colorMode === 'mono' || colorMode === 'tint') {
        fr = tintR; fg = tintG; fb = tintB;
      } else if (colorMode === 'sepia') {
        fr = Math.min(255, 0.393*srcR + 0.769*srcG + 0.189*srcB);
        fg = Math.min(255, 0.349*srcR + 0.686*srcG + 0.168*srcB);
        fb = Math.min(255, 0.272*srcR + 0.534*srcG + 0.131*srcB);
      } else if (colorMode === 'terminal') {
        [fr, fg, fb] = nearestTerminal16(srcR, srcG, srcB);
      } else {
        // auto
        const gray = 0.299*srcR + 0.587*srcG + 0.114*srcB;
        fr = gray + (srcR - gray) * saturation;
        fg = gray + (srcG - gray) * saturation;
        fb = gray + (srcB - gray) * saturation;
        fr = Math.min(255, Math.max(0, (fr - 128) * contrast + 128)) * brightness;
        fg = Math.min(255, Math.max(0, (fg - 128) * contrast + 128)) * brightness;
        fb = Math.min(255, Math.max(0, (fb - 128) * contrast + 128)) * brightness;
        fr = Math.min(255, Math.max(0, fr));
        fg = Math.min(255, Math.max(0, fg));
        fb = Math.min(255, Math.max(0, fb));
      }

      ctx.fillStyle = `rgb(${fr | 0},${fg | 0},${fb | 0})`;
      ctx.fillText(ch, col * charW, row * charH);
    }
  }

  return out;
}

// ─── Day 1 — file loading ─────────────────────────────────────────────────────

/**
 * Reads a File object and returns a Promise<HTMLCanvasElement>
 * containing the decoded image at its natural resolution.
 */
function fileToCanvas(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read file: ' + file.name));
    reader.onload  = e => {
      const img = new Image();
      img.onerror = () => reject(new Error('Not a valid image: ' + file.name));
      img.onload  = () => {
        const canvas   = document.createElement('canvas');
        canvas.width   = img.naturalWidth;
        canvas.height  = img.naturalHeight;
        canvas.getContext('2d').drawImage(img, 0, 0);
        resolve(canvas);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}
