'use strict';

// ─── Day 1 ────────────────────────────────────────────────────────────────────
// Features: scaffold, file loading, raw image preview, accordion, zoom/pan.
// ASCII rendering, export, and settings persistence come in later days.

// ─── State ───────────────────────────────────────────────────────────────────

const state = {
  sources:   [],   // HTMLCanvasElement[] — one per loaded file
  frameIdx:  0,
  zoom:      1,
  panX:      0,
  panY:      0,
  isPanning: false,
  lastMX:    0,
  lastMY:    0,
};

// ─── DOM shortcuts ────────────────────────────────────────────────────────────

const $  = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

const fileInput    = $('file-input');
const outputCanvas = $('output-canvas');
const canvasWrap   = $('canvas-wrap');
const dropZone     = $('drop-zone');
const fileInfo     = $('file-info');
const statusText   = $('status-text');
const outputDims   = $('output-dims');
const zoomLevel    = $('zoom-level');
const seqBadge     = $('seq-badge');
const seqControls  = $('seq-controls');
const frameCounter = $('frame-counter');

// ─── Image display ────────────────────────────────────────────────────────────

/** Draws the current source canvas to the output canvas and fits it on screen. */
function showCurrentFrame() {
  const src = state.sources[state.frameIdx];
  if (!src) return;

  outputCanvas.width  = src.width;
  outputCanvas.height = src.height;
  outputCanvas.getContext('2d').drawImage(src, 0, 0);

  outputCanvas.style.display = 'block';
  dropZone.style.display     = 'none';
  outputDims.textContent     = `${src.width} × ${src.height}px`;

  fitToWindow();
  setStatus('Ready');
}

// ─── File loading ─────────────────────────────────────────────────────────────

const VALID_TYPES = /\.(png|jpe?g|bmp|webp|gif)$/i;

async function loadFiles(files) {
  const imageFiles = Array.from(files).filter(
    f => f.type.startsWith('image/') || VALID_TYPES.test(f.name)
  );
  if (!imageFiles.length) {
    showToast('No supported image files found.', 'error');
    return;
  }

  setStatus('<span class="spinner"></span>Loading…');

  try {
    const canvases = await Promise.all(imageFiles.map(f => fileToCanvas(f)));

    state.sources  = canvases;
    state.frameIdx = 0;

    const first = imageFiles[0].name;
    fileInfo.textContent = canvases.length > 1
      ? `${canvases.length} frames  ·  ${first} …`
      : `${first}  (${canvases[0].width} × ${canvases[0].height}px)`;

    // Pre-fill export name (used in Day 4+)
    $('export-name').value = first.replace(/\.[^.]+$/, '') + '_glyph';

    // Show sequence controls only when multiple images are loaded
    if (canvases.length > 1) {
      seqBadge.textContent      = canvases.length;
      seqBadge.style.display    = '';
      seqControls.style.display = '';
      $('btn-gif').style.display = '';
      frameCounter.textContent  = `1 / ${canvases.length}`;
    } else {
      seqBadge.style.display     = 'none';
      seqControls.style.display  = 'none';
      $('btn-gif').style.display = 'none';
    }

    showCurrentFrame();
    showToast(`Loaded ${canvases.length} image${canvases.length > 1 ? 's' : ''}.`, 'success');
  } catch (err) {
    setStatus('Load failed: ' + err.message);
    showToast(err.message, 'error');
  }
}

// ─── Frame navigation ─────────────────────────────────────────────────────────

function goToFrame(idx) {
  if (!state.sources.length) return;
  state.frameIdx = Math.max(0, Math.min(idx, state.sources.length - 1));
  frameCounter.textContent = `${state.frameIdx + 1} / ${state.sources.length}`;
  showCurrentFrame();
}

// ─── Zoom & pan ───────────────────────────────────────────────────────────────

function fitToWindow() {
  const cw = canvasWrap.clientWidth;
  const ch = canvasWrap.clientHeight;
  if (!cw || !ch || !outputCanvas.width) return;

  const scaleX = cw / outputCanvas.width;
  const scaleY = ch / outputCanvas.height;
  const z      = Math.min(scaleX, scaleY, 1); // never upscale beyond 100%

  state.zoom = z;
  state.panX = (cw - outputCanvas.width  * z) / 2;
  state.panY = (ch - outputCanvas.height * z) / 2;
  applyTransform();
  zoomLevel.textContent = 'Fit';
}

function applyZoom(delta) {
  const cw   = canvasWrap.clientWidth;
  const ch   = canvasWrap.clientHeight;
  const prev = state.zoom;
  const next = Math.max(0.05, Math.min(state.zoom * delta, 8));
  state.zoom = next;
  // Keep the visual centre fixed while scaling
  state.panX = cw / 2 - (cw / 2 - state.panX) * (next / prev);
  state.panY = ch / 2 - (ch / 2 - state.panY) * (next / prev);
  applyTransform();
  zoomLevel.textContent = Math.round(next * 100) + '%';
}

function applyTransform() {
  outputCanvas.style.transform =
    `translate(${state.panX}px, ${state.panY}px) scale(${state.zoom})`;
}

// ─── Accordion ────────────────────────────────────────────────────────────────

function initAccordion() {
  $$('.section-header').forEach(header => {
    header.addEventListener('click', () => {
      const body = $(header.dataset.target);
      if (!body) return;
      const opening = !body.classList.contains('open');
      body.classList.toggle('open', opening);
      header.classList.toggle('open', opening);
    });
  });

  // Open these sections by default
  ['sec-chars', 'sec-size', 'sec-colors', 'sec-export'].forEach(id => {
    const body = $(id);
    if (!body) return;
    body.classList.add('open');
    body.previousElementSibling.classList.add('open');
  });
}

// ─── Status / toasts ─────────────────────────────────────────────────────────

function setStatus(html) {
  statusText.innerHTML = html;
}

function showToast(msg, type = 'info') {
  const el = document.createElement('div');
  el.className   = `toast ${type}`;
  el.textContent = msg;
  $('toast-container').appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

// ─── Event wiring ─────────────────────────────────────────────────────────────

function init() {
  initAccordion();

  // ── File open ──────────────────────────────────────────────────────────────
  $('btn-open').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', e => {
    loadFiles(e.target.files);
    fileInput.value = ''; // allow re-selecting same file
  });

  // ── Drag & drop ────────────────────────────────────────────────────────────
  const container = $('canvas-container');

  container.addEventListener('dragover', e => {
    e.preventDefault();
    container.classList.add('drag-over');
  });
  container.addEventListener('dragleave', e => {
    if (!container.contains(e.relatedTarget))
      container.classList.remove('drag-over');
  });
  container.addEventListener('drop', e => {
    e.preventDefault();
    container.classList.remove('drag-over');
    loadFiles(e.dataTransfer.files);
  });

  // ── Mode switcher (wired up; rendering in Day 2) ───────────────────────────
  $$('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const mode = btn.dataset.mode;
      $('sec-edge-panel').style.display = mode === 'edge' ? '' : 'none';
      showToast(`Mode "${btn.textContent}" — rendering in Day 2.`, 'info');
    });
  });

  // ── Render button (wired up; rendering in Day 2) ──────────────────────────
  $('btn-render').addEventListener('click', () => {
    if (!state.sources.length) {
      showToast('Load an image first.', 'error');
      return;
    }
    showToast('ASCII rendering arrives in Day 2.', 'info');
  });

  // ── Export buttons (wired up; export in Day 4+) ───────────────────────────
  $$('.btn-export').forEach(btn => {
    btn.addEventListener('click', () => notYetImplemented(btn.dataset.format.toUpperCase()));
  });

  // ── Zoom controls ──────────────────────────────────────────────────────────
  $('btn-zoom-in').addEventListener('click',     () => applyZoom(1.25));
  $('btn-zoom-out').addEventListener('click',    () => applyZoom(0.8));
  $('btn-zoom-fit').addEventListener('click',    () => fitToWindow());
  $('btn-zoom-actual').addEventListener('click', () => {
    state.panX = 0;
    state.panY = 0;
    state.zoom = 1;
    applyTransform();
    zoomLevel.textContent = '100%';
  });

  $('canvas-container').addEventListener('wheel', e => {
    e.preventDefault();
    applyZoom(e.deltaY < 0 ? 1.1 : 1 / 1.1);
  }, { passive: false });

  // ── Pan (drag) ─────────────────────────────────────────────────────────────
  canvasWrap.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    state.isPanning = true;
    state.lastMX    = e.clientX;
    state.lastMY    = e.clientY;
    canvasWrap.classList.add('grabbing');
  });
  window.addEventListener('mouseup', () => {
    state.isPanning = false;
    canvasWrap.classList.remove('grabbing');
  });
  window.addEventListener('mousemove', e => {
    if (!state.isPanning) return;
    state.panX += e.clientX - state.lastMX;
    state.panY += e.clientY - state.lastMY;
    state.lastMX = e.clientX;
    state.lastMY = e.clientY;
    applyTransform();
  });

  // ── Frame navigation ───────────────────────────────────────────────────────
  $('btn-prev-frame').addEventListener('click', () => goToFrame(state.frameIdx - 1));
  $('btn-next-frame').addEventListener('click', () => goToFrame(state.frameIdx + 1));
  document.addEventListener('keydown', e => {
    if (['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)) return;
    if (e.key === 'ArrowLeft')  goToFrame(state.frameIdx - 1);
    if (e.key === 'ArrowRight') goToFrame(state.frameIdx + 1);
  });

  // ── Window resize: re-fit ──────────────────────────────────────────────────
  window.addEventListener('resize', () => {
    if (state.sources.length) fitToWindow();
  });

  // ── Keyboard shortcut: Ctrl+O to open ─────────────────────────────────────
  document.addEventListener('keydown', e => {
    if (e.ctrlKey && e.key === 'o') { e.preventDefault(); fileInput.click(); }
  });
}

document.addEventListener('DOMContentLoaded', init);
