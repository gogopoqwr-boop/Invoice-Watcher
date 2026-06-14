import React, { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Environment, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useSpring, animated } from '@react-spring/three';

// ─── WebGL check ───────────────────────────────────────────────────────────

function checkWebGL(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl') || (c as any).getContext('experimental-webgl'));
  } catch { return false; }
}
const WEB_GL_OK = checkWebGL();

// ─── Box style presets ─────────────────────────────────────────────────────

const BOX_STYLES = {
  standard: {
    bodyColor:     '#1e293b',
    lidColor:      '#253347',
    interiorColor: '#0f172a',
    cushionColor:  '#2c4a72',   // visible blue-grey vs dark interior
    accentColor:   '#475569',
    rimColor:      '#334155',
    metalness: 0.22,
    roughness: 0.72,
    lidMetalness: 0.18,
    lidRoughness: 0.65,
  },
  premium: {
    bodyColor:     '#100800',
    lidColor:      '#1c0d00',
    interiorColor: '#1a0820',
    cushionColor:  '#6b2060',   // rich velvet purple, visible vs dark interior
    accentColor:   '#c9970a',
    rimColor:      '#b8860b',
    metalness: 0.55,
    roughness: 0.18,
    lidMetalness: 0.60,
    lidRoughness: 0.14,
  },
  collector: {
    bodyColor:     '#5c3d1e',
    lidColor:      '#7c5228',
    interiorColor: '#0e1e10',
    cushionColor:  '#1e4a30',   // forest green satin, contrasts against dark
    accentColor:   '#c9970a',
    rimColor:      '#a07030',
    metalness: 0.10,
    roughness: 0.68,
    lidMetalness: 0.10,
    lidRoughness: 0.62,
  },
};

// ─── Box geometry ──────────────────────────────────────────────────────────

const W = 4.3;   // width
const D = 2.9;   // depth
const H = 1.35;  // body height
const T = 0.13;  // wall thickness
const LID_T = 0.13;

function Box3D({ boxType, open }: { boxType: string; open: boolean }) {
  const s = BOX_STYLES[boxType as keyof typeof BOX_STYLES] ?? BOX_STYLES.standard;

  const { lidAngle } = useSpring({
    lidAngle: open ? -Math.PI * 0.54 : 0.02,
    config: { mass: 1.4, tension: 48, friction: 20 },
  });

  const bodyMat  = { color: s.bodyColor,  metalness: s.metalness,    roughness: s.roughness    };
  const lidMat   = { color: s.lidColor,   metalness: s.lidMetalness,  roughness: s.lidRoughness };
  const rimMat   = { color: s.rimColor,   metalness: 0.75,            roughness: 0.22           };
  const accentMat= { color: s.accentColor,metalness: 0.88,            roughness: 0.12           };
  const intMat   = { color: s.interiorColor, metalness: 0, roughness: 0.96 };
  const cushMat  = { color: s.cushionColor,  metalness: 0, roughness: 0.92 };

  const isPremium  = boxType === 'premium';
  const isCollector= boxType === 'collector';

  return (
    <group>
      {/* ── Box body: bottom + 4 walls ── */}
      {/* Bottom */}
      <mesh position={[0, -H/2 + T/2, 0]} receiveShadow>
        <boxGeometry args={[W, T, D]} />
        <meshStandardMaterial {...bodyMat} />
      </mesh>
      {/* Back wall */}
      <mesh position={[0, 0, -D/2 + T/2]}>
        <boxGeometry args={[W, H, T]} />
        <meshStandardMaterial {...bodyMat} />
      </mesh>
      {/* Front wall */}
      <mesh position={[0, 0, D/2 - T/2]}>
        <boxGeometry args={[W, H, T]} />
        <meshStandardMaterial {...bodyMat} />
      </mesh>
      {/* Left wall */}
      <mesh position={[-W/2 + T/2, 0, 0]}>
        <boxGeometry args={[T, H, D]} />
        <meshStandardMaterial {...bodyMat} />
      </mesh>
      {/* Right wall */}
      <mesh position={[W/2 - T/2, 0, 0]}>
        <boxGeometry args={[T, H, D]} />
        <meshStandardMaterial {...bodyMat} />
      </mesh>

      {/* ── Interior floor ── */}
      <mesh position={[0, -H/2 + T + 0.04, 0]}>
        <boxGeometry args={[W - T*2 - 0.06, 0.05, D - T*2 - 0.06]} />
        <meshStandardMaterial {...intMat} />
      </mesh>

      {/* ── Watch cushion (oval) ── */}
      <mesh position={[0, -H/2 + T + 0.19, 0]} rotation={[0, 0, 0]}>
        <cylinderGeometry args={[1.06, 1.0, 0.24, 40]} />
        <meshStandardMaterial {...cushMat} />
      </mesh>
      {/* Cushion dip (inner) */}
      <mesh position={[0, -H/2 + T + 0.30, 0]}>
        <cylinderGeometry args={[0.44, 0.44, 0.06, 32]} />
        <meshStandardMaterial color={s.cushionColor} roughness={0.98} metalness={0} />
      </mesh>

      {/* ── Rim / edge trim ── */}
      <mesh position={[0, H/2 - T*0.3, 0]}>
        <boxGeometry args={[W + 0.04, T * 0.35, D + 0.04]} />
        <meshStandardMaterial {...rimMat} />
      </mesh>

      {/* ── Accent corners for premium / collector ── */}
      {(isPremium || isCollector) && (
        <>
          {([-W/2 + T*0.5, W/2 - T*0.5] as number[]).flatMap(x =>
            ([-D/2 + T*0.5, D/2 - T*0.5] as number[]).map(z => (
              <mesh key={`c${x}_${z}`} position={[x, -H/2 + T + 0.01, z]} castShadow>
                <boxGeometry args={[0.28, 0.06, 0.28]} />
                <meshStandardMaterial {...accentMat} />
              </mesh>
            ))
          )}
        </>
      )}

      {/* ── Hinge cylinders ── */}
      {[-W/2 + 0.55, 0, W/2 - 0.55].map(x => (
        <mesh key={`h${x}`} position={[x, H/2 + 0.02, -D/2 + T/2]} rotation={[0, 0, Math.PI/2]}>
          <cylinderGeometry args={[0.07, 0.07, 0.24, 12]} />
          <meshStandardMaterial {...rimMat} />
        </mesh>
      ))}

      {/* ── Wood grain lines for collector ── */}
      {isCollector && ([0.3, 0.6, 0.9, -0.3, -0.6, -0.9] as number[]).map(z => (
        <mesh key={`w${z}`} position={[0, -H/2 + T*0.6, z]}>
          <boxGeometry args={[W - T*2, 0.008, 0.018]} />
          <meshStandardMaterial color="#3a2208" metalness={0} roughness={1} />
        </mesh>
      ))}

      {/* ── Lid (pivots at back-top edge) ── */}
      {/* Pivot group placed at the top-back edge of box */}
      <animated.group position={[0, H/2 - T*0.1, -D/2 + T]} rotation-x={lidAngle}>
        {/* Lid panel: offset so back edge is at pivot */}
        <mesh position={[0, LID_T/2, D/2 - T/2]} castShadow>
          <boxGeometry args={[W, LID_T, D]} />
          <meshStandardMaterial {...lidMat} />
        </mesh>
        {/* Lid interior face */}
        <mesh position={[0, -LID_T * 0.2, D/2 - T/2]}>
          <boxGeometry args={[W - T*2, 0.04, D - T*2]} />
          <meshStandardMaterial {...intMat} />
        </mesh>
        {/* Brand plate on lid exterior */}
        {(isPremium || isCollector) && (
          <mesh position={[0, LID_T/2 + 0.008, D/2 - T/2]}>
            <boxGeometry args={[1.3, 0.025, 0.34]} />
            <meshStandardMaterial {...accentMat} />
          </mesh>
        )}
        {/* Standard brand deboss rectangle */}
        {!isPremium && !isCollector && (
          <mesh position={[0, LID_T/2 + 0.004, D/2 - T/2]}>
            <boxGeometry args={[1.1, 0.015, 0.26]} />
            <meshStandardMaterial color="#334155" metalness={0.1} roughness={0.85} />
          </mesh>
        )}
        {/* Lid rim strip */}
        <mesh position={[0, LID_T/2, -(D/2 - T/2) + 0.06]}>
          <boxGeometry args={[W + 0.04, LID_T * 0.35, 0.1]} />
          <meshStandardMaterial {...rimMat} />
        </mesh>
        {/* Collector wood grain on lid */}
        {isCollector && ([0.2, 0.5, 0.8, -0.2, -0.5, -0.8] as number[]).map(z => (
          <mesh key={`lw${z}`} position={[0, LID_T/2 + 0.005, D/2 - T/2 + z]}>
            <boxGeometry args={[W - T*2, 0.01, 0.02]} />
            <meshStandardMaterial color="#3a2208" metalness={0} roughness={1} />
          </mesh>
        ))}
      </animated.group>
    </group>
  );
}

// ─── Mini watch (inside the box) ──────────────────────────────────────────

interface WatchConfig {
  watchfaceGeometry?: string | null;
  watchfaceColor?: string | null;
  braceletMaterial?: string | null;
  braceletColor?: string | null;
  handsEnabled?: boolean | null;
  handsColor?: string | null;
  watchfaceText?: string | null;
}

function buildShape(geom: string): THREE.Shape {
  const s = new THREE.Shape();
  if (geom === 'circle') {
    s.absarc(0, 0, 1.5, 0, Math.PI * 2, false);
  } else if (geom === 'square') {
    const r = 0.28, w = 1.28;
    s.moveTo(-w+r,-w); s.lineTo(w-r,-w); s.quadraticCurveTo(w,-w,w,-w+r);
    s.lineTo(w,w-r); s.quadraticCurveTo(w,w,w-r,w); s.lineTo(-w+r,w);
    s.quadraticCurveTo(-w,w,-w,w-r); s.lineTo(-w,-w+r); s.quadraticCurveTo(-w,-w,-w+r,-w);
  } else {
    const r = 0.65, w = 1.1;
    s.moveTo(-w+r,-w); s.lineTo(w-r,-w); s.quadraticCurveTo(w,-w,w,-w+r);
    s.lineTo(w,w-r); s.quadraticCurveTo(w,w,w-r,w); s.lineTo(-w+r,w);
    s.quadraticCurveTo(-w,w,-w,w-r); s.lineTo(-w,-w+r); s.quadraticCurveTo(-w,-w,-w+r,-w);
  }
  return s;
}

function buildFaceTex(faceCol: string, text: string | null | undefined): THREE.CanvasTexture {
  const S = 512;
  const cv = document.createElement('canvas');
  cv.width = S; cv.height = S;
  const ctx = cv.getContext('2d')!;

  ctx.fillStyle = faceCol;
  ctx.fillRect(0, 0, S, S);

  const grad = ctx.createRadialGradient(S*0.38, S*0.33, 0, S/2, S/2, S*0.52);
  grad.addColorStop(0, 'rgba(255,255,255,0.10)');
  grad.addColorStop(1, 'rgba(0,0,0,0.18)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, S, S);

  if (text?.trim()) {
    const t = text.trim().toUpperCase().slice(0, 12);
    const fontSize = Math.max(24, Math.min(52, Math.floor(S * 0.095)));
    ctx.font = `900 ${fontSize}px system-ui, -apple-system, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.letterSpacing = '0.12em';
    ctx.globalAlpha = 0.72;
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillText(t, S/2, S * 0.61);
    ctx.globalAlpha = 1;
  }

  return new THREE.CanvasTexture(cv);
}

function WatchInBox({ config, visible }: { config: WatchConfig; visible: boolean }) {

  const geom    = config.watchfaceGeometry ?? 'circle';
  const faceCol = config.watchfaceColor    ?? '#C0C0C0';
  const strapCol= config.braceletColor     ?? '#888888';
  const handCol = config.handsColor        ?? '#ffffff';
  const handsOn = config.handsEnabled      !== false;
  const mat     = config.braceletMaterial  ?? 'metal_solid';
  const isMetal = mat === 'metal_solid' || mat === 'metal_segmented';
  const isResin = mat === 'resin';
  const text    = config.watchfaceText ?? null;

  const bodyGeo    = useMemo(() => new THREE.ExtrudeGeometry(buildShape(geom), { depth: 0.38, bevelEnabled: true, bevelSize: 0.09, bevelThickness: 0.09, bevelSegments: 6 }), [geom]);
  const faceGeo    = useMemo(() => new THREE.ShapeGeometry(buildShape(geom), 48), [geom]);
  const crystalGeo = useMemo(() => new THREE.ExtrudeGeometry(buildShape(geom), { depth: 0.04, bevelEnabled: true, bevelSize: 0.035, bevelThickness: 0.035, bevelSegments: 8 }), [geom]);
  const faceTex    = useMemo(() => buildFaceTex(faceCol, text), [faceCol, text]);
  useEffect(() => () => { bodyGeo.dispose(); faceGeo.dispose(); crystalGeo.dispose(); faceTex.dispose(); }, [bodyGeo, faceGeo, crystalGeo, faceTex]);

  // Pop-in spring when box opens.
  // Never go to exactly 0 — a zero scale creates a degenerate Three.js matrix
  // that silently breaks rendering for the rest of the frame.
  // Use Three.js group.visible=false to skip the subtree when closed instead.
  const { sc } = useSpring({
    sc: visible ? 0.44 : 0.001,
    config: { mass: 0.8, tension: 140, friction: 20 },
    delay: visible ? 180 : 0,
  });

  return (
    <animated.group
      position={[0, -0.28, 0]}   // sits on the cushion (cushion top ≈ -0.235)
      scale={sc}                  // 0.001 → 0.44; straps fit (tip ≈ ±1.23, wall ±1.32)
      rotation={[-Math.PI / 2, 0, 0]}
      visible={visible}           // Three.js skips subtree when false; no degenerate matrix
    >
        {/* Watch case */}
        <mesh>
          <primitive object={bodyGeo} />
          <meshStandardMaterial color={faceCol} metalness={0.76} roughness={0.14} />
        </mesh>
        {/* Face dial */}
        <mesh position={[0, 0, 0.48]}>
          <primitive object={faceGeo} />
          <meshStandardMaterial map={faceTex} roughness={0.26} metalness={0.05} />
        </mesh>
        {/* Crystal glass */}
        <mesh position={[0, 0, 0.54]}>
          <primitive object={crystalGeo} />
          <meshPhysicalMaterial color="#daeeff" metalness={0} roughness={0.04} transmission={0.82} ior={1.45} thickness={0.06} clearcoat={0.8} clearcoatRoughness={0.06} />
        </mesh>
        {/* Lugs */}
        {([1.60, -1.60] as number[]).map(y => (
          <mesh key={y} position={[0, y, 0.01]}>
            <boxGeometry args={[1.14, 0.50, 0.24]} />
            <meshStandardMaterial color={faceCol} metalness={0.76} roughness={0.14} />
          </mesh>
        ))}
        {/* Straps — shortened to fit inside box walls.
            At scale 0.44 the tip is at ±(2.20+0.60)*0.44 = ±1.23 world units,
            safely inside the inner wall at ±(D/2−T) = ±1.32. */}
        {([1, -1] as number[]).map(sign => (
          <mesh key={sign} position={[0, sign * 2.20, 0]}>
            <boxGeometry args={[1.05, 1.20, 0.14]} />
            <meshStandardMaterial color={strapCol} metalness={isMetal ? 0.85 : 0} roughness={isMetal ? 0.10 : 0.80} transparent={isResin} opacity={isResin ? 0.72 : 1} />
          </mesh>
        ))}
        {/* Hands */}
        {handsOn && (
          <group position={[0, 0, 0.59]}>
            <group rotation={[0, 0, Math.PI / 5]}>
              <mesh position={[0, 0.26, 0]}>
                <boxGeometry args={[0.058, 0.52, 0.018]} />
                <meshStandardMaterial color={handCol} metalness={0.94} roughness={0.06} />
              </mesh>
            </group>
            <group rotation={[0, 0, -Math.PI / 3.5]}>
              <mesh position={[0, 0.38, 0]}>
                <boxGeometry args={[0.040, 0.76, 0.016]} />
                <meshStandardMaterial color={handCol} metalness={0.94} roughness={0.06} />
              </mesh>
            </group>
            <group rotation={[0, 0, Math.PI * 0.75]}>
              <mesh position={[0, 0.34, 0.002]}>
                <boxGeometry args={[0.010, 0.68, 0.008]} />
                <meshStandardMaterial color="#ef4444" metalness={0.75} roughness={0.15} />
              </mesh>
            </group>
          </group>
        )}
        {/* Crown */}
        <mesh position={[1.62, 0.18, 0.10]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.09, 0.085, 0.28, 14]} />
          <meshStandardMaterial color={faceCol} metalness={0.76} roughness={0.14} />
        </mesh>
    </animated.group>
  );
}

// ─── Gift Ribbon ────────────────────────────────────────────────────────────

const RIBBON_Y_LID = H / 2 + LID_T + 0.018;  // just above the closed lid top

const RIBBON_COLOR = '#d63370';
const RIBBON_M = { color: RIBBON_COLOR, metalness: 0.18, roughness: 0.52 } as const;

function GiftRibbon({ visible }: { visible: boolean }) {
  const { sc } = useSpring({
    sc: visible ? 1 : 0,
    config: { mass: 0.8, tension: 180, friction: 22 },
  });

  // THREE.js scale=0 creates a singular matrix → garbage rendering.
  // The outer <group visible={…}> tells Three.js to skip the subtree entirely
  // when hidden; the inner animated.group only handles the pop-in spring.
  return (
    <group visible={visible}>
      <animated.group scale={sc}>
        {/* ── Cross-strips on lid top ── */}
        <mesh position={[0, RIBBON_Y_LID, 0]}>
          <boxGeometry args={[0.22, 0.022, D + 0.05]} />
          <meshStandardMaterial {...RIBBON_M} />
        </mesh>
        <mesh position={[0, RIBBON_Y_LID + 0.012, 0]}>
          <boxGeometry args={[W + 0.05, 0.022, 0.22]} />
          <meshStandardMaterial {...RIBBON_M} />
        </mesh>

        {/* ── Ribbon strip on front face ── */}
        <mesh position={[0, 0, D / 2 + 0.018]}>
          <boxGeometry args={[0.22, H + LID_T + 0.04, 0.018]} />
          <meshStandardMaterial {...RIBBON_M} />
        </mesh>
        {/* ── Ribbon strip on right face ── */}
        <mesh position={[W / 2 + 0.018, 0, 0]}>
          <boxGeometry args={[0.018, H + LID_T + 0.04, 0.22]} />
          <meshStandardMaterial {...RIBBON_M} />
        </mesh>

        {/* ── Bow loops ── */}
        <mesh position={[-0.27, RIBBON_Y_LID + 0.06, 0]} rotation={[Math.PI / 2, 0, 0.22]} scale={[1, 0.36, 1]}>
          <torusGeometry args={[0.22, 0.068, 4, 28]} />
          <meshStandardMaterial {...RIBBON_M} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0.27, RIBBON_Y_LID + 0.06, 0]} rotation={[Math.PI / 2, 0, -0.22]} scale={[1, 0.36, 1]}>
          <torusGeometry args={[0.22, 0.068, 4, 28]} />
          <meshStandardMaterial {...RIBBON_M} side={THREE.DoubleSide} />
        </mesh>

        {/* ── Bow tails ── */}
        <mesh position={[-0.16, RIBBON_Y_LID + 0.01, 0.04]} rotation={[0.12, 0, 0.28]}>
          <boxGeometry args={[0.26, 0.022, 0.18]} />
          <meshStandardMaterial {...RIBBON_M} />
        </mesh>
        <mesh position={[0.16, RIBBON_Y_LID + 0.01, 0.04]} rotation={[0.12, 0, -0.28]}>
          <boxGeometry args={[0.26, 0.022, 0.18]} />
          <meshStandardMaterial {...RIBBON_M} />
        </mesh>

        {/* ── Knot ── */}
        <mesh position={[0, RIBBON_Y_LID + 0.09, 0]}>
          <sphereGeometry args={[0.10, 14, 10]} />
          <meshStandardMaterial {...RIBBON_M} roughness={0.38} />
        </mesh>
      </animated.group>
    </group>
  );
}

// ─── Scene ─────────────────────────────────────────────────────────────────

function Scene({ config, boxType, giftWrap, open }: { config: WatchConfig; boxType: string; giftWrap: boolean; open: boolean }) {
  return (
    <>
      <ambientLight intensity={0.55} />
      <spotLight position={[6, 8, 5]} angle={0.24} penumbra={0.6} intensity={2.8} castShadow shadow-mapSize={[1024, 1024]} />
      <directionalLight position={[-3, 5, 4]} intensity={0.7} color="#c4d4f0" />
      <pointLight position={[0, 6, -2]} intensity={0.5} color="#f0eaff" />
      <pointLight position={[4, 0, 5]} intensity={0.4} color="#ffffff" />
      <Environment preset="city" />
      <group rotation={[0, -0.46, 0]}>
        <Box3D boxType={boxType} open={open} />
        <WatchInBox config={config} visible={open} />
        {giftWrap && <GiftRibbon visible={!open} />}
      </group>
    </>
  );
}

// ─── Public component ──────────────────────────────────────────────────────

export interface WatchBoxSceneProps {
  config: WatchConfig;
  boxType?: string;
  /** Controlled open/close state */
  open?: boolean;
  /** Auto-open the box after mount (used on the Payment page) */
  autoOpen?: boolean;
  giftWrap?: boolean;
  /** height class e.g. "h-72" */
  className?: string;
  /** Called when the user taps/clicks anywhere on the box scene */
  onToggle?: () => void;
}

export default function WatchBoxScene({ config, boxType = 'standard', open = false, autoOpen = false, giftWrap = false, className, onToggle }: WatchBoxSceneProps) {
  const [autoOpened, setAutoOpened] = useState(false);
  useEffect(() => {
    if (!autoOpen) return;
    const t = setTimeout(() => setAutoOpened(true), 800);
    return () => clearTimeout(t);
  }, [autoOpen]);
  const isOpen = open || autoOpened;
  if (!WEB_GL_OK) {
    const s = BOX_STYLES[boxType as keyof typeof BOX_STYLES] ?? BOX_STYLES.standard;
    const faceCol   = config.watchfaceColor  ?? '#C0C0C0';
    const strapCol  = config.braceletColor   ?? '#888888';
    // Isometric projection: iso(x,y,z) with cx=54,cy=50,s=7,cos30=0.866,sin30=0.5
    // Visible corners of box (W=4.3, H=1.35, D=2.9):
    //  E(0,H,0)=(54,37.6)  F(W,H,0)=(80.1,52.7)  H(W,H,D)=(62.5,62.9)  G(0,H,D)=(36.4,47.8)
    //  A(0,0,0)=(54,47)    B(W,0,0)=(80.1,62.1)   D(W,0,D)=(62.5,72.3)
    // Open lid top edge (lid pivots at G-H, stands ~90° up):
    //  G'=(36.4,29.8)  H'=(62.5,44.9)
    return (
      <div
        className={`flex items-center justify-center rounded-2xl overflow-hidden ${className ?? 'h-64'}${onToggle ? ' cursor-pointer select-none' : ''}`}
        style={{ background: `radial-gradient(ellipse at 50% 55%, ${s.bodyColor}ee 0%, ${s.bodyColor}66 55%, transparent 100%)` }}
        onClick={onToggle}
      >
        <svg viewBox="28 24 58 54" className="w-full max-w-xs" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="iso-lid" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.lidColor} />
              <stop offset="100%" stopColor={s.bodyColor} />
            </linearGradient>
            <linearGradient id="iso-front" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.rimColor} stopOpacity="0.9" />
              <stop offset="100%" stopColor={s.bodyColor} />
            </linearGradient>
            <linearGradient id="iso-right" x1="1" y1="0" x2="0" y2="0">
              <stop offset="0%" stopColor={s.bodyColor} />
              <stop offset="100%" stopColor={s.rimColor} stopOpacity="0.7" />
            </linearGradient>
          </defs>

          {/* ── Open lid — standing upright behind the box ── */}
          <polygon points="36.4,47.8 62.5,62.9 62.5,44.9 36.4,29.8" fill="url(#iso-lid)" />
          {/* Lid rim strip (hinge edge) */}
          <line x1="36.4" y1="47.8" x2="62.5" y2="62.9" stroke={s.rimColor} strokeWidth="1.2" opacity="0.8" />
          {/* Brand accent plate on lid */}
          {(boxType === 'premium' || boxType === 'collector') && (
            <polygon points="42.5,44.8 56.5,39.4 56.5,35.4 42.5,40.8" fill={s.accentColor} opacity="0.9" />
          )}
          {/* Lid highlight */}
          <polygon points="36.4,47.8 62.5,62.9 62.5,44.9 36.4,29.8" fill="rgba(255,255,255,0.06)" />
          {/* Lid top edge */}
          <line x1="36.4" y1="29.8" x2="62.5" y2="44.9" stroke={s.rimColor} strokeWidth="0.6" opacity="0.5" />

          {/* ── Box front face  A→B→F→E ── */}
          <polygon points="54,47 80.1,62.1 80.1,52.7 54,37.6" fill="url(#iso-front)" />

          {/* ── Box right face  B→D→H→F ── */}
          <polygon points="80.1,62.1 62.5,72.3 62.5,62.9 80.1,52.7" fill="url(#iso-right)" />

          {/* ── Box top / interior face  E→F→H→G ── */}
          <polygon points="54,37.6 80.1,52.7 62.5,62.9 36.4,47.8" fill={s.interiorColor} />

          {/* Interior cushion */}
          <polygon points="57.5,40.4 77.2,51.5 61.8,60.1 42.2,49.1" fill={s.cushionColor} opacity="0.75" />

          {/* ── Watch silhouette inside the box ── */}
          {/* Strap bottom (toward back/+z in iso: left-down direction) */}
          <line x1="54.2" y1="52.4" x2="50.2" y2="55.0" stroke={strapCol} strokeWidth="3.5" strokeLinecap="round" opacity="0.72" />
          {/* Strap top (toward front/-z in iso: right-up direction) */}
          <line x1="65.2" y1="48.8" x2="69.2" y2="46.2" stroke={strapCol} strokeWidth="3.5" strokeLinecap="round" opacity="0.72" />
          {/* Watch face oval */}
          <ellipse cx="59.7" cy="50.5" rx="10" ry="5.8" fill={faceCol} opacity="0.90" />
          {/* Watch face shine */}
          <ellipse cx="57.8" cy="49.0" rx="3.5" ry="2.0" fill="rgba(255,255,255,0.22)" />

          {/* ── Edge highlights ── */}
          <line x1="54" y1="37.6" x2="80.1" y2="52.7" stroke={s.rimColor} strokeWidth="0.9" opacity="0.7" />
          <line x1="54" y1="37.6" x2="36.4" y2="47.8" stroke={s.rimColor} strokeWidth="0.7" opacity="0.5" />
          <line x1="80.1" y1="62.1" x2="80.1" y2="52.7" stroke={s.rimColor} strokeWidth="0.5" opacity="0.4" />
          <line x1="54" y1="47" x2="54" y2="37.6" stroke={s.rimColor} strokeWidth="0.5" opacity="0.35" />
          <line x1="80.1" y1="62.1" x2="62.5" y2="72.3" stroke={s.rimColor} strokeWidth="0.4" opacity="0.3" />
        </svg>
      </div>
    );
  }

  // Drag detection: fire onToggle only when pointer moves < 6px (tap, not orbit drag)
  const pointerDown = useRef<{ x: number; y: number } | null>(null);

  function handlePointerDown(e: React.PointerEvent) {
    pointerDown.current = { x: e.clientX, y: e.clientY };
  }

  function handlePointerUp(e: React.PointerEvent) {
    if (!pointerDown.current || !onToggle) return;
    const dx = e.clientX - pointerDown.current.x;
    const dy = e.clientY - pointerDown.current.y;
    if (Math.sqrt(dx * dx + dy * dy) < 6) onToggle();
    pointerDown.current = null;
  }

  return (
    <div
      className={`w-full ${className ?? 'h-64'} rounded-2xl overflow-hidden${onToggle ? ' cursor-pointer' : ''}`}
      onPointerDown={onToggle ? handlePointerDown : undefined}
      onPointerUp={onToggle ? handlePointerUp : undefined}
    >
      <Canvas
        camera={{ position: [1.6, 2.4, 8.2], fov: 36 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'default' }}
        style={{ background: 'transparent' }}
        shadows
      >
        <Scene config={config} boxType={boxType} giftWrap={giftWrap} open={isOpen} />
        <OrbitControls
          enablePan={false}
          minDistance={4}
          maxDistance={18}
          minPolarAngle={0.1}
          maxPolarAngle={Math.PI * 0.85}
          target={[0, 0, 0]}
        />
      </Canvas>
    </div>
  );
}
