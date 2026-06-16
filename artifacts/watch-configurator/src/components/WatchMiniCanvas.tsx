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
      // Left half: happy (warm yellow), Right half: sad (cool blue-grey)
      ctx.save();
      ctx.beginPath(); ctx.rect(0, 0, S / 2, S);
      ctx.clip();
      ctx.fillStyle = '#fde68a'; ctx.fillRect(0, 0, S, S);
      ctx.restore();
      ctx.save();
      ctx.beginPath(); ctx.rect(S / 2, 0, S / 2, S);
      ctx.clip();
      ctx.fillStyle = '#bfdbfe'; ctx.fillRect(0, 0, S, S);
      ctx.restore();
      // dividing line
      ctx.beginPath(); ctx.moveTo(S / 2, 0); ctx.lineTo(S / 2, S);
      ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 2; ctx.stroke();
      // left eye (happy ^ arch)
      ctx.beginPath();
      ctx.arc(cx - S * 0.18, cy - S * 0.08, S * 0.065, Math.PI, 0);
      ctx.strokeStyle = '#92400e'; ctx.lineWidth = 4; ctx.stroke();
      // right eye (droopy sad)
      ctx.beginPath();
      ctx.arc(cx + S * 0.18, cy - S * 0.08, S * 0.065, 0, Math.PI);
      ctx.strokeStyle = '#1e3a5f'; ctx.lineWidth = 4; ctx.stroke();
      // left smile
      ctx.beginPath();
      ctx.arc(cx - S * 0.15, cy + S * 0.08, S * 0.10, 0.2, Math.PI - 0.2);
      ctx.strokeStyle = '#92400e'; ctx.lineWidth = 3.5; ctx.stroke();
      // right frown
      ctx.beginPath();
      ctx.arc(cx + S * 0.15, cy + S * 0.15, S * 0.10, Math.PI + 0.2, -0.2);
      ctx.strokeStyle = '#1e3a5f'; ctx.lineWidth = 3.5; ctx.stroke();
      // right tear
      ctx.beginPath();
      ctx.ellipse(cx + S * 0.18, cy + S * 0.01, 4, 7, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#60a5fa'; ctx.globalAlpha = 0.8; ctx.fill(); ctx.globalAlpha = 1;
      break;
    }
    case 'drops': {
      // Scattered teardrops all over the face
      const dropPositions = [
        [0.5, 0.18], [0.25, 0.28], [0.75, 0.28], [0.15, 0.52], [0.85, 0.52],
        [0.38, 0.70], [0.62, 0.70], [0.5, 0.82], [0.28, 0.46], [0.72, 0.46],
        [0.5, 0.50], [0.42, 0.32], [0.58, 0.32],
      ];
      dropPositions.forEach(([px, py], i) => {
        const dx = px * S, dy = py * S;
        const dr = S * 0.048 + (i % 3) * S * 0.015;
        const hue = 200 + (i * 13) % 40;
        ctx.beginPath();
        ctx.moveTo(dx, dy - dr * 1.6);
        ctx.bezierCurveTo(dx + dr * 1.1, dy - dr * 0.5, dx + dr * 1.1, dy + dr * 0.8, dx, dy + dr);
        ctx.bezierCurveTo(dx - dr * 1.1, dy + dr * 0.8, dx - dr * 1.1, dy - dr * 0.5, dx, dy - dr * 1.6);
        ctx.fillStyle = `hsla(${hue},75%,65%,0.82)`;
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(dx - dr * 0.32, dy - dr * 0.3, dr * 0.22, dr * 0.35, -0.5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fill();
      });
      break;
    }
    case 'sunny': {
      const sr = S * 0.18;
      const rayCount = 12;
      for (let i = 0; i < rayCount; i++) {
        const a = (i / rayCount) * Math.PI * 2;
        const inner = sr * 1.35, outer = sr * (i % 2 === 0 ? 2.1 : 1.75);
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner);
        ctx.lineTo(cx + Math.cos(a) * outer, cy + Math.sin(a) * outer);
        ctx.strokeStyle = 'rgba(251,191,36,0.85)';
        ctx.lineWidth = i % 2 === 0 ? 5 : 3;
        ctx.lineCap = 'round';
        ctx.stroke();
      }
      const sunGrad = ctx.createRadialGradient(cx - sr * 0.3, cy - sr * 0.3, 0, cx, cy, sr);
      sunGrad.addColorStop(0, '#fef08a');
      sunGrad.addColorStop(0.6, '#fbbf24');
      sunGrad.addColorStop(1, '#f59e0b');
      ctx.beginPath(); ctx.arc(cx, cy, sr, 0, Math.PI * 2);
      ctx.fillStyle = sunGrad; ctx.fill();
      // small suns scattered
      [[0.18, 0.18], [0.82, 0.22], [0.12, 0.75], [0.78, 0.78]].forEach(([px, py]) => {
        const bx = px * S, by = py * S, br = S * 0.055;
        ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(251,191,36,0.45)'; ctx.fill();
      });
      break;
    }
    case 'cry': {
      // Two eyes upper center, tears streaming straight down like hanging sticks/drops
      const eyeSpacing = S * 0.22;
      const eyeY = cy - S * 0.12;
      [-1, 1].forEach(side => {
        const ex = cx + side * eyeSpacing;
        // eyeball
        ctx.beginPath(); ctx.ellipse(ex, eyeY, S * 0.085, S * 0.07, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#f0f9ff'; ctx.fill();
        ctx.strokeStyle = 'rgba(14,165,233,0.4)'; ctx.lineWidth = 1.5; ctx.stroke();
        // iris
        ctx.beginPath(); ctx.ellipse(ex, eyeY + S * 0.01, S * 0.048, S * 0.048, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#0369a1'; ctx.fill();
        // pupil
        ctx.beginPath(); ctx.arc(ex, eyeY + S * 0.01, S * 0.022, 0, Math.PI * 2);
        ctx.fillStyle = '#0c1a2e'; ctx.fill();
        // tear streak (stick down)
        const tearStartY = eyeY + S * 0.07;
        const tearEndY = cy + S * 0.32;
        const grad = ctx.createLinearGradient(ex, tearStartY, ex, tearEndY);
        grad.addColorStop(0, 'rgba(96,165,250,0.9)');
        grad.addColorStop(0.7, 'rgba(96,165,250,0.6)');
        grad.addColorStop(1, 'rgba(96,165,250,0)');
        ctx.beginPath(); ctx.moveTo(ex - 3, tearStartY); ctx.lineTo(ex + 3, tearStartY);
        ctx.lineTo(ex + 2, tearEndY); ctx.lineTo(ex - 2, tearEndY); ctx.closePath();
        ctx.fillStyle = grad; ctx.fill();
        // teardrop at bottom
        ctx.beginPath();
        ctx.moveTo(ex, tearEndY - S * 0.04);
        ctx.bezierCurveTo(ex + S * 0.04, tearEndY, ex + S * 0.04, tearEndY + S * 0.055, ex, tearEndY + S * 0.055);
        ctx.bezierCurveTo(ex - S * 0.04, tearEndY + S * 0.055, ex - S * 0.04, tearEndY, ex, tearEndY - S * 0.04);
        ctx.fillStyle = 'rgba(96,165,250,0.75)'; ctx.fill();
      });
      break;
    }
    case 'lightning': {
      // Lightning bolt center + electric glow
      const lx = cx, ly = cy;
      const boltPath: [number, number][] = [
        [lx + S * 0.08, ly - S * 0.36],
        [lx - S * 0.02, ly - S * 0.04],
        [lx + S * 0.06, ly - S * 0.04],
        [lx - S * 0.10, ly + S * 0.36],
        [lx + S * 0.04, ly + S * 0.04],
        [lx - S * 0.04, ly + S * 0.04],
      ];
      // glow
      ctx.shadowColor = '#a78bfa'; ctx.shadowBlur = 22;
      ctx.beginPath();
      ctx.moveTo(boltPath[0][0], boltPath[0][1]);
      boltPath.slice(1).forEach(([px, py]) => ctx.lineTo(px, py));
      ctx.closePath();
      ctx.fillStyle = 'rgba(196,181,253,0.95)'; ctx.fill();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.shadowBlur = 0;
      // small sparks
      [[cx - S * 0.3, cy - S * 0.2], [cx + S * 0.3, cy - S * 0.15], [cx - S * 0.25, cy + S * 0.25]].forEach(([sx2, sy2]) => {
        ctx.beginPath(); ctx.arc(sx2, sy2, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(253,230,138,0.8)'; ctx.fill();
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

function buildMiniTexture(
  faceColor: string,
  handsColor: string,
  text: string,
  textMode: string,
): THREE.CanvasTexture {
  const S = 256;
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
  paused?: boolean;
}

export function MiniWatch({ watchfaceGeometry, watchfaceColor, braceletColor, braceletMaterial, handsColor, handsEnabled, watchfaceText, watchfaceTextMode, paused }: MiniWatchProps) {
  const groupRef = useRef<THREE.Group>(null);

  const bodyGeo = useMemo(() => {
    const shape = buildShape(watchfaceGeometry);
    return new THREE.ExtrudeGeometry(shape, { depth: 0.38, bevelEnabled: true, bevelSize: 0.09, bevelThickness: 0.09, bevelSegments: 6 });
  }, [watchfaceGeometry]);

  const faceGeo = useMemo(() => new THREE.ShapeGeometry(buildShape(watchfaceGeometry), 48), [watchfaceGeometry]);
  const crystalGeo = useMemo(() => {
    const shape = buildShape(watchfaceGeometry);
    return new THREE.ExtrudeGeometry(shape, { depth: 0.04, bevelEnabled: true, bevelSize: 0.035, bevelThickness: 0.035, bevelSegments: 8 });
  }, [watchfaceGeometry]);

  const faceTex = useMemo(
    () => buildMiniTexture(watchfaceColor, handsColor, watchfaceText ?? '', watchfaceTextMode ?? 'circular'),
    [watchfaceColor, handsColor, watchfaceText, watchfaceTextMode]
  );

  useEffect(() => () => { bodyGeo.dispose(); faceGeo.dispose(); crystalGeo.dispose(); faceTex.dispose(); }, [bodyGeo, faceGeo, crystalGeo, faceTex]);

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
      <mesh position={[0, 0, 0.48]}>
        <primitive object={faceGeo} />
        <meshStandardMaterial map={faceTex} roughness={0.26} metalness={0.05} />
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

// Lightweight color placeholder shown while a context slot isn't available.
// Uses the watch's own colors so each card looks distinct and intentional.
function lum(hex: string) {
  const r = parseInt(hex.slice(1, 3) || '88', 16) / 255;
  const g = parseInt(hex.slice(3, 5) || '88', 16) / 255;
  const b = parseInt(hex.slice(5, 7) || '88', 16) / 255;
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function WatchColorCard({ watchfaceColor, braceletColor, watchfaceText }: { watchfaceColor: string; braceletColor: string; watchfaceText?: string }) {
  const textLines = watchfaceText?.trim().split('\n').slice(0, 3).filter(Boolean) ?? [];
  const dark = lum(watchfaceColor) > 0.55;
  const textColor = dark ? 'rgba(0,0,0,0.82)' : 'rgba(255,255,255,0.92)';

  return (
    <div
      className="w-full h-full flex items-center justify-center relative overflow-hidden"
      style={{
        background: `radial-gradient(ellipse at 50% 38%, ${watchfaceColor}cc 0%, ${watchfaceColor}66 40%, ${braceletColor}44 75%, transparent 100%)`,
      }}
    >
      {/* watch silhouette */}
      <div className="flex flex-col items-center gap-[3px] select-none pointer-events-none relative" style={{ transform: 'scale(0.72)' }}>
        <div className="w-[34px] h-[22px] rounded-[5px]" style={{ backgroundColor: braceletColor, opacity: 0.72 }} />
        <div
          className="w-[52px] h-[52px] rounded-full border-[3px] flex items-center justify-center relative"
          style={{ backgroundColor: watchfaceColor, borderColor: braceletColor + 'aa' }}
        >
          <div
            className="w-[38px] h-[38px] rounded-full"
            style={{ background: `linear-gradient(135deg, ${watchfaceColor}ff 0%, ${watchfaceColor}88 100%)` }}
          />
          {/* text overlaid on face */}
          {textLines.length > 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-[1px] px-1" style={{ color: textColor }}>
              {textLines.map((line, i) => (
                <span key={i} style={{
                  fontSize: textLines.length > 1 ? '7px' : '8px',
                  fontWeight: 900,
                  letterSpacing: '0.04em',
                  lineHeight: 1.15,
                  textAlign: 'center',
                  display: 'block',
                  textShadow: dark
                    ? '0 0 3px rgba(255,255,255,0.5)'
                    : '0 0 3px rgba(0,0,0,0.5)',
                }}>
                  {line}
                </span>
              ))}
            </div>
          )}
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
            camera={{ position: [0, 1.2, 7.2], fov: 38 }}
            gl={{ alpha: true, antialias: true, powerPreference: 'low-power', preserveDrawingBuffer: false }}
            style={{ background: 'transparent', width: '100%', height: '100%' }}
            dpr={[1, 1.2]}
          >
            <ambientLight intensity={0.55} />
            <directionalLight position={[5, 8, 6]} intensity={1.3} />
            <directionalLight position={[-3, -2, -4]} intensity={0.28} />
            <pointLight position={[-4, 2, 3]} intensity={0.7} color="#6366f1" />
            <hemisphereLight intensity={0.25} />
            <Environment preset="city" />
            <MiniWatch
              watchfaceGeometry={preset.watchfaceGeometry ?? 'rounded'}
              watchfaceColor={faceColor}
              braceletColor={strapColor}
              braceletMaterial={preset.braceletMaterial ?? 'leather'}
              handsColor={preset.handsColor ?? '#ffffff'}
              handsEnabled={preset.handsEnabled ?? true}
              watchfaceText={preset.watchfaceText ?? ''}
              watchfaceTextMode={preset.watchfaceTextMode ?? 'circular'}
              paused={paused}
            />
          </Canvas>
        </div>
      )}

    </div>
  );
}
