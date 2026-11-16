// Emberline Crossing — procedural canvas textures. No external assets: every
// surface is painted from a seeded generator, so the game loads with zero
// network requests and the same seed always paints the same map.
import * as THREE from 'three';
import { THEME } from './palette.js';

export function mulberry32(initial) {
  let a = initial;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvasTexture(size, painter, { repeat = [1, 1], seed = 1 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  painter(ctx, size, mulberry32(seed));
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat[0], repeat[1]);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function speckle(ctx, size, random, count, color, minR, maxR, alpha = 1) {
  ctx.fillStyle = color;
  ctx.globalAlpha = alpha;
  for (let i = 0; i < count; i += 1) {
    const r = minR + random() * (maxR - minR);
    ctx.beginPath();
    ctx.arc(random() * size, random() * size, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function cracks(ctx, size, random, count, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  for (let i = 0; i < count; i += 1) {
    let x = random() * size;
    let y = random() * size;
    ctx.globalAlpha = 0.25 + random() * 0.35;
    ctx.beginPath();
    ctx.moveTo(x, y);
    const segs = 3 + Math.floor(random() * 4);
    for (let s = 0; s < segs; s += 1) {
      x += (random() - 0.5) * 70;
      y += (random() - 0.5) * 70;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

// Sand / asphalt / moss ground: base colour, darker patches, speckles, cracks.
export function groundTexture(seed = 7) {
  const base = THEME.groundBase;
  const patch = THEME.groundPatch;
  const line = THEME.groundLine;
  const map = canvasTexture(512, (ctx, size, random) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 46; i += 1) {
      ctx.fillStyle = random() < 0.5 ? patch : line;
      ctx.globalAlpha = 0.08 + random() * 0.14;
      const r = 18 + random() * 70;
      ctx.beginPath();
      ctx.ellipse(random() * size, random() * size, r, r * (0.5 + random() * 0.7), random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    speckle(ctx, size, random, 2600, patch, 0.6, 2.4, 0.55);
    speckle(ctx, size, random, 900, line, 0.8, 2.8, 0.5);
    cracks(ctx, size, random, 9, patch);
    // Asphalt repair patches: darker rounded slabs with worn edges.
    for (let i = 0; i < 7; i += 1) {
      ctx.fillStyle = patch;
      ctx.globalAlpha = 0.22 + random() * 0.2;
      const px = random() * size;
      const py = random() * size;
      const pw = 40 + random() * 90;
      const ph = 26 + random() * 60;
      ctx.beginPath();
      ctx.roundRect(px, py, pw, ph, 8);
      ctx.fill();
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = line;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(px, py, pw, ph, 8);
      ctx.stroke();
    }
    // Tire scuff arcs and oil stains.
    for (let i = 0; i < 6; i += 1) {
      ctx.strokeStyle = patch;
      ctx.globalAlpha = 0.18 + random() * 0.2;
      ctx.lineWidth = 5 + random() * 7;
      ctx.beginPath();
      ctx.arc(random() * size, random() * size, 30 + random() * 60, random() * Math.PI, random() * Math.PI + 1.2 + random());
      ctx.stroke();
    }
    for (let i = 0; i < 5; i += 1) {
      ctx.fillStyle = '#1a1512';
      ctx.globalAlpha = 0.25 + random() * 0.25;
      ctx.beginPath();
      ctx.ellipse(random() * size, random() * size, 10 + random() * 26, 7 + random() * 16, random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (THEME.id === 'neon') {
      // Faded lane paint on wet asphalt.
      ctx.fillStyle = '#c8b45a';
      ctx.globalAlpha = 0.28;
      ctx.fillRect(size * 0.48, 0, 5, size);
      ctx.globalAlpha = 1;
      // Puddle sheen: pale soft blobs.
      for (let i = 0; i < 8; i += 1) {
        ctx.fillStyle = '#8fb4d8';
        ctx.globalAlpha = 0.1 + random() * 0.12;
        ctx.beginPath();
        ctx.ellipse(random() * size, random() * size, 22 + random() * 46, 14 + random() * 26, random() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    if (THEME.id === 'mist') {
      // Leaf litter and moss clumps.
      speckle(ctx, size, random, 500, '#3d4a2e', 1, 3, 0.7);
      speckle(ctx, size, random, 300, '#8a7a3a', 0.8, 2, 0.5);
    }
  }, { repeat: [9, 8], seed });
  const bump = canvasTexture(256, (ctx, size, random) => {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, size, size);
    speckle(ctx, size, random, 1800, '#5a5a5a', 1, 3, 0.8);
    speckle(ctx, size, random, 1200, '#a8a8a8', 1, 2.5, 0.8);
  }, { repeat: [9, 8], seed: seed + 31 });
  return { map, bump };
}

// Stained concrete for walls: panel lines, stains, speckle.
export function concreteTexture(seed = 11) {
  return canvasTexture(512, (ctx, size, random) => {
    ctx.fillStyle = THEME.wallConcrete;
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 22; i += 1) {
      ctx.fillStyle = THEME.wallConcreteDark;
      ctx.globalAlpha = 0.06 + random() * 0.12;
      const w = 30 + random() * 90;
      ctx.fillRect(random() * size, random() * size, w, 12 + random() * 40);
    }
    ctx.globalAlpha = 1;
    // Panel seams.
    ctx.strokeStyle = THEME.wallConcreteDark;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 2;
    for (let i = 1; i < 4; i += 1) {
      ctx.beginPath();
      ctx.moveTo(0, (size / 4) * i);
      ctx.lineTo(size, (size / 4) * i);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo((size / 4) * i, 0);
      ctx.lineTo((size / 4) * i, size);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    speckle(ctx, size, random, 1400, THEME.wallConcreteDark, 0.7, 2.2, 0.32);
    cracks(ctx, size, random, 5, THEME.wallConcreteDark);
    // Damp stains bleeding from the top edge + grime at the base.
    for (let i = 0; i < 6; i += 1) {
      const grad = ctx.createLinearGradient(0, 0, 0, 60 + random() * 120);
      grad.addColorStop(0, THEME.wallConcreteDark);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = 0.12 + random() * 0.15;
      ctx.fillStyle = grad;
      const w = 20 + random() * 50;
      ctx.fillRect(random() * size, 0, w, 60 + random() * 120);
    }
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = THEME.wallConcreteDark;
    ctx.fillRect(0, size - 26, size, 26);
    ctx.globalAlpha = 1;
  }, { repeat: [1, 1], seed });
}

// Corrugated metal: vertical ribs, rust streaks, rivets.
export function metalTexture(seed = 13) {
  return canvasTexture(512, (ctx, size, random) => {
    ctx.fillStyle = THEME.wallMetal;
    ctx.fillRect(0, 0, size, size);
    for (let x = 0; x < size; x += 32) {
      const grad = ctx.createLinearGradient(x, 0, x + 32, 0);
      grad.addColorStop(0, THEME.wallMetalDark);
      grad.addColorStop(0.5, THEME.wallMetal);
      grad.addColorStop(1, THEME.wallMetalDark);
      ctx.fillStyle = grad;
      ctx.fillRect(x, 0, 32, size);
    }
    // Rust streaks running down.
    for (let i = 0; i < 26; i += 1) {
      ctx.fillStyle = THEME.wallMetalDark;
      ctx.globalAlpha = 0.15 + random() * 0.3;
      const x = random() * size;
      ctx.fillRect(x, random() * size * 0.4, 3 + random() * 6, 40 + random() * 120);
    }
    ctx.globalAlpha = 1;
    // Rivets along the ribs.
    ctx.fillStyle = THEME.wallMetalDark;
    for (let x = 16; x < size; x += 32) {
      for (let y = 16; y < size; y += 64) {
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    speckle(ctx, size, random, 900, THEME.wallMetalDark, 0.7, 2, 0.5);
    // Chipped paint: pale flecks where the coating has flaked off.
    speckle(ctx, size, random, 260, '#c8b490', 0.8, 2.4, 0.6);
    // Heavy rust bloom near the bottom edge.
    for (let i = 0; i < 10; i += 1) {
      ctx.fillStyle = '#4a2410';
      ctx.globalAlpha = 0.2 + random() * 0.25;
      const x = random() * size;
      ctx.fillRect(x, size - 30 - random() * 60, 4 + random() * 10, 30 + random() * 60);
    }
    ctx.globalAlpha = 1;
  }, { repeat: [1, 1], seed });
}

// Wooden planks: grain lines, knots, plank seams.
export function woodTexture(seed = 17) {
  return canvasTexture(512, (ctx, size, random) => {
    ctx.fillStyle = THEME.wood;
    ctx.fillRect(0, 0, size, size);
    const plankH = size / 6;
    for (let p = 0; p < 6; p += 1) {
      ctx.fillStyle = p % 2 ? THEME.wood : THEME.woodDark;
      ctx.globalAlpha = 0.18;
      ctx.fillRect(0, p * plankH, size, plankH);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = THEME.woodDark;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, p * plankH);
      ctx.lineTo(size, p * plankH);
      ctx.stroke();
      // Grain.
      ctx.strokeStyle = THEME.woodDark;
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 1;
      for (let g = 0; g < 7; g += 1) {
        const y = p * plankH + 6 + random() * (plankH - 12);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.bezierCurveTo(size * 0.3, y + (random() - 0.5) * 8, size * 0.7, y + (random() - 0.5) * 8, size, y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      // Knot.
      if (random() < 0.7) {
        ctx.strokeStyle = THEME.woodDark;
        ctx.beginPath();
        ctx.ellipse(random() * size, p * plankH + plankH / 2, 7, 4.5, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    speckle(ctx, size, random, 700, THEME.woodDark, 0.7, 1.8, 0.4);
  }, { repeat: [1, 1], seed });
}

// Crate face: frame + diagonal brace + stencil mark.
export function crateTexture(seed = 19, tint = null) {
  const face = tint || THEME.crateA;
  const dark = THEME.crateB;
  return canvasTexture(256, (ctx, size, random) => {
    ctx.fillStyle = face;
    ctx.fillRect(0, 0, size, size);
    speckle(ctx, size, random, 500, dark, 0.8, 2, 0.5);
    ctx.fillStyle = dark;
    ctx.globalAlpha = 0.85;
    ctx.fillRect(0, 0, size, 14);
    ctx.fillRect(0, size - 14, size, 14);
    ctx.fillRect(0, 0, 14, size);
    ctx.fillRect(size - 14, 0, 14, size);
    ctx.save();
    ctx.translate(size / 2, size / 2);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-size * 0.62, -7, size * 1.24, 14);
    ctx.restore();
    ctx.globalAlpha = 1;
    // Stencil mark.
    ctx.strokeStyle = THEME.accent;
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = 3;
    ctx.strokeRect(size * 0.32, size * 0.36, size * 0.36, size * 0.28);
    ctx.beginPath();
    ctx.moveTo(size * 0.38, size * 0.5);
    ctx.lineTo(size * 0.62, size * 0.5);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }, { repeat: [1, 1], seed });
}

// Building facade: window grid with lit/unlit variation + a twin emissive
// canvas (walls black, windows bright) so lit windows glow at dusk without
// a second mesh. Drawn once per building, so every facade is different.
export function buildingFacadeTexture(seed = 41, {
  floors = 6, cols = 5, litRatio = 0.35, base = '#6a5a52', dark = '#453a34',
  shop = false,
} = {}) {
  const mapCanvas = document.createElement('canvas');
  mapCanvas.width = 256;
  mapCanvas.height = 512;
  const emCanvas = document.createElement('canvas');
  emCanvas.width = 256;
  emCanvas.height = 512;
  const mapCtx = mapCanvas.getContext('2d');
  const emCtx = emCanvas.getContext('2d');
  const random = mulberry32(seed);
  mapCtx.fillStyle = base;
  mapCtx.fillRect(0, 0, 256, 512);
  emCtx.fillStyle = '#000000';
  emCtx.fillRect(0, 0, 256, 512);
  // Grime + floor bands on the map canvas.
  for (let i = 0; i < 14; i += 1) {
    mapCtx.fillStyle = dark;
    mapCtx.globalAlpha = 0.08 + random() * 0.12;
    mapCtx.fillRect(random() * 256, random() * 512, 30 + random() * 80, 12 + random() * 40);
  }
  mapCtx.globalAlpha = 1;
  const floorH = 512 / floors;
  const colW = 256 / cols;
  const winW = colW * 0.52;
  const winH = floorH * 0.52;
  const shopRows = shop ? 1 : 0;
  for (let f = 0; f < floors; f += 1) {
    const y = f * floorH;
    mapCtx.fillStyle = dark;
    mapCtx.globalAlpha = 0.5;
    mapCtx.fillRect(0, y, 256, 2);
    mapCtx.globalAlpha = 1;
    if (shop && f === floors - 1) {
      // Ground-floor storefront: glass band + sign strip + awning line.
      mapCtx.fillStyle = '#1d2c33';
      mapCtx.fillRect(8, y + floorH * 0.32, 240, floorH * 0.62);
      mapCtx.fillStyle = '#ffd27a';
      mapCtx.globalAlpha = 0.85;
      for (let x = 24; x < 240; x += 28) mapCtx.fillRect(x, y + floorH * 0.36, 12, floorH * 0.5);
      mapCtx.globalAlpha = 1;
      emCtx.fillStyle = '#ffca6a';
      emCtx.fillRect(8, y + floorH * 0.32, 240, floorH * 0.62);
      mapCtx.fillStyle = THEME.accent;
      mapCtx.fillRect(0, y + floorH * 0.08, 256, floorH * 0.2);
      continue;
    }
    for (let c = 0; c < cols; c += 1) {
      const x = c * colW + (colW - winW) / 2;
      const wy = y + (floorH - winH) / 2;
      const lit = random() < litRatio;
      const warm = random() < 0.7;
      if (lit) {
        mapCtx.fillStyle = warm ? '#ffd27a' : '#9fd8ff';
        emCtx.fillStyle = warm ? '#ffca6a' : '#8fd0ff';
      } else {
        mapCtx.fillStyle = '#232a33';
        emCtx.fillStyle = '#000000';
      }
      mapCtx.fillRect(x, wy, winW, winH);
      emCtx.fillRect(x, wy, winW, winH);
      // Window frame + mullion cross.
      mapCtx.fillStyle = dark;
      mapCtx.fillRect(x - 2, wy - 2, winW + 4, 3);
      mapCtx.fillRect(x - 2, wy + winH - 1, winW + 4, 3);
      mapCtx.fillRect(x + winW / 2 - 1, wy, 2, winH);
      // AC unit under some windows.
      if (random() < 0.3) {
        mapCtx.fillStyle = '#8a8a82';
        mapCtx.fillRect(x + winW * 0.2, wy + winH + 3, winW * 0.6, 7);
        mapCtx.fillStyle = dark;
        mapCtx.fillRect(x + winW * 0.2, wy + winH + 5, winW * 0.6, 1);
      }
    }
  }
  const map = new THREE.CanvasTexture(mapCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  const emissive = new THREE.CanvasTexture(emCanvas);
  emissive.colorSpace = THREE.SRGBColorSpace;
  return { map, emissive };
}

// Roll-up warehouse door: horizontal slats + hazard stripe at the base.
export function doorTexture(seed = 53) {
  const random = mulberry32(seed);
  return canvasTexture(256, (ctx, size) => {
    ctx.fillStyle = '#5d6066';
    ctx.fillRect(0, 0, size, size);
    for (let y = 0; y < size; y += 18) {
      ctx.fillStyle = '#4a4d52';
      ctx.fillRect(0, y, size, 4);
      ctx.fillStyle = '#6e7278';
      ctx.fillRect(0, y + 4, size, 2);
    }
    speckle(ctx, size, random, 500, '#3a3d42', 0.8, 2, 0.5);
    // Hazard stripe along the bottom.
    for (let i = 0; i < 8; i += 1) {
      ctx.fillStyle = i % 2 ? '#c8a52a' : '#1c1c1c';
      ctx.save();
      ctx.translate(i * 32, size - 22);
      ctx.rotate(-0.6);
      ctx.fillRect(-8, 0, 16, 22);
      ctx.restore();
    }
    // Stencilled depot number.
    ctx.fillStyle = '#e8e2d4';
    ctx.font = '700 34px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('DEPOT 7', size / 2, size * 0.42);
  }, { repeat: [1, 1], seed });
}

// Asphalt road strip with a faded dashed centre line (laid as a plane).
export function roadTexture(seed = 61) {
  const random = mulberry32(seed);
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#3a3630';
  ctx.fillRect(0, 0, 128, 512);
  speckle(ctx, 128, random, 700, '#2a2723', 0.8, 2.4, 0.6);
  speckle(ctx, 128, random, 300, '#4a463e', 0.8, 2, 0.5);
  // Edge lines.
  ctx.fillStyle = '#c8c2ae';
  ctx.globalAlpha = 0.55;
  ctx.fillRect(6, 0, 3, 512);
  ctx.fillRect(119, 0, 3, 512);
  // Faded dashed centre line.
  ctx.fillStyle = '#c8b45a';
  ctx.globalAlpha = 0.5;
  for (let y = 0; y < 512; y += 64) ctx.fillRect(61, y, 6, 34);
  ctx.globalAlpha = 1;
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
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#1c1712';
  ctx.fillRect(0, 0, 256, 64);
  ctx.fillStyle = color;
  ctx.font = '700 34px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 34);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Spray-paint graffiti tag on a transparent canvas (decals on walls).
export function graffitiTexture(seed = 71, hue = '#ff5a4e') {
  const random = mulberry32(seed);
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 256, 128);
  ctx.strokeStyle = hue;
  ctx.globalAlpha = 0.85;
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  for (let s = 0; s < 3; s += 1) {
    ctx.beginPath();
    let x = 20 + random() * 30;
    let y = 30 + random() * 60;
    ctx.moveTo(x, y);
    for (let i = 0; i < 5; i += 1) {
      x += 30 + random() * 40;
      y += (random() - 0.5) * 50;
      ctx.quadraticCurveTo(x - 15, y + (random() - 0.5) * 40, x, y);
    }
    ctx.stroke();
  }
  ctx.fillStyle = '#f2ede4';
  ctx.globalAlpha = 0.9;
  ctx.font = '700 26px system-ui, sans-serif';
  ctx.fillText('EMBER', 30 + random() * 60, 100);
  ctx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Diagonal yellow/black hazard stripes.
export function hazardTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#c8a52a';
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = '#1c1c1c';
  for (let i = -2; i < 6; i += 1) {
    ctx.save();
    ctx.translate(i * 32, 0);
    ctx.rotate(0.6);
    ctx.fillRect(-8, -40, 16, 220);
    ctx.restore();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Small wall poster: coloured header + title lines (invented text only).
export function posterTexture(seed = 83, title = 'EMBERLINE', color = '#e8843c') {
  const random = mulberry32(seed);
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 192;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#e8e2d4';
  ctx.fillRect(0, 0, 128, 192);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 128, 52);
  ctx.fillStyle = '#1c1712';
  ctx.font = '700 17px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title, 64, 96);
  ctx.font = '500 12px system-ui, sans-serif';
  ctx.fillText('RAIL YARD', 64, 118);
  ctx.fillText('EST. 1987', 64, 136);
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.strokeRect(4, 4, 120, 184);
  speckle(ctx, 128, random, 120, '#8a8578', 0.8, 2, 0.4);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
