import React, { useRef, useState, useEffect, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
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

interface MiniWatchProps {
  watchfaceGeometry: string;
  watchfaceColor: string;
  braceletColor: string;
  braceletMaterial: string;
  handsColor: string;
  handsEnabled: boolean;
  paused?: boolean;
}

function MiniWatch({ watchfaceGeometry, watchfaceColor, braceletColor, braceletMaterial, handsColor, handsEnabled, paused }: MiniWatchProps) {
  const groupRef = useRef<THREE.Group>(null);
  const rotRef = useRef(0);

  const bodyGeo = useMemo(() => {
    const shape = buildShape(watchfaceGeometry);
    return new THREE.ExtrudeGeometry(shape, { depth: 0.38, bevelEnabled: true, bevelSize: 0.09, bevelThickness: 0.09, bevelSegments: 6 });
  }, [watchfaceGeometry]);

  const faceGeo = useMemo(() => new THREE.ShapeGeometry(buildShape(watchfaceGeometry), 48), [watchfaceGeometry]);
  const crystalGeo = useMemo(() => {
    const shape = buildShape(watchfaceGeometry);
    return new THREE.ExtrudeGeometry(shape, { depth: 0.04, bevelEnabled: true, bevelSize: 0.035, bevelThickness: 0.035, bevelSegments: 8 });
  }, [watchfaceGeometry]);

  useEffect(() => () => { bodyGeo.dispose(); faceGeo.dispose(); crystalGeo.dispose(); }, [bodyGeo, faceGeo, crystalGeo]);

  const isMetal = braceletMaterial === 'metal_solid' || braceletMaterial === 'metal_segmented';
  const isResin = braceletMaterial === 'resin';

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const targetSpeed = paused ? 0.004 : 0.012;
    rotRef.current += (targetSpeed - rotRef.current) * 0.08;
    groupRef.current.rotation.y += rotRef.current;
  });

  return (
    <group ref={groupRef} rotation-x={-0.28}>
      <mesh>
        <primitive object={bodyGeo} />
        <meshStandardMaterial color={watchfaceColor} metalness={0.76} roughness={0.14} envMapIntensity={0} />
      </mesh>
      <mesh position={[0, 0, 0.48]}>
        <primitive object={faceGeo} />
        <meshStandardMaterial color={watchfaceColor} roughness={0.26} metalness={0.05} />
      </mesh>
      <mesh position={[0, 0, 0.54]}>
        <primitive object={crystalGeo} />
        <meshPhysicalMaterial
          color="#daeeff"
          metalness={0}
          roughness={0.04}
          transmission={0.82}
          ior={1.45}
          thickness={0.06}
          clearcoat={0.8}
          clearcoatRoughness={0.06}
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
        <group position={[0, 0, 0.59]}>
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
function WatchColorCard({ watchfaceColor, braceletColor }: { watchfaceColor: string; braceletColor: string }) {
  return (
    <div
      className="w-full h-full flex items-center justify-center relative overflow-hidden"
      style={{
        background: `radial-gradient(ellipse at 50% 38%, ${watchfaceColor}cc 0%, ${watchfaceColor}66 40%, ${braceletColor}44 75%, transparent 100%)`,
      }}
    >
      {/* watch silhouette */}
      <div className="flex flex-col items-center gap-[3px] select-none pointer-events-none" style={{ transform: 'scale(0.72)' }}>
        <div className="w-[34px] h-[22px] rounded-[5px]" style={{ backgroundColor: braceletColor, opacity: 0.72 }} />
        <div
          className="w-[52px] h-[52px] rounded-full border-[3px] flex items-center justify-center"
          style={{ backgroundColor: watchfaceColor, borderColor: braceletColor + 'aa' }}
        >
          <div
            className="w-[38px] h-[38px] rounded-full"
            style={{ background: `linear-gradient(135deg, ${watchfaceColor}ff 0%, ${watchfaceColor}88 100%)` }}
          />
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
          <WatchColorCard watchfaceColor={faceColor} braceletColor={strapColor} />
        </div>
      )}

      {mounted && !paused && (
        <div className="absolute inset-0">
          <Canvas
            camera={{ position: [0, 0.5, 8.0], fov: 40 }}
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
              paused={paused}
            />
          </Canvas>
        </div>
      )}
    </div>
  );
}
