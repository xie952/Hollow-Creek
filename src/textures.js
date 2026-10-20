// Procedural textures. Everything is drawn into canvases at boot — no external files.
import * as THREE from 'three';
import {
  createCanvas, makeTexture, normalFromCanvas, roughFromCanvas, setMaxAnisotropy,
  mulberry32, tileFbm, tileNoise, clamp, lerp, TAU,
} from './lib.js';

const cache = new Map();
const memo = (key, fn) => { if (!cache.has(key)) cache.set(key, fn()); return cache.get(key); };
const rgb = (r, g, b) => 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')';
const rgba = (r, g, b, a) => 'rgba(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ',' + a + ')';

export function initTextures(renderer) {
  setMaxAnisotropy(renderer.capabilities.getMaxAnisotropy?.() || 4);
}

export function metered(map, meters) {
  if (!map) return map;
  const key = map.uuid + ':' + meters;
  if (map.userData._metered && map.userData._metered[key]) return map.userData._metered[key];
  const m = map.clone();
  m.wrapS = m.wrapT = THREE.RepeatWrapping;
  m.repeat.set(1 / meters, 1 / meters);
  m.anisotropy = map.anisotropy;
  m.colorSpace = map.colorSpace;
  m.needsUpdate = true;
  map.userData._metered = map.userData._metered || {};
  map.userData._metered[key] = m;
  return m;
}

// ---------------------------------------------------------------- wood siding
export const woodSiding = () => memo('woodSiding', () => {
  const S = 1024;
  const { canvas, ctx } = createCanvas(S);
  const rng = mulberry32(1108);
  const boards = 8, bw = S / boards;
  ctx.fillStyle = '#403126'; ctx.fillRect(0, 0, S, S);

  for (let b = 0; b < boards; b++) {
    const x0 = b * bw;
    const tone = 0.82 + rng() * 0.36;
    const warm = 0.92 + rng() * 0.16;
    const base = [104 * tone * warm, 82 * tone, 61 * tone * 1.95 - 60];
    ctx.fillStyle = rgb(base[0], base[1], base[2]);
    ctx.fillRect(x0 + 1, 0, bw - 2, S);

    // Long vertical grain, broken into drifting fibres.
    for (let i = 0; i < 150; i++) {
      const gx = x0 + 2 + rng() * (bw - 4);
      const dark = rng() < 0.58;
      ctx.strokeStyle = dark
        ? rgba(42, 27, 16, 0.05 + rng() * 0.15)
        : rgba(221, 190, 151, 0.03 + rng() * 0.08);
      ctx.lineWidth = 0.6 + rng() * 2.1;
      ctx.beginPath();
      let px = gx, py = 0;
      ctx.moveTo(px, 0);
      while (py < S) {
        py += 24 + rng() * 80;
        px = gx + Math.sin(py * 0.012 + i * 1.7) * (1 + rng() * 3.4);
        ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    // Saw marks / horizontal checks.
    for (let i = 0; i < 12; i++) {
      const y = rng() * S;
      ctx.strokeStyle = rgba(25, 16, 10, 0.10 + rng() * 0.12);
      ctx.lineWidth = 0.8 + rng() * 1.2;
      ctx.beginPath();
      ctx.moveTo(x0 + 4, y);
      ctx.lineTo(x0 + bw - 4, y + (rng() - 0.5) * 3);
      ctx.stroke();
    }
    // Knots.
    if (rng() < 0.7) {
      const kx = x0 + bw * (0.25 + rng() * 0.5), ky = 80 + rng() * (S - 160);
      const kr = 4 + rng() * 11;
      for (let r = kr; r > 1; r -= 2.1) {
        ctx.beginPath();
        ctx.ellipse(kx, ky, r, r * 1.7, 0.1, 0, Math.PI * 2);
        ctx.strokeStyle = r > kr * 0.5 ? rgba(49, 31, 18, 0.18) : rgba(30, 19, 12, 0.38);
        ctx.lineWidth = 1.1;
        ctx.stroke();
      }
      const grd = ctx.createRadialGradient(kx, ky, 0, kx, ky, kr * 2.2);
      grd.addColorStop(0, 'rgba(48,30,18,0.45)');
      grd.addColorStop(1, 'rgba(48,30,18,0)');
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.ellipse(kx, ky, kr * 2.2, kr * 3.2, 0, 0, Math.PI * 2); ctx.fill();
    }
    // Shadowed board gap and a faint worn highlight.
    ctx.fillStyle = 'rgba(16,10,7,0.82)'; ctx.fillRect(x0, 0, 2.4, S);
    ctx.fillStyle = 'rgba(255,224,182,0.06)'; ctx.fillRect(x0 + 3.5, 0, 1.2, S);
    ctx.fillStyle = 'rgba(20,12,8,0.30)'; ctx.fillRect(x0 + bw - 2, 0, 2, S);
  }

  // Weather staining, slightly green at the bottom.
  for (let i = 0; i < 46; i++) {
    const x = rng() * S, y = rng() * S, r = 30 + rng() * 150;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rng() < 0.6 ? 'rgba(36,40,27,0.06)' : 'rgba(21,14,9,0.08)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  const normalMap = normalFromCanvas(canvas, 1.7, 512);
  const roughnessMap = roughFromCanvas(canvas, 165, 238);
  return { map: makeTexture(canvas), normalMap, roughnessMap };
});

// ---------------------------------------------------------------- structural timber
export const timber = () => memo('timber', () => {
  const S = 512;
  const { canvas, ctx } = createCanvas(S);
  const rng = mulberry32(7741);
  ctx.fillStyle = '#4a3829'; ctx.fillRect(0, 0, S, S);
  const grd = ctx.createLinearGradient(0, 0, S, 0);
  grd.addColorStop(0, 'rgba(24,16,10,0.45)');
  grd.addColorStop(0.28, 'rgba(142,103,70,0.16)');
  grd.addColorStop(0.62, 'rgba(20,13,8,0.3)');
  grd.addColorStop(1, 'rgba(118,87,58,0.1)');
  ctx.fillStyle = grd; ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 460; i++) {
    const gx = rng() * S;
    const dark = rng() < 0.55;
    ctx.strokeStyle = dark ? rgba(20, 13, 8, 0.1 + rng() * 0.18) : rgba(205, 170, 126, 0.03 + rng() * 0.08);
    ctx.lineWidth = 0.7 + rng() * 2;
    ctx.beginPath();
    let px = gx, py = 0;
    ctx.moveTo(px, 0);
    while (py < S) {
      py += 12 + rng() * 42;
      px = gx + Math.sin(py * 0.025 + i) * (1.5 + rng() * 3);
      ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
  for (let i = 0; i < 9; i++) {
    const x = rng() * S, y = rng() * S, w = 2 + rng() * 22;
    ctx.strokeStyle = rgba(13, 8, 5, 0.38);
    ctx.lineWidth = 1 + rng() * 2;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y + 18 + rng() * 200); ctx.stroke();
  }
  return { map: makeTexture(canvas), normalMap: normalFromCanvas(canvas, 1.7, 256) };
});

// ---------------------------------------------------------------- roof shingles
export const roofShingle = () => memo('roofShingle', () => {
  const S = 1024;
  const { canvas, ctx } = createCanvas(S);
  const rng = mulberry32(88031);
  ctx.fillStyle = '#26251f'; ctx.fillRect(0, 0, S, S);
  const rows = 11, rowH = S / rows;

  for (let r = rows - 1; r >= 0; r--) {
    const y = r * rowH;
    let x = -40 + (r % 2) * 45 - rng() * 15;
    while (x < S + 40) {
      const w = 48 + rng() * 50;
      const h = rowH * (0.92 + rng() * 0.24);
      const tone = 0.7 + rng() * 0.52;
      const warm = 0.9 + rng() * 0.2;
      ctx.beginPath();
      const left = x, right = x + w - 3, top = y - 3, bottom = y + h;
      ctx.moveTo(left + 2, top);
      ctx.lineTo(right - 1, top + rng() * 2);
      ctx.lineTo(right - 3 - rng() * 4, bottom - 4);
      ctx.quadraticCurveTo((left + right) / 2, bottom + 3, left + 3 + rng() * 4, bottom - 3);
      ctx.closePath();
      const g = ctx.createLinearGradient(left, top, left, bottom);
      g.addColorStop(0, rgb(101 * tone * warm, 89 * tone, 69 * tone));
      g.addColorStop(0.72, rgb(71 * tone * warm, 62 * tone, 49 * tone));
      g.addColorStop(1, rgb(48 * tone, 43 * tone, 35 * tone));
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = rgba(19, 17, 13, 0.58); ctx.lineWidth = 1.4; ctx.stroke();

      // grain and a shadow gap under the butt
      for (let i = 0; i < 5; i++) {
        ctx.strokeStyle = rng() < 0.5 ? rgba(27, 22, 16, 0.16) : rgba(222, 190, 145, 0.05);
        ctx.lineWidth = 0.7 + rng();
        ctx.beginPath();
        const gy = top + 4 + rng() * (h - 10);
        ctx.moveTo(left + 3, gy);
        ctx.lineTo(right - 3, gy + (rng() - 0.5) * 3);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(8,8,6,0.62)';
      ctx.fillRect(left + 1, bottom - 1.5, w - 3, 2.5);

      // Moss creeping out of the shadowed seams.
      if (rng() < 0.17) {
        const mx = left + 10 + rng() * (w - 20), my = bottom - 2;
        const mr = 3 + rng() * 9;
        const mg = ctx.createRadialGradient(mx, my, 0, mx, my, mr);
        mg.addColorStop(0, 'rgba(84,96,45,0.68)');
        mg.addColorStop(1, 'rgba(84,96,45,0)');
        ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2); ctx.fill();
      }
      x = right;
    }
    // Row shadow.
    ctx.fillStyle = 'rgba(8,8,6,0.36)';
    ctx.fillRect(0, y + rowH - 3, S, 4);
  }

  // Patches of lichen / moss.
  for (let i = 0; i < 34; i++) {
    const x = rng() * S, y = rng() * S, r = 12 + rng() * 70;
    const g = ctx.createRadialGradient(x, y, r * 0.2, x, y, r);
    g.addColorStop(0, 'rgba(85,94,51,' + (0.06 + rng() * 0.16) + ')');
    g.addColorStop(0.7, 'rgba(92,101,56,0.04)');
    g.addColorStop(1, 'rgba(92,101,56,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(x, y, r, r * (0.35 + rng() * 0.55), rng() * 3, 0, Math.PI * 2); ctx.fill();
  }
  const normalMap = normalFromCanvas(canvas, 2.1, 512);
  return { map: makeTexture(canvas), normalMap, roughnessMap: roughFromCanvas(canvas, 190, 245) };
});

// ---------------------------------------------------------------- field stone
export const fieldStone = () => memo('fieldStone', () => {
  const S = 768;
  const { canvas, ctx } = createCanvas(S);
  const rng = mulberry32(40501);
  ctx.fillStyle = '#3a3832'; ctx.fillRect(0, 0, S, S);
  // Mortar grain.
  for (let i = 0; i < 9000; i++) {
    const a = 0.025 + rng() * 0.08;
    ctx.fillStyle = rng() < 0.5 ? rgba(12, 11, 9, a) : rgba(225, 215, 190, a * 0.8);
    ctx.fillRect(rng() * S, rng() * S, 1 + rng() * 3, 1 + rng() * 2);
  }
  const rows = 7, rowH = S / rows;
  for (let r = 0; r < rows; r++) {
    let x = -60 + rng() * 60;
    const y = r * rowH;
    while (x < S + 40) {
      const w = rowH * (0.8 + rng() * 2.15);
      const h = rowH * (0.62 + rng() * 0.24);
      const left = x, right = x + w;
      const top = y + (rowH - h) * rng() * 0.7;
      const baseTone = 0.7 + rng() * 0.45;
      const warm = 0.84 + rng() * 0.3;
      ctx.beginPath();
      ctx.moveTo(left + 4, top + 4);
      const pts = 8;
      for (let i = 1; i <= pts; i++) {
        const t = i / pts;
        const px = left + (right - left) * t;
        const py = top + 4 + Math.sin(t * Math.PI) * (rng() - 0.4) * 5;
        ctx.lineTo(px, py);
      }
      ctx.lineTo(right - 3, top + h - 5);
      ctx.quadraticCurveTo(right - 5, top + h + 2, right - h * 0.24, top + h - 2);
      ctx.lineTo(left + 5, top + h - 3);
      ctx.quadraticCurveTo(left - 1, top + h * 0.55, left + 4, top + 4);
      ctx.closePath();
      const g = ctx.createLinearGradient(left, top, left + w * 0.4, top + h);
      g.addColorStop(0, rgb(130 * baseTone * warm, 128 * baseTone, 115 * baseTone));
      g.addColorStop(0.5, rgb(95 * baseTone * warm, 94 * baseTone, 84 * baseTone));
      g.addColorStop(1, rgb(68 * baseTone * warm, 68 * baseTone, 62 * baseTone));
      ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = 'rgba(26,24,20,0.58)'; ctx.lineWidth = 2; ctx.stroke();

      // pitting and lichen
      for (let i = 0; i < 30; i++) {
        ctx.fillStyle = rng() < 0.5 ? rgba(25, 24, 21, 0.15) : rgba(205, 198, 176, 0.10);
        ctx.beginPath();
        ctx.ellipse(left + 6 + rng() * (w - 12), top + 6 + rng() * (h - 10), 1 + rng() * 3, 0.7 + rng() * 2, rng() * 3, 0, Math.PI * 2);
        ctx.fill();
      }
      if (rng() < 0.42) {
        const cx = left + w * (0.2 + rng() * 0.6), cy = top + h * (0.35 + rng() * 0.45);
        const cr = 4 + rng() * Math.min(26, w * 0.2);
        const lg = ctx.createRadialGradient(cx, cy, 0, cx, cy, cr);
        lg.addColorStop(0, 'rgba(108,119,64,0.32)');
        lg.addColorStop(1, 'rgba(108,119,64,0)');
        ctx.fillStyle = lg; ctx.beginPath(); ctx.arc(cx, cy, cr, 0, Math.PI * 2); ctx.fill();
      }
      x = right - 2 + rng() * 6;
    }
  }
  ctx.fillStyle = 'rgba(18,17,14,0.32)';
  for (let x = 0; x < S; x += 1) if (rng() < 0.08) ctx.fillRect(x, 0, 1, S);
  return { map: makeTexture(canvas), normalMap: normalFromCanvas(canvas, 2.4, 512), roughnessMap: roughFromCanvas(canvas, 170, 250) };
});

// ---------------------------------------------------------------- forest floor
export const forestFloor = () => memo('forestFloor', () => {
  const S = 1024;
  const { canvas, ctx } = createCanvas(S);
  const rng = mulberry32(600613);
  const img = ctx.createImageData(S, S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const n1 = tileFbm(x / 52, y / 52, 20, 4, 5);
      const n2 = tileFbm(x / 9, y / 9, 114, 3, 17);
      const moss = clamp((n1 - 0.42) * 2.2) * 0.7;
      const r = lerp(64, 102, n1) + n2 * 22 + moss * 9;
      const g = lerp(58, 100, n1) + n2 * 20 + moss * 34;
      const b = lerp(43, 68, n1) + n2 * 12 + moss * 12;
      const o = (y * S + x) * 4;
      img.data[o] = r; img.data[o + 1] = g; img.data[o + 2] = b; img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  // Soft moss islands.
  for (let i = 0; i < 48; i++) {
    const x = rng() * S, y = rng() * S, r = 30 + rng() * 150;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(75,92,45,' + (0.12 + rng() * 0.24) + ')');
    g.addColorStop(0.7, 'rgba(66,82,40,0.09)');
    g.addColorStop(1, 'rgba(66,82,40,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(x, y, r, r * (0.45 + rng() * 0.5), rng() * 3, 0, Math.PI * 2); ctx.fill();
  }
  // Needles — the dominant litter in a spruce forest.
  for (let i = 0; i < 4200; i++) {
    const x = rng() * S, y = rng() * S, a = rng() * Math.PI;
    const len = 3 + rng() * 12;
    ctx.strokeStyle = rng() < 0.58
      ? rgba(93 + rng() * 32, 62 + rng() * 26, 33 + rng() * 18, 0.28 + rng() * 0.34)
      : rgba(62 + rng() * 25, 51 + rng() * 20, 35 + rng() * 15, 0.2 + rng() * 0.26);
    ctx.lineWidth = 0.7 + rng() * 1.1;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); ctx.stroke();
  }
  // Broad leaves, twigs, stones.
  for (let i = 0; i < 310; i++) {
    const x = rng() * S, y = rng() * S, a = rng() * Math.PI * 2, r = 3 + rng() * 10;
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    ctx.fillStyle = ['#8b6333', '#a3783e', '#73572d', '#5e4b29', '#a68a53'][Math.floor(rng() * 5)];
    ctx.globalAlpha = 0.22 + rng() * 0.44;
    ctx.beginPath(); ctx.ellipse(0, 0, r, r * (0.38 + rng() * 0.3), 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(38,27,16,0.2)'; ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.moveTo(-r, 0); ctx.lineTo(r, 0); ctx.stroke();
    ctx.restore();
  }
  for (let i = 0; i < 90; i++) {
    const x = rng() * S, y = rng() * S, a = rng() * Math.PI * 2, len = 10 + rng() * 55;
    ctx.strokeStyle = 'rgba(40,28,18,' + (0.3 + rng() * 0.35) + ')';
    ctx.lineWidth = 0.8 + rng() * 2.2;
    ctx.beginPath(); ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + Math.cos(a) * len * 0.5 + (rng() - 0.5) * 16, y + Math.sin(a) * len * 0.5, x + Math.cos(a) * len, y + Math.sin(a) * len);
    ctx.stroke();
  }
  for (let i = 0; i < 140; i++) {
    const x = rng() * S, y = rng() * S, r = 1 + rng() * 5;
    ctx.fillStyle = rgba(95 + rng() * 50, 92 + rng() * 45, 82 + rng() * 36, 0.35 + rng() * 0.4);
    ctx.beginPath(); ctx.ellipse(x, y, r, r * (0.6 + rng() * 0.5), rng() * 3, 0, Math.PI * 2); ctx.fill();
  }
  const normalMap = normalFromCanvas(canvas, 1.7, 512);
  return { map: makeTexture(canvas), normalMap, roughnessMap: roughFromCanvas(canvas, 185, 250) };
});

// ---------------------------------------------------------------- gravel path
export const gravelPath = () => memo('gravelPath', () => {
  const S = 768;
  const { canvas, ctx } = createCanvas(S);
  const rng = mulberry32(22318);
  ctx.fillStyle = '#6a604d'; ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 3800; i++) {
    const x = rng() * S, y = rng() * S, r = 1.2 + rng() * 9;
    const tone = 0.55 + rng() * 0.65;
    const warm = 0.9 + rng() * 0.22;
    ctx.fillStyle = rgba(100 * tone * warm, 95 * tone, 80 * tone, 0.4 + rng() * 0.55);
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * (0.55 + rng() * 0.5), rng() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(31,27,20,0.24)'; ctx.lineWidth = 0.7; ctx.stroke();
  }
  for (let i = 0; i < 100; i++) {
    const x = rng() * S, y = rng() * S, a = rng() * 3.14, len = 8 + rng() * 32;
    ctx.strokeStyle = 'rgba(33,27,17,' + (0.2 + rng() * 0.3) + ')'; ctx.lineWidth = 0.7 + rng() * 1.5;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); ctx.stroke();
  }
  for (let i = 0; i < 70; i++) {
    const x = rng() * S, y = rng() * S, r = 10 + rng() * 45;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(64,74,39,0.16)');
    g.addColorStop(1, 'rgba(64,74,39,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  return { map: makeTexture(canvas), normalMap: normalFromCanvas(canvas, 2.1, 512) };
});

// ---------------------------------------------------------------- bark
export const bark = () => memo('bark', () => {
  const S = 512;
  const { canvas, ctx } = createCanvas(S);
  const rng = mulberry32(31337);
  ctx.fillStyle = '#44382b'; ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 1300; i++) {
    const x = rng() * S;
    const w = 0.8 + rng() * 4.5;
    const dark = rng() < 0.55;
    ctx.strokeStyle = dark ? rgba(25, 18, 12, 0.16 + rng() * 0.34) : rgba(142, 119, 90, 0.05 + rng() * 0.16);
    ctx.lineWidth = w;
    ctx.beginPath();
    let px = x, py = 0;
    ctx.moveTo(px, 0);
    while (py < S) {
      py += 10 + rng() * 32;
      px = x + Math.sin(py * 0.02 + i * 2.3) * (2 + rng() * 5);
      ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
  for (let i = 0; i < 40; i++) {
    const x = rng() * S, y = rng() * S, len = 30 + rng() * 150, a = rng() * 3.14;
    ctx.strokeStyle = 'rgba(16,11,7,0.5)'; ctx.lineWidth = 1.3 + rng() * 2.5;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); ctx.stroke();
  }
  const normalMap = normalFromCanvas(canvas, 3.2, 512);
  return { map: makeTexture(canvas), normalMap };
});

// ---------------------------------------------------------------- birch
export const birchBark = () => memo('birchBark', () => {
  const S = 512;
  const { canvas, ctx } = createCanvas(S);
  const rng = mulberry32(9042);
  ctx.fillStyle = '#c9c1ad'; ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 140; i++) {
    const y = rng() * S, h = 1 + rng() * 6, w = 15 + rng() * 140;
    ctx.fillStyle = 'rgba(54,47,38,' + (0.15 + rng() * 0.55) + ')';
    ctx.beginPath(); ctx.ellipse(rng() * S, y, w * 0.4, h, (rng() - 0.5) * 0.1, 0, Math.PI * 2); ctx.fill();
  }
  for (let i = 0; i < 40; i++) {
    const x = rng() * S, y = rng() * S, h = 30 + rng() * 140;
    ctx.fillStyle = 'rgba(65,56,44,' + (0.08 + rng() * 0.2) + ')';
    ctx.beginPath(); ctx.ellipse(x, y, 3 + rng() * 12, h, 0.1, 0, Math.PI * 2); ctx.fill();
  }
  for (let i = 0; i < 1400; i++) {
    ctx.fillStyle = rng() < 0.45 ? 'rgba(55,47,35,0.12)' : 'rgba(255,251,233,0.16)';
    ctx.fillRect(rng() * S, rng() * S, 1, 1);
  }
  return { map: makeTexture(canvas), normalMap: normalFromCanvas(canvas, 1.6, 256) };
});

// ---------------------------------------------------------------- log end grain
export const logEnd = () => memo('logEnd', () => {
  const S = 256;
  const { canvas, ctx } = createCanvas(S);
  const rng = mulberry32(9182);
  ctx.fillStyle = '#8b6b45'; ctx.fillRect(0, 0, S, S);
  const cx = S * 0.52, cy = S * 0.48;
  for (let r = S * 0.46; r > 4; r -= 2 + rng() * 4) {
    ctx.strokeStyle = rng() < 0.55 ? 'rgba(67,43,25,0.35)' : 'rgba(206,169,119,0.20)';
    ctx.lineWidth = 0.8 + rng() * 2.5;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  }
  for (let i = 0; i < 6; i++) {
    const a = rng() * Math.PI * 2;
    ctx.strokeStyle = 'rgba(48,28,15,0.5)'; ctx.lineWidth = 1.2 + rng() * 2;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * S * 0.45, cy + Math.sin(a) * S * 0.45); ctx.stroke();
  }
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, S * 0.46);
  g.addColorStop(0, 'rgba(255,220,164,0.12)'); g.addColorStop(0.7, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(20,13,8,0.3)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  return { map: makeTexture(canvas), normalMap: normalFromCanvas(canvas, 1.2, 256) };
});

// ---------------------------------------------------------------- pine spray (alpha)
export const pineSpray = () => memo('pineSpray', () => {
  const S = 512;
  const { canvas, ctx } = createCanvas(S);
  const rng = mulberry32(12002);
  ctx.clearRect(0, 0, S, S);
  const branches = 7;
  for (let b = 0; b < branches; b++) {
    const originX = S * (0.06 + b * 0.02);
    const originY = S * (0.2 + (b / branches) * 0.62);
    const endX = S * (0.72 + rng() * 0.24);
    const endY = originY + (rng() - 0.5) * S * 0.35;
    const cpX = S * (0.35 + rng() * 0.2), cpY = originY + (rng() - 0.5) * S * 0.2;
    ctx.strokeStyle = 'rgba(62,43,26,0.72)';
    ctx.lineWidth = 2 + rng() * 3;
    ctx.beginPath(); ctx.moveTo(originX, originY);
    ctx.quadraticCurveTo(cpX, cpY, endX, endY); ctx.stroke();
    // needles along the twig
    const needleCount = 90 + Math.floor(rng() * 50);
    for (let i = 0; i < needleCount; i++) {
      const t = 0.14 + rng() * 0.84;
      const mt = 1 - t;
      const bx = mt * mt * originX + 2 * mt * t * cpX + t * t * endX;
      const by = mt * mt * originY + 2 * mt * t * cpY + t * t * endY;
      const side = rng() < 0.5 ? 1 : -1;
      const len = (14 + rng() * 26) * (1.05 - t * 0.55);
      const a = Math.atan2(endY - originY, endX - originX) + side * (0.55 + rng() * 0.55);
      const px = bx + Math.cos(a) * len, py = by + Math.sin(a) * len;
      ctx.strokeStyle = ['rgba(48,68,43,0.9)', 'rgba(62,84,50,0.9)', 'rgba(82,101,59,0.82)', 'rgba(40,57,36,0.9)'][Math.floor(rng() * 4)];
      ctx.lineWidth = 0.8 + rng() * 1.5;
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo(bx + Math.cos(a) * len * 0.55, by + Math.sin(a) * len * 0.55 + 2, px, py); ctx.stroke();
    }
    // little clusters / tip growth
    for (let i = 0; i < 25; i++) {
      const t = 0.2 + rng() * 0.8;
      const mt = 1 - t;
      const bx = mt * mt * originX + 2 * mt * t * cpX + t * t * endX;
      const by = mt * mt * originY + 2 * mt * t * cpY + t * t * endY;
      const r = 2 + rng() * 6;
      ctx.fillStyle = rng() < 0.5 ? 'rgba(58,82,45,0.5)' : 'rgba(87,107,60,0.36)';
      ctx.beginPath(); ctx.ellipse(bx + (rng() - 0.5) * 24, by + (rng() - 0.5) * 24, r, r * 0.7, rng() * 3, 0, Math.PI * 2); ctx.fill();
    }
  }
  // faint frosty rim
  ctx.globalCompositeOperation = 'source-atop';
  const g = ctx.createLinearGradient(0, 0, S, S);
  g.addColorStop(0, 'rgba(218,230,194,0.12)');
  g.addColorStop(0.5, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  ctx.globalCompositeOperation = 'source-over';
  const t = makeTexture(canvas, { clamp: true });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
});

// ---------------------------------------------------------------- larch / golden spray
export const larchSpray = () => memo('larchSpray', () => {
  const S = 512;
  const { canvas, ctx } = createCanvas(S);
  const rng = mulberry32(8117);
  ctx.clearRect(0, 0, S, S);
  for (let b = 0; b < 8; b++) {
    const ox = S * 0.05, oy = S * (0.16 + b * 0.09);
    const ex = S * (0.7 + rng() * 0.27), ey = oy + (rng() - 0.5) * S * 0.3;
    ctx.strokeStyle = 'rgba(77,51,25,0.7)'; ctx.lineWidth = 2 + rng() * 2;
    ctx.beginPath(); ctx.moveTo(ox, oy); ctx.quadraticCurveTo(S * 0.38, oy - 10, ex, ey); ctx.stroke();
    for (let i = 0; i < 80; i++) {
      const t = 0.15 + rng() * 0.8;
      const bx = ox + (ex - ox) * t, by = oy + (ey - oy) * t + Math.sin(t * 3.14) * 8;
      const a = (rng() - 0.5) * 2.3;
      const len = (9 + rng() * 20) * (1 - t * 0.4);
      ctx.strokeStyle = ['rgba(140,107,44,0.88)', 'rgba(177,139,53,0.82)', 'rgba(106,83,36,0.85)', 'rgba(198,161,73,0.7)'][Math.floor(rng() * 4)];
      ctx.lineWidth = 0.8 + rng() * 1.4;
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + Math.cos(a) * len, by + Math.sin(a) * len); ctx.stroke();
    }
  }
  const t = makeTexture(canvas, { clamp: true });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
});

// ---------------------------------------------------------------- broadleaf spray
export const leafSpray = (warm = false) => memo('leafSpray' + (warm ? 'warm' : ''), () => {
  const S = 512;
  const { canvas, ctx } = createCanvas(S);
  const rng = mulberry32(warm ? 7351 : 4207);
  ctx.clearRect(0, 0, S, S);
  // A loose cluster of small leaves that fills a rounded canopy shape.
  const palettes = warm
    ? ['#8e8137', '#b39a46', '#6f6c35', '#c1a955', '#5f6331', '#9b8233']
    : ['#405a33', '#536c3b', '#617a43', '#344a2b', '#73864a', '#4a6236', '#869656'];
  for (let i = 0; i < 260; i++) {
    const a = rng() * Math.PI * 2;
    const rr = Math.sqrt(rng()) * S * 0.43;
    const x = S * 0.5 + Math.cos(a) * rr * 1.12;
    const y = S * 0.52 + Math.sin(a) * rr * 0.78;
    const angle = rng() * Math.PI * 2;
    const l = 7 + rng() * 15;
    const w = l * (0.35 + rng() * 0.32);
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
    ctx.fillStyle = palettes[Math.floor(rng() * palettes.length)];
    ctx.globalAlpha = 0.66 + rng() * 0.34;
    ctx.beginPath(); ctx.ellipse(0, 0, l, w, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(30,36,22,0.22)'; ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.moveTo(-l, 0); ctx.lineTo(l, 0); ctx.stroke();
    ctx.restore();
  }
  // woody twigs
  for (let i = 0; i < 18; i++) {
    const x = rng() * S, y = rng() * S;
    ctx.strokeStyle = 'rgba(62,48,30,0.5)'; ctx.lineWidth = 1 + rng() * 2;
    ctx.beginPath(); ctx.moveTo(x, S * 0.95); ctx.quadraticCurveTo(x + (rng() - 0.5) * 150, y, x + (rng() - 0.5) * 200, rng() * S); ctx.stroke();
  }
  const t = makeTexture(canvas, { clamp: true });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
});

// ---------------------------------------------------------------- fern frond
export const fernFrond = () => memo('fernFrond', () => {
  const S = 512;
  const { canvas, ctx } = createCanvas(S);
  const rng = mulberry32(3307);
  ctx.clearRect(0, 0, S, S);
  const baseX = S * 0.5, baseY = S * 0.98;
  const tipX = S * (0.35 + rng() * 0.3), tipY = S * 0.04;
  const cpX = S * (0.25 + rng() * 0.5), cpY = S * 0.52;
  ctx.strokeStyle = 'rgba(73,86,42,0.86)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(baseX, baseY); ctx.quadraticCurveTo(cpX, cpY, tipX, tipY); ctx.stroke();
  const leaflets = 40;
  for (let i = 0; i < leaflets; i++) {
    const t = 0.07 + (i / leaflets) * 0.9;
    const mt = 1 - t;
    const x = mt * mt * baseX + 2 * mt * t * cpX + t * t * tipX;
    const y = mt * mt * baseY + 2 * mt * t * cpY + t * t * tipY;
    const len = (S * 0.22) * Math.sin(t * Math.PI) * (0.55 + rng() * 0.55);
    for (const side of [-1, 1]) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(side * (0.95 + rng() * 0.2));
      ctx.fillStyle = ['#4d663c', '#5c7444', '#3e5533', '#69804c'][Math.floor(rng() * 4)];
      ctx.globalAlpha = 0.78 + rng() * 0.2;
      // serrated leaflet as overlapping slivers
      for (let k = 0; k < 4; k++) {
        const r = len * (1 - k * 0.2);
        ctx.beginPath();
        ctx.ellipse(0, -k * (r * 0.18), r * 0.22, r * 0.52, 0.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }
  const t = makeTexture(canvas, { clamp: true });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
});

// ---------------------------------------------------------------- grass tuft
export const grassTuft = (warm = false) => memo('grassTuft' + (warm ? 'warm' : ''), () => {
  const S = 256;
  const { canvas, ctx } = createCanvas(S);
  const rng = mulberry32(warm ? 445 : 1004);
  ctx.clearRect(0, 0, S, S);
  for (let i = 0; i < 24; i++) {
    const x0 = S * (0.24 + rng() * 0.52);
    const h = S * (0.28 + rng() * 0.64);
    const lean = (rng() - 0.5) * S * 0.45;
    const w = 1.4 + rng() * 3.8;
    ctx.fillStyle = warm
      ? ['#7d793e', '#96914d', '#62632f', '#a39c58'][Math.floor(rng() * 4)]
      : ['#53613a', '#677844', '#43522f', '#7d8c52', '#596b3d'][Math.floor(rng() * 5)];
    ctx.globalAlpha = 0.7 + rng() * 0.3;
    ctx.beginPath();
    ctx.moveTo(x0 - w, S);
    ctx.quadraticCurveTo(x0 + lean * 0.2, S - h * 0.52, x0 + lean, S - h);
    ctx.quadraticCurveTo(x0 + lean * 0.2 + w, S - h * 0.52, x0 + w, S);
    ctx.closePath(); ctx.fill();
  }
  // a couple of seed heads
  for (let i = 0; i < 3; i++) {
    const x = S * (0.3 + rng() * 0.4), y = S * (0.1 + rng() * 0.2);
    ctx.strokeStyle = 'rgba(143,129,79,0.8)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, S); ctx.lineTo(x + (rng() - 0.5) * 14, y); ctx.stroke();
    for (let k = 0; k < 8; k++) {
      ctx.fillStyle = 'rgba(171,151,91,0.7)';
      ctx.beginPath(); ctx.ellipse(x + (rng() - 0.5) * 14, y + rng() * 30, 1.2, 3.6, rng() * 3, 0, Math.PI * 2); ctx.fill();
    }
  }
  const t = makeTexture(canvas, { clamp: true });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
});

// ---------------------------------------------------------------- wildflower card
export const wildflower = (warm = false) => memo('wildflower' + (warm ? 'warm' : ''), () => {
  const S = 256;
  const { canvas, ctx } = createCanvas(S);
  const rng = mulberry32(warm ? 209 : 44);
  ctx.clearRect(0, 0, S, S);
  for (let i = 0; i < 9; i++) {
    const x = S * (0.18 + rng() * 0.64);
    const top = S * (0.15 + rng() * 0.35);
    ctx.strokeStyle = 'rgba(74,90,45,0.9)'; ctx.lineWidth = 1.2 + rng();
    ctx.beginPath(); ctx.moveTo(x, S); ctx.quadraticCurveTo(x + (rng() - 0.5) * 20, S * 0.6, x + (rng() - 0.5) * 26, top); ctx.stroke();
    const fy = top;
    const col = warm ? ['#d4bd75', '#c6a959', '#e2cd8b'] : ['#ded9c5', '#c9c6b4', '#e9e4d2'];
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      ctx.fillStyle = col[Math.floor(rng() * col.length)];
      ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * 4, fy + Math.sin(a) * 4, 4.5, 2.6, a, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = warm ? 'rgba(129,95,39,0.9)' : 'rgba(147,138,101,0.9)';
    ctx.beginPath(); ctx.arc(x, fy, 2.4, 0, Math.PI * 2); ctx.fill();
  }
  const t = makeTexture(canvas, { clamp: true });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
});

// ---------------------------------------------------------------- warm window
export const windowGlow = (variant = 0) => memo('windowGlow' + variant, () => {
  const S = 512;
  const { canvas, ctx } = createCanvas(S);
  const rng = mulberry32(1300 + variant * 11);
  const g = ctx.createLinearGradient(0, 0, 0, S);
  g.addColorStop(0, '#4b3422'); g.addColorStop(0.35, '#9b6030');
  g.addColorStop(0.62, '#e0904a'); g.addColorStop(0.82, '#f2ad63'); g.addColorStop(1, '#a95f2f');
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);

  // A warm pool of light and a lamp.
  const lg = ctx.createRadialGradient(S * (0.62 + rng() * 0.12), S * 0.5, 0, S * 0.62, S * 0.5, S * 0.62);
  lg.addColorStop(0, 'rgba(255,223,158,0.95)');
  lg.addColorStop(0.35, 'rgba(255,174,92,0.8)');
  lg.addColorStop(1, 'rgba(118,63,28,0)');
  ctx.fillStyle = lg; ctx.fillRect(0, 0, S, S);

  // Dark interior furniture silhouettes.
  ctx.fillStyle = 'rgba(34,23,16,0.62)';
  ctx.fillRect(0, S * 0.62, S * 0.34, S * 0.38);
  ctx.fillRect(S * 0.7, S * 0.7, S * 0.3, S * 0.3);
  ctx.beginPath(); ctx.ellipse(S * 0.28, S * 0.52, S * 0.12, S * 0.2, 0.12, 0, Math.PI * 2); ctx.fill(); // plant
  for (let i = 0; i < 9; i++) {
    ctx.strokeStyle = 'rgba(29,42,22,0.56)'; ctx.lineWidth = 3 + rng() * 3;
    ctx.beginPath();
    const sx = S * 0.28, sy = S * 0.55;
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo(sx + (rng() - 0.5) * 60, sy - S * 0.12, sx + (rng() - 0.5) * 100, sy - S * (0.2 + rng() * 0.12));
    ctx.stroke();
  }
  // Curtains at both edges with folds.
  for (const side of [0, 1]) {
    const x0 = side === 0 ? 0 : S * 0.76;
    const w = S * 0.24;
    const grad = ctx.createLinearGradient(x0, 0, x0 + w, 0);
    grad.addColorStop(0, 'rgba(58,37,24,0.96)');
    grad.addColorStop(0.3, '#d8b78b');
    grad.addColorStop(0.5, '#a77b51');
    grad.addColorStop(0.72, '#e2c69e');
    grad.addColorStop(1, 'rgba(48,31,21,0.94)');
    ctx.fillStyle = grad;
    ctx.fillRect(x0, 0, w, S);
    for (let i = 0; i < 6; i++) {
      const x = x0 + 8 + rng() * (w - 16);
      ctx.strokeStyle = 'rgba(59,38,24,0.24)'; ctx.lineWidth = 1 + rng() * 3;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.quadraticCurveTo(x + 6, S * 0.5, x, S); ctx.stroke();
    }
  }
  // vignette / inner shadow around the edges
  const vg = ctx.createRadialGradient(S * 0.5, S * 0.5, S * 0.18, S * 0.5, S * 0.5, S * 0.72);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(17,11,8,0.7)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, S, S);
  // tiny warm dust specks
  for (let i = 0; i < 60; i++) {
    ctx.fillStyle = 'rgba(255,229,175,' + (0.1 + rng() * 0.35) + ')';
    ctx.fillRect(rng() * S, rng() * S, 1 + rng() * 2, 1 + rng() * 2);
  }
  const tex = makeTexture(canvas, { clamp: true });
  return tex;
});

// ---------------------------------------------------------------- smoke puff
export const smokePuff = () => memo('smokePuff', () => {
  const S = 256;
  const { canvas, ctx } = createCanvas(S);
  const img = ctx.createImageData(S, S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = (x - S / 2) / (S / 2), dy = (y - S / 2) / (S / 2);
      const r = Math.hypot(dx, dy);
      const n = tileFbm(x / 22, y / 22, 16, 4, 4);
      const a = clamp((1 - r) * 1.35) * (0.35 + n * 0.9);
      const o = (y * S + x) * 4;
      img.data[o] = img.data[o + 1] = img.data[o + 2] = 180 + n * 55;
      img.data[o + 3] = clamp(a * 0.7) * 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = makeTexture(canvas, { clamp: true });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
});

// ---------------------------------------------------------------- soft round sprite
export const softDot = () => memo('softDot', () => {
  const S = 128;
  const { canvas, ctx } = createCanvas(S);
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.2, 'rgba(255,255,255,0.85)');
  g.addColorStop(0.55, 'rgba(255,255,255,0.22)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  const t = makeTexture(canvas, { clamp: true });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
});


// ---------------------------------------------------------------- distant fir silhouette
export const firSilhouette = () => memo('firSilhouette', () => {
  const W = 512, H = 1024;
  const { canvas, ctx } = createCanvas(W, H);
  const rng = mulberry32(60411);
  ctx.clearRect(0, 0, W, H);
  const cx = W * 0.5;

  // A conifer wall card must survive mipmapping as ONE solid silhouette.
  // Thin branch strokes used to average down to a bright vertical spine
  // (the "telephone pole" artifact), so the crown is now a filled jagged
  // polygon with soft interior shading instead.
  const steps = 132;
  const left = [], right = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const y = H * (0.035 + 0.945 * t);
    const base = W * (0.012 + 0.492 * Math.pow(t, 1.03));
    const notch = 0.78 + 0.22 * Math.sin(i * 2.4 + rng() * 0.3);
    const spike = i % 4 === 0 ? 0.86 + rng() * 0.22 : 0.94 + rng() * 0.12;
    const w = base * notch * spike;
    left.push([cx - w, y + (rng() - 0.5) * 4]);
    right.push([cx + w, y + (rng() - 0.5) * 4]);
  }

  const crown = new Path2D();
  crown.moveTo(cx, H * 0.03);
  for (const [x, y] of left) crown.lineTo(x, y);
  crown.lineTo(cx - W * 0.012, H * 0.992);
  crown.lineTo(cx + W * 0.012, H * 0.992);
  for (let i = right.length - 1; i >= 0; i--) crown.lineTo(right[i][0], right[i][1]);
  crown.closePath();

  const fill = ctx.createLinearGradient(0, 0, 0, H);
  fill.addColorStop(0, 'rgba(238,246,226,0.96)');
  fill.addColorStop(0.55, 'rgba(244,249,234,0.99)');
  fill.addColorStop(1, 'rgba(226,235,214,0.96)');
  ctx.fillStyle = fill;
  ctx.fill(crown);

  // Interior branch rhythm, clipped to the crown: visible up close, harmless far away.
  ctx.save();
  ctx.clip(crown);
  for (let i = 0; i < 26; i++) {
    const t = i / 25;
    const y = H * (0.08 + 0.82 * t);
    const half = W * (0.04 + 0.46 * Math.pow(t, 1.06));
    ctx.strokeStyle = i % 2 ? 'rgba(196,210,182,0.20)' : 'rgba(255,255,244,0.22)';
    ctx.lineWidth = 2 + (1 - t) * 5;
    ctx.beginPath();
    ctx.moveTo(cx, y - 8);
    ctx.quadraticCurveTo(cx + half * 0.5, y - 8 - (1 - t) * 18, cx + half, y + 10);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx, y - 8);
    ctx.quadraticCurveTo(cx - half * 0.5, y - 8 - (1 - t) * 18, cx - half, y + 10);
    ctx.stroke();
  }
  // Sun-side rim on the right edge.
  const rim = ctx.createLinearGradient(cx, 0, W, 0);
  rim.addColorStop(0.55, 'rgba(255,255,255,0)');
  rim.addColorStop(1, 'rgba(255,246,229,0.55)');
  ctx.strokeStyle = rim;
  ctx.lineWidth = 9;
  ctx.stroke(crown);
  ctx.restore();

  const t = makeTexture(canvas, { clamp: true });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
});
// ---------------------------------------------------------------- ground shadow decal
export const contactShadow = () => memo('contactShadow', () => {
  const S = 256;
  const { canvas, ctx } = createCanvas(S);
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(0,0,0,0.62)');
  g.addColorStop(0.42, 'rgba(0,0,0,0.34)');
  g.addColorStop(0.78, 'rgba(0,0,0,0.08)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  const t = makeTexture(canvas, { clamp: true });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
});

// ---------------------------------------------------------------- moss carpet
export const mossCarpet = () => memo('mossCarpet', () => {
  const S = 512;
  const { canvas, ctx } = createCanvas(S);
  const rng = mulberry32(771);
  ctx.fillStyle = '#4c5b36'; ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 6000; i++) {
    const x = rng() * S, y = rng() * S;
    ctx.fillStyle = rng() < 0.5 ? rgba(72, 91, 50, 0.5) : rgba(96, 112, 63, 0.35);
    ctx.fillRect(x, y, 1 + rng() * 2, 1 + rng() * 2);
  }
  for (let i = 0; i < 80; i++) {
    const x = rng() * S, y = rng() * S, r = 10 + rng() * 50;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(90,111,58,0.35)'); g.addColorStop(1, 'rgba(90,111,58,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  return { map: makeTexture(canvas), normalMap: normalFromCanvas(canvas, 2.0, 256) };
});

// A 360-degree painted forest wall for the far distance. Individual billboard
// conifers read as cut-out cones at 30 m+; a layered silhouette panorama holds
// together as one soft mass and lets the 3D trees own the near and middle ground.
export const forestBackdrop = () => memo('forestBackdrop', () => {
  const W = 3072, H = 768;
  const RADIUS = 44, HEIGHT = 44, BOTTOM = -5;
  const pxX = W / (TAU * RADIUS);
  const pxY = H / HEIGHT;
  const { canvas, ctx } = createCanvas(W, H);
  const rng = mulberry32(90210);
  ctx.clearRect(0, 0, W, H);

  const baseY = (m) => H - ((m - BOTTOM) / HEIGHT) * H;
  const drawConifer = (x, base, hM, wM, color, alpha, seed) => {
    const h = hM * pxY, w = wM * pxX;
    const top = base - h;
    const tiers = 20;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, top);
    for (let i = 1; i <= tiers; i++) {
      const t = i / tiers;
      const y = top + h * Math.pow(t, 0.9);
      const half = w * 0.5 * Math.pow(t, 0.74) *
        (0.66 + 0.34 * Math.abs(Math.sin(seed * 2.7 + i * 1.93)));
      ctx.lineTo(x + half, y - h * 0.006);
      ctx.lineTo(x + half * 0.52, y + h * 0.02);
    }
    ctx.lineTo(x + w * 0.035, base);
    for (let i = tiers; i >= 1; i--) {
      const t = i / tiers;
      const y = top + h * Math.pow(t, 0.9);
      const half = w * 0.5 * Math.pow(t, 0.74) *
        (0.66 + 0.34 * Math.abs(Math.sin(seed * 2.7 + i * 1.93 + 1.7)));
      ctx.lineTo(x - half * 0.52, y + h * 0.02);
      ctx.lineTo(x - half, y - h * 0.006);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };

  const drawBroadleaf = (x, base, hM, wM, color, alpha, seed) => {
    const h = hM * pxY, w = wM * pxX;
    const top = base - h;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.fillRect(x - w * 0.035, top + h * 0.32, w * 0.07, h * 0.7);
    for (let i = 0; i < 7; i++) {
      const bx = x + (rng() - 0.5) * w * 0.9;
      const by = top + h * (0.18 + rng() * 0.46);
      const rx = w * (0.22 + rng() * 0.24);
      const ry = h * (0.1 + rng() * 0.14);
      ctx.beginPath();
      ctx.ellipse(bx, by, rx, ry, (rng() - 0.5) * 0.6, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  };

  const layers = [
    { n: 112, h: [9, 17], w: [3.8, 7.2], color: 'rgb(30,39,32)', alpha: 0.56, base: [-0.4, 1.2] },
    { n: 72, h: [8, 15], w: [3.6, 7], color: 'rgb(25,34,27)', alpha: 0.74, base: [-0.8, 0.8] },
    { n: 42, h: [7, 13], w: [3.4, 6.5], color: 'rgb(19,27,21)', alpha: 0.92, base: [-1.1, 0.5] },
  ];

  const emit = (fn) => {
    for (const dx of [-W, 0, W]) fn(dx);
  };

  for (const L of layers) {
    for (let i = 0; i < L.n; i++) {
      const x = rng() * W;
      const base = baseY(L.base[0] + rng() * (L.base[1] - L.base[0]));
      const hM = L.h[0] + rng() * (L.h[1] - L.h[0]);
      const wM = L.w[0] + rng() * (L.w[1] - L.w[0]);
      const roll = rng();
      const seed = rng() * 100;
      emit((dx) => {
        if (roll < 0.16) drawBroadleaf(x + dx, base, hM, wM, L.color, L.alpha, seed);
        else drawConifer(x + dx, base, hM, wM, L.color, L.alpha, seed);
      });
    }
  }

  // Tint the lower trunks into the same haze the fog will add at runtime.
  ctx.globalCompositeOperation = 'source-atop';
  const haze = ctx.createLinearGradient(0, H, 0, H - 230);
  haze.addColorStop(0, 'rgba(101,96,80,0.6)');
  haze.addColorStop(1, 'rgba(101,96,80,0)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'source-over';

  const tex = makeTexture(canvas, { clamp: false });
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
});

// ---------------------------------------------------------------- window frame shapes / decal
export const grainDark = () => memo('grainDark', () => {
  const S = 256;
  const { canvas, ctx } = createCanvas(S);
  const rng = mulberry32(1551);
  ctx.fillStyle = '#30271e'; ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 300; i++) {
    ctx.strokeStyle = rng() < 0.65 ? 'rgba(12,9,6,0.24)' : 'rgba(135,107,76,0.12)';
    ctx.lineWidth = 0.7 + rng() * 2;
    const y = rng() * S;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.bezierCurveTo(S * 0.3, y + 4, S * 0.7, y - 4, S, y); ctx.stroke();
  }
  return makeTexture(canvas);
});
