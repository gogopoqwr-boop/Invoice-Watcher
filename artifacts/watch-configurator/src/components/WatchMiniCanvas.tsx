import React, { useRef, useState, useEffect, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import WatchSVG from './WatchSVG';

let _activeContexts = 0;
const MAX_CONTEXTS = 6;

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
  } else if (geom === 'star') {
    const oR = 1.52, iR = 0.68;
    for (let i = 0; i < 10; i++) {
      const r2 = i % 2 === 0 ? oR : iR;
      const a = (i * Math.PI) / 5 - Math.PI / 2;
      i === 0 ? s.moveTo(r2 * Math.cos(a), r2 * Math.sin(a)) : s.lineTo(r2 * Math.cos(a), r2 * Math.sin(a));
    }
    s.closePath();
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
}

function MiniWatch({ watchfaceGeometry, watchfaceColor, braceletColor, braceletMaterial, handsColor, handsEnabled }: MiniWatchProps) {
  const groupRef = useRef<THREE.Group>(null);

  const bodyGeo = useMemo(() => {
    const shape = buildShape(watchfaceGeometry);
    return new THREE.ExtrudeGeometry(shape, { depth: 0.38, bevelEnabled: true, bevelSize: 0.09, bevelThickness: 0.09, bevelSegments: 6 });
  }, [watchfaceGeometry]);

  const faceGeo = useMemo(() => new THREE.ShapeGeometry(buildShape(watchfaceGeometry), 48), [watchfaceGeometry]);
  const crystalGeo = useMemo(() => new THREE.ShapeGeometry(buildShape(watchfaceGeometry), 48), [watchfaceGeometry]);

  useEffect(() => () => { bodyGeo.dispose(); faceGeo.dispose(); crystalGeo.dispose(); }, [bodyGeo, faceGeo, crystalGeo]);

  const isMetal = braceletMaterial === 'metal_solid' || braceletMaterial === 'metal_segmented';
  const isResin = braceletMaterial === 'resin';

  useFrame(() => { if (groupRef.current) groupRef.current.rotation.y += 0.009; });

  return (
    <group ref={groupRef} rotation-x={-0.28}>
      <mesh>
        <primitive object={bodyGeo} />
        <meshStandardMaterial color={watchfaceColor} metalness={0.72} roughness={0.18} />
      </mesh>

      <mesh position={[0, 0, 0.48]}>
        <primitive object={faceGeo} />
        <meshStandardMaterial color={watchfaceColor} roughness={0.28} metalness={0.05} />
      </mesh>

      <mesh position={[0, 0, 0.54]}>
        <primitive object={crystalGeo} />
        <meshPhysicalMaterial
          color="#c4dff5"
          metalness={0}
          roughness={0.02}
          transmission={0.90}
          ior={1.52}
          thickness={0.10}
          transparent
          opacity={0.85}
        />
      </mesh>

      {([1.60, -1.60] as number[]).map(y => (
        <group key={y}>
          <mesh position={[0, y, 0.01]}>
            <boxGeometry args={[1.14, 0.50, 0.24]} />
            <meshStandardMaterial color={watchfaceColor} metalness={0.72} roughness={0.18} />
          </mesh>
          <mesh position={[0, y, 0.12]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.032, 0.032, 1.18, 10]} />
            <meshStandardMaterial color={watchfaceColor} metalness={0.95} roughness={0.04} />
          </mesh>
        </group>
      ))}

      {([1, -1] as number[]).map(sign => (
        <mesh key={sign} position={[0, sign * 3.05, 0]}>
          <boxGeometry args={[1.05, 2.40, 0.14]} />
          <meshStandardMaterial
            color={braceletColor}
            metalness={isMetal ? 0.85 : 0}
            roughness={isMetal ? 0.10 : 0.80}
            transparent={isResin}
            opacity={isResin ? 0.72 : 1}
          />
        </mesh>
      ))}

      {handsEnabled && (
        <group position={[0, 0, 0.59]}>
          <group rotation={[0, 0, Math.PI / 5]}>
            <mesh position={[0, 0.26, 0]}>
              <boxGeometry args={[0.058, 0.52, 0.018]} />
              <meshStandardMaterial color={handsColor} metalness={0.94} roughness={0.06} />
            </mesh>
            <mesh position={[0, -0.07, 0]}>
              <boxGeometry args={[0.070, 0.10, 0.022]} />
              <meshStandardMaterial color={handsColor} metalness={0.94} roughness={0.06} />
            </mesh>
          </group>
          <group rotation={[0, 0, -Math.PI / 3.5]}>
            <mesh position={[0, 0.38, 0]}>
              <boxGeometry args={[0.040, 0.76, 0.016]} />
              <meshStandardMaterial color={handsColor} metalness={0.94} roughness={0.06} />
            </mesh>
            <mesh position={[0, -0.08, 0]}>
              <boxGeometry args={[0.053, 0.12, 0.020]} />
              <meshStandardMaterial color={handsColor} metalness={0.94} roughness={0.06} />
            </mesh>
          </group>
          <group rotation={[0, 0, Math.PI * 0.75]}>
            <mesh position={[0, 0.34, 0.002]}>
              <boxGeometry args={[0.010, 0.68, 0.008]} />
              <meshStandardMaterial color="#ef4444" metalness={0.75} roughness={0.15} />
            </mesh>
            <mesh position={[0, -0.10, 0.002]}>
              <boxGeometry args={[0.022, 0.16, 0.010]} />
              <meshStandardMaterial color="#ef4444" metalness={0.75} roughness={0.15} />
            </mesh>
          </group>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.054, 0.054, 0.005, 24]} />
            <meshStandardMaterial color={handsColor} metalness={1} roughness={0.02} />
          </mesh>
          <mesh position={[0, 0, 0.006]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.022, 0.022, 0.004, 16]} />
            <meshStandardMaterial color="#ef4444" metalness={0.85} roughness={0.08} />
          </mesh>
        </group>
      )}

      <mesh position={[1.62, 0.18, 0.10]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.09, 0.085, 0.28, 14]} />
        <meshStandardMaterial color={watchfaceColor} metalness={0.72} roughness={0.18} />
      </mesh>
    </group>
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
}

export default function WatchMiniCanvas({ preset }: WatchMiniCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const didMount = useRef(false);

  useEffect(() => {
    if (!WEB_GL_OK) return;
    const el = containerRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !didMount.current && _activeContexts < MAX_CONTEXTS) {
          didMount.current = true;
          _activeContexts++;
          setMounted(true);
          obs.disconnect();
        }
      },
      { rootMargin: '100px', threshold: 0 }
    );
    obs.observe(el);
    return () => {
      obs.disconnect();
      if (didMount.current) {
        _activeContexts = Math.max(0, _activeContexts - 1);
        didMount.current = false;
      }
    };
  }, []);

  if (!WEB_GL_OK) {
    return (
      <div className="w-full h-full flex items-center justify-center p-4">
        <div className="w-20 h-36 flex items-center justify-center">
          <WatchSVG
            mini
            config={{
              watchfaceGeometry: (preset.watchfaceGeometry ?? 'rounded') as any,
              watchfaceColor: preset.watchfaceColor ?? '#888888',
              braceletColor: preset.braceletColor ?? '#333333',
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
    <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
      {mounted && (
        <Canvas
          camera={{ position: [0, 0, 7.8], fov: 36 }}
          gl={{ alpha: true, antialias: true, powerPreference: 'low-power' }}
          style={{ background: 'transparent', width: '100%', height: '100%' }}
          dpr={[1, 1.5]}
        >
          <ambientLight intensity={0.70} />
          <directionalLight position={[4, 6, 5]} intensity={1.15} castShadow />
          <directionalLight position={[-2, -2, -3]} intensity={0.22} />
          <hemisphereLight intensity={0.30} />
          <MiniWatch
            watchfaceGeometry={preset.watchfaceGeometry ?? 'rounded'}
            watchfaceColor={preset.watchfaceColor ?? '#888888'}
            braceletColor={preset.braceletColor ?? '#333333'}
            braceletMaterial={preset.braceletMaterial ?? 'leather'}
            handsColor={preset.handsColor ?? '#ffffff'}
            handsEnabled={preset.handsEnabled ?? true}
          />
        </Canvas>
      )}
    </div>
  );
}
