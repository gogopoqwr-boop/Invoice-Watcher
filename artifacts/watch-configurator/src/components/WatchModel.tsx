import React, { useRef, useMemo, useEffect, Suspense } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Text3D, Center, Billboard } from '@react-three/drei';
import { useWatchConfig, ExtendedConfigState } from '@/hooks/use-watch-config';
import * as THREE from 'three';
import { useSpring, animated } from '@react-spring/three';

// typeface.js JSON font — generated from DejaVuSans-Bold.ttf via opentype.js.
// Full Cyrillic + Latin coverage. Loaded by FontLoader (main thread fetch),
// not a blob WebWorker — works reliably from any origin.
const TYPEFACE_URL = '/fonts/DejaVuSans-Bold.typeface.json';

// Error boundary that renders null on error — keeps the rest of the Canvas alive
// when the font CDN is unreachable or a text render fails.
class TextErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch() { /* swallow — intentional, don't let it bubble */ }
  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

// ─── Shape helpers ─────────────────────────────────────────────────────────

function shapeHalfWidth(geom: string): number {
  if (geom === 'circle') return 1.5;
  if (geom === 'square') return 1.28;
  return 1.1;
}

function buildFaceShape(geom: string): THREE.Shape {
  const s = new THREE.Shape();
  if (geom === 'circle') {
    s.absarc(0, 0, 1.5, 0, Math.PI * 2, false);
  } else if (geom === 'square') {
    const r = 0.28, w = 1.28;
    s.moveTo(-w + r, -w); s.lineTo(w - r, -w);
    s.quadraticCurveTo(w, -w, w, -w + r); s.lineTo(w, w - r);
    s.quadraticCurveTo(w, w, w - r, w); s.lineTo(-w + r, w);
    s.quadraticCurveTo(-w, w, -w, w - r); s.lineTo(-w, -w + r);
    s.quadraticCurveTo(-w, -w, -w + r, -w);
  } else {
    const r = 0.65, w = 1.1;
    s.moveTo(-w + r, -w); s.lineTo(w - r, -w);
    s.quadraticCurveTo(w, -w, w, -w + r); s.lineTo(w, w - r);
    s.quadraticCurveTo(w, w, w - r, w); s.lineTo(-w + r, w);
    s.quadraticCurveTo(-w, w, -w, w - r); s.lineTo(-w, -w + r);
    s.quadraticCurveTo(-w, -w, -w + r, -w);
  }
  return s;
}

// ─── Face texture (canvas) ─────────────────────────────────────────────────
//
// All text is drawn on the canvas texture — this is the only reliable path
// in Replit's environment (Troika's blob WebWorker can't resolve font URLs).
//
// textMode:
//   'circular'     — embossed letters around the bezel ring  (3-D look)
//   'center-flat'  — flat text centred on face, sits under hands (2-D)
//   'center-raised'— embossed letters centred, no hands obstruction (3-D look)
//   'none'         — no text

// Derive shadow / highlight colours from the hands colour.
function embossColors(handsColor: string) {
  const base = new THREE.Color(handsColor);
  const shadow = '#' + base.clone().multiplyScalar(0.25).getHexString();
  const highlight = '#' + base.clone().lerp(new THREE.Color('#ffffff'), 0.55).getHexString();
  return { shadow, highlight, base: handsColor };
}

// Draw a single chunk of text at (tx, ty) — already translated & rotated.
// Layers: dark extrusion → main face → specular streak.
function drawRaisedText(
  ctx: CanvasRenderingContext2D,
  label: string,
  tx: number, ty: number,
  rotation: number,
  colors: { shadow: string; highlight: string; base: string },
  depth: number,
) {
  ctx.save();
  ctx.translate(tx, ty);
  ctx.rotate(rotation);

  // Extrusion side-face: dark layers offset bottom-right
  ctx.fillStyle = colors.shadow;
  for (let d = Math.ceil(depth); d >= 1; d--) {
    ctx.fillText(label, d * 0.65, d * 0.72);
  }

  // Main face
  ctx.fillStyle = colors.base;
  ctx.fillText(label, 0, 0);

  // Specular highlight streak (top-left)
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = colors.highlight;
  ctx.fillText(label, -0.45, -0.5);
  ctx.globalAlpha = 1;

  ctx.restore();
}

function buildFaceTexture(
  faceColor: string,
  handsColor: string,
  geom: string,
  textMode: 'none' | 'circular' | 'center-flat' | 'center-raised',
  text?: string,
): THREE.CanvasTexture {
  const isCircular = textMode === 'circular';
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

  const rawText = text?.trim().toUpperCase() ?? '';
  const hasText  = rawText.length > 0 && !rawText.startsWith('EYE:');

  // ── Circular: embossed letters placed around the bezel ring ──────────────
  if (textMode === 'circular' && hasText) {
    const chars = Array.from(rawText.replace(/ /g, '·'));
    const count = chars.length;
    if (count > 0) {
      const circR    = S * 0.355;
      const fullRing = count >= 5;
      const arcSpan  = fullRing ? Math.PI * 2 : Math.min(Math.PI * 1.55, count * 0.44);
      const fontSize = Math.max(18, Math.min(56, Math.round(S * 1.1 / Math.max(count, 5))));
      const depth    = Math.max(2, fontSize * 0.10);
      const startAngle = fullRing
        ? Math.PI / 2
        : Math.PI / 2 + arcSpan / 2;
      const angleStep = fullRing
        ? (Math.PI * 2) / count
        : arcSpan / Math.max(count - 1, 1);

      ctx.font = `bold ${fontSize}px Arial, Helvetica, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const colors = embossColors(handsColor);
      chars.forEach((ch, i) => {
        // Clockwise from 12 o'clock
        const angle = startAngle - i * angleStep;
        const x = S / 2 + circR * Math.cos(angle);
        const y = S / 2 - circR * Math.sin(angle);
        // Letter base faces the dial centre
        const rot = Math.PI / 2 - angle;
        drawRaisedText(ctx, ch, x, y, rot, colors, depth);
      });
    }
  }

  // ── Center raised: embossed letters centred (no hands) ───────────────────
  if (textMode === 'center-raised' && hasText) {
    const lines = rawText.split('\n').filter(Boolean).slice(0, 3);
    const maxLen = Math.max(...lines.map(l => l.length), 1);
    const fontSize = Math.min(S * 0.16, S * 0.70 / maxLen);
    const depth    = Math.max(2, fontSize * 0.09);
    const lineH    = fontSize * 1.35;
    const totalH   = (lines.length - 1) * lineH;

    ctx.font = `bold ${fontSize}px Arial, Helvetica, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const colors = embossColors(handsColor);
    lines.forEach((line, i) => {
      const ty = S / 2 - totalH / 2 + i * lineH;
      drawRaisedText(ctx, line, S / 2, ty, 0, colors, depth);
    });
  }

  // ── Center flat: plain text, sits under hands ─────────────────────────────
  if (textMode === 'center-flat' && hasText) {
    const lines = rawText.split('\n').filter(Boolean).slice(0, 3);
    const maxLen = Math.max(...lines.map(l => l.length), 1);
    const fontSize = Math.min(S * 0.13, S * 0.65 / maxLen);
    ctx.font = `bold ${fontSize}px Arial, Helvetica, sans-serif`;
    ctx.fillStyle = handsColor;
    ctx.globalAlpha = 0.68;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const lineH = fontSize * 1.35;
    const totalH = (lines.length - 1) * lineH;
    lines.forEach((line, i) => {
      ctx.fillText(line, S / 2, S / 2 - totalH / 2 + i * lineH);
    });
    ctx.globalAlpha = 1;
  }

  const tex = new THREE.CanvasTexture(cv);

  const half = shapeHalfWidth(geom);
  const rep = 0.5 / half;
  tex.offset.set(0.5, 0.5);
  tex.repeat.set(rep, rep);
  tex.needsUpdate = true;
  return tex;
}

// ─── Bump texture (white-on-black letter silhouettes) ──────────────────────
// Applied as bumpMap on the face disc so the scene lights physically respond
// to the letter surfaces — creates genuine raised-letter depth rather than
// a painted-on illusion.  Only used for the two "3D" text modes.
function buildBumpTexture(
  geom: string,
  textMode: 'none' | 'circular' | 'center-flat' | 'center-raised',
  text?: string,
): THREE.CanvasTexture | null {
  const rawText = text?.trim().toUpperCase() ?? '';
  const hasText = rawText.length > 0 && !rawText.startsWith('EYE:');
  if (!hasText || textMode === 'none' || textMode === 'center-flat') return null;

  const S = 512;
  const cv = document.createElement('canvas');
  cv.width = S; cv.height = S;
  const ctx = cv.getContext('2d')!;

  // Black = flat (baseline face), white = raised (letter faces)
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, S, S);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (textMode === 'circular') {
    const chars = Array.from(rawText.replace(/ /g, '·'));
    const count = chars.length;
    if (count > 0) {
      const circR     = S * 0.355;
      const fullRing  = count >= 5;
      const arcSpan   = fullRing ? Math.PI * 2 : Math.min(Math.PI * 1.55, count * 0.44);
      const fontSize  = Math.max(18, Math.min(56, Math.round(S * 1.1 / Math.max(count, 5))));
      const startAngle = fullRing ? Math.PI / 2 : Math.PI / 2 + arcSpan / 2;
      const angleStep  = fullRing ? (Math.PI * 2) / count : arcSpan / Math.max(count - 1, 1);

      ctx.font = `bold ${fontSize}px Arial, Helvetica, sans-serif`;
      chars.forEach((ch, i) => {
        const angle = startAngle - i * angleStep;
        const x = S / 2 + circR * Math.cos(angle);
        const y = S / 2 - circR * Math.sin(angle);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(Math.PI / 2 - angle);
        ctx.fillText(ch, 0, 0);
        ctx.restore();
      });
    }
  } else {
    // center-raised
    const lines    = rawText.split('\n').filter(Boolean).slice(0, 3);
    const maxLen   = Math.max(...lines.map(l => l.length), 1);
    const fontSize = Math.min(S * 0.16, S * 0.70 / maxLen);
    const lineH    = fontSize * 1.35;
    const totalH   = (lines.length - 1) * lineH;
    ctx.font = `bold ${fontSize}px Arial, Helvetica, sans-serif`;
    lines.forEach((line, i) => {
      ctx.fillText(line, S / 2, S / 2 - totalH / 2 + i * lineH);
    });
  }

  const tex = new THREE.CanvasTexture(cv);
  const half = shapeHalfWidth(geom);
  const rep  = 0.5 / half;
  tex.offset.set(0.5, 0.5);
  tex.repeat.set(rep, rep);
  tex.needsUpdate = true;
  return tex;
}

// ─── Watch face 3D text (Text3D — real extruded geometry) ──────────────────
// Uses typeface.js JSON font (Y-up font coordinates, correct for THREE.js).
// Letters face the viewer: front face is readable from +Z (camera direction).
// Circular mode: each letter rotated so its base faces the dial centre,
// matching the convention used on real watch/clock bezels.
function WatchFaceText({ text, mode, textColor, faceZ, handsEnabled, geom }: {
  text: string; mode: 'center' | 'circular'; textColor: string; faceZ: number; handsEnabled: boolean; geom: string;
}) {
  const trimmed = text.trim().toUpperCase().replace(/\n/g, ' ').trim();
  if (!trimmed || trimmed.startsWith('EYE:')) return null;

  // Letters sit just above face disc, safely below the crystal bottom bevel
  const textZ = faceZ + 0.006;

  // Shared metallic-glow material for all 3D letters
  const matProps = {
    color: textColor,
    metalness: 0.92,
    roughness: 0.08,
    emissive: textColor,
    emissiveIntensity: 0.35,
  };

  // Extrude params proportional to font size so bevels never overpower small glyphs.
  // curveSegments=16 gives smooth O/C/G curves instead of polygon approximations.
  function extrudeFor(sz: number) {
    const bev = sz * 0.018;
    return {
      depth:          sz * 0.06,
      bevelEnabled:   true  as const,
      bevelSize:      bev,
      bevelThickness: bev,
      bevelSegments:  5,
      curveSegments:  16,
    };
  }

  if (mode === 'circular') {
    const chars = Array.from(trimmed.replace(/ /g, '·'));
    const count = chars.length;
    if (count === 0) return null;

    const faceR = shapeHalfWidth(geom);
    // For square faces use a tighter radius so letters stay inside the rounded-corner crystal.
    const r = faceR * (geom === 'square' ? 0.68 : 0.78);

    // Circular distribution — equally-spaced angles starting at 12 o'clock.
    // Works for all face geometries: letters always stay within the crystal area
    // and face the camera via Billboard, so no bezel-convention rotation needed.
    const perimeter = 2 * Math.PI * r;
    const fontSize  = Math.max(0.12, Math.min(0.28, (perimeter * 0.52) / Math.max(count, 4)));

    const letterPositions = Array.from({ length: count }, (_, i) => {
      const angle = Math.PI / 2 - (i / count) * Math.PI * 2;  // 12 o'clock first, clockwise
      return { x: r * Math.cos(angle), y: r * Math.sin(angle) };
    });

    return (
      <group position={[0, 0, textZ]}>
        {chars.map((ch, i) => {
          const { x, y } = letterPositions[i];
          return (
            <CameraFacingChar
              key={i}
              ch={ch}
              x={x}
              y={y}
              rotationZ={-(i / count) * Math.PI * 2}
              fontSize={fontSize}
              matProps={matProps}
              extrudeFor={extrudeFor}
            />
          );
        })}
      </group>
    );
  }

  // Center mode
  if (handsEnabled) return null; // center+hands handled by canvas texture (center-flat)

  // center + no hands → 3D raised text centred on the face
  const lines = text.trim().split('\n').slice(0, 3).filter(Boolean).map(l => l.toUpperCase().trim());
  if (lines.length === 0) return null;

  const faceHalf = shapeHalfWidth(geom);
  const maxLen   = Math.max(...lines.map(l => l.length), 1);
  const fontSize = Math.max(0.14, Math.min(0.34, (faceHalf * 1.5) / Math.max(maxLen, 3)));
  const lineH    = fontSize * 1.35;
  const totalH   = (lines.length - 1) * lineH;

  return (
    <CameraFacingText
      lines={lines}
      fontSize={fontSize}
      lineH={lineH}
      totalH={totalH}
      textZ={textZ}
      matProps={matProps}
      extrudeFor={extrudeFor}
    />
  );
}

/** Single character for circular bezel text — static geometry, rotates with the watch.
 *  rotationZ orients each letter so its top points outward (standard bezel convention). */
function CameraFacingChar({ ch, x, y, rotationZ, fontSize, matProps, extrudeFor }: {
  ch: string; x: number; y: number; rotationZ: number; fontSize: number; matProps: object; extrudeFor: (sz: number) => object;
}) {
  return (
    <group position={[x, y, 0]} rotation={[0, 0, rotationZ]}>
      <Center>
        <Text3D font={TYPEFACE_URL} size={fontSize} {...(extrudeFor(fontSize) as any)}>
          {ch}
          <meshStandardMaterial {...(matProps as any)} />
        </Text3D>
      </Center>
    </group>
  );
}

/** Static raised text block for center mode — geometry fixed to the face plane. */
function CameraFacingText({ lines, fontSize, lineH, totalH, textZ, matProps, extrudeFor }: {
  lines: string[];
  fontSize: number;
  lineH: number;
  totalH: number;
  textZ: number;
  matProps: object;
  extrudeFor: (sz: number) => object;
}) {
  return (
    <group position={[0, 0, textZ]}>
      {lines.map((line, i) => (
        <group key={i} position={[0, totalH / 2 - i * lineH, 0]}>
          <Center>
            <Text3D font={TYPEFACE_URL} size={fontSize} {...(extrudeFor(fontSize) as any)}>
              {line}
              <meshStandardMaterial {...(matProps as any)} />
            </Text3D>
          </Center>
        </group>
      ))}
    </group>
  );
}

// ─── Clasp & bone-chain strap system ───────────────────────────────────────

// Joints per strap arm and world-unit length of each segment.
// 6 joints × 0.44 = 2.64 units total arm length.
const WRAP_SEGS = 6;
const SEG_LEN   = 0.44;

// StrapClasp — rendered at the chain terminus.
// isDeployant → fold-over butterfly clasp (metal bracelets)
// !isDeployant → traditional pin-buckle (leather / resin / fabric)
function StrapClasp({ sign, claspColor, isDeployant, width }: {
  sign: number; claspColor: string; isDeployant: boolean; width: number;
}) {
  const m = { color: claspColor, metalness: 0.97, roughness: 0.03, envMapIntensity: 2.0 };
  return (
    <group position={[0, sign * 0.10, 0]}>
      {/* Clasp frame bar */}
      <mesh castShadow>
        <boxGeometry args={[0.82 * width, 0.20, 0.14]} />
        <meshStandardMaterial {...m} />
      </mesh>
      {isDeployant ? (
        // Deployant: upper leaf + hinge pin
        <>
          <mesh position={[0, sign * 0.20, 0.02]} castShadow>
            <boxGeometry args={[0.76 * width, 0.14, 0.05]} />
            <meshStandardMaterial {...m} />
          </mesh>
          <mesh position={[0, sign * 0.20, 0.05]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.015, 0.015, 0.78 * width, 8]} />
            <meshStandardMaterial color={claspColor} metalness={0.99} roughness={0.01} />
          </mesh>
        </>
      ) : (
        // Pin buckle: axial pin + two keeper loops
        <>
          <mesh position={[0, 0, 0.10]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.015, 0.015, 0.60 * width, 8]} />
            <meshStandardMaterial color={claspColor} metalness={0.99} roughness={0.01} />
          </mesh>
          {([-0.24, 0.24] as const).map(x => (
            <mesh key={x} position={[x * width, 0, 0.08]}>
              <boxGeometry args={[0.06, 0.22, 0.10]} />
              <meshStandardMaterial {...m} roughness={0.06} />
            </mesh>
          ))}
        </>
      )}
    </group>
  );
}

// StrapJoint — one bone in the procedural strap chain.
//
// Each joint is an <animated.group> whose rotation-x is driven by the SAME
// fractional spring value (total_wrap / WRAP_SEGS).  Because the groups are
// NESTED (joint k+1 is a child of joint k's far tip), the cumulative angle at
// the last segment equals WRAP_SEGS × θ = total_wrap, producing a smooth
// constant-curvature arc identical to a properly-rigged bone chain.
//
// sign   +1 = upper arm (strap grows +Y), −1 = lower arm (−Y).
// θ      a @react-spring SpringValue<number> — React Spring writes the GPU
//        matrix every animation frame without triggering React re-renders.
function StrapJoint({ k, sign, θ, color, mat, isSegmented, isDeployant, claspColor, width }: {
  k: number; sign: number; θ: any;
  color: string; mat: string; isSegmented: boolean; isDeployant: boolean; claspColor: string; width: number;
}) {
  const segH    = SEG_LEN * 0.86;
  const isResin = mat === 'resin';
  const isFab   = mat === 'cotton_fabric';
  const isLeath = mat === 'leather';
  const metal   = isSegmented ? 0.92 : mat.includes('metal') ? 0.85 : 0;
  const rough   = isSegmented ? 0.07 : isLeath ? 0.92 : isFab ? 0.88 : isResin ? 0.06 : 0.78;
  const segW    = 1.05 * width;

  // Terminus: render clasp instead of another joint
  if (k >= WRAP_SEGS) {
    return <StrapClasp sign={sign} claspColor={claspColor} isDeployant={isDeployant} width={width} />;
  }

  return (
    <animated.group rotation-x={θ}>
      {/* Segment body */}
      {isFab ? (
        <>
          <mesh position={[0, sign * segH / 2, 0]} castShadow>
            <boxGeometry args={[segW, segH, 0.10]} />
            <meshStandardMaterial color={color} roughness={0.90} metalness={0} />
          </mesh>
          {([-0.36, -0.12, 0.12, 0.36] as const).map(x => (
            <mesh key={x} position={[x * width, sign * segH / 2, 0.06]} castShadow>
              <boxGeometry args={[0.05 * width, segH, 0.03]} />
              <meshStandardMaterial
                color={new THREE.Color(color).offsetHSL(0, 0, 0.12).getStyle()}
                roughness={0.85} metalness={0}
              />
            </mesh>
          ))}
        </>
      ) : (
        <mesh position={[0, sign * segH / 2, 0]} castShadow>
          <boxGeometry args={[segW, segH, 0.15]} />
          <meshStandardMaterial
            color={color} metalness={metal} roughness={rough}
            transparent={isResin} opacity={isResin ? 0.72 : 1}
          />
        </mesh>
      )}
      {/* Next joint pivot at the far tip of this segment */}
      <group position={[0, sign * SEG_LEN, 0]}>
        <StrapJoint k={k + 1} sign={sign} θ={θ} color={color} mat={mat}
          isSegmented={isSegmented} isDeployant={isDeployant} claspColor={claspColor} width={width} />
      </group>
    </animated.group>
  );
}

// ─── Camera controller ─────────────────────────────────────────────────────

const INTERACTION_PAUSE_MS = 10_000;
const RESUME_RAMP_MS = 2_500;

export function CameraRig({ step, lastInteractionRef, showWrist }: {
  step: number;
  lastInteractionRef?: React.RefObject<number>;
  showWrist?: boolean;
}) {
  const { camera } = useThree();
  const targets: [number, number, number][] = [
    [0,  1.2, 7.5],  // step 0
    [0,  1.2, 7.5],  // step 1
    [0, -0.6, 7.5],  // step 2 — bracelet: slightly below to show strap curl
    [0,  1.2, 7.5],  // step 3
    [0,  1.2, 7.5],  // step 4
  ];
  // Wrist view: above and slightly off-axis — natural "glancing at your watch" angle
  const wristPos: [number, number, number] = [0.6, 3.2, 6.5];
  const pos = showWrist ? wristPos : targets[Math.min(step, targets.length - 1)];
  const vec = useMemo(() => new THREE.Vector3(...pos), [pos[0], pos[1], pos[2]]);
  const resumeStartRef = useRef<number | null>(null);

  useFrame(() => {
    const userActive = lastInteractionRef?.current
      ? Date.now() - lastInteractionRef.current < INTERACTION_PAUSE_MS
      : false;
    if (userActive) { resumeStartRef.current = null; return; }
    if (resumeStartRef.current === null) resumeStartRef.current = Date.now();
    const t = Math.min(1, (Date.now() - resumeStartRef.current) / RESUME_RAMP_MS);
    camera.position.lerp(vec, 0.02 + 0.03 * t);
    camera.lookAt(0, 0, 0);
  });
  return null;
}

// ─── Back panel ───────────────────────────────────────────────────────────

function buildBackTexture(geom: string, caseColor: string, serial?: string, collectionName?: string | null): THREE.CanvasTexture {
  const S = 512;
  const cv = document.createElement('canvas');
  cv.width = S; cv.height = S;
  const ctx = cv.getContext('2d')!;

  const bgCol = new THREE.Color(caseColor).multiplyScalar(0.72);
  ctx.fillStyle = bgCol.getStyle();
  ctx.fillRect(0, 0, S, S);

  const grad = ctx.createRadialGradient(S * 0.38, S * 0.35, 0, S * 0.5, S * 0.5, S * 0.55);
  grad.addColorStop(0, 'rgba(255,255,255,0.09)');
  grad.addColorStop(1, 'rgba(0,0,0,0.14)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, S, S);

  const engCol = new THREE.Color(caseColor).multiplyScalar(1.5);
  engCol.r = Math.min(1, engCol.r);
  engCol.g = Math.min(1, engCol.g);
  engCol.b = Math.min(1, engCol.b);
  const engStyle = engCol.getStyle();

  const cx = S / 2, cy = S / 2;
  const letterR = S * 0.33;

  ctx.beginPath();
  ctx.arc(cx, cy, letterR * 1.32, 0, Math.PI * 2);
  ctx.strokeStyle = engStyle;
  ctx.globalAlpha = 0.22;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.globalAlpha = 1;

  const letters = 'ЧЕБЛЯЧАС'.split('');
  const n = letters.length;
  ctx.font = `bold ${Math.round(S * 0.064)}px Arial, sans-serif`;
  ctx.fillStyle = engStyle;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  letters.forEach((letter, i) => {
    const a = Math.PI / 2 - (i / n) * Math.PI * 2;
    const x = cx + letterR * Math.cos(a);
    const y = cy - letterR * Math.sin(a);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.PI / 2 - a);
    ctx.fillText(letter, 0, 0);
    ctx.restore();
  });

  if (collectionName) {
    const lines = collectionName.replace(/\\n/g, '\n').split('\n').filter(Boolean);
    const maxLen = Math.max(...lines.map((l: string) => l.length), 1);
    const fontSize = Math.min(S * 0.12, S * 0.55 / maxLen);
    ctx.font = `bold ${Math.round(fontSize)}px Arial, sans-serif`;
    ctx.fillStyle = engStyle;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = 0.92;
    const lineH = fontSize * 1.25;
    const totalH = (lines.length - 1) * lineH;
    const baseY = serial ? cy - S * 0.04 : cy;
    lines.forEach((line: string, i: number) => ctx.fillText(line, cx, baseY - totalH / 2 + i * lineH));
    ctx.globalAlpha = 1;
  }

  if (serial) {
    ctx.font = `bold ${Math.round(S * 0.043)}px monospace`;
    ctx.fillStyle = engStyle;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = 0.9;
    ctx.fillText(serial.toUpperCase(), cx, cy + S * 0.065);
    ctx.globalAlpha = 1;
  }

  ctx.beginPath();
  ctx.arc(cx, cy, S * 0.013, 0, Math.PI * 2);
  ctx.fillStyle = engStyle;
  ctx.globalAlpha = 0.75;
  ctx.fill();
  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(cv);
  const half = shapeHalfWidth(geom);
  const rep = 0.5 / half;
  tex.offset.set(0.5, 0.5);
  tex.repeat.set(-rep, rep);
  tex.needsUpdate = true;
  return tex;
}

function WatchBackPanel({ geom, caseColor, serial, collectionName }: {
  geom: string; caseColor: string; serial?: string; collectionName?: string | null;
}) {
  const backDiscGeo = useMemo(() => new THREE.ShapeGeometry(buildFaceShape(geom), 72), [geom]);
  const backTexture = useMemo(() => buildBackTexture(geom, caseColor, serial, collectionName), [geom, caseColor, serial, collectionName]);
  return (
    <mesh position={[0, 0, -0.12]}>
      <primitive object={backDiscGeo} />
      <meshStandardMaterial map={backTexture} metalness={0.88} roughness={0.2} side={THREE.BackSide} />
    </mesh>
  );
}

// ─── Machined bezel ring ───────────────────────────────────────────────────

function BezelRing({ geom, caseMat }: {
  geom: string;
  caseMat: { color: string; metalness: number; roughness: number };
}) {
  const geo = useMemo(() => {
    const scaleFn = (f: number) => {
      const pts = buildFaceShape(geom).getPoints(48);
      return new THREE.Shape(pts.map(p => new THREE.Vector2(p.x * f, p.y * f)));
    };
    const outerS = scaleFn(1.055);
    const innerS = scaleFn(1.005);
    outerS.holes = [innerS];
    return new THREE.ExtrudeGeometry(outerS, {
      depth: 0.14,
      bevelEnabled: true,
      bevelSize: 0.022,
      bevelThickness: 0.022,
      bevelSegments: 5,
    });
  }, [geom]);
  useEffect(() => () => geo.dispose(), [geo]);

  return (
    <mesh position={[0, 0, 0.44]} castShadow>
      <primitive object={geo} />
      <meshStandardMaterial
        color={caseMat.color}
        metalness={Math.min(1, caseMat.metalness + 0.06)}
        roughness={Math.max(0.04, caseMat.roughness - 0.06)}
        envMapIntensity={1.6}
      />
    </mesh>
  );
}


// ─── Wrist mannequin (improved) ────────────────────────────────────────────

export function WristMannequin() {
  // Lathe profile for a tapered, anatomically shaped wrist
  // Points define the profile from one end of the wrist to the other
  const wristGeo = useMemo(() => {
    const points = [
      new THREE.Vector2(1.32, -3.8),  // forearm end (narrower — going up arm)
      new THREE.Vector2(1.38, -2.0),
      new THREE.Vector2(1.42, -0.5),  // wrist crease (slightly narrower)
      new THREE.Vector2(1.48, 0.5),
      new THREE.Vector2(1.52, 2.0),
      new THREE.Vector2(1.55, 3.8),   // hand side (slightly wider)
    ];
    return new THREE.LatheGeometry(points, 28);
  }, []);
  useEffect(() => () => wristGeo.dispose(), [wristGeo]);

  // Slight elliptical flattening: x scale < z scale  
  // The wrist group is rotated so the cylinder runs along Z (horizontal wrist under the watch)
  return (
    <group position={[0, 0, -1.55]} rotation={[Math.PI / 2, 0, 0]} scale={[0.96, 1, 1]}>
      {/* Main wrist body */}
      <mesh receiveShadow>
        <primitive object={wristGeo} />
        <meshStandardMaterial color="#c9a07a" roughness={0.78} metalness={0.0} />
      </mesh>

      {/* Styloid process (wrist bone) bumps */}
      <mesh position={[0.74, 0, 0.3]} castShadow>
        <sphereGeometry args={[0.26, 12, 10]} />
        <meshStandardMaterial color="#bf9068" roughness={0.85} metalness={0} />
      </mesh>
      <mesh position={[-0.66, 0, -0.2]} castShadow>
        <sphereGeometry args={[0.20, 12, 10]} />
        <meshStandardMaterial color="#bf9068" roughness={0.85} metalness={0} />
      </mesh>

      {/* Subtle tendon ridge along top of wrist */}
      <mesh position={[0, 0, 0.6]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.055, 0.055, 7.2, 8]} />
        <meshStandardMaterial color="#b88a62" roughness={0.92} metalness={0} />
      </mesh>
    </group>
  );
}

// ─── Main watch model ──────────────────────────────────────────────────────

export interface WatchModelProps {
  step?: number;
  lastInteractionRef?: React.RefObject<number>;
  showWrist?: boolean;
  /** When true, all animation (auto-rotate, hand springs) is frozen.
   *  Use when embedding the watch inside a static display (e.g. the gift box). */
  paused?: boolean;
  /** When provided, overrides the global WatchConfigContext for this instance. */
  configOverride?: ExtendedConfigState;
}

// ─── WatchEyes — 3D eyes that track the camera (EYE: face mode) ──────────────
//
// Two eyeballs (sclera → iris → pupil) are placed on the face plane.
// Each frame the pupils shift toward wherever the camera is looking from,
// giving a creepy/fun "alive eyes" effect that works with any watch geometry.
function WatchEyes({ faceZ, handsColor }: { faceZ: number; handsColor: string }) {
  const leftPupilRef  = useRef<THREE.Mesh>(null);
  const rightPupilRef = useRef<THREE.Mesh>(null);
  const eyeGroupRef   = useRef<THREE.Group>(null);
  // Pre-allocated temporaries — reused every frame (no per-frame allocation)
  const _mat4 = useRef(new THREE.Matrix4());
  const _vec3 = useRef(new THREE.Vector3());

  useFrame(({ camera }) => {
    if (!eyeGroupRef.current) return;
    // Transform camera world position into this group's local space so the
    // pupils track correctly even as the watch rotates around Y.
    _mat4.current.copy(eyeGroupRef.current.matrixWorld).invert();
    _vec3.current.copy(camera.position).applyMatrix4(_mat4.current);

    const maxOff = 0.092;
    const scale  = Math.min(1, 4 / (Math.abs(_vec3.current.z) || 4));
    const px = THREE.MathUtils.clamp(_vec3.current.x * 0.065 * scale, -maxOff, maxOff);
    const py = THREE.MathUtils.clamp(_vec3.current.y * 0.065 * scale, -maxOff, maxOff);

    if (leftPupilRef.current) {
      leftPupilRef.current.position.x = px;
      leftPupilRef.current.position.y = py;
    }
    if (rightPupilRef.current) {
      rightPupilRef.current.position.x = px;
      rightPupilRef.current.position.y = py;
    }
  });

  const eyeZ = faceZ + 0.016;

  const Eye = ({ side }: { side: -1 | 1 }) => (
    <group position={[side * 0.42, 0.10, 0]}>
      {/* Sclera (white) */}
      <mesh>
        <circleGeometry args={[0.265, 36]} />
        <meshStandardMaterial color="#f5f5ee" roughness={0.22} metalness={0} />
      </mesh>
      {/* Iris */}
      <mesh position={[0, 0, 0.002]}>
        <circleGeometry args={[0.168, 28]} />
        <meshStandardMaterial color={handsColor} roughness={0.35} metalness={0.08} />
      </mesh>
      {/* Pupil — position driven by useFrame via ref */}
      <mesh ref={side === -1 ? leftPupilRef : rightPupilRef} position={[0, 0, 0.004]}>
        <circleGeometry args={[0.098, 22]} />
        <meshStandardMaterial color="#060606" roughness={0.9} metalness={0} />
      </mesh>
      {/* Specular highlight */}
      <mesh position={[0.072, 0.075, 0.007]}>
        <circleGeometry args={[0.038, 12]} />
        <meshStandardMaterial color="white" roughness={0.05} transparent opacity={0.88} />
      </mesh>
    </group>
  );

  return (
    <group ref={eyeGroupRef} position={[0, 0, eyeZ]}>
      <Eye side={-1} />
      <Eye side={1} />
    </group>
  );
}

// Lug geometry measurements — all three constants kept in lockstep so
// the lug arm, spring bar, and strap attachment always share the same Y and Z origin.
const LUG_TIP_Y  = 1.85;  // |y| of spring bar / strap attachment (top of lug arm)
const LUG_ARM_Z  = 0.10;  // Z center for lug body, spring bar, and strap — single source of truth
// STRAP_HALF removed — strap length now expressed as WRAP_SEGS × SEG_LEN in the StrapJoint chain

export default function WatchModel({ step = 0, lastInteractionRef, showWrist = false, paused = false, configOverride }: WatchModelProps) {
  const { config: ctxConfig } = useWatchConfig();
  const config: ExtendedConfigState = configOverride ?? ctxConfig;
  const groupRef = useRef<THREE.Group>(null);
  const prevStepRef = useRef(step);
  const faceSnapTargetRef = useRef<number | null>(null);
  const rotResumeStartRef = useRef<number | null>(null);

  // Болванки hand refs — each group's rotation.z is driven imperatively in useFrame
  const hourHandRef   = useRef<THREE.Group>(null);
  const minuteHandRef = useRef<THREE.Group>(null);
  const secHandRef    = useRef<THREE.Group>(null);
  const gmtHandRef    = useRef<THREE.Group>(null);
  // Mechanical target angles (where a rigid hand would be)
  const hourAngle   = useRef(Math.PI / 5);
  const minuteAngle = useRef(-Math.PI / 3.5);
  const secAngle    = useRef(Math.PI * 0.75);
  // Actual rendered angles + velocities — spring-damper (loose-pin physics)
  const hourActual  = useRef(Math.PI / 5);
  const minActual   = useRef(-Math.PI / 3.5);
  const secActual   = useRef(Math.PI * 0.75);
  const gmtActual   = useRef(Math.PI * 0.12);
  const hourVel     = useRef(0);
  const minVel      = useRef(0);
  const secVel      = useRef(0);
  const prevCamAz   = useRef<number | null>(null);

  useEffect(() => {
    if (step === 3 && prevStepRef.current !== 3 && groupRef.current) {
      const curY = groupRef.current.rotation.y;
      faceSnapTargetRef.current = Math.round(curY / (Math.PI * 2)) * Math.PI * 2;
    } else if (step !== 3) {
      faceSnapTargetRef.current = null;
    }
    prevStepRef.current = step;
  }, [step]);

  // Tilt + wrist-snap Z position (watch moves forward/into wrist when wrist shown)
  // When paused (e.g. inside the gift box) hold perfectly flat at 0 rotation.
  const { tiltX, watchZ } = useSpring({
    tiltX: paused ? 0 : (step === 2 ? 0.52 : -0.32),
    watchZ: paused ? 0 : (showWrist ? 0.2 : 0),
    config: { mass: 1, tension: 110, friction: 22 },
  });

  // Strap wrap — each spring drives the TOTAL bend angle for one arm.
  // The StrapJoint chain distributes this across WRAP_SEGS pivot joints
  // (θ = total / WRAP_SEGS per joint) to produce a smooth circular arc.
  // 1.4 rad ≈ 80° total gives a convincing wrist-cradling curve.
  const { wrapUpper, wrapLower } = useSpring({
    wrapUpper: step === 2 ? -1.4 : 0,
    wrapLower: step === 2 ?  1.4 : 0,
    config: { mass: 1.4, tension: 80, friction: 30 },
  });
  // Per-joint fractional angles — passed to every animated.group in the chain
  const θUpper = wrapUpper.to(v => v / WRAP_SEGS);
  const θLower = wrapLower.to(v => v / WRAP_SEGS);

  useFrame(({ camera }, delta) => {
    if (!groupRef.current) return;
    // Frozen display mode — no animation at all (used inside the gift box)
    if (paused) return;

    // ── Болванки hands: spring-damper "loose pin" physics ───────────────────
    // Each hand has a mechanical target (rigid gear-ratio drive from camera azimuth)
    // and an actual rendered position that springs toward that target with low damping.
    // Low damping ratio → underdamped → hands oscillate (wobble) around the target
    // before settling, just like a hand loose on its friction pin.
    const camAz = Math.atan2(camera.position.x, camera.position.z);
    if (prevCamAz.current !== null) {
      let dAz = camAz - prevCamAz.current;
      if (dAz >  Math.PI) dAz -= 2 * Math.PI;
      if (dAz < -Math.PI) dAz += 2 * Math.PI;
      // Mechanical targets — driven by watch rotation at different gear ratios
      hourAngle.current   -= dAz * 1.4;
      minuteAngle.current -= dAz * 4.8;
      secAngle.current    -= dAz * 13;

      // Spring-damper for each hand: F = k*(target-actual) - b*velocity
      // k (stiffness): lower = looser, more lag
      // b (damping): lower = more oscillation before settling
      const springStep = (
        actual: React.MutableRefObject<number>,
        vel:    React.MutableRefObject<number>,
        target: number,
        k: number,
        b: number,
      ) => {
        let err = target - actual.current;
        // Shortest-path wrap so spring never chooses the long way around
        err = ((err % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
        vel.current    += (k * err - b * vel.current) * delta;
        actual.current += vel.current * delta;
      };

      springStep(hourActual, hourVel, hourAngle.current,    3.5, 0.80); // heavy, lazy
      springStep(minActual,  minVel,  minuteAngle.current,  6.0, 0.55); // medium
      springStep(secActual,  secVel,  secAngle.current,    18.0, 0.28); // light, quick, oscillates most
      // GMT: 24h hand — no spring, rigid (navigators expect precision)
      gmtActual.current = hourAngle.current * 0.5;
    }
    prevCamAz.current = camAz;

    if (hourHandRef.current)   hourHandRef.current.rotation.z   = hourActual.current;
    if (minuteHandRef.current) minuteHandRef.current.rotation.z = minActual.current;
    if (secHandRef.current)    secHandRef.current.rotation.z    = secActual.current;
    if (gmtHandRef.current)    gmtHandRef.current.rotation.z    = gmtActual.current;

    // ── Watch auto-rotation ────────────────────────────────────────────────────
    const userActive = lastInteractionRef?.current
      ? Date.now() - lastInteractionRef.current < INTERACTION_PAUSE_MS
      : false;
    if (userActive) { rotResumeStartRef.current = null; return; }
    if (rotResumeStartRef.current === null) rotResumeStartRef.current = Date.now();
    const speedFactor = Math.min(1, (Date.now() - rotResumeStartRef.current) / RESUME_RAMP_MS);

    if (faceSnapTargetRef.current !== null) {
      const target = faceSnapTargetRef.current;
      groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, target, 0.06 * speedFactor);
      if (Math.abs(groupRef.current.rotation.y - target) < 0.001) {
        groupRef.current.rotation.y = target;
        faceSnapTargetRef.current = null;
      }
    } else {
      groupRef.current.rotation.y += 0.004 * speedFactor;
    }
  });

  const bodyGeo = useMemo(() => {
    const shape = buildFaceShape(config.watchfaceGeometry);
    return new THREE.ExtrudeGeometry(shape, {
      depth: 0.38,
      bevelEnabled: true,
      bevelSize: 0.09,
      bevelThickness: 0.09,
      bevelSegments: 8,
    });
  }, [config.watchfaceGeometry]);

  const discGeo = useMemo(() => new THREE.ShapeGeometry(buildFaceShape(config.watchfaceGeometry), 72), [config.watchfaceGeometry]);
  // Domed crystal — ExtrudeGeometry so the crystal has visible thickness from
  // the side and bevelled edges that catch light like real sapphire/mineral glass.
  // bevelSegments=10 creates smooth dome-like rounded edges; depth=0.04 is the flat
  // slab between the two bevels.
  const crystalGeo = useMemo(() => {
    const shape = buildFaceShape(config.watchfaceGeometry);
    return new THREE.ExtrudeGeometry(shape, {
      depth: 0.04,
      bevelEnabled: true,
      bevelSize: 0.04,
      bevelThickness: 0.04,
      bevelSegments: 10,
    });
  }, [config.watchfaceGeometry]);

  const hasText = !!(config.watchfaceText?.trim()) && !config.watchfaceText.startsWith('EYE:');
  // Resolve text mode from config — 'circular' (default) or 'center'
  const textMode = ((config.watchfaceTextMode ?? 'circular') === 'center' ? 'center' : 'circular') as 'circular' | 'center';
  const handsOn  = config.handsEnabled !== false;

  // center + hands → canvas draws flat 2D text under the hands
  // all other combos → canvas stays blank, Text3D handles it
  const canvasTextMode: 'none' | 'circular' | 'center-flat' | 'center-raised' =
    hasText && textMode === 'center' && handsOn ? 'center-flat' : 'none';

  const isCircular = hasText && textMode === 'circular';

  const faceTexture = useMemo(
    () => buildFaceTexture(config.watchfaceColor, config.handsColor, config.watchfaceGeometry, canvasTextMode, config.watchfaceText),
    [config.watchfaceColor, config.handsColor, config.watchfaceGeometry, canvasTextMode, config.watchfaceText]
  );

  const isMetal = config.watchfaceMaterial === 'metal';
  const caseMat = useMemo(() => ({
    color: config.watchfaceColor,
    metalness: isMetal ? 0.88 : 0.05,
    roughness: isMetal ? 0.12 : 0.72,
  }), [config.watchfaceColor, config.watchfaceMaterial]);

  const isSegmented = config.braceletMaterial === 'metal_segmented';
  const isDeployant = config.braceletType === 'segmented';
  const caseHalf = shapeHalfWidth(config.watchfaceGeometry);
  const faceZ = 0.48;
  const crystalZ = 0.56;
  const handsZ = 0.57;

  return (
    <>
    <animated.group ref={groupRef} rotation-x={tiltX} position-z={watchZ} scale={config.watchfaceSize ?? 1}>

      {/* ── Case body ── */}
      <mesh castShadow receiveShadow>
        <primitive object={bodyGeo} />
        <meshStandardMaterial {...caseMat} envMapIntensity={1.4} />
      </mesh>

      {/* Back panel — brand + serial */}
      <WatchBackPanel
        geom={config.watchfaceGeometry}
        caseColor={config.watchfaceColor}
        serial={config.serialNumber || undefined}
        collectionName={(config as any).collectionName || null}
      />

      {/* Face disc */}
      <mesh position={[0, 0, faceZ]}>
        <primitive object={discGeo} />
        <meshStandardMaterial map={faceTexture} roughness={0.25} metalness={0.05} />
      </mesh>

      {/* 3D face text — rendered between dial and crystal.
          Isolated in its own Suspense + ErrorBoundary so a font-load failure
          (CDN unreachable, worker blocked, etc.) only hides the text and never
          crashes the entire WebGL canvas. */}
      {config.watchfaceText && (
        <TextErrorBoundary>
          <Suspense fallback={null}>
            <WatchFaceText
              text={config.watchfaceText}
              mode={textMode}
              textColor={config.watchfaceTextColor ?? config.handsColor ?? '#fbbf24'}
              faceZ={faceZ}
              handsEnabled={config.handsEnabled ?? true}
              geom={config.watchfaceGeometry ?? 'circle'}
            />
          </Suspense>
        </TextErrorBoundary>
      )}

      {/* EYE: mode — two 3D eyeballs that track the camera every frame */}
      {config.watchfaceText?.startsWith('EYE:') && (
        <WatchEyes faceZ={faceZ} handsColor={config.handsColor ?? '#ffffff'} />
      )}

      {/* Crystal — high-fidelity sapphire glass */}
      {/* Sits at starCrystalZ so the bevelled bottom starts just above the hands.
          transmission + clearcoat together produce two distinct visual layers:
            1. The transmissive body lets the dial + hands show through with IOR distortion
            2. The clearcoat surface acts as a real mirror/reflection plane for env highlights */}
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

      {/* Watch hands — болванки: rotation.z driven imperatively in useFrame */}
      {config.handsEnabled && (config.handsCount ?? 3) >= 1 && (
        <group position={[0, 0, handsZ]}>
          <group ref={hourHandRef}>
            <mesh position={[0, 0.26, 0]} castShadow>
              <boxGeometry args={[0.058, 0.52, 0.018]} />
              <meshStandardMaterial color={config.handsColor} metalness={0.94} roughness={0.06} />
            </mesh>
            <mesh position={[0, 0.52, 0]} castShadow>
              <boxGeometry args={[0.034, 0.06, 0.018]} />
              <meshStandardMaterial color={config.handsColor} metalness={0.94} roughness={0.06} />
            </mesh>
            <mesh position={[0, -0.072, 0]} castShadow>
              <boxGeometry args={[0.072, 0.10, 0.022]} />
              <meshStandardMaterial color={config.handsColor} metalness={0.94} roughness={0.06} />
            </mesh>
          </group>
          {(config.handsCount ?? 3) >= 2 && (
          <group ref={minuteHandRef}>
            <mesh position={[0, 0.38, 0]} castShadow>
              <boxGeometry args={[0.040, 0.76, 0.016]} />
              <meshStandardMaterial color={config.handsColor} metalness={0.94} roughness={0.06} />
            </mesh>
            <mesh position={[0, 0.76, 0]} castShadow>
              <boxGeometry args={[0.022, 0.04, 0.016]} />
              <meshStandardMaterial color={config.handsColor} metalness={0.94} roughness={0.06} />
            </mesh>
            <mesh position={[0, -0.08, 0]} castShadow>
              <boxGeometry args={[0.055, 0.12, 0.020]} />
              <meshStandardMaterial color={config.handsColor} metalness={0.94} roughness={0.06} />
            </mesh>
          </group>
          )}
          {(config.handsCount ?? 3) >= 3 && (
            <group ref={secHandRef}>
              <mesh position={[0, 0.34, 0.002]} castShadow>
                <boxGeometry args={[0.010, 0.68, 0.008]} />
                <meshStandardMaterial color="#ef4444" metalness={0.75} roughness={0.15} />
              </mesh>
              <mesh position={[0, 0.62, 0.002]}>
                <cylinderGeometry args={[0.022, 0.022, 0.008, 12]} />
                <meshStandardMaterial color="#ef4444" metalness={0.75} roughness={0.15} />
              </mesh>
              <mesh position={[0, -0.10, 0.002]} castShadow>
                <boxGeometry args={[0.024, 0.16, 0.010]} />
                <meshStandardMaterial color="#ef4444" metalness={0.75} roughness={0.15} />
              </mesh>
            </group>
          )}
          {/* 4th hand — GMT / 24 h, blue arrow style */}
          {(config.handsCount ?? 3) >= 4 && (
            <group ref={gmtHandRef}>
              {/* Shaft — slightly shorter than hour hand */}
              <mesh position={[0, 0.24, -0.003]} castShadow>
                <boxGeometry args={[0.012, 0.48, 0.008]} />
                <meshStandardMaterial color="#3b82f6" metalness={0.9} roughness={0.1} />
              </mesh>
              {/* Arrowhead */}
              <mesh position={[0, 0.50, -0.003]} castShadow>
                <coneGeometry args={[0.026, 0.072, 3, 1]} />
                <meshStandardMaterial color="#3b82f6" metalness={0.9} roughness={0.1} />
              </mesh>
              {/* Counter-weight */}
              <mesh position={[0, -0.06, -0.003]} castShadow>
                <boxGeometry args={[0.020, 0.08, 0.008]} />
                <meshStandardMaterial color="#3b82f6" metalness={0.9} roughness={0.1} />
              </mesh>
            </group>
          )}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.058, 0.058, 0.006, 28]} />
            <meshStandardMaterial color={config.handsColor} metalness={1} roughness={0.02} />
          </mesh>
          <mesh position={[0, 0, 0.007]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.024, 0.024, 0.004, 16]} />
            <meshStandardMaterial color="#ef4444" metalness={0.85} roughness={0.08} />
          </mesh>
        </group>
      )}

      {/* Crown — positioned flush with the right edge of the case for every geometry */}
      <mesh position={[caseHalf + 0.12, 0.18, 0.10]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.09, 0.085, 0.28, 18]} />
        <meshStandardMaterial {...caseMat} />
      </mesh>
      <mesh position={[caseHalf + 0.16, 0.18, 0.10]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.09, 0.018, 8, 18]} />
        <meshStandardMaterial color={caseMat.color} metalness={caseMat.metalness} roughness={Math.min(1, caseMat.roughness + 0.15)} />
      </mesh>

      {/* ── Lugs — geometry-aware arm + spring bar ── */}
      {/* The lug arm starts 0.12 units inside the case body (caseHalf - 0.12) so it
          is always physically rooted regardless of case geometry (circle / square /
          drawn / star).  The spring bar sits at the tip (LUG_TIP_Y) — the exact
          same Y as the strap pivot — so the strap attaches flush to the pin.
          All lug parts share LUG_ARM_Z so straps never float in a different Z plane. */}
      {([+1, -1] as const).map((sign) => {
        const tipY      = sign * LUG_TIP_Y;
        const baseY     = sign * (caseHalf - 0.12);   // 0.12 inside case body
        const centerY   = (tipY + baseY) / 2;
        const lugHeight = Math.abs(tipY - baseY);
        return (
          <group key={sign}>
            {/* Lug arm body — runs from inside-case root to spring-bar tip */}
            <mesh position={[0, centerY, LUG_ARM_Z]} castShadow receiveShadow>
              <boxGeometry args={[1.14, lugHeight, 0.26]} />
              <meshStandardMaterial {...caseMat} envMapIntensity={1.5} />
            </mesh>
            {/* Chamfer strip — polished front face of the lug arm */}
            <mesh position={[0, centerY, LUG_ARM_Z + 0.07]} castShadow>
              <boxGeometry args={[1.10, lugHeight, 0.04]} />
              <meshStandardMaterial
                color={caseMat.color}
                metalness={Math.min(1, caseMat.metalness + 0.08)}
                roughness={Math.max(0.03, caseMat.roughness - 0.08)}
                envMapIntensity={2.0}
              />
            </mesh>
            {/* Spring bar pin — at the TIP of the lug arm, same Y as strap pivot */}
            <mesh position={[0, tipY, LUG_ARM_Z + 0.03]} rotation={[0, 0, Math.PI / 2]} castShadow>
              <cylinderGeometry args={[0.036, 0.036, 1.22, 14]} />
              <meshStandardMaterial color={caseMat.color} metalness={0.97} roughness={0.02} envMapIntensity={2.2} />
            </mesh>
            {/* Keeper rings at bar ends */}
            {[-0.56, 0.56].map((x) => (
              <mesh key={x} position={[x, tipY, LUG_ARM_Z + 0.03]} rotation={[0, 0, Math.PI / 2]}>
                <torusGeometry args={[0.036, 0.016, 8, 12]} />
                <meshStandardMaterial color={caseMat.color} metalness={0.98} roughness={0.02} />
              </mesh>
            ))}
          </group>
        );
      })}

      {/* ── Upper strap — 6-joint bone chain from lug tip ── */}
      {/* θUpper is the PER-JOINT rotation (total / WRAP_SEGS); nesting
          joints inside each other accumulates the total bend at the tip. */}
      <group position={[0, LUG_TIP_Y, LUG_ARM_Z]}>
        <StrapJoint k={0} sign={1} θ={θUpper}
          color={config.braceletColor} mat={config.braceletMaterial}
          isSegmented={isSegmented} isDeployant={isDeployant} claspColor={caseMat.color}
          width={config.strapWidth ?? 1} />
      </group>

      {/* ── Lower strap — mirror bone chain ── */}
      <group position={[0, -LUG_TIP_Y, LUG_ARM_Z]}>
        <StrapJoint k={0} sign={-1} θ={θLower}
          color={config.braceletColor} mat={config.braceletMaterial}
          isSegmented={isSegmented} isDeployant={isDeployant} claspColor={caseMat.color}
          width={config.strapWidth ?? 1} />
      </group>

      {/* Bezel ring — machined metal overlay around crystal */}
      <BezelRing geom={config.watchfaceGeometry} caseMat={caseMat} />

      {/* Wrist mannequin — inside the tilt group so it follows the watch rotation */}
      {showWrist && <WristMannequin />}

    </animated.group>
    </>
  );
}
