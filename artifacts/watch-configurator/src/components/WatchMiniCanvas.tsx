import React, { useRef, useState, useEffect, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, Html } from '@react-three/drei';
import * as THREE from 'three';
import WatchSVG from './WatchSVG';

// At most 8 simultaneous WebGL contexts (browsers cap ~16; these are low-power).
// Contexts are acquired when a card scrolls into view and released when it
// scrolls out, so any card on screen at any time will have a live render.
let _activeContexts = 0;
const MAX_CONTEXTS = 8;

function checkWebGL(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl') || (c as any).getContext('experimental-webgl'));
  } catch {
    return false;
  }
}
const WEB_GL_OK = checkWebGL();

function buildShape(geom: string): THREE.Shape {
  const s = new THREE.Shape();
  if (geom === 'circle') {
    s.absarc(0, 0, 1.5, 0, Math.PI * 2, false);
  } else if (geom === 'square') {
    const r = 0.28, w = 1.28;
    s.moveTo(-w + r, -w); s.lineTo(w - r, -w); s.quadraticCurveTo(w, -w, w, -w + r);
    s.lineTo(w, w - r); s.quadraticCurveTo(w, w, w - r, w); s.lineTo(-w + r, w);
    s.quadraticCurveTo(-w, w, -w, w - r); s.lineTo(-w, -w + r); s.quadraticCurveTo(-w, -w, -w + r, -w);
  } else {
    const r = 0.65, w = 1.1;
    s.moveTo(-w + r, -w); s.lineTo(w - r, -w); s.quadraticCurveTo(w, -w, w, -w + r);
    s.lineTo(w, w - r); s.quadraticCurveTo(w, w, w - r, w); s.lineTo(-w + r, w);
    s.quadraticCurveTo(-w, w, -w, w - r); s.lineTo(-w, -w + r); s.quadraticCurveTo(-w, -w, -w + r, -w);
  }
  return s;
}

// ── Lightweight canvas texture for mini watch face ────────────────────────
// Mirrors the circular/center text approach from buildFaceTexture in WatchModel
// but at 256px with no emboss (mini cards don't need bump maps).

function drawEyesOnTexture(ctx: CanvasRenderingContext2D, S: number, eyeType: string) {
  const cx = S / 2, cy = S / 2;
  switch (eyeType) {
    case 'spider': {
      const es = 14, ps = 7;
      const r = S * 0.32;
      const positions: [number, number][] = [
        [-r * 0.45, -r * 0.2], [r * 0.45, -r * 0.2],
        [-r * 0.15, -r * 0.42], [r * 0.15, -r * 0.42],
        [-r * 0.55, r * 0.1],  [r * 0.55, r * 0.1],
        [-r * 0.2,  r * 0.3],  [r * 0.2,  r * 0.3],
      ];
      positions.forEach(([ox, oy]) => {
        ctx.beginPath(); ctx.arc(cx + ox, cy + oy, es, 0, Math.PI * 2);
        ctx.fillStyle = '#0a1a0a'; ctx.fill();
        ctx.strokeStyle = '#4ade80'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.beginPath(); ctx.arc(cx + ox, cy + oy, ps, 0, Math.PI * 2);
        ctx.fillStyle = '#4ade80'; ctx.globalAlpha = 0.9; ctx.fill(); ctx.globalAlpha = 1;
        ctx.beginPath(); ctx.arc(cx + ox - ps * 0.3, cy + oy - ps * 0.3, ps * 0.35, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fill();
      });
      break;
    }
    case 'squid': {
      const er = 38, prW = 8, prH = 26;
      ctx.beginPath(); ctx.ellipse(cx, cy, er, er * 0.75, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#001a2e'; ctx.fill();
      ctx.strokeStyle = '#7dd3fc'; ctx.lineWidth = 2; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(cx, cy, er * 0.65, er * 0.55, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#0e3a5c'; ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx, cy, prW, prH, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#0a0a1a'; ctx.globalAlpha = 0.95; ctx.fill(); ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.ellipse(cx, cy, prW * 0.4, prH * 0.4, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(125,211,252,0.6)'; ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx - er * 0.25, cy - er * 0.3, er * 0.2, er * 0.12, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fill();
      break;
    }
    case 'reptile': {
      const er = 40, pupilH = 28, pupilW = 8;
      ctx.beginPath(); ctx.ellipse(cx, cy, er, er * 0.65, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#1a0500'; ctx.fill();
      ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 2; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(cx, cy, er * 0.75, er * 0.5, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#2d0a00'; ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx, cy, er * 0.55, er * 0.38, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#8b3a00'; ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx, cy, pupilW, pupilH, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#050505'; ctx.globalAlpha = 0.95; ctx.fill(); ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.ellipse(cx - pupilW * 0.3, cy - pupilH * 0.3, pupilW * 0.4, pupilH * 0.25, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(251,191,36,0.4)'; ctx.fill();
      break;
    }
    case 'gremlin': {
      const er = 22, pr = 11, spacing = 32;
      [-1, 1].forEach(side => {
        const ex = cx + side * spacing, ey = cy - S * 0.05;
        ctx.beginPath(); ctx.arc(ex, ey, er, 0, Math.PI * 2);
        ctx.fillStyle = '#1a0020'; ctx.fill();
        ctx.strokeStyle = '#f0abfc'; ctx.lineWidth = 2; ctx.stroke();
        ctx.beginPath(); ctx.arc(ex, ey, er * 0.65, 0, Math.PI * 2);
        ctx.fillStyle = '#2d0040'; ctx.fill();
        ctx.beginPath(); ctx.arc(ex, ey, pr, 0, Math.PI * 2);
        ctx.fillStyle = '#0a0010'; ctx.fill();
        ctx.beginPath(); ctx.arc(ex - pr * 0.4, ey - pr * 0.4, pr * 0.35, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(240,171,252,0.7)'; ctx.fill();
        ctx.beginPath(); ctx.arc(ex - er * 0.3, ey - er * 0.3, er * 0.25, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fill();
      });
      break;
    }
    case 'cyber': {
      const er = 38;
      [0.9, 0.7, 0.5].forEach((scale, i) => {
        ctx.beginPath(); ctx.arc(cx, cy, er * scale, 0, Math.PI * 2);
        ctx.strokeStyle = i === 0 ? '#5eead4' : i === 1 ? '#0d9488' : '#134e4a';
        ctx.lineWidth = i === 0 ? 2 : 1;
        if (i === 1) ctx.setLineDash([er * scale * 0.2, er * scale * 0.1]);
        ctx.globalAlpha = 0.8; ctx.stroke(); ctx.globalAlpha = 1;
        ctx.setLineDash([]);
      });
      ctx.beginPath(); ctx.arc(cx, cy, er * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = '#042f2e'; ctx.fill();
      ctx.beginPath(); ctx.arc(cx, cy, er * 0.28, 0, Math.PI * 2);
      ctx.fillStyle = '#5eead4'; ctx.globalAlpha = 0.9; ctx.fill(); ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.arc(cx, cy, er * 0.13, 0, Math.PI * 2);
      ctx.fillStyle = '#042f2e'; ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx - er, cy); ctx.lineTo(cx + er, cy);
      ctx.moveTo(cx, cy - er); ctx.lineTo(cx, cy + er);
      ctx.strokeStyle = '#5eead4'; ctx.lineWidth = 0.6; ctx.globalAlpha = 0.3; ctx.stroke(); ctx.globalAlpha = 1;
      break;
    }
    case 'halfmood': {
      // Left half: happy sunny yellow
      ctx.save();
      ctx.beginPath(); ctx.rect(0, 0, S / 2, S); ctx.clip();
      ctx.fillStyle = '#FFE234'; ctx.fillRect(0, 0, S, S);
      // happy arch eye (^ shape)
      ctx.beginPath();
      ctx.arc(cx - S * 0.18, cy - S * 0.07, S * 0.07, Math.PI, 0);
      ctx.strokeStyle = '#7c4a00'; ctx.lineWidth = S * 0.03; ctx.lineCap = 'round'; ctx.stroke();
      // rosy cheek
      ctx.beginPath(); ctx.ellipse(cx - S * 0.24, cy + S * 0.06, S * 0.08, S * 0.05, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,120,80,0.35)'; ctx.fill();
      // big smile
      ctx.beginPath();
      ctx.arc(cx - S * 0.12, cy + S * 0.1, S * 0.11, 0.1, Math.PI - 0.1);
      ctx.strokeStyle = '#7c4a00'; ctx.lineWidth = S * 0.028; ctx.stroke();
      ctx.restore();

      // Right half: sad cool blue
      ctx.save();
      ctx.beginPath(); ctx.rect(S / 2, 0, S / 2, S); ctx.clip();
      ctx.fillStyle = '#B8D4FF'; ctx.fillRect(0, 0, S, S);
      // sad angled eyebrow
      ctx.beginPath();
      ctx.moveTo(cx + S * 0.07, cy - S * 0.17);
      ctx.lineTo(cx + S * 0.29, cy - S * 0.11);
      ctx.strokeStyle = '#1e3a5f'; ctx.lineWidth = S * 0.028; ctx.lineCap = 'round'; ctx.stroke();
      // open sad eye
      ctx.beginPath(); ctx.ellipse(cx + S * 0.18, cy - S * 0.06, S * 0.07, S * 0.06, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff'; ctx.fill();
      ctx.beginPath(); ctx.arc(cx + S * 0.18, cy - S * 0.04, S * 0.04, 0, Math.PI * 2);
      ctx.fillStyle = '#1e3a5f'; ctx.fill();
      ctx.beginPath(); ctx.arc(cx + S * 0.16, cy - S * 0.055, S * 0.015, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fill();
      // frown
      ctx.beginPath();
      ctx.arc(cx + S * 0.12, cy + S * 0.19, S * 0.11, Math.PI + 0.1, -0.1);
      ctx.strokeStyle = '#1e3a5f'; ctx.lineWidth = S * 0.028; ctx.stroke();
      // big teardrop
      const tx = cx + S * 0.18, ty = cy + S * 0.02;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.bezierCurveTo(tx + S * 0.045, ty + S * 0.06, tx + S * 0.045, ty + S * 0.13, tx, ty + S * 0.14);
      ctx.bezierCurveTo(tx - S * 0.045, ty + S * 0.13, tx - S * 0.045, ty + S * 0.06, tx, ty);
      ctx.fillStyle = '#60a5fa'; ctx.fill();
      ctx.restore();

      // dividing line
      ctx.beginPath(); ctx.moveTo(S / 2, 0); ctx.lineTo(S / 2, S);
      ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = S * 0.012; ctx.stroke();
      break;
    }
    case 'drops': {
      // Big emoji-style water drops scattered all over
      const dropDefs: [number, number, number][] = [
        [0.50, 0.14, 1.3], [0.20, 0.28, 1.1], [0.80, 0.26, 1.15],
        [0.10, 0.55, 1.0], [0.90, 0.52, 1.05],[0.32, 0.74, 1.1],
        [0.68, 0.72, 1.0], [0.50, 0.86, 1.2], [0.26, 0.46, 0.9],
        [0.74, 0.44, 0.95],[0.50, 0.50, 1.4],
      ];
      dropDefs.forEach(([px, py, sc]) => {
        const dx = px * S, dy = py * S, r = S * 0.072 * sc;
        ctx.beginPath();
        ctx.moveTo(dx, dy - r * 1.7);
        ctx.bezierCurveTo(dx + r * 1.2, dy - r * 0.4, dx + r * 1.2, dy + r * 0.9, dx, dy + r);
        ctx.bezierCurveTo(dx - r * 1.2, dy + r * 0.9, dx - r * 1.2, dy - r * 0.4, dx, dy - r * 1.7);
        const g = ctx.createRadialGradient(dx - r * 0.3, dy - r * 0.5, 0, dx, dy, r * 1.5);
        g.addColorStop(0, '#bfdbfe');
        g.addColorStop(0.45, '#3b82f6');
        g.addColorStop(1, '#1d4ed8');
        ctx.fillStyle = g; ctx.fill();
        // highlight
        ctx.beginPath(); ctx.ellipse(dx - r * 0.38, dy - r * 0.55, r * 0.3, r * 0.42, -0.45, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fill();
      });
      break;
    }
    case 'sunny': {
      // Full ☀️ emoji style — big sun with rays + corner mini suns
      const sr = S * 0.21;
      const rayCount = 16;
      ctx.lineCap = 'round';
      for (let i = 0; i < rayCount; i++) {
        const a = (i / rayCount) * Math.PI * 2;
        const isLong = i % 2 === 0;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * sr * 1.18, cy + Math.sin(a) * sr * 1.18);
        ctx.lineTo(cx + Math.cos(a) * sr * (isLong ? 2.05 : 1.65), cy + Math.sin(a) * sr * (isLong ? 2.05 : 1.65));
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = isLong ? S * 0.032 : S * 0.02;
        ctx.stroke();
      }
      const sunGrad = ctx.createRadialGradient(cx - sr * 0.3, cy - sr * 0.3, 0, cx, cy, sr);
      sunGrad.addColorStop(0, '#fff176');
      sunGrad.addColorStop(0.5, '#fbbf24');
      sunGrad.addColorStop(1, '#f59e0b');
      ctx.beginPath(); ctx.arc(cx, cy, sr, 0, Math.PI * 2);
      ctx.fillStyle = sunGrad; ctx.fill();
      // eyes on sun
      [-0.28, 0.28].forEach(ox => {
        ctx.beginPath(); ctx.arc(cx + ox * sr, cy - sr * 0.22, sr * 0.1, 0, Math.PI * 2);
        ctx.fillStyle = '#92400e'; ctx.fill();
      });
      // smile on sun
      ctx.beginPath();
      ctx.arc(cx, cy + sr * 0.05, sr * 0.28, 0.15, Math.PI - 0.15);
      ctx.strokeStyle = '#92400e'; ctx.lineWidth = S * 0.025; ctx.stroke();
      // corner mini suns
      ([([0.11, 0.12]), [0.89, 0.13], [0.09, 0.87], [0.89, 0.85]] as [number, number][]).forEach(([px, py]) => {
        const bx = px * S, by = py * S, br = S * 0.065;
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(bx + Math.cos(a) * br * 1.25, by + Math.sin(a) * br * 1.25);
          ctx.lineTo(bx + Math.cos(a) * br * 1.9, by + Math.sin(a) * br * 1.9);
          ctx.strokeStyle = 'rgba(251,191,36,0.75)'; ctx.lineWidth = 1.8; ctx.stroke();
        }
        const bg = ctx.createRadialGradient(bx - br * 0.3, by - br * 0.3, 0, bx, by, br);
        bg.addColorStop(0, '#fef08a'); bg.addColorStop(1, '#f59e0b');
        ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2);
        ctx.fillStyle = bg; ctx.fill();
      });
      break;
    }
    case 'cry': {
      // Large eyes with thick tear columns hanging straight down
      const eyeSpacing = S * 0.23;
      const eyeY = cy - S * 0.16;
      [-1, 1].forEach(side => {
        const ex = cx + side * eyeSpacing;
        // white of eye
        ctx.beginPath(); ctx.ellipse(ex, eyeY, S * 0.11, S * 0.09, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff'; ctx.fill();
        ctx.strokeStyle = '#bfdbfe'; ctx.lineWidth = S * 0.008; ctx.stroke();
        // iris
        ctx.beginPath(); ctx.arc(ex, eyeY + S * 0.012, S * 0.062, 0, Math.PI * 2);
        ctx.fillStyle = '#2563eb'; ctx.fill();
        // pupil
        ctx.beginPath(); ctx.arc(ex, eyeY + S * 0.012, S * 0.03, 0, Math.PI * 2);
        ctx.fillStyle = '#0f172a'; ctx.fill();
        // catchlight
        ctx.beginPath(); ctx.arc(ex - S * 0.022, eyeY - S * 0.01, S * 0.014, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fill();
        // tear column — thick, tapers at bottom
        const tearTop = eyeY + S * 0.09;
        const tearBot = cy + S * 0.40;
        const tw = S * 0.028;
        const tg = ctx.createLinearGradient(ex, tearTop, ex, tearBot);
        tg.addColorStop(0, 'rgba(59,130,246,0.95)');
        tg.addColorStop(0.65, 'rgba(96,165,250,0.75)');
        tg.addColorStop(1, 'rgba(147,197,253,0.15)');
        ctx.beginPath();
        ctx.moveTo(ex - tw, tearTop);
        ctx.lineTo(ex + tw, tearTop);
        ctx.lineTo(ex + tw * 0.55, tearBot);
        ctx.lineTo(ex - tw * 0.55, tearBot);
        ctx.closePath();
        ctx.fillStyle = tg; ctx.fill();
        // hanging teardrop
        const td = tearBot + S * 0.01;
        ctx.beginPath();
        ctx.moveTo(ex, td - S * 0.04);
        ctx.bezierCurveTo(ex + S * 0.05, td + S * 0.01, ex + S * 0.05, td + S * 0.08, ex, td + S * 0.08);
        ctx.bezierCurveTo(ex - S * 0.05, td + S * 0.08, ex - S * 0.05, td + S * 0.01, ex, td - S * 0.04);
        ctx.fillStyle = '#60a5fa'; ctx.fill();
      });
      break;
    }
    case 'lightning': {
      // Bold ⚡ with outer glow + two small secondary bolts
      const drawBolt = (offX: number, offY: number, sc: number, alpha: number) => {
        const pts: [number, number][] = [
          [cx + offX + S * 0.09 * sc,  cy + offY - S * 0.40 * sc],
          [cx + offX - S * 0.04 * sc,  cy + offY - S * 0.03 * sc],
          [cx + offX + S * 0.08 * sc,  cy + offY - S * 0.03 * sc],
          [cx + offX - S * 0.11 * sc,  cy + offY + S * 0.40 * sc],
          [cx + offX + S * 0.03 * sc,  cy + offY + S * 0.03 * sc],
          [cx + offX - S * 0.05 * sc,  cy + offY + S * 0.03 * sc],
        ];
        ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
        pts.slice(1).forEach(([px, py]) => ctx.lineTo(px, py));
        ctx.closePath();
        ctx.fillStyle = `rgba(253,224,71,${alpha})`; ctx.fill();
        ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.7})`; ctx.lineWidth = S * 0.01; ctx.stroke();
      };
      // glow halo
      ctx.shadowColor = '#a78bfa'; ctx.shadowBlur = 32;
      drawBolt(0, 0, 1, 1);
      ctx.shadowBlur = 0;
      // inner bright highlight
      ctx.beginPath();
      ctx.moveTo(cx + S * 0.07, cy - S * 0.38);
      ctx.lineTo(cx - S * 0.01, cy - S * 0.06);
      ctx.strokeStyle = 'rgba(255,255,255,0.65)'; ctx.lineWidth = S * 0.014; ctx.stroke();
      // secondary small bolts
      drawBolt(-S * 0.28, -S * 0.18, 0.38, 0.55);
      drawBolt( S * 0.24,  S * 0.20, 0.35, 0.5);
      // sparks
      [[cx - S*0.32,cy-S*0.22],[cx+S*0.33,cy-S*0.14],[cx-S*0.27,cy+S*0.28],[cx+S*0.3,cy+S*0.14]].forEach(([sx2,sy2]) => {
        ctx.beginPath(); ctx.arc(sx2, sy2, S * 0.018, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(253,230,138,0.85)'; ctx.fill();
      });
      break;
    }
    default: {
      const er = 22, pr = 11, spacing = 32;
      [-1, 1].forEach(side => {
        const ex = cx + side * spacing, ey = cy - S * 0.05;
        ctx.beginPath(); ctx.arc(ex, ey, er, 0, Math.PI * 2);
        ctx.fillStyle = 'white'; ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.beginPath(); ctx.arc(ex, ey, pr, 0, Math.PI * 2);
        ctx.fillStyle = '#1a1a2e'; ctx.fill();
        ctx.beginPath(); ctx.arc(ex - pr * 0.35, ey - pr * 0.35, pr * 0.3, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fill();
      });
    }
  }
}

function buildMiniBackTexture(caseColor: string, collectionName?: string | null): THREE.CanvasTexture {
  const S = 256;
  const cv = document.createElement('canvas');
  cv.width = S; cv.height = S;
  const ctx = cv.getContext('2d')!;

  const bg = new THREE.Color(caseColor).multiplyScalar(0.72);
  ctx.fillStyle = bg.getStyle();
  ctx.fillRect(0, 0, S, S);

  const radGrad = ctx.createRadialGradient(S * 0.38, S * 0.35, 0, S / 2, S / 2, S * 0.55);
  radGrad.addColorStop(0, 'rgba(255,255,255,0.09)');
  radGrad.addColorStop(1, 'rgba(0,0,0,0.14)');
  ctx.fillStyle = radGrad;
  ctx.fillRect(0, 0, S, S);

  const eng = new THREE.Color(caseColor).multiplyScalar(1.55);
  eng.r = Math.min(1, eng.r); eng.g = Math.min(1, eng.g); eng.b = Math.min(1, eng.b);
  const es = eng.getStyle();
  const cx = S / 2, cy = S / 2;

  ctx.beginPath();
  ctx.arc(cx, cy, S * 0.365, 0, Math.PI * 2);
  ctx.strokeStyle = es; ctx.globalAlpha = 0.22; ctx.lineWidth = 1; ctx.stroke(); ctx.globalAlpha = 1;

  const brand = 'ЧЕБЛЯЧАС'.split('');
  const letterR = S * 0.285;
  ctx.font = `bold ${Math.round(S * 0.058)}px Arial, sans-serif`;
  ctx.fillStyle = es; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.globalAlpha = 0.72;
  brand.forEach((ch, i) => {
    const a = Math.PI / 2 - (i / brand.length) * Math.PI * 2;
    const x = cx + letterR * Math.cos(a), y = cy - letterR * Math.sin(a);
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 2 - a); ctx.fillText(ch, 0, 0); ctx.restore();
  });
  ctx.globalAlpha = 1;

  if (collectionName) {
    const lines = collectionName.replace(/\\n/g, '\n').split('\n').filter(Boolean);
    const maxLen = Math.max(...lines.map(l => l.length), 1);
    const fontSize = Math.min(S * 0.14, S * 0.52 / maxLen);
    ctx.font = `bold ${Math.round(fontSize)}px Arial, sans-serif`;
    ctx.fillStyle = es; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.globalAlpha = 0.92;
    const lineH = fontSize * 1.25;
    const totalH = (lines.length - 1) * lineH;
    lines.forEach((line, i) => ctx.fillText(line, cx, cy - totalH / 2 + i * lineH));
    ctx.globalAlpha = 1;
  }

  ctx.beginPath();
  ctx.arc(cx, cy + (collectionName ? S * 0.12 : 0), S * 0.012, 0, Math.PI * 2);
  ctx.fillStyle = es; ctx.globalAlpha = 0.7; ctx.fill(); ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(cv);
  tex.repeat.set(-1, 1);
  tex.center.set(0.5, 0.5);
  tex.needsUpdate = true;
  return tex;
}

function buildMiniTexture(
  faceColor: string,
  handsColor: string,
  text: string,
  textMode: string,
): THREE.CanvasTexture {
  const S = 512;
  const cv = document.createElement('canvas');
  cv.width = S; cv.height = S;
  const ctx = cv.getContext('2d')!;

  ctx.fillStyle = faceColor;
  ctx.fillRect(0, 0, S, S);

  const grad = ctx.createRadialGradient(S * 0.35, S * 0.3, 0, S / 2, S / 2, S * 0.55);
  grad.addColorStop(0, 'rgba(255,255,255,0.10)');
  grad.addColorStop(1, 'rgba(0,0,0,0.15)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, S, S);

  const rawText = text.trim().toUpperCase();

  if (rawText.startsWith('EYE:')) {
    const eyeType = rawText.slice(4).toLowerCase();
    drawEyesOnTexture(ctx, S, eyeType);
  } else if (rawText) {
    ctx.fillStyle = handsColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (textMode === 'circular') {
      const chars = Array.from(rawText.replace(/ /g, '·'));
      const count = chars.length;
      const circR = S * 0.345;
      const fontSize = Math.max(10, Math.min(36, Math.round(S * 1.05 / Math.max(count, 5))));
      ctx.font = `bold ${fontSize}px Arial, Helvetica, sans-serif`;
      ctx.globalAlpha = 0.92;
      chars.forEach((ch, i) => {
        const angle = Math.PI / 2 - (i / count) * Math.PI * 2;
        const x = S / 2 + circR * Math.cos(angle);
        const y = S / 2 - circR * Math.sin(angle);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle - Math.PI / 2);
        ctx.fillText(ch, 0, 0);
        ctx.restore();
      });
      ctx.globalAlpha = 1;
    } else {
      const lines = rawText.split('\n').filter(Boolean).slice(0, 3);
      const maxLen = Math.max(...lines.map(l => l.length), 1);
      const fontSize = Math.min(S * 0.16, S * 0.70 / maxLen);
      const lineH = fontSize * 1.35;
      const totalH = (lines.length - 1) * lineH;
      ctx.font = `bold ${fontSize}px Arial, Helvetica, sans-serif`;
      ctx.globalAlpha = 0.88;
      lines.forEach((line, i) => {
        ctx.fillText(line, S / 2, S / 2 - totalH / 2 + i * lineH);
      });
      ctx.globalAlpha = 1;
    }
  }

  const tex = new THREE.CanvasTexture(cv);
  tex.needsUpdate = true;
  return tex;
}

export interface MiniWatchProps {
  watchfaceGeometry: string;
  watchfaceColor: string;
  braceletColor: string;
  braceletMaterial: string;
  handsColor: string;
  handsEnabled: boolean;
  watchfaceText?: string;
  watchfaceTextMode?: string;
  collectionName?: string | null;
  paused?: boolean;
}

export function MiniWatch({ watchfaceGeometry, watchfaceColor, braceletColor, braceletMaterial, handsColor, handsEnabled, watchfaceText, watchfaceTextMode, collectionName, paused }: MiniWatchProps) {
  const groupRef = useRef<THREE.Group>(null);

  const bodyGeo = useMemo(() => {
    const shape = buildShape(watchfaceGeometry);
    return new THREE.ExtrudeGeometry(shape, { depth: 0.38, bevelEnabled: true, bevelSize: 0.09, bevelThickness: 0.09, bevelSegments: 6 });
  }, [watchfaceGeometry]);

  const faceGeo = useMemo(() => new THREE.ShapeGeometry(buildShape(watchfaceGeometry), 48), [watchfaceGeometry]);
  const backGeo = useMemo(() => new THREE.ShapeGeometry(buildShape(watchfaceGeometry), 48), [watchfaceGeometry]);
  const crystalGeo = useMemo(() => {
    const shape = buildShape(watchfaceGeometry);
    return new THREE.ExtrudeGeometry(shape, { depth: 0.04, bevelEnabled: true, bevelSize: 0.035, bevelThickness: 0.035, bevelSegments: 8 });
  }, [watchfaceGeometry]);

  const faceTex = useMemo(
    () => buildMiniTexture(watchfaceColor, handsColor, watchfaceText ?? '', watchfaceTextMode ?? 'circular'),
    [watchfaceColor, handsColor, watchfaceText, watchfaceTextMode]
  );

  const backTex = useMemo(
    () => buildMiniBackTexture(watchfaceColor, collectionName),
    [watchfaceColor, collectionName]
  );

  useEffect(() => () => { bodyGeo.dispose(); faceGeo.dispose(); backGeo.dispose(); crystalGeo.dispose(); faceTex.dispose(); backTex.dispose(); }, [bodyGeo, faceGeo, backGeo, crystalGeo, faceTex, backTex]);

  const isMetal = braceletMaterial === 'metal_solid' || braceletMaterial === 'metal_segmented';
  const isResin = braceletMaterial === 'resin';

  useFrame((state) => {
    if (!groupRef.current || paused) return;
    const t = state.clock.elapsedTime;
    groupRef.current.rotation.y = Math.sin(t * 0.45) * 0.38;
  });

  return (
    <group ref={groupRef} rotation-x={-0.28}>
      <mesh>
        <primitive object={bodyGeo} />
        <meshStandardMaterial color={watchfaceColor} metalness={0.76} roughness={0.14} envMapIntensity={0} />
      </mesh>
      <mesh position={[0, 0, -0.01]}>
        <primitive object={backGeo} />
        <meshStandardMaterial map={backTex} metalness={0.82} roughness={0.22} side={THREE.BackSide} />
      </mesh>
      <mesh position={[0, 0, 0.48]}>
        <primitive object={faceGeo} />
        <meshStandardMaterial map={faceTex} roughness={0.38} metalness={0} envMapIntensity={0} />
      </mesh>
      <mesh position={[0, 0, 0.54]}>
        <primitive object={crystalGeo} />
        <meshPhysicalMaterial
          color="#daeeff"
          metalness={0}
          roughness={0.04}
          transmission={0.65}
          ior={1.05}
          thickness={0.02}
          clearcoat={1.0}
          clearcoatRoughness={0.04}
          reflectivity={0.5}
          specularIntensity={1.2}
          specularColor="#ffffff"
        />
      </mesh>

      {([1.60, -1.60] as number[]).map(y => (
        <group key={y}>
          <mesh position={[0, y, 0.01]}>
            <boxGeometry args={[1.14, 0.50, 0.24]} />
            <meshStandardMaterial color={watchfaceColor} metalness={0.76} roughness={0.14} />
          </mesh>
          <mesh position={[0, y, 0.12]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.032, 0.032, 1.18, 10]} />
            <meshStandardMaterial color={watchfaceColor} metalness={0.95} roughness={0.04} />
          </mesh>
        </group>
      ))}

      {([1, -1] as number[]).map(sign => (
        <group key={sign} position={[0, sign * 1.85, 0]} rotation={[sign * -0.48, 0, 0]}>
          <mesh position={[0, sign * 1.20, 0]}>
            <boxGeometry args={[1.05, 2.40, 0.14]} />
            <meshStandardMaterial
              color={braceletColor}
              metalness={isMetal ? 0.85 : 0}
              roughness={isMetal ? 0.10 : 0.80}
              transparent={isResin}
              opacity={isResin ? 0.72 : 1}
            />
          </mesh>
        </group>
      ))}

      {handsEnabled && (
        <group position={[0, 0, 0.66]}>
          <group rotation={[0, 0, Math.PI / 5]}>
            <mesh position={[0, 0.26, 0]}>
              <boxGeometry args={[0.058, 0.52, 0.018]} />
              <meshStandardMaterial color={handsColor} metalness={0.94} roughness={0.06} />
            </mesh>
          </group>
          <group rotation={[0, 0, -Math.PI / 3.5]}>
            <mesh position={[0, 0.38, 0]}>
              <boxGeometry args={[0.040, 0.76, 0.016]} />
              <meshStandardMaterial color={handsColor} metalness={0.94} roughness={0.06} />
            </mesh>
          </group>
          <group rotation={[0, 0, Math.PI * 0.75]}>
            <mesh position={[0, 0.34, 0.002]}>
              <boxGeometry args={[0.010, 0.68, 0.008]} />
              <meshStandardMaterial color="#ef4444" metalness={0.75} roughness={0.15} />
            </mesh>
          </group>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.054, 0.054, 0.005, 24]} />
            <meshStandardMaterial color={handsColor} metalness={1} roughness={0.02} />
          </mesh>
        </group>
      )}

      <mesh position={[1.62, 0.18, 0.10]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.09, 0.085, 0.28, 14]} />
        <meshStandardMaterial color={watchfaceColor} metalness={0.76} roughness={0.14} />
      </mesh>

    </group>
  );
}

// ─── Full-quality card watch ──────────────────────────────────────────────────
// Matches WatchModel geometry — lugs, spring bars, bezel ring, premium crystal,
// detailed tipped hands — but uses only plain THREE.js groups (no animated.group
// from @react-spring/three) so it is safe in any independent R3F Canvas.

const CARD_LUG_TIP_Y = 1.85;
const CARD_LUG_Z     = 0.10;

function cardCaseHalf(geom: string): number {
  return geom === 'circle' ? 1.5 : geom === 'square' ? 1.28 : 1.1;
}

export function WatchCardModel({
  watchfaceGeometry,
  watchfaceColor,
  braceletColor,
  braceletMaterial,
  handsColor,
  handsEnabled,
  watchfaceText,
  watchfaceTextMode,
  collectionName,
  paused,
}: MiniWatchProps) {
  const groupRef = useRef<THREE.Group>(null);
  const hourRef  = useRef<THREE.Group>(null);
  const minRef   = useRef<THREE.Group>(null);
  const secRef   = useRef<THREE.Group>(null);

  // Spring-physics for hands — loose-pin inertia driven by watch body swing
  const prevRotY    = useRef(0);
  const hourTarget  = useRef(0);
  const minTarget   = useRef(0);
  const secTarget   = useRef(0);
  const hourActual  = useRef(0);
  const minActual   = useRef(0);
  const secActual   = useRef(0);
  const hourVel     = useRef(0);
  const minVel      = useRef(0);
  const secVel      = useRef(0);

  const bodyGeo    = useMemo(() => new THREE.ExtrudeGeometry(buildShape(watchfaceGeometry), {
    depth: 0.38, bevelEnabled: true, bevelSize: 0.09, bevelThickness: 0.09, bevelSegments: 8,
  }), [watchfaceGeometry]);

  const faceGeo    = useMemo(() => new THREE.ShapeGeometry(buildShape(watchfaceGeometry), 64), [watchfaceGeometry]);
  const backGeo    = useMemo(() => new THREE.ShapeGeometry(buildShape(watchfaceGeometry), 48), [watchfaceGeometry]);
  const crystalGeo = useMemo(() => new THREE.ExtrudeGeometry(buildShape(watchfaceGeometry), {
    depth: 0.04, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 10,
  }), [watchfaceGeometry]);

  const faceTex = useMemo(
    () => buildMiniTexture(watchfaceColor, handsColor, watchfaceText ?? '', watchfaceTextMode ?? 'circular'),
    [watchfaceColor, handsColor, watchfaceText, watchfaceTextMode],
  );
  const backTex = useMemo(
    () => buildMiniBackTexture(watchfaceColor, collectionName ?? null),
    [watchfaceColor, collectionName],
  );

  useEffect(() => () => {
    bodyGeo.dispose(); faceGeo.dispose(); backGeo.dispose();
    crystalGeo.dispose(); faceTex.dispose(); backTex.dispose();
  }, [bodyGeo, faceGeo, backGeo, crystalGeo, faceTex, backTex]);

  // Seed hand positions from actual wall-clock time on mount
  useEffect(() => {
    const now = new Date();
    const s = now.getSeconds() + now.getMilliseconds() / 1000;
    const m = now.getMinutes() + s / 60;
    const h = (now.getHours() % 12) + m / 60;
    secTarget.current  = -(s / 60)  * Math.PI * 2;
    minTarget.current  = -(m / 60)  * Math.PI * 2;
    hourTarget.current = -(h / 12)  * Math.PI * 2;
    secActual.current  = secTarget.current;
    minActual.current  = minTarget.current;
    hourActual.current = hourTarget.current;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const isMetal = braceletMaterial === 'metal_solid' || braceletMaterial === 'metal_segmented';
  const isResin = braceletMaterial === 'resin';
  const caseH   = cardCaseHalf(watchfaceGeometry);

  useFrame((state, delta) => {
    if (!groupRef.current || paused) return;
    const t = state.clock.elapsedTime;

    // ── Organic pendulum Y rotation — two harmonics so it never repeats mechanically
    const newRotY = Math.sin(t * 0.38) * 0.52 + Math.sin(t * 0.11) * 0.14;
    groupRef.current.rotation.y = newRotY;

    // ── Breathing tilt — subtle X oscillation around the resting -0.32 rad
    groupRef.current.rotation.x = -0.32 + Math.sin(t * 0.22) * 0.055;

    if (!handsEnabled) return;

    // ── Real wall-clock hand targets (updated each frame for smooth sweep)
    const now = new Date();
    const s   = now.getSeconds() + now.getMilliseconds() / 1000;
    const m   = now.getMinutes() + s / 60;
    const h   = (now.getHours() % 12) + m / 60;
    secTarget.current  = -(s / 60) * Math.PI * 2;
    minTarget.current  = -(m / 60) * Math.PI * 2;
    hourTarget.current = -(h / 12) * Math.PI * 2;

    // ── Loose-pin spring-damper — inertia kick from watch body swing
    const dRotY = newRotY - prevRotY.current;
    prevRotY.current = newRotY;

    // Impulse: faster swing → bigger kick to each hand (light hands wobble more)
    hourVel.current -= dRotY * 2.8;
    minVel.current  -= dRotY * 8.5;
    secVel.current  -= dRotY * 24;

    const springStep = (
      actual: React.MutableRefObject<number>,
      vel:    React.MutableRefObject<number>,
      target: number,
      k: number, b: number,
    ) => {
      let err = target - actual.current;
      // Shortest-path wrap so spring never takes the long way around the dial
      err = ((err % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
      vel.current    += (k * err - b * vel.current) * delta;
      actual.current += vel.current * delta;
    };

    // Heavy hour hand — barely wobbles, returns slowly
    springStep(hourActual, hourVel, hourTarget.current,  4.5, 1.4);
    // Medium minute hand — some wobble
    springStep(minActual,  minVel,  minTarget.current,   8.0, 0.9);
    // Light second hand — springs and oscillates the most
    springStep(secActual,  secVel,  secTarget.current,  22.0, 0.45);

    if (hourRef.current) hourRef.current.rotation.z = hourActual.current;
    if (minRef.current)  minRef.current.rotation.z  = minActual.current;
    if (secRef.current)  secRef.current.rotation.z  = secActual.current;
  });

  const cMat = { color: watchfaceColor, metalness: 0.76 as number, roughness: 0.14 as number };
  const faceZ    = 0.48;
  const crystalZ = 0.56;
  const handsZ   = 0.57;

  return (
    <group ref={groupRef} rotation-x={-0.32}>

      {/* ── Case body ── */}
      <mesh castShadow receiveShadow>
        <primitive object={bodyGeo} />
        <meshStandardMaterial {...cMat} envMapIntensity={1.4} />
      </mesh>

      {/* Back panel */}
      <mesh position={[0, 0, -0.01]}>
        <primitive object={backGeo} />
        <meshStandardMaterial map={backTex} metalness={0.82} roughness={0.22} side={THREE.BackSide} />
      </mesh>

      {/* Face disc */}
      <mesh position={[0, 0, faceZ]}>
        <primitive object={faceGeo} />
        <meshStandardMaterial map={faceTex} roughness={0.25} metalness={0.05} />
      </mesh>

      {/* Crystal — high-quality sapphire glass */}
      <mesh position={[0, 0, crystalZ]}>
        <primitive object={crystalGeo} />
        <meshPhysicalMaterial
          color="#daeeff"
          metalness={0}
          roughness={0.0}
          transmission={0.97}
          ior={1.52}
          thickness={0.08}
          envMapIntensity={5.0}
          clearcoat={1.0}
          clearcoatRoughness={0.03}
          reflectivity={0.7}
          specularIntensity={2.0}
          specularColor="#ffffff"
          attenuationDistance={0.6}
          attenuationColor="#cce8ff"
        />
      </mesh>

      {/* Bezel ring — polished metal rim around crystal (circle only) */}
      {watchfaceGeometry === 'circle' && (
        <mesh position={[0, 0, crystalZ + 0.035]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.506, 0.072, 10, 72]} />
          <meshStandardMaterial color={watchfaceColor} metalness={0.92} roughness={0.06} envMapIntensity={2.5} />
        </mesh>
      )}

      {/* ── Lugs — top (+1) and bottom (-1) ── */}
      {([+1, -1] as const).map((sign) => {
        const tipY  = sign * CARD_LUG_TIP_Y;
        const baseY = sign * (caseH - 0.12);
        const cy    = (tipY + baseY) / 2;
        const lh    = Math.abs(tipY - baseY);
        return (
          <group key={sign}>
            {/* Arm body */}
            <mesh position={[0, cy, CARD_LUG_Z]} castShadow>
              <boxGeometry args={[1.14, lh, 0.26]} />
              <meshStandardMaterial {...cMat} envMapIntensity={1.5} />
            </mesh>
            {/* Chamfer — polished front face */}
            <mesh position={[0, cy, CARD_LUG_Z + 0.07]}>
              <boxGeometry args={[1.10, lh, 0.04]} />
              <meshStandardMaterial color={cMat.color} metalness={0.84} roughness={0.06} envMapIntensity={2.0} />
            </mesh>
            {/* Spring bar pin */}
            <mesh position={[0, tipY, CARD_LUG_Z + 0.03]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.036, 0.036, 1.22, 14]} />
              <meshStandardMaterial color={cMat.color} metalness={0.97} roughness={0.02} />
            </mesh>
          </group>
        );
      })}

      {/* ── Straps attached at lug tips ── */}
      {([+1, -1] as const).map((sign) => (
        <group key={sign} position={[0, sign * CARD_LUG_TIP_Y, CARD_LUG_Z]} rotation={[sign * -0.48, 0, 0]}>
          <mesh position={[0, sign * 1.20, 0]}>
            <boxGeometry args={[1.05, 2.40, 0.14]} />
            <meshStandardMaterial
              color={braceletColor}
              metalness={isMetal ? 0.85 : 0}
              roughness={isMetal ? 0.10 : 0.80}
              transparent={isResin}
              opacity={isResin ? 0.72 : 1}
            />
          </mesh>
        </group>
      ))}

      {/* Crown */}
      <mesh position={[caseH + 0.12, 0.18, CARD_LUG_Z]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.09, 0.085, 0.28, 18]} />
        <meshStandardMaterial {...cMat} />
      </mesh>
      <mesh position={[caseH + 0.16, 0.18, CARD_LUG_Z]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.09, 0.018, 8, 18]} />
        <meshStandardMaterial color={cMat.color} metalness={cMat.metalness} roughness={Math.min(1, cMat.roughness + 0.12)} />
      </mesh>

      {/* ── Watch hands ── */}
      {handsEnabled && (
        <group position={[0, 0, handsZ]}>
          {/* Hour — rotation driven imperatively by spring-physics in useFrame */}
          <group ref={hourRef}>
            <mesh position={[0, 0.26, 0]}><boxGeometry args={[0.058, 0.52, 0.018]} /><meshStandardMaterial color={handsColor} metalness={0.94} roughness={0.06} /></mesh>
            <mesh position={[0, 0.52, 0]}><boxGeometry args={[0.034, 0.06, 0.018]} /><meshStandardMaterial color={handsColor} metalness={0.94} roughness={0.06} /></mesh>
            <mesh position={[0, -0.072, 0]}><boxGeometry args={[0.072, 0.10, 0.022]} /><meshStandardMaterial color={handsColor} metalness={0.94} roughness={0.06} /></mesh>
          </group>
          {/* Minute */}
          <group ref={minRef}>
            <mesh position={[0, 0.38, 0]}><boxGeometry args={[0.040, 0.76, 0.016]} /><meshStandardMaterial color={handsColor} metalness={0.94} roughness={0.06} /></mesh>
            <mesh position={[0, 0.76, 0]}><boxGeometry args={[0.022, 0.04, 0.016]} /><meshStandardMaterial color={handsColor} metalness={0.94} roughness={0.06} /></mesh>
            <mesh position={[0, -0.08, 0]}><boxGeometry args={[0.055, 0.12, 0.020]} /><meshStandardMaterial color={handsColor} metalness={0.94} roughness={0.06} /></mesh>
          </group>
          {/* Second */}
          <group ref={secRef}>
            <mesh position={[0, 0.34, 0.002]}><boxGeometry args={[0.010, 0.68, 0.008]} /><meshStandardMaterial color="#ef4444" metalness={0.75} roughness={0.15} /></mesh>
            <mesh position={[0, -0.10, 0.002]}><boxGeometry args={[0.024, 0.16, 0.010]} /><meshStandardMaterial color="#ef4444" metalness={0.75} roughness={0.15} /></mesh>
          </group>
          {/* Pivot cap + seconds pip */}
          <mesh rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.058, 0.058, 0.006, 28]} /><meshStandardMaterial color={handsColor} metalness={1} roughness={0.02} /></mesh>
          <mesh position={[0, 0, 0.007]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.024, 0.024, 0.004, 16]} /><meshStandardMaterial color="#ef4444" metalness={0.85} roughness={0.08} /></mesh>
        </group>
      )}

    </group>
  );
}

// Lightweight color placeholder shown while a context slot isn't available.
// Uses the watch's own colors so each card looks distinct and intentional.
function lum(hex: string) {
  const r = parseInt(hex.slice(1, 3) || '88', 16) / 255;
  const g = parseInt(hex.slice(3, 5) || '88', 16) / 255;
  const b = parseInt(hex.slice(5, 7) || '88', 16) / 255;
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

const EYE_EMOJI: Record<string, string> = {
  halfmood: '🙂‍↕️', drops: '💧', sunny: '☀️', cry: '😢', lightning: '⚡',
  spider: '🕷️', squid: '🦑', reptile: '🦎', gremlin: '👹', cyber: '🤖',
};

function WatchFaceContent({ text, faceColor }: { text: string; faceColor: string }) {
  const raw = text.trim();
  if (raw.toUpperCase().startsWith('EYE:')) {
    const key = raw.slice(4).toLowerCase();
    if (key === 'halfmood') {
      return (
        <div className="absolute inset-0 overflow-hidden rounded-full flex">
          <div className="flex-1 flex items-center justify-center text-[18px]" style={{ background: '#FFE234' }}>🙂</div>
          <div className="flex-1 flex items-center justify-center text-[18px]" style={{ background: '#B8D4FF' }}>😢</div>
        </div>
      );
    }
    if (key === 'drops') {
      return (
        <div className="absolute inset-0 flex flex-wrap items-center justify-center gap-0 overflow-hidden rounded-full p-1">
          {['💧','💧','💧','💧','💧','💧'].map((e,i) => <span key={i} style={{ fontSize: '11px', lineHeight: 1 }}>{e}</span>)}
        </div>
      );
    }
    if (key === 'sunny') {
      return (
        <div className="absolute inset-0 flex flex-wrap items-center justify-center gap-0 overflow-hidden rounded-full p-0.5">
          {['☀️','☀️','☀️','☀️','☀️','☀️','☀️','☀️','☀️'].map((e,i) => <span key={i} style={{ fontSize: '10px', lineHeight: 1 }}>{e}</span>)}
        </div>
      );
    }
    if (key === 'cry') {
      return <div className="absolute inset-0 flex items-center justify-center text-[28px]">😢</div>;
    }
    if (key === 'lightning') {
      return <div className="absolute inset-0 flex items-center justify-center text-[28px]">⚡</div>;
    }
    const emoji = EYE_EMOJI[key];
    return emoji ? <div className="absolute inset-0 flex items-center justify-center text-[28px]">{emoji}</div> : null;
  }
  if (raw) {
    const dark = lum(faceColor) > 0.55;
    const textColor = dark ? 'rgba(0,0,0,0.82)' : 'rgba(255,255,255,0.92)';
    const lines = raw.split('\n').slice(0, 3).filter(Boolean);
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-[1px] px-1" style={{ color: textColor }}>
        {lines.map((line, i) => (
          <span key={i} style={{ fontSize: lines.length > 1 ? '7px' : '9px', fontWeight: 900, letterSpacing: '0.04em', lineHeight: 1.15, textAlign: 'center' }}>
            {line}
          </span>
        ))}
      </div>
    );
  }
  return null;
}

function WatchColorCard({ watchfaceColor, braceletColor, watchfaceText }: { watchfaceColor: string; braceletColor: string; watchfaceText?: string }) {
  return (
    <div
      className="w-full h-full flex items-center justify-center relative overflow-hidden"
      style={{
        background: `radial-gradient(ellipse at 50% 38%, ${watchfaceColor}cc 0%, ${watchfaceColor}66 40%, ${braceletColor}44 75%, transparent 100%)`,
      }}
    >
      <div className="flex flex-col items-center gap-[3px] select-none pointer-events-none relative" style={{ transform: 'scale(0.72)' }}>
        <div className="w-[34px] h-[22px] rounded-[5px]" style={{ backgroundColor: braceletColor, opacity: 0.72 }} />
        <div
          className="w-[52px] h-[52px] rounded-full border-[3px] relative overflow-hidden"
          style={{ backgroundColor: watchfaceColor, borderColor: braceletColor + 'aa' }}
        >
          <WatchFaceContent text={watchfaceText ?? ''} faceColor={watchfaceColor} />
        </div>
        <div className="w-[34px] h-[22px] rounded-[5px]" style={{ backgroundColor: braceletColor, opacity: 0.72 }} />
      </div>
    </div>
  );
}

export interface WatchMiniCanvasProps {
  preset: {
    watchfaceGeometry?: string;
    watchfaceColor?: string;
    braceletColor?: string;
    braceletMaterial?: string;
    handsColor?: string;
    handsEnabled?: boolean;
    watchfaceText?: string;
    watchfaceTextMode?: string;
    braceletType?: string;
    watchfaceBackgroundType?: string;
    collectionName?: string | null;
  };
  paused?: boolean;
  /** Skip IntersectionObserver and mount immediately — use when the card is
   *  guaranteed visible but inside an overflow container that clips IO detection */
  forceMount?: boolean;
}

export default function WatchMiniCanvas({ preset, paused, forceMount }: WatchMiniCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const didMount = useRef(false);

  const faceColor = preset.watchfaceColor ?? '#888888';
  const strapColor = preset.braceletColor ?? '#333333';

  // forceMount path — acquire context slot immediately, release when prop flips off
  useEffect(() => {
    if (!WEB_GL_OK || !forceMount) return;
    if (!didMount.current && _activeContexts < MAX_CONTEXTS) {
      didMount.current = true;
      _activeContexts++;
      setMounted(true);
    }
    return () => {
      if (didMount.current) {
        _activeContexts = Math.max(0, _activeContexts - 1);
        didMount.current = false;
        setMounted(false);
      }
    };
  }, [forceMount]);

  // IntersectionObserver path — for cards in normal scrolling pages
  useEffect(() => {
    if (!WEB_GL_OK || forceMount) return;
    const el = containerRef.current;
    if (!el) return;

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (!didMount.current && _activeContexts < MAX_CONTEXTS) {
            didMount.current = true;
            _activeContexts++;
            setMounted(true);
          }
        } else {
          if (didMount.current) {
            didMount.current = false;
            _activeContexts = Math.max(0, _activeContexts - 1);
            setMounted(false);
          }
        }
      },
      { rootMargin: '120px', threshold: 0 }
    );
    obs.observe(el);

    return () => {
      obs.disconnect();
      if (didMount.current) {
        _activeContexts = Math.max(0, _activeContexts - 1);
        didMount.current = false;
      }
    };
  }, [forceMount]);

  if (!WEB_GL_OK) {
    return (
      <div className="w-full h-full flex items-center justify-center p-4">
        <div className="w-20 h-36 flex items-center justify-center">
          <WatchSVG
            mini
            config={{
              watchfaceGeometry: (preset.watchfaceGeometry ?? 'rounded') as any,
              watchfaceColor: faceColor,
              braceletColor: strapColor,
              braceletMaterial: (preset.braceletMaterial ?? 'leather') as any,
              braceletType: (preset.braceletType ?? 'strap') as any,
              handsEnabled: preset.handsEnabled ?? true,
              handsColor: preset.handsColor ?? '#cbd5e1',
              handsCount: 3,
              watchfaceText: preset.watchfaceText ?? '',
              watchfaceTextMode: (preset.watchfaceTextMode ?? 'center') as any,
              watchfaceBackgroundType: 'solid',
            }}
          />
        </div>
      </div>
    );
  }


  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      {/* Color card shown only while Canvas hasn't mounted — hides once 3D is live */}
      {(!mounted || paused) && (
        <div className="absolute inset-0">
          <WatchColorCard watchfaceColor={faceColor} braceletColor={strapColor} watchfaceText={preset.watchfaceText ?? ''} />
        </div>
      )}

      {mounted && !paused && (
        <div className="absolute inset-0">
          <Canvas
            camera={{ position: [0, 0.5, 9.0], fov: 38 }}
            gl={{ alpha: true, antialias: true, powerPreference: 'low-power', preserveDrawingBuffer: false }}
            style={{ background: 'transparent', width: '100%', height: '100%' }}
            dpr={[1, 2]}
          >
            <ambientLight intensity={0.7} />
            <directionalLight position={[0, 0, 10]} intensity={1.8} />
            <directionalLight position={[5, 8, 6]} intensity={0.9} castShadow />
            <directionalLight position={[-3, 4, 5]} intensity={0.5} />
            <directionalLight position={[-3, -2, -4]} intensity={0.2} />
            <pointLight position={[-4, 2, 3]} intensity={0.4} color="#6366f1" />
            <hemisphereLight intensity={0.25} />
            <Environment preset="city" />
            <WatchCardModel
              watchfaceGeometry={preset.watchfaceGeometry ?? 'rounded'}
              watchfaceColor={faceColor}
              braceletColor={strapColor}
              braceletMaterial={preset.braceletMaterial ?? 'leather'}
              handsColor={preset.handsColor ?? '#ffffff'}
              handsEnabled={preset.handsEnabled ?? true}
              watchfaceText={preset.watchfaceText ?? ''}
              watchfaceTextMode={preset.watchfaceTextMode ?? 'circular'}
              collectionName={preset.collectionName ?? null}
              paused={paused}
            />
          </Canvas>
        </div>
      )}

    </div>
  );
}
