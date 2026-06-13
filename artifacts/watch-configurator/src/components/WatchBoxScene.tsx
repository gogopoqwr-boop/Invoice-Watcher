import React, { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
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
    cushionColor:  '#162032',
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
    interiorColor: '#2e1030',
    cushionColor:  '#3d1540',
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
    interiorColor: '#1a3050',
    cushionColor:  '#122040',
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
    lidAngle: open ? -Math.PI * 0.93 : 0.02,
    config: { mass: 1.2, tension: 52, friction: 17 },
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
  const groupRef = useRef<THREE.Group>(null);

  const geom    = config.watchfaceGeometry ?? 'circle';
  const faceCol = config.watchfaceColor    ?? '#C0C0C0';
  const strapCol= config.braceletColor     ?? '#888888';
  const handCol = config.handsColor        ?? '#ffffff';
  const handsOn = config.handsEnabled      !== false;
  const mat     = config.braceletMaterial  ?? 'metal_solid';
  const isMetal = mat === 'metal_solid' || mat === 'metal_segmented';
  const isResin = mat === 'resin';
  const text    = config.watchfaceText ?? null;

  const bodyGeo  = useMemo(() => new THREE.ExtrudeGeometry(buildShape(geom), { depth: 0.38, bevelEnabled: true, bevelSize: 0.09, bevelThickness: 0.09, bevelSegments: 6 }), [geom]);
  const faceGeo  = useMemo(() => new THREE.ShapeGeometry(buildShape(geom), 48), [geom]);
  const crystalGeo = useMemo(() => new THREE.ExtrudeGeometry(buildShape(geom), { depth: 0.04, bevelEnabled: true, bevelSize: 0.035, bevelThickness: 0.035, bevelSegments: 8 }), [geom]);
  const faceTex  = useMemo(() => buildFaceTex(faceCol, text), [faceCol, text]);
  useEffect(() => () => { bodyGeo.dispose(); faceGeo.dispose(); crystalGeo.dispose(); faceTex.dispose(); }, [bodyGeo, faceGeo, crystalGeo, faceTex]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y += delta * 0.28;
  });

  return (
    <animated.group
      ref={groupRef}
      position={[0, -H/2 + T + 0.42, 0]}
      scale={[0.52, 0.52, 0.52]}
      rotation={[-0.18, 0, 0]}
    >
      {/* Watch case */}
      <mesh>
        <primitive object={bodyGeo} />
        <meshStandardMaterial color={faceCol} metalness={0.76} roughness={0.14} />
      </mesh>
      <mesh position={[0, 0, 0.48]}>
        <primitive object={faceGeo} />
        <meshStandardMaterial map={faceTex} roughness={0.26} metalness={0.05} />
      </mesh>
      <mesh position={[0, 0, 0.54]}>
        <primitive object={crystalGeo} />
        <meshPhysicalMaterial color="#daeeff" metalness={0} roughness={0.04} transmission={0.82} ior={1.45} thickness={0.06} clearcoat={0.8} clearcoatRoughness={0.06} />
      </mesh>
      {/* Lugs */}
      {([1.60, -1.60] as number[]).map(y => (
        <group key={y}>
          <mesh position={[0, y, 0.01]}>
            <boxGeometry args={[1.14, 0.50, 0.24]} />
            <meshStandardMaterial color={faceCol} metalness={0.76} roughness={0.14} />
          </mesh>
        </group>
      ))}
      {/* Straps */}
      {([1, -1] as number[]).map(sign => (
        <group key={sign} position={[0, sign * 1.85, 0]} rotation={[sign * -0.48, 0, 0]}>
          <mesh position={[0, sign * 1.20, 0]}>
            <boxGeometry args={[1.05, 2.40, 0.14]} />
            <meshStandardMaterial color={strapCol} metalness={isMetal ? 0.85 : 0} roughness={isMetal ? 0.10 : 0.80} transparent={isResin} opacity={isResin ? 0.72 : 1} />
          </mesh>
        </group>
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

// ─── Scene ─────────────────────────────────────────────────────────────────

function Scene({ config, boxType, autoOpen }: { config: WatchConfig; boxType: string; autoOpen: boolean }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!autoOpen) return;
    const t = setTimeout(() => setOpen(true), 380);
    return () => clearTimeout(t);
  }, [autoOpen]);

  useEffect(() => {
    setOpen(false);
    if (!autoOpen) return;
    const t = setTimeout(() => setOpen(true), 320);
    return () => clearTimeout(t);
  }, [boxType]);

  return (
    <>
      <ambientLight intensity={0.40} />
      <spotLight position={[4, 7, 5]} angle={0.26} penumbra={0.7} intensity={2.4} castShadow shadow-mapSize={[1024, 1024]} />
      <directionalLight position={[-4, 4, 3]} intensity={0.55} color="#c4d4f0" />
      <pointLight position={[0, 5, -3]} intensity={0.6} color="#f0eaff" />
      <pointLight position={[3, -1, 4]} intensity={0.35} color="#ffffff" />
      <Environment preset="city" />
      <Box3D boxType={boxType} open={open} />
      <WatchInBox config={config} visible={open} />
    </>
  );
}

// ─── Public component ──────────────────────────────────────────────────────

export interface WatchBoxSceneProps {
  config: WatchConfig;
  boxType?: string;
  autoOpen?: boolean;
  /** height class e.g. "h-72" */
  className?: string;
}

export default function WatchBoxScene({ config, boxType = 'standard', autoOpen = true, className }: WatchBoxSceneProps) {
  if (!WEB_GL_OK) {
    const s = BOX_STYLES[boxType as keyof typeof BOX_STYLES] ?? BOX_STYLES.standard;
    return (
      <div className={`flex items-center justify-center rounded-2xl overflow-hidden ${className ?? 'h-64'}`}
        style={{ background: `radial-gradient(ellipse at 50% 40%, ${s.bodyColor}cc 0%, ${s.bodyColor}55 60%, transparent 100%)` }}>
        <svg viewBox="0 0 120 80" className="w-44 opacity-70" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="fb-lid" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.lidColor} />
              <stop offset="100%" stopColor={s.bodyColor} />
            </linearGradient>
            <linearGradient id="fb-body" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.bodyColor} />
              <stop offset="100%" stopColor={s.interiorColor} />
            </linearGradient>
          </defs>
          {/* Isometric box base */}
          <polygon points="60,28 100,42 100,68 60,54" fill={s.bodyColor} />
          <polygon points="20,42 60,28 60,54 20,68" fill={s.rimColor} />
          <polygon points="20,42 60,28 100,42 60,56" fill="url(#fb-lid)" />
          {/* Open lid floated above */}
          <polygon points="20,22 60,8 100,22 60,36" fill="url(#fb-lid)" stroke={s.accentColor} strokeWidth="0.5" />
          {/* Brand plate on lid */}
          <polygon points="45,14 60,8.5 75,14 60,19.5" fill={s.accentColor} opacity="0.75" />
          {/* Interior glow */}
          <ellipse cx="60" cy="50" rx="15" ry="5" fill={s.cushionColor} opacity="0.7" />
        </svg>
      </div>
    );
  }

  return (
    <div className={`w-full ${className ?? 'h-64'} rounded-2xl overflow-hidden`}>
      <Canvas
        camera={{ position: [0, 2.8, 6.5], fov: 38 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'default' }}
        style={{ background: 'transparent' }}
        shadows
      >
        <Scene config={config} boxType={boxType} autoOpen={autoOpen} />
      </Canvas>
    </div>
  );
}
