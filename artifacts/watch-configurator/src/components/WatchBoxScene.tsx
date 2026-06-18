import React, { useEffect, useState, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, OrbitControls, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import { useSpring } from '@react-spring/three';
import { WatchCardModel } from '@/components/WatchMiniCanvas';
import type { ExtendedConfigState } from '@/hooks/use-watch-config';
// NOTE: useSpring from @react-spring/three is still used for GiftRibbon/Box3D lid,
// but WatchInBox intentionally avoids it (spring scale never fires in a second Canvas).

// ─── WebGL check ────────────────────────────────────────────────────────────

function checkWebGL(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl') || (c as any).getContext('experimental-webgl'));
  } catch { return false; }
}
const WEB_GL_OK = checkWebGL();

// ─── Box style presets ──────────────────────────────────────────────────────

const BOX_STYLES = {
  standard: {
    bodyColor:     '#1e293b',
    lidColor:      '#253347',
    interiorColor: '#0f172a',
    cushionColor:  '#2c4a72',
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
    cushionColor:  '#6b2060',
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
    cushionColor:  '#1e4a30',
    accentColor:   '#c9970a',
    rimColor:      '#a07030',
    metalness: 0.10,
    roughness: 0.68,
    lidMetalness: 0.10,
    lidRoughness: 0.62,
  },
};

// ─── Box geometry constants ─────────────────────────────────────────────────
// Watch-specific proportions: narrow width (across face), long depth (along strap)

const W     = 3.2;   // width — across the watch face
const D     = 5.0;   // depth — along the strap (needs to fit strap arms)
const H     = 1.4;   // body height
const T     = 0.13;  // wall thickness
const LID_T = 0.13;

// Interior floor surface
const FLOOR_Y = -H / 2 + T;

// Oval cushion — pillow for the watch case.
// Uses a scaled sphere: scaleX wide enough for watch face, scaleZ for watch case depth.
const CUSH_R    = 0.34;   // sphere radius before scaling
const CUSH_SX   = 2.3;    // X scale — covers watch face width
const CUSH_SY   = 0.88;   // Y scale — pillow height
const CUSH_SZ   = 1.6;    // Z scale — covers watch case + lug area
const CUSH_HALF = CUSH_R * CUSH_SY;           // half-height in world units
const CUSH_Y    = FLOOR_Y + CUSH_HALF + 0.04; // center so bottom touches floor
const WATCH_Y   = CUSH_Y + CUSH_HALF + 0.20;  // sits on cushion top (accounts for MiniWatch case half-depth at scale 0.62)

// ─── Box geometry ───────────────────────────────────────────────────────────

function Box3D({ boxType, open }: { boxType: string; open: boolean }) {
  const s = BOX_STYLES[boxType as keyof typeof BOX_STYLES] ?? BOX_STYLES.standard;

  const { lidAngle } = useSpring({
    lidAngle: open ? -Math.PI * 0.63 : 0,
    config: { mass: 1.4, tension: 44, friction: 18 },
  });
  const lidRef = useRef<THREE.Group>(null);
  useFrame(() => {
    if (lidRef.current) lidRef.current.rotation.x = lidAngle.get();
  });

  const bodyMat   = { color: s.bodyColor,     metalness: s.metalness,    roughness: s.roughness    };
  const lidMat    = { color: s.lidColor,      metalness: s.lidMetalness, roughness: s.lidRoughness };
  const rimMat    = { color: s.rimColor,      metalness: 0.75,           roughness: 0.22           };
  const accentMat = { color: s.accentColor,   metalness: 0.88,           roughness: 0.12           };
  const intMat    = { color: s.interiorColor, metalness: 0,              roughness: 0.96           };
  const cushMat   = { color: s.cushionColor,  metalness: 0,              roughness: 0.90           };

  const isPremium   = boxType === 'premium';
  const isCollector = boxType === 'collector';

  return (
    <group>
      {/* ── Box body: bottom + 4 walls ── */}
      <mesh position={[0, -H/2 + T/2, 0]} receiveShadow>
        <boxGeometry args={[W, T, D]} />
        <meshStandardMaterial {...bodyMat} />
      </mesh>
      <mesh position={[0, 0, -D/2 + T/2]}>
        <boxGeometry args={[W, H, T]} />
        <meshStandardMaterial {...bodyMat} />
      </mesh>
      <mesh position={[0, 0, D/2 - T/2]}>
        <boxGeometry args={[W, H, T]} />
        <meshStandardMaterial {...bodyMat} />
      </mesh>
      <mesh position={[-W/2 + T/2, 0, 0]}>
        <boxGeometry args={[T, H, D]} />
        <meshStandardMaterial {...bodyMat} />
      </mesh>
      <mesh position={[W/2 - T/2, 0, 0]}>
        <boxGeometry args={[T, H, D]} />
        <meshStandardMaterial {...bodyMat} />
      </mesh>

      {/* ── Interior floor ── */}
      <mesh position={[0, FLOOR_Y + 0.04, 0]}>
        <boxGeometry args={[W - T*2 - 0.06, 0.04, D - T*2 - 0.06]} />
        <meshStandardMaterial {...intMat} />
      </mesh>

      {/* ── Watch cushion — elongated pill pillow ── */}
      <mesh position={[0, CUSH_Y, 0]} scale={[CUSH_SX, CUSH_SY, CUSH_SZ]} castShadow>
        <sphereGeometry args={[CUSH_R, 36, 20]} />
        <meshStandardMaterial {...cushMat} />
      </mesh>
      {/* Cushion top highlight strip (fabric sheen) */}
      <mesh position={[0, CUSH_Y + CUSH_HALF - 0.01, 0]} scale={[CUSH_SX * 0.70, 1, CUSH_SZ * 0.55]}>
        <sphereGeometry args={[CUSH_R * 0.98, 24, 12]} />
        <meshStandardMaterial color={s.cushionColor} metalness={0.06} roughness={0.82} transparent opacity={0.45} />
      </mesh>

      {/* ── Rim / edge trim ── */}
      {/* Kept well below H/2 so it never z-fights with the closed lid bottom face */}
      <mesh position={[0, H/2 - T * 0.85, 0]}>
        <boxGeometry args={[W + 0.04, T * 0.38, D + 0.04]} />
        <meshStandardMaterial {...rimMat} />
      </mesh>

      {/* ── Accent corners for premium / collector ── */}
      {(isPremium || isCollector) && (
        <>
          {([-W/2 + T*0.5, W/2 - T*0.5] as number[]).flatMap(x =>
            ([-D/2 + T*0.5, D/2 - T*0.5] as number[]).map(z => (
              <mesh key={`c${x}_${z}`} position={[x, -H/2 + T + 0.01, z]}>
                <boxGeometry args={[0.22, 0.06, 0.22]} />
                <meshStandardMaterial {...accentMat} />
              </mesh>
            ))
          )}
        </>
      )}

      {/* ── Hinge cylinders ── */}
      {([-W/2 + 0.45, 0, W/2 - 0.45] as number[]).map(x => (
        <mesh key={`h${x}`} position={[x, H/2 + 0.02, -D/2 + T/2]} rotation={[0, 0, Math.PI/2]}>
          <cylinderGeometry args={[0.07, 0.07, 0.22, 12]} />
          <meshStandardMaterial {...rimMat} />
        </mesh>
      ))}

      {/* ── Wood grain for collector ── */}
      {isCollector && ([0.4, 0.8, 1.2, -0.4, -0.8, -1.2, 1.6, -1.6] as number[]).map(z => (
        <mesh key={`w${z}`} position={[0, -H/2 + T*0.6, z]}>
          <boxGeometry args={[W - T*2, 0.008, 0.016]} />
          <meshStandardMaterial color="#3a2208" metalness={0} roughness={1} />
        </mesh>
      ))}

      {/* ── Lid (pivots at back-top edge) ── */}
      {/* Pivot placed exactly at H/2 so closed lid bottom face is flush with box top — no z-fighting. */}
      <group ref={lidRef} position={[0, H/2, -D/2 + T]}>
        <mesh position={[0, LID_T/2, D/2 - T/2]} castShadow>
          <boxGeometry args={[W, LID_T, D]} />
          <meshStandardMaterial {...lidMat} />
        </mesh>
        <mesh position={[0, -LID_T * 0.2, D/2 - T/2]}>
          <boxGeometry args={[W - T*2, 0.04, D - T*2]} />
          <meshStandardMaterial {...intMat} />
        </mesh>
        {/* Interior satin lining on lid — matches cushion color */}
        <mesh position={[0, -LID_T * 0.1 + 0.012, D/2 - T/2]}>
          <boxGeometry args={[W - T*2 - 0.08, 0.025, D - T*2 - 0.08]} />
          <meshStandardMaterial color={s.cushionColor} metalness={0} roughness={0.94} />
        </mesh>
        {/* Brand plate on lid exterior */}
        {(isPremium || isCollector) && (
          <mesh position={[0, LID_T/2 + 0.008, D/2 - T/2]}>
            <boxGeometry args={[1.1, 0.022, 0.28]} />
            <meshStandardMaterial {...accentMat} />
          </mesh>
        )}
        {!isPremium && !isCollector && (
          <mesh position={[0, LID_T/2 + 0.004, D/2 - T/2]}>
            <boxGeometry args={[0.90, 0.014, 0.22]} />
            <meshStandardMaterial color="#334155" metalness={0.1} roughness={0.85} />
          </mesh>
        )}
        {/* Lid free-edge rim strip */}
        <mesh position={[0, LID_T/2, D - T/2 - 0.05]}>
          <boxGeometry args={[W + 0.04, LID_T * 0.32, 0.1]} />
          <meshStandardMaterial {...rimMat} />
        </mesh>
        {/* Collector wood grain on lid */}
        {isCollector && ([0.3, 0.7, 1.1, -0.3, -0.7, -1.1, 1.5, -1.5] as number[]).map(z => (
          <mesh key={`lw${z}`} position={[0, LID_T/2 + 0.005, D/2 - T/2 + z]}>
            <boxGeometry args={[W - T*2, 0.01, 0.018]} />
            <meshStandardMaterial color="#3a2208" metalness={0} roughness={1} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

// ─── Watch inside the box ───────────────────────────────────────────────────
// Scale is driven purely through the ref — no React prop changes so R3F never
// resets the scale between frames. Target is read from a ref so the closure
// captures the latest value without stale-closure lag.

function WatchInBox({ config, visible }: { config: ExtendedConfigState; visible: boolean }) {
  const groupRef  = useRef<THREE.Group>(null);
  const targetRef = useRef<number>(0); // updated each render via the line below

  // Sync latest visible into targetRef every render (no stale closure).
  targetRef.current = visible ? 0.68 : 0;

  // Imperatively initialise scale to 0 before the first painted frame.
  useEffect(() => {
    if (groupRef.current) groupRef.current.scale.setScalar(0);
  }, []);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const cur    = groupRef.current.scale.x;
    const target = targetRef.current;
    const next   = THREE.MathUtils.lerp(cur, target, Math.min(1, delta * 6));
    // Snap to 0 when target is 0 and nearly there (prevents invisible micro-render)
    groupRef.current.scale.setScalar(next < 0.004 && target < 0.01 ? 0 : next);
  });

  return (
    /*
      Always rendered (no visibility gate) so useFrame runs every frame.
      Watch stands upright (face toward camera), with a slight backward tilt
      so the dial is fully visible from the camera above-front position.
    */
    <group
      ref={groupRef}
      position={[0, WATCH_Y + 0.15, 0]}
      rotation={[-0.18, 0, 0]}
    >
      <WatchCardModel
        watchfaceGeometry={config.watchfaceGeometry ?? 'circle'}
        watchfaceColor={config.watchfaceColor ?? '#C0C0C0'}
        braceletColor={config.braceletColor ?? '#888888'}
        braceletMaterial={config.braceletMaterial ?? 'leather'}
        handsColor={config.handsColor ?? '#ffffff'}
        handsEnabled={config.handsEnabled ?? true}
        watchfaceText={config.watchfaceText ?? ''}
        watchfaceTextMode={config.watchfaceTextMode ?? 'circular'}
        collectionName={(config as any).collectionName ?? null}
        paused
      />
    </group>
  );
}

// ─── Gift Ribbon ─────────────────────────────────────────────────────────────

const RIBBON_Y_LID = H / 2 + LID_T + 0.018;

const RIBBON_COLOR = '#d63370';
const RIBBON_M = { color: RIBBON_COLOR, metalness: 0.18, roughness: 0.52 } as const;

function GiftRibbon({ visible }: { visible: boolean }) {
  const { sc } = useSpring({
    sc: visible ? 1 : 0,
    config: { mass: 0.8, tension: 180, friction: 22 },
  });
  const ribbonRef = useRef<THREE.Group>(null);
  useFrame(() => {
    if (ribbonRef.current) ribbonRef.current.scale.setScalar(sc.get());
  });

  return (
    <group visible={visible}>
      <group ref={ribbonRef}>
        {/* Cross-strips on lid top */}
        <mesh position={[0, RIBBON_Y_LID, 0]}>
          <boxGeometry args={[0.20, 0.022, D + 0.05]} />
          <meshStandardMaterial {...RIBBON_M} />
        </mesh>
        <mesh position={[0, RIBBON_Y_LID + 0.012, 0]}>
          <boxGeometry args={[W + 0.05, 0.022, 0.20]} />
          <meshStandardMaterial {...RIBBON_M} />
        </mesh>
        {/* Ribbon strip on front face */}
        <mesh position={[0, 0, D / 2 + 0.018]}>
          <boxGeometry args={[0.20, H + LID_T + 0.04, 0.018]} />
          <meshStandardMaterial {...RIBBON_M} />
        </mesh>
        {/* Ribbon strip on right face */}
        <mesh position={[W / 2 + 0.018, 0, 0]}>
          <boxGeometry args={[0.018, H + LID_T + 0.04, 0.20]} />
          <meshStandardMaterial {...RIBBON_M} />
        </mesh>
        {/* Bow loops */}
        <mesh position={[-0.24, RIBBON_Y_LID + 0.055, 0]} rotation={[Math.PI / 2, 0, 0.22]} scale={[1, 0.34, 1]}>
          <torusGeometry args={[0.20, 0.064, 4, 28]} />
          <meshStandardMaterial {...RIBBON_M} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0.24, RIBBON_Y_LID + 0.055, 0]} rotation={[Math.PI / 2, 0, -0.22]} scale={[1, 0.34, 1]}>
          <torusGeometry args={[0.20, 0.064, 4, 28]} />
          <meshStandardMaterial {...RIBBON_M} side={THREE.DoubleSide} />
        </mesh>
        {/* Bow tails */}
        <mesh position={[-0.14, RIBBON_Y_LID + 0.008, 0.04]} rotation={[0.12, 0, 0.28]}>
          <boxGeometry args={[0.24, 0.022, 0.16]} />
          <meshStandardMaterial {...RIBBON_M} />
        </mesh>
        <mesh position={[0.14, RIBBON_Y_LID + 0.008, 0.04]} rotation={[0.12, 0, -0.28]}>
          <boxGeometry args={[0.24, 0.022, 0.16]} />
          <meshStandardMaterial {...RIBBON_M} />
        </mesh>
        {/* Knot */}
        <mesh position={[0, RIBBON_Y_LID + 0.082, 0]}>
          <sphereGeometry args={[0.09, 14, 10]} />
          <meshStandardMaterial {...RIBBON_M} roughness={0.38} />
        </mesh>
      </group>
    </group>
  );
}

// ─── Scene ───────────────────────────────────────────────────────────────────

function Scene({ config, boxType, giftWrap, open }: { config: ExtendedConfigState; boxType: string; giftWrap: boolean; open: boolean }) {
  return (
    <>
      {/* Low ambient so shadows have depth */}
      <ambientLight intensity={0.38} />
      {/* Key light — high-front-right */}
      <spotLight
        position={[4, 11, 7]}
        angle={0.22}
        penumbra={0.85}
        intensity={4.8}
      />
      {/* Cool fill from upper-left */}
      <directionalLight position={[-5, 7, 3]} intensity={0.60} color="#c8d4f8" />
      {/* Soft purple rim from behind — separates box from bg */}
      <pointLight position={[0, 4, -7]} intensity={0.30} color="#9080ff" />
      {/* Front-low fill so box front face isn't lost in shadow */}
      <pointLight position={[0, -1, 8]} intensity={0.28} color="#ffffff" />
      {/* Interior lights — only when box is open; highlights the watch */}
      {open && (
        <>
          {/* Warm overhead fill — wide, soft, illuminates the whole interior */}
          <pointLight position={[0, 2.2, 1.0]} intensity={4.5} color="#fff8f0" distance={8} decay={1.8} />
          {/* Cool key from top-front — gives the face a subtle specular highlight */}
          <pointLight position={[0.6, 1.8, 2.5]} intensity={3.0} color="#d8e8ff" distance={7} decay={2.0} />
          {/* Narrow fill aimed at the watch face from directly above */}
          <pointLight position={[0, WATCH_Y + 2.5, 0.4]} intensity={5.0} color="#fffaf5" distance={5} decay={2.0} />
        </>
      )}
      {/* Soft contact shadow — grounds the box without polygon artifacts */}
      <ContactShadows
        position={[0, -H / 2 - 0.01, 0]}
        opacity={0.38}
        scale={14}
        blur={3.2}
        far={7}
        color="#000000"
      />
      <Environment preset="apartment" />
      {/* Slight X-tilt so camera naturally looks down into the open box */}
      <group rotation={[0.06, -0.30, 0]}>
        <Box3D boxType={boxType} open={open} />
        <WatchInBox config={config} visible={open} />
        {giftWrap && <GiftRibbon visible={!open} />}
      </group>
    </>
  );
}

// ─── Public component ─────────────────────────────────────────────────────────

export interface WatchBoxSceneProps {
  config: ExtendedConfigState;
  boxType?: string;
  open?: boolean;
  autoOpen?: boolean;
  giftWrap?: boolean;
  compact?: boolean;
  className?: string;
  onToggle?: () => void;
}

export default function WatchBoxScene({ config, boxType = 'standard', open = false, autoOpen = false, giftWrap = false, compact = false, className, onToggle }: WatchBoxSceneProps) {
  const [autoOpened, setAutoOpened] = useState(false);
  useEffect(() => {
    if (!autoOpen) return;
    const t = setTimeout(() => setAutoOpened(true), 800);
    return () => clearTimeout(t);
  }, [autoOpen]);

  const isOpen = open || autoOpened;

  // ── SVG fallback (no WebGL) ──────────────────────────────────────────────
  if (!WEB_GL_OK) {
    const s = BOX_STYLES[boxType as keyof typeof BOX_STYLES] ?? BOX_STYLES.standard;
    const faceCol  = config.watchfaceColor ?? '#C0C0C0';
    const strapCol = config.braceletColor  ?? '#888888';
    return (
      <div
        className={`relative flex items-center justify-center overflow-hidden ${className?.includes('rounded') ? '' : 'rounded-2xl'} ${className ?? 'h-64'}${onToggle ? ' cursor-pointer select-none' : ''}`}
        style={{ background: `radial-gradient(ellipse at 50% 55%, ${s.bodyColor}ee 0%, ${s.bodyColor}66 55%, transparent 100%)` }}
        onClick={onToggle}
      >
        <svg viewBox="18 24 70 56" className="w-full max-w-xs" xmlns="http://www.w3.org/2000/svg">
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

          {/* Open lid — standing upright behind the box */}
          <polygon points="30,47.5 64,62.5 64,40.5 30,25.5" fill="url(#iso-lid)" />
          <line x1="30" y1="47.5" x2="64" y2="62.5" stroke={s.rimColor} strokeWidth="1.2" opacity="0.8" />
          {(boxType === 'premium' || boxType === 'collector') && (
            <polygon points="38,41.5 56,36.5 56,32.5 38,37.5" fill={s.accentColor} opacity="0.9" />
          )}
          <line x1="30" y1="25.5" x2="64" y2="40.5" stroke={s.rimColor} strokeWidth="0.6" opacity="0.5" />

          {/* Box front face */}
          <polygon points="47,47.5 77,62.5 77,54.0 47,39.0" fill="url(#iso-front)" />
          {/* Box right face */}
          <polygon points="77,62.5 64,72.5 64,62.5 77,52.5" fill="url(#iso-right)" />
          {/* Box top/interior */}
          <polygon points="47,39.0 77,54.0 64,62.5 30,47.5" fill={s.interiorColor} />

          {/* Interior cushion — elongated oval */}
          <ellipse cx="55.5" cy="52.5" rx="10" ry="5.5" fill={s.cushionColor} opacity="0.80" />

          {/* Watch silhouette — face on cushion, strap along long axis */}
          <line x1="55.5" y1="57.5" x2="55.5" y2="64.5" stroke={strapCol} strokeWidth="4" strokeLinecap="round" opacity="0.70" />
          <line x1="55.5" y1="47.5" x2="55.5" y2="40.5" stroke={strapCol} strokeWidth="4" strokeLinecap="round" opacity="0.70" />
          <ellipse cx="55.5" cy="52.5" rx="5.5" ry="5.5" fill={faceCol} opacity="0.92" />
          <ellipse cx="53.8" cy="50.8" rx="1.9" ry="1.9" fill="rgba(255,255,255,0.22)" />

          {/* Edge highlights */}
          <line x1="47" y1="39.0" x2="77" y2="54.0" stroke={s.rimColor} strokeWidth="0.9" opacity="0.7" />
          <line x1="47" y1="39.0" x2="30" y2="47.5" stroke={s.rimColor} strokeWidth="0.7" opacity="0.5" />
          <line x1="77" y1="62.5" x2="77" y2="52.5" stroke={s.rimColor} strokeWidth="0.5" opacity="0.4" />
          <line x1="47" y1="47.5" x2="47" y2="39.0" stroke={s.rimColor} strokeWidth="0.5" opacity="0.35" />
          <line x1="77" y1="62.5" x2="64" y2="72.5" stroke={s.rimColor} strokeWidth="0.4" opacity="0.3" />
        </svg>

        {onToggle && (
          <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-sm text-white/60 text-[10px] font-medium select-none">
            <span>{isOpen ? '📦' : '🎁'}</span>
            <span>{isOpen ? 'Нажмите, чтобы закрыть' : 'Нажмите, чтобы открыть'}</span>
          </div>
        )}
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
    if (Math.sqrt(dx * dx + dy * dy) < 6) {
      setAutoOpened(false);
      onToggle();
    }
    pointerDown.current = null;
  }

  return (
    <div
      className={`${className?.includes('absolute') ? '' : 'relative w-full canvas-box-bg'} ${className ?? 'h-64'} ${className?.includes('rounded') ? '' : 'rounded-2xl'} overflow-hidden${onToggle ? ' cursor-pointer' : ''}`}
      onPointerDown={onToggle ? handlePointerDown : undefined}
      onPointerUp={onToggle ? handlePointerUp : undefined}
    >
      <Canvas
        camera={{ position: compact ? [0.8, 6.5, 17.5] : [1.5, 4.5, 12.5], fov: compact ? 36 : 42 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'default' }}
        style={{ background: 'transparent' }}
      >
        <Scene config={config} boxType={boxType} giftWrap={giftWrap} open={isOpen} />
        <OrbitControls
          enablePan={false}
          minDistance={3.5}
          maxDistance={16}
          minPolarAngle={0.1}
          maxPolarAngle={Math.PI * 0.85}
          target={[0, 0, 0]}
        />
      </Canvas>

      {onToggle && (
        <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-sm text-white/60 text-[10px] font-medium select-none">
          <span>{isOpen ? '📦' : '🎁'}</span>
          <span>{isOpen ? 'Нажмите, чтобы закрыть' : 'Нажмите, чтобы открыть'}</span>
        </div>
      )}
    </div>
  );
}
