import React, { useRef, useMemo, useEffect, Suspense } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Text3D, Center } from '@react-three/drei';
import { useWatchConfig } from '@/hooks/use-watch-config';
import * as THREE from 'three';
import { useSpring, animated } from '@react-spring/three';

// ─── Shape helpers ─────────────────────────────────────────────────────────

function shapeHalfWidth(geom: string): number {
  if (geom === 'circle') return 1.5;
  if (geom === 'square') return 1.28;
  if (geom === 'star') return 1.52;
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
  } else if (geom === 'star') {
    // Machined star: straight outer edges, concave bezier valleys
    const pts = 5;
    const oR = 1.52;  // outer tip radius
    const iR = 0.74;  // inner valley radius (raised slightly for machined look)

    // Pre-compute all 10 vertices (alternating outer/inner)
    const verts = Array.from({ length: pts * 2 }, (_, i) => {
      const r = i % 2 === 0 ? oR : iR;
      const a = (i * Math.PI) / pts - Math.PI / 2;
      return { x: r * Math.cos(a), y: r * Math.sin(a), a };
    });

    s.moveTo(verts[0].x, verts[0].y);
    for (let i = 1; i <= pts * 2; i++) {
      const v = verts[i % (pts * 2)];
      const isOuter = (i % 2 === 0);
      if (isOuter) {
        // Outer point: straight line (sharp tip)
        s.lineTo(v.x, v.y);
      } else {
        // Inner valley: concave quadratic bezier — control point pulled toward center
        // This creates the characteristic machined/milled concave groove
        const prevV = verts[(i - 1) % (pts * 2)];
        const nextV = verts[(i + 1) % (pts * 2)];
        // Midpoint direction toward center, pulled inward
        const cpX = v.x * 0.78;
        const cpY = v.y * 0.78;
        s.quadraticCurveTo(cpX, cpY, v.x, v.y);
      }
    }
    s.closePath();
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

function buildFaceTexture(
  faceColor: string,
  handsColor: string,
  geom: string,
  isCircular: boolean,
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

  const markerR = S * 0.33;
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI * 2) / 12 - Math.PI / 2;
    const x = S / 2 + markerR * Math.cos(a);
    const y = S / 2 + markerR * Math.sin(a);
    ctx.beginPath();
    const dotR = isCircular ? (i % 3 === 0 ? 5 : 2.5) : (i % 3 === 0 ? 8 : 4);
    ctx.arc(x, y, dotR, 0, Math.PI * 2);
    ctx.fillStyle = handsColor;
    ctx.globalAlpha = isCircular ? 0.5 : 0.8;
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  ctx.beginPath();
  ctx.arc(S / 2, S / 2, 7, 0, Math.PI * 2);
  ctx.fillStyle = handsColor;
  ctx.fill();

  const tex = new THREE.CanvasTexture(cv);
  const half = shapeHalfWidth(geom);
  const rep = 0.5 / half;
  tex.offset.set(0.5, 0.5);
  tex.repeat.set(rep, rep);
  tex.needsUpdate = true;
  return tex;
}

// ─── 3D text on the watchface ──────────────────────────────────────────────

const FONT_URL = '/dejavu_bold.typeface.json';
const TEXT_DEPTH = 0.06;

function WatchFaceText3D({ text, mode, handsColor, faceZ }: {
  text: string; mode: 'center' | 'circular'; handsColor: string; faceZ: number;
}) {
  const trimmed = text.trim().toUpperCase();
  const chars   = Array.from(trimmed);

  // Arc geometry — computed unconditionally so hooks are never called conditionally.
  // 0.27 rad/char keeps letters comfortably spaced; cap at 0.88π so they stay in the top hemisphere.
  const arcSpan = Math.min(Math.PI * 0.88, chars.length * 0.27);
  const arcLeft = Math.PI / 2 + arcSpan / 2;           // leftmost char angle (10-11 o'clock)
  const step    = chars.length > 0 ? arcSpan / chars.length : 1;
  const circR   = 1.26;

  // Pre-compute per-letter position + quaternion using explicit makeBasis so axes are unambiguous:
  //   right   = CW-tangent  → (sin a, -cos a, 0)  — letters read left→right
  //   up      = outward-radial → (cos a,  sin a, 0)  — letter bottom faces center
  //   forward = +Z                                  — face always toward viewer
  const letterData = useMemo(() => chars.map((_, i) => {
    const angle   = arcLeft - (i + 0.5) * step;
    const x       = circR * Math.cos(angle);
    const y       = circR * Math.sin(angle);
    const right   = new THREE.Vector3( Math.sin(angle), -Math.cos(angle), 0);
    const outward = new THREE.Vector3( Math.cos(angle),  Math.sin(angle), 0);
    const m       = new THREE.Matrix4().makeBasis(right, outward, new THREE.Vector3(0, 0, 1));
    const q       = new THREE.Quaternion().setFromRotationMatrix(m);
    return { x, y, q };
  }), [trimmed, arcLeft, step]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!trimmed) return null;

  // textZ: just above the face disc surface, always below the crystal.
  // faceZ is passed from the parent (starFaceZ) so it adapts to geometry variant.
  const textZ = faceZ + 0.01;
  const mat   = <meshStandardMaterial color={handsColor} metalness={0.55} roughness={0.2} />;

  if (mode === 'circular') {
    const fontSize = Math.max(0.09, Math.min(0.17, 0.78 / Math.max(chars.length, 4)));
    return (
      <group position={[0, 0, textZ]}>
        {chars.map((ch, i) => {
          const { x, y, q } = letterData[i];
          return (
            <group key={i} position={[x, y, 0]} quaternion={q}>
              <Center>
                <Text3D font={FONT_URL} size={fontSize} height={TEXT_DEPTH}
                  bevelEnabled bevelSize={0.008} bevelThickness={0.008} bevelSegments={3} curveSegments={6}>
                  {ch}{mat}
                </Text3D>
              </Center>
            </group>
          );
        })}
        <group position={[0, -0.14, 0]}>
          <Center>
            <Text3D font={FONT_URL} size={0.055} height={0.02} bevelEnabled={false} curveSegments={4}>
              {'ЧЕБЛЯЧАС'}
              <meshStandardMaterial color={handsColor} metalness={0.4} roughness={0.4} opacity={0.4} transparent />
            </Text3D>
          </Center>
        </group>
      </group>
    );
  }

  const lines   = trimmed.split('\n').filter(Boolean).slice(0, 4);
  const maxLen  = Math.max(...lines.map(l => l.length), 1);
  const fSize   = Math.min(0.28, Math.max(0.08, 0.7 / maxLen));
  const lineH   = fSize * 1.4;
  const totalH  = (lines.length - 1) * lineH;
  return (
    <group position={[0, 0, textZ]}>
      {lines.map((line, i) => (
        <group key={i} position={[0, totalH / 2 - i * lineH, 0]}>
          <Center>
            <Text3D font={FONT_URL} size={fSize} height={TEXT_DEPTH}
              bevelEnabled bevelSize={0.012} bevelThickness={0.012} bevelSegments={3} curveSegments={8}>
              {line}{mat}
            </Text3D>
          </Center>
        </group>
      ))}
      <group position={[0, -totalH / 2 - fSize * 0.85, 0]}>
        <Center>
          <Text3D font={FONT_URL} size={0.06} height={0.02} bevelEnabled={false} curveSegments={4}>
            {'ЧЕБЛЯЧАС'}
            <meshStandardMaterial color={handsColor} metalness={0.4} roughness={0.4} opacity={0.3} transparent />
          </Text3D>
        </Center>
      </group>
    </group>
  );
}

// ─── Strap renderers ───────────────────────────────────────────────────────

// Segmented metal-link strap — starts at y=0 (the pivot/spring-bar plane) and
// grows outward in the sign(posY) direction.  Never centered around posY so
// segments cannot clip back into the lug body above the attachment point.
function SegmentedStrap({ posY, color }: { posY: number; color: string }) {
  const sign  = Math.sign(posY) || 1;
  const count = 9;
  const segH  = 0.28;
  const gap   = 0.06;
  return (
    <group>
      {Array.from({ length: count }).map((_, i) => (
        <mesh key={i} position={[0, sign * (i * (segH + gap) + segH / 2), 0]} castShadow>
          <boxGeometry args={[1.05, segH, 0.15]} />
          <meshStandardMaterial color={color} metalness={0.92} roughness={0.07} />
        </mesh>
      ))}
    </group>
  );
}

function SolidStrap({ posY, color, mat }: { posY: number; color: string; mat: string }) {
  const isResin = mat === 'resin';
  const isFabric = mat === 'cotton_fabric';
  const isLeather = mat === 'leather';
  const metalness = mat.includes('metal') ? 0.85 : 0.0;
  const roughness = isLeather ? 0.92 : isFabric ? 0.88 : isResin ? 0.06 : 0.78;

  if (isFabric) {
    return (
      <group position={[0, posY, 0]}>
        <mesh castShadow>
          <boxGeometry args={[1.05, 2.4, 0.10]} />
          <meshStandardMaterial color={color} roughness={0.9} metalness={0} />
        </mesh>
        {[-0.36, -0.12, 0.12, 0.36].map((x, i) => (
          <mesh key={i} position={[x, 0, 0.06]} castShadow>
            <boxGeometry args={[0.05, 2.4, 0.04]} />
            <meshStandardMaterial color={new THREE.Color(color).offsetHSL(0, 0, 0.12).getStyle()} roughness={0.85} metalness={0} />
          </mesh>
        ))}
      </group>
    );
  }

  return (
    <mesh position={[0, posY, 0]} castShadow>
      <boxGeometry args={[1.05, 2.4, 0.15]} />
      <meshStandardMaterial
        color={color}
        metalness={metalness}
        roughness={roughness}
        transparent={isResin}
        opacity={isResin ? 0.72 : 1}
      />
    </mesh>
  );
}

// ─── Camera controller ─────────────────────────────────────────────────────

const INTERACTION_PAUSE_MS = 10_000;
const RESUME_RAMP_MS = 2_500;

export function CameraRig({ step, lastInteractionRef }: {
  step: number;
  lastInteractionRef?: React.RefObject<number>;
}) {
  const { camera } = useThree();
  const targets: [number, number, number][] = [
    [0, 1.2, 7.5],
    [0, 1.2, 7.5],
    [0, -3.0, 7.0],
    [0, 1.2, 7.5],
    [0, 1.2, 7.5],
  ];
  const pos = targets[Math.min(step, targets.length - 1)];
  const vec = useMemo(() => new THREE.Vector3(...pos), [step]);
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

function buildBackTexture(geom: string, caseColor: string, serial?: string): THREE.CanvasTexture {
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

function WatchBackPanel({ geom, caseColor, serial }: {
  geom: string; caseColor: string; serial?: string;
}) {
  const backDiscGeo = useMemo(() => new THREE.ShapeGeometry(buildFaceShape(geom), 72), [geom]);
  const backTexture = useMemo(() => buildBackTexture(geom, caseColor, serial), [geom, caseColor, serial]);
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

// ─── Realistic star bezel ring with chamfered arms ─────────────────────────
// Extra ring only for star geometry — adds a visible machined star bezel face
function StarCaseAccent({ caseMat }: { caseMat: { color: string; metalness: number; roughness: number } }) {
  const geo = useMemo(() => {
    // Build a slightly-inset star shape for the accent ring (outer edge of the star case face)
    const outerShape = buildFaceShape('star');
    const innerPts = buildFaceShape('star').getPoints(64);
    const innerShape = new THREE.Shape(innerPts.map(p => new THREE.Vector2(p.x * 0.82, p.y * 0.82)));
    outerShape.holes = [innerShape];
    return new THREE.ExtrudeGeometry(outerShape, {
      depth: 0.12,
      bevelEnabled: true,
      bevelSize: 0.035,
      bevelThickness: 0.035,
      bevelSegments: 6,
    });
  }, []);
  useEffect(() => () => geo.dispose(), [geo]);

  return (
    <mesh position={[0, 0, 0.28]} castShadow receiveShadow>
      <primitive object={geo} />
      <meshStandardMaterial
        color={caseMat.color}
        metalness={Math.min(1, caseMat.metalness + 0.10)}
        roughness={Math.max(0.03, caseMat.roughness - 0.08)}
        envMapIntensity={2.0}
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
}

// Lug geometry measurements — all three constants kept in lockstep so
// the lug arm, spring bar, and strap attachment always share the same Y and Z origin.
const LUG_TIP_Y  = 1.85;  // |y| of spring bar / strap attachment (top of lug arm)
const LUG_ARM_Z  = 0.10;  // Z center for lug body, spring bar, and strap — single source of truth
const STRAP_HALF = 1.2;   // half-length of each strap (center relative to pivot)

export default function WatchModel({ step = 0, lastInteractionRef, showWrist = false }: WatchModelProps) {
  const { config } = useWatchConfig();
  const groupRef = useRef<THREE.Group>(null);
  const prevStepRef = useRef(step);
  const faceSnapTargetRef = useRef<number | null>(null);
  const rotResumeStartRef = useRef<number | null>(null);

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
  const { tiltX, watchZ } = useSpring({
    tiltX: step === 2 ? 0.52 : -0.32,
    watchZ: showWrist ? 0.2 : 0,
    config: { mass: 1, tension: 110, friction: 22 },
  });

  const { spread } = useSpring({
    spread: step === 2 ? 0.5 : 0,
    config: { mass: 1, tension: 120, friction: 20 },
  });

  // Strap wrap — pivots at lug tips so straps stay anchored while curling around wrist
  const { wrapUpper, wrapLower } = useSpring({
    wrapUpper: step === 2 ? -0.52 : 0,
    wrapLower: step === 2 ? 0.52 : 0,
    config: { mass: 1.2, tension: 95, friction: 26 },
  });

  useFrame(() => {
    if (!groupRef.current) return;
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
    // Star gets extra depth + larger bevel for machined look
    const isStar = config.watchfaceGeometry === 'star';
    return new THREE.ExtrudeGeometry(shape, {
      depth: isStar ? 0.52 : 0.38,
      bevelEnabled: true,
      bevelSize: isStar ? 0.12 : 0.09,
      bevelThickness: isStar ? 0.12 : 0.09,
      bevelSegments: isStar ? 12 : 8,
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

  const isCircular = (config.watchfaceTextMode ?? 'center') === 'circular';
  const faceTexture = useMemo(
    () => buildFaceTexture(config.watchfaceColor, config.handsColor, config.watchfaceGeometry, isCircular),
    [config.watchfaceColor, config.handsColor, config.watchfaceGeometry, isCircular]
  );

  const isMetal = config.watchfaceMaterial === 'metal';
  const caseMat = useMemo(() => ({
    color: config.watchfaceColor,
    metalness: isMetal ? 0.88 : 0.05,
    roughness: isMetal ? 0.12 : 0.72,
  }), [config.watchfaceColor, config.watchfaceMaterial]);

  const isSegmented = config.braceletMaterial === 'metal_segmented';
  const isStar = config.watchfaceGeometry === 'star';
  const hasText = (config.watchfaceText ?? '').trim().length > 0;
  // How far from the origin the case body reaches in ±Y — used to root the lug arm
  // inside the case body rather than floating above it.
  const caseHalf = shapeHalfWidth(config.watchfaceGeometry);

  // Vertical Z offset when star (thicker case) to keep face disc at right z
  const starFaceZ = isStar ? 0.62 : 0.48;
  const starCrystalZ = isStar ? 0.70 : 0.56;
  const starHandsZ = isStar ? 0.71 : 0.57;

  return (
    <>
    <animated.group ref={groupRef} rotation-x={tiltX} position-z={watchZ}>

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
      />

      {/* Face disc */}
      <mesh position={[0, 0, starFaceZ]}>
        <primitive object={discGeo} />
        <meshStandardMaterial map={faceTexture} roughness={0.25} metalness={0.05} />
      </mesh>

      {/* 3D text on face */}
      {hasText && (
        <Suspense fallback={null}>
          <WatchFaceText3D
            text={config.watchfaceText ?? ''}
            mode={config.watchfaceTextMode ?? 'center'}
            handsColor={config.handsColor}
            faceZ={starFaceZ}
          />
        </Suspense>
      )}

      {/* Crystal — high-fidelity sapphire glass */}
      {/* Sits at starCrystalZ so the bevelled bottom starts just above the hands.
          transmission + clearcoat together produce two distinct visual layers:
            1. The transmissive body lets the dial + hands show through with IOR distortion
            2. The clearcoat surface acts as a real mirror/reflection plane for env highlights */}
      <mesh position={[0, 0, starCrystalZ]}>
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

      {/* Watch hands */}
      {config.handsEnabled && (
        <group position={[0, 0, starHandsZ]}>
          <group rotation={[0, 0, Math.PI / 5]}>
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
          <group rotation={[0, 0, -Math.PI / 3.5]}>
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
          {(config.handsCount ?? 3) >= 3 && (
            <group rotation={[0, 0, Math.PI * 0.75]}>
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

      {/* Crown */}
      <mesh position={[1.62, 0.18, 0.10]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.09, 0.085, 0.28, 18]} />
        <meshStandardMaterial {...caseMat} />
      </mesh>
      <mesh position={[1.66, 0.18, 0.10]} rotation={[0, 0, Math.PI / 2]}>
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

      {/* ── Upper strap — pivot at spring-bar tip ── */}
      {/* Base Z = LUG_ARM_Z so the strap sits in the same plane as the spring bar.
          rotation-x wraps the strap around the wrist; position-z adds spread offset. */}
      <group position={[0, LUG_TIP_Y, LUG_ARM_Z]}>
        <animated.group position-z={spread} rotation-x={wrapUpper}>
          {isSegmented
            ? <SegmentedStrap posY={STRAP_HALF} color={config.braceletColor} />
            : <SolidStrap posY={STRAP_HALF} color={config.braceletColor} mat={config.braceletMaterial} />
          }
        </animated.group>
      </group>

      {/* ── Lower strap — pivot at spring-bar tip ── */}
      <group position={[0, -LUG_TIP_Y, LUG_ARM_Z]}>
        <animated.group position-z={spread} rotation-x={wrapLower}>
          {isSegmented
            ? <SegmentedStrap posY={-STRAP_HALF} color={config.braceletColor} />
            : <SolidStrap posY={-STRAP_HALF} color={config.braceletColor} mat={config.braceletMaterial} />
          }
        </animated.group>
      </group>

      {/* Bezel ring — machined metal overlay around crystal */}
      <BezelRing geom={config.watchfaceGeometry} caseMat={caseMat} />

      {/* Star-only: extra stepped accent ring for the machined case arm look */}
      {isStar && <StarCaseAccent caseMat={caseMat} />}

    </animated.group>

    {/* Wrist mannequin — rendered outside watch group so it doesn't rotate with it */}
    {showWrist && <WristMannequin />}
    </>
  );
}
