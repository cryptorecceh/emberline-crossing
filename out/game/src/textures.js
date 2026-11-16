// Emberline Crossing — procedural canvas textures. No external assets: every
// surface is painted from a seeded generator, so the game loads with zero
// network requests and the same seed always paints the same map.
import * as THREE from 'three';
import { THEME } from './palette.js';

export function mulberry32(seed) {
  let state = seed;
  return function next() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let mix = Math.imul(state ^ (state >>> 15), 1 | state);
    mix = (mix + Math.imul(mix ^ (mix >>> 7), 61 | mix)) ^ mix;
    return ((mix ^ (mix >>> 14)) >>> 0) / 4294967296;
  };
}

function paintCanvas(side, draw, { repeat: tile = [1, 1], seed = 1 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = side;
  canvas.height = side;
  const g = canvas.getContext('2d');
  draw(g, side, mulberry32(seed));
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(tile[0], tile[1]);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function speckle(g, side, next, n, fill, lo, hi, a = 1) {
  g.fillStyle = fill;
  g.globalAlpha = a;
  for (let i = 0; i < n; i += 1) {
    const r = lo + next() * (hi - lo);
    g.beginPath();
    g.arc(next() * side, next() * side, r, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
}

function cracks(g, side, next, n, fill) {
  g.strokeStyle = fill;
  g.lineWidth = 1;
  for (let i = 0; i < n; i += 1) {
    let x = next() * side;
    let y = next() * side;
    g.globalAlpha = 0.25 + next() * 0.35;
    g.beginPath();
    g.moveTo(x, y);
    const segs = 3 + Math.floor(next() * 4);
    for (let s = 0; s < segs; s += 1) {
      x += (next() - 0.5) * 70;
      y += (next() - 0.5) * 70;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  g.globalAlpha = 1;
}

// Sand / asphalt / moss ground: base colour, darker patches, speckles, cracks.
export function groundTexture(seed = 7) {
  const dirt = THEME.groundBase;
  const mottle = THEME.groundPatch;
  const streak = THEME.groundLine;
  const top = paintCanvas(512, (g, side, next) => {
    g.fillStyle = dirt;
    g.fillRect(0, 0, side, side);
    for (let i = 0; i < 46; i += 1) {
      g.fillStyle = next() < 0.5 ? mottle : streak;
      g.globalAlpha = 0.08 + next() * 0.14;
      const r = 18 + next() * 70;
      g.beginPath();
      g.ellipse(next() * side, next() * side, r, r * (0.5 + next() * 0.7), next() * Math.PI, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
    speckle(g, side, next, 2600, mottle, 0.6, 2.4, 0.55);
    speckle(g, side, next, 900, streak, 0.8, 2.8, 0.5);
    cracks(g, side, next, 9, mottle);
    // Asphalt repair patches: darker rounded slabs with worn edges.
    for (let i = 0; i < 7; i += 1) {
      g.fillStyle = mottle;
      g.globalAlpha = 0.22 + next() * 0.2;
      const px = next() * side;
      const py = next() * side;
      const pw = 40 + next() * 90;
      const ph = 26 + next() * 60;
      g.beginPath();
      g.roundRect(px, py, pw, ph, 8);
      g.fill();
      g.globalAlpha = 0.5;
      g.strokeStyle = streak;
      g.lineWidth = 2;
      g.beginPath();
      g.roundRect(px, py, pw, ph, 8);
      g.stroke();
    }
    // Tire scuff arcs and oil stains.
    for (let i = 0; i < 6; i += 1) {
      g.strokeStyle = mottle;
      g.globalAlpha = 0.18 + next() * 0.2;
      g.lineWidth = 5 + next() * 7;
      g.beginPath();
      g.arc(next() * side, next() * side, 30 + next() * 60, next() * Math.PI, next() * Math.PI + 1.2 + next());
      g.stroke();
    }
    for (let i = 0; i < 5; i += 1) {
      g.fillStyle = '#1a1512';
      g.globalAlpha = 0.25 + next() * 0.25;
      g.beginPath();
      g.ellipse(next() * side, next() * side, 10 + next() * 26, 7 + next() * 16, next() * Math.PI, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
    if (THEME.id === 'neon') {
      // Faded lane paint on wet asphalt.
      g.fillStyle = '#c8b45a';
      g.globalAlpha = 0.28;
      g.fillRect(side * 0.48, 0, 5, side);
      g.globalAlpha = 1;
      // Puddle sheen: pale soft blobs.
      for (let i = 0; i < 8; i += 1) {
        g.fillStyle = '#8fb4d8';
        g.globalAlpha = 0.1 + next() * 0.12;
        g.beginPath();
        g.ellipse(next() * side, next() * side, 22 + next() * 46, 14 + next() * 26, next() * Math.PI, 0, Math.PI * 2);
        g.fill();
      }
      g.globalAlpha = 1;
    }
    if (THEME.id === 'mist') {
      // Leaf litter and moss clumps.
      speckle(g, side, next, 500, '#3d4a2e', 1, 3, 0.7);
      speckle(g, side, next, 300, '#8a7a3a', 0.8, 2, 0.5);
    }
  }, { repeat: [9, 8], seed });
  const relief = paintCanvas(256, (g, side, next) => {
    g.fillStyle = '#808080';
    g.fillRect(0, 0, side, side);
    speckle(g, side, next, 1800, '#5a5a5a', 1, 3, 0.8);
    speckle(g, side, next, 1200, '#a8a8a8', 1, 2.5, 0.8);
  }, { repeat: [9, 8], seed: seed + 31 });
  return { map: top, bump: relief };
}

// Stained concrete for walls: panel lines, stains, speckle.
export function concreteTexture(seed = 11) {
  return paintCanvas(512, (g, side, next) => {
    g.fillStyle = THEME.wallConcrete;
    g.fillRect(0, 0, side, side);
    for (let i = 0; i < 22; i += 1) {
      g.fillStyle = THEME.wallConcreteDark;
      g.globalAlpha = 0.06 + next() * 0.12;
      const w = 30 + next() * 90;
      g.fillRect(next() * side, next() * side, w, 12 + next() * 40);
    }
    g.globalAlpha = 1;
    // Panel seams.
    g.strokeStyle = THEME.wallConcreteDark;
    g.globalAlpha = 0.55;
    g.lineWidth = 2;
    for (let i = 1; i < 4; i += 1) {
      g.beginPath();
      g.moveTo(0, (side / 4) * i);
      g.lineTo(side, (side / 4) * i);
      g.stroke();
      g.beginPath();
      g.moveTo((side / 4) * i, 0);
      g.lineTo((side / 4) * i, side);
      g.stroke();
    }
    g.globalAlpha = 1;
    speckle(g, side, next, 1400, THEME.wallConcreteDark, 0.7, 2.2, 0.32);
    cracks(g, side, next, 5, THEME.wallConcreteDark);
    // Damp stains bleeding from the top edge + grime at the base.
    for (let i = 0; i < 6; i += 1) {
      const grad = g.createLinearGradient(0, 0, 0, 60 + next() * 120);
      grad.addColorStop(0, THEME.wallConcreteDark);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.globalAlpha = 0.12 + next() * 0.15;
      g.fillStyle = grad;
      const w = 20 + next() * 50;
      g.fillRect(next() * side, 0, w, 60 + next() * 120);
    }
    g.globalAlpha = 0.16;
    g.fillStyle = THEME.wallConcreteDark;
    g.fillRect(0, side - 26, side, 26);
    g.globalAlpha = 1;
  }, { repeat: [1, 1], seed });
}

// Corrugated metal: vertical ribs, rust streaks, rivets.
export function metalTexture(seed = 13) {
  return paintCanvas(512, (g, side, next) => {
    g.fillStyle = THEME.wallMetal;
    g.fillRect(0, 0, side, side);
    for (let x = 0; x < side; x += 32) {
      const grad = g.createLinearGradient(x, 0, x + 32, 0);
      grad.addColorStop(0, THEME.wallMetalDark);
      grad.addColorStop(0.5, THEME.wallMetal);
      grad.addColorStop(1, THEME.wallMetalDark);
      g.fillStyle = grad;
      g.fillRect(x, 0, 32, side);
    }
    // Rust streaks running down.
    for (let i = 0; i < 26; i += 1) {
      g.fillStyle = THEME.wallMetalDark;
      g.globalAlpha = 0.15 + next() * 0.3;
      const x = next() * side;
      g.fillRect(x, next() * side * 0.4, 3 + next() * 6, 40 + next() * 120);
    }
    g.globalAlpha = 1;
    // Rivets along the ribs.
    g.fillStyle = THEME.wallMetalDark;
    for (let x = 16; x < side; x += 32) {
      for (let y = 16; y < side; y += 64) {
        g.beginPath();
        g.arc(x, y, 3, 0, Math.PI * 2);
        g.fill();
      }
    }
    speckle(g, side, next, 900, THEME.wallMetalDark, 0.7, 2, 0.5);
    // Chipped paint: pale flecks where the coating has flaked off.
    speckle(g, side, next, 260, '#c8b490', 0.8, 2.4, 0.6);
    // Heavy rust bloom near the bottom edge.
    for (let i = 0; i < 10; i += 1) {
      g.fillStyle = '#4a2410';
      g.globalAlpha = 0.2 + next() * 0.25;
      const x = next() * side;
      g.fillRect(x, side - 30 - next() * 60, 4 + next() * 10, 30 + next() * 60);
    }
    g.globalAlpha = 1;
  }, { repeat: [1, 1], seed });
}

// Wooden planks: grain lines, knots, plank seams.
export function woodTexture(seed = 17) {
  return paintCanvas(512, (g, side, next) => {
    g.fillStyle = THEME.wood;
    g.fillRect(0, 0, side, side);
    const plankH = side / 6;
    for (let p = 0; p < 6; p += 1) {
      g.fillStyle = p % 2 ? THEME.wood : THEME.woodDark;
      g.globalAlpha = 0.18;
      g.fillRect(0, p * plankH, side, plankH);
      g.globalAlpha = 1;
      g.strokeStyle = THEME.woodDark;
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(0, p * plankH);
      g.lineTo(side, p * plankH);
      g.stroke();
      // Grain.
      g.strokeStyle = THEME.woodDark;
      g.globalAlpha = 0.35;
      g.lineWidth = 1;
      for (let k = 0; k < 7; k += 1) {
        const y = p * plankH + 6 + next() * (plankH - 12);
        g.beginPath();
        g.moveTo(0, y);
        g.bezierCurveTo(side * 0.3, y + (next() - 0.5) * 8, side * 0.7, y + (next() - 0.5) * 8, side, y);
        g.stroke();
      }
      g.globalAlpha = 1;
      // Knot.
      if (next() < 0.7) {
        g.strokeStyle = THEME.woodDark;
        g.beginPath();
        g.ellipse(next() * side, p * plankH + plankH / 2, 7, 4.5, 0, 0, Math.PI * 2);
        g.stroke();
      }
    }
    speckle(g, side, next, 700, THEME.woodDark, 0.7, 1.8, 0.4);
  }, { repeat: [1, 1], seed });
}

// Crate face: frame + diagonal brace + stencil mark.
export function crateTexture(seed = 19, tint = null) {
  const face = tint || THEME.crateA;
  const dark = THEME.crateB;
  return paintCanvas(256, (g, side, next) => {
    g.fillStyle = face;
    g.fillRect(0, 0, side, side);
    speckle(g, side, next, 500, dark, 0.8, 2, 0.5);
    g.fillStyle = dark;
    g.globalAlpha = 0.85;
    g.fillRect(0, 0, side, 14);
    g.fillRect(0, side - 14, side, 14);
    g.fillRect(0, 0, 14, side);
    g.fillRect(side - 14, 0, 14, side);
    g.save();
    g.translate(side / 2, side / 2);
    g.rotate(Math.PI / 4);
    g.fillRect(-side * 0.62, -7, side * 1.24, 14);
    g.restore();
    g.globalAlpha = 1;
    // Stencil mark.
    g.strokeStyle = THEME.accent;
    g.globalAlpha = 0.85;
    g.lineWidth = 3;
    g.strokeRect(side * 0.32, side * 0.36, side * 0.36, side * 0.28);
    g.beginPath();
    g.moveTo(side * 0.38, side * 0.5);
    g.lineTo(side * 0.62, side * 0.5);
    g.stroke();
    g.globalAlpha = 1;
  }, { repeat: [1, 1], seed });
}

// Building facade: window grid with lit/unlit variation + a twin emissive
// canvas (walls black, windows bright) so lit windows glow at dusk without
// a second mesh. Drawn once per building, so every facade is different.
export function buildingFacadeTexture(seed = 41, {
  floors = 6, cols = 5, litRatio = 0.35, base = '#6a5a52', dark = '#453a34',
  shop = false,
} = {}) {
  const faceCanvas = document.createElement('canvas');
  faceCanvas.width = 256;
  faceCanvas.height = 512;
  const glowCanvas = document.createElement('canvas');
  glowCanvas.width = 256;
  glowCanvas.height = 512;
  const face = faceCanvas.getContext('2d');
  const glow = glowCanvas.getContext('2d');
  const next = mulberry32(seed);
  face.fillStyle = base;
  face.fillRect(0, 0, 256, 512);
  glow.fillStyle = '#000000';
  glow.fillRect(0, 0, 256, 512);
  // Grime + floor bands on the map canvas.
  for (let i = 0; i < 14; i += 1) {
    face.fillStyle = dark;
    face.globalAlpha = 0.08 + next() * 0.12;
    face.fillRect(next() * 256, next() * 512, 30 + next() * 80, 12 + next() * 40);
  }
  face.globalAlpha = 1;
  const storeyH = 512 / floors;
  const bayW = 256 / cols;
  const paneW = bayW * 0.52;
  const paneH = storeyH * 0.52;
  const shopFloors = shop ? 1 : 0;
  void shopFloors;
  for (let f = 0; f < floors; f += 1) {
    const y = f * storeyH;
    face.fillStyle = dark;
    face.globalAlpha = 0.5;
    face.fillRect(0, y, 256, 2);
    face.globalAlpha = 1;
    if (shop && f === floors - 1) {
      // Ground-floor storefront: glass band + sign strip + awning line.
      face.fillStyle = '#1d2c33';
      face.fillRect(8, y + storeyH * 0.32, 240, storeyH * 0.62);
      face.fillStyle = '#ffd27a';
      face.globalAlpha = 0.85;
      for (let x = 24; x < 240; x += 28) face.fillRect(x, y + storeyH * 0.36, 12, storeyH * 0.5);
      face.globalAlpha = 1;
      glow.fillStyle = '#ffca6a';
      glow.fillRect(8, y + storeyH * 0.32, 240, storeyH * 0.62);
      face.fillStyle = THEME.accent;
      face.fillRect(0, y + storeyH * 0.08, 256, storeyH * 0.2);
      continue;
    }
    for (let c = 0; c < cols; c += 1) {
      const x = c * bayW + (bayW - paneW) / 2;
      const wy = y + (storeyH - paneH) / 2;
      const lit = next() < litRatio;
      const warm = next() < 0.7;
      if (lit) {
        face.fillStyle = warm ? '#ffd27a' : '#9fd8ff';
        glow.fillStyle = warm ? '#ffca6a' : '#8fd0ff';
      } else {
        face.fillStyle = '#232a33';
        glow.fillStyle = '#000000';
      }
      face.fillRect(x, wy, paneW, paneH);
      glow.fillRect(x, wy, paneW, paneH);
      // Window frame + mullion cross.
      face.fillStyle = dark;
      face.fillRect(x - 2, wy - 2, paneW + 4, 3);
      face.fillRect(x - 2, wy + paneH - 1, paneW + 4, 3);
      face.fillRect(x + paneW / 2 - 1, wy, 2, paneH);
      // AC unit under some windows.
      if (next() < 0.3) {
        face.fillStyle = '#8a8a82';
        face.fillRect(x + paneW * 0.2, wy + paneH + 3, paneW * 0.6, 7);
        face.fillStyle = dark;
        face.fillRect(x + paneW * 0.2, wy + paneH + 5, paneW * 0.6, 1);
      }
    }
  }
  const map = new THREE.CanvasTexture(faceCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  const emissive = new THREE.CanvasTexture(glowCanvas);
  emissive.colorSpace = THREE.SRGBColorSpace;
  return { map, emissive };
}

// Roll-up warehouse door: horizontal slats + hazard stripe at the base.
export function doorTexture(seed = 53) {
  const next = mulberry32(seed);
  return paintCanvas(256, (g, side) => {
    g.fillStyle = '#5d6066';
    g.fillRect(0, 0, side, side);
    for (let y = 0; y < side; y += 18) {
      g.fillStyle = '#4a4d52';
      g.fillRect(0, y, side, 4);
      g.fillStyle = '#6e7278';
      g.fillRect(0, y + 4, side, 2);
    }
    speckle(g, side, next, 500, '#3a3d42', 0.8, 2, 0.5);
    // Hazard stripe along the bottom.
    for (let i = 0; i < 8; i += 1) {
      g.fillStyle = i % 2 ? '#c8a52a' : '#1c1c1c';
      g.save();
      g.translate(i * 32, side - 22);
      g.rotate(-0.6);
      g.fillRect(-8, 0, 16, 22);
      g.restore();
    }
    // Stencilled depot number.
    g.fillStyle = '#e8e2d4';
    g.font = '700 34px system-ui, sans-serif';
    g.textAlign = 'center';
    g.fillText('DEPOT 7', side / 2, side * 0.42);
  }, { repeat: [1, 1], seed });
}

// Asphalt road strip with a faded dashed centre line (laid as a plane).
export function roadTexture(seed = 61) {
  const next = mulberry32(seed);
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 512;
  const g = canvas.getContext('2d');
  g.fillStyle = '#3a3630';
  g.fillRect(0, 0, 128, 512);
  speckle(g, 128, next, 700, '#2a2723', 0.8, 2.4, 0.6);
  speckle(g, 128, next, 300, '#4a463e', 0.8, 2, 0.5);
  // Edge lines.
  g.fillStyle = '#c8c2ae';
  g.globalAlpha = 0.55;
  g.fillRect(6, 0, 3, 512);
  g.fillRect(119, 0, 3, 512);
  // Faded dashed centre line.
  g.fillStyle = '#c8b45a';
  g.globalAlpha = 0.5;
  for (let y = 0; y < 512; y += 64) g.fillRect(61, y, 6, 34);
  g.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// Shop fascia sign: coloured band + invented shop name (no real brands).
export function shopSignTexture(text, color = '#ffb347') {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const g = canvas.getContext('2d');
  g.fillStyle = '#1c1712';
  g.fillRect(0, 0, 256, 64);
  g.fillStyle = color;
  g.font = '700 34px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 128, 34);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Spray-paint graffiti tag on a transparent canvas (decals on walls).
export function graffitiTexture(seed = 71, hue = '#ff5a4e') {
  const next = mulberry32(seed);
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const g = canvas.getContext('2d');
  g.clearRect(0, 0, 256, 128);
  g.strokeStyle = hue;
  g.globalAlpha = 0.85;
  g.lineWidth = 7;
  g.lineCap = 'round';
  for (let s = 0; s < 3; s += 1) {
    g.beginPath();
    let x = 20 + next() * 30;
    let y = 30 + next() * 60;
    g.moveTo(x, y);
    for (let i = 0; i < 5; i += 1) {
      x += 30 + next() * 40;
      y += (next() - 0.5) * 50;
      g.quadraticCurveTo(x - 15, y + (next() - 0.5) * 40, x, y);
    }
    g.stroke();
  }
  g.fillStyle = '#f2ede4';
  g.globalAlpha = 0.9;
  g.font = '700 26px system-ui, sans-serif';
  g.fillText('EMBER', 30 + next() * 60, 100);
  g.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Diagonal yellow/black hazard stripes.
export function hazardTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const g = canvas.getContext('2d');
  g.fillStyle = '#c8a52a';
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#1c1c1c';
  for (let i = -2; i < 6; i += 1) {
    g.save();
    g.translate(i * 32, 0);
    g.rotate(0.6);
    g.fillRect(-8, -40, 16, 220);
    g.restore();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Small wall poster: coloured header + title lines (invented text only).
export function posterTexture(seed = 83, title = 'EMBERLINE', color = '#e8843c') {
  const next = mulberry32(seed);
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 192;
  const g = canvas.getContext('2d');
  g.fillStyle = '#e8e2d4';
  g.fillRect(0, 0, 128, 192);
  g.fillStyle = color;
  g.fillRect(0, 0, 128, 52);
  g.fillStyle = '#1c1712';
  g.font = '700 17px system-ui, sans-serif';
  g.textAlign = 'center';
  g.fillText(title, 64, 96);
  g.font = '500 12px system-ui, sans-serif';
  g.fillText('RAIL YARD', 64, 118);
  g.fillText('EST. 1987', 64, 136);
  g.strokeStyle = color;
  g.lineWidth = 3;
  g.strokeRect(4, 4, 120, 184);
  speckle(g, 128, next, 120, '#8a8578', 0.8, 2, 0.4);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
