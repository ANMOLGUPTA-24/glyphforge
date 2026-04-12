'use strict';

// Character presets (used in Day 2+ rendering)
const PRESETS = {
  classic:  { name: 'Classic',   chars: " .'`,:;i+|!olt?}{xzjfI[]r()1/\\*ck7LvJunszXYUCFwmZO0&QABP@#$" },
  dense:    { name: 'Dense',     chars: " .:-=+*[%&#@$" },
  minimal:  { name: 'Minimal',   chars: "  ..@@" },
  blocks:   { name: 'Blocks',    chars: " ░▒▓█" },
  hatching: { name: 'Hatching',  chars: " -~+|x#@" },
  dots:     { name: 'Dots',      chars: " ·•◦○●" },
  binary:   { name: 'Binary',    chars: " 01" },
};

// Defaults — extended in later days
const DEFAULTS = {
  preset:      'classic',
  chars:       PRESETS.classic.chars,
  mode:        'standard',
  scale:       0.10,
  fontSize:    12,
  charW:       8,
  charH:       14,
  colorMode:   'auto',
  tintR:       255,
  tintG:       255,
  tintB:       255,
  saturation:  1.0,
  brightness:  1.0,
  contrast:    1.0,
  bgColor:     '#000000',
  dither:      false,
  edgeThresh:  30,
  edgeSourceColor: true,
  edgeTint:    '#00ff88',
  fps:         10,
  livePreview: true,
  exportName:  'glyphforge_output',
};
