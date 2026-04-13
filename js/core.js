'use strict';

// Day 1 — image loading: fileToCanvas
// Day 2 — Standard mode rendering: renderASCII, TERM16, nearestTerminal16

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
