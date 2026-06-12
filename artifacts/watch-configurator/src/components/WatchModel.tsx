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
  return 1.1; // rounded default
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
    const pts = 5, oR = 1.52, iR = 0.68;
    for (let i = 0; i < pts * 2; i++) {
      const r = i % 2 === 0 ? oR : iR;
      const a = (i * Math.PI) / pts - Math.PI / 2;
      i === 0 ? s.moveTo(r * Math.cos(a), r * Math.sin(a)) : s.lineTo(r * Math.cos(a), r * Math.sin(a));
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

// ─── Face texture (canvas) — background + markers only, NO text ───────────

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

  // Hour markers
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

  // Center pip
  ctx.beginPath();
  ctx.arc(S / 2, S / 2, 7, 0, Math.PI * 2);
  ctx.fillStyle = handsColor;
  ctx.fill();

  const tex = new THREE.CanvasTexture(cv);

  // Fix UV mapping: ShapeGeometry uses raw vertex coords as UVs (not normalized).
  // We must map the shape's [-half, +half] range to texture [0, 1].
  // formula: sample = offset + rawUV * repeat
  // offset=0.5, repeat=0.5/halfWidth maps rawUV=0→0.5 (center) and rawUV=±half→0 or 1 (edges)
  const half = shapeHalfWidth(geom);
  const rep = 0.5 / half;
  tex.offset.set(0.5, 0.5);
  tex.repeat.set(rep, rep);
  tex.needsUpdate = true;

  return tex;
}

// ─── 3D text on the watchface ─────────────────────────────────────────────

const FONT_URL = '/dejavu_bold.typeface.json';
const TEXT_DEPTH = 0.06;

function WatchFaceText3D({
  text,
  mode,
  handsColor,
}: {
  text: string;
  mode: 'center' | 'circular';
  handsColor: string;
}) {
  const trimmed = text.trim().toUpperCase();
  if (!trimmed) return null;

  const mat = (
    <meshStandardMaterial
      color={handsColor}
      metalness={0.55}
      roughness={0.2}
    />
  );

  if (mode === 'circular') {
    const chars = Array.from(trimmed);
    const arcSpan = Math.min(Math.PI * 1.7, chars.length * 0.32);
    const startAngle = -Math.PI / 2 - arcSpan / 2;
    const circR = 0.72;
    const fontSize = Math.max(0.055, Math.min(0.13, 0.55 / Math.max(chars.length, 4)));

    return (
      <group position={[0, 0, 0.61]}>
        {chars.map((ch, i) => {
          const angle = startAngle + (i + 0.5) * (arcSpan / chars.length);
          const x = circR * Math.cos(angle);
          const y = circR * Math.sin(angle);
          const rot = angle + Math.PI / 2;
          return (
            <group key={i} position={[x, y, 0]} rotation={[0, 0, rot]}>
              <Center>
                <Text3D
                  font={FONT_URL}
                  size={fontSize}
                  height={TEXT_DEPTH}
                  bevelEnabled
                  bevelSize={0.008}
                  bevelThickness={0.008}
                  bevelSegments={3}
                  curveSegments={6}
                >
                  {ch}
                  {mat}
                </Text3D>
              </Center>
            </group>
          );
        })}
        {/* Brand label */}
        <group position={[0, -0.14, 0]}>
          <Center>
            <Text3D
              font={FONT_URL}
              size={0.055}
              height={0.02}
              bevelEnabled={false}
              curveSegments={4}
            >
              {'ЧЕБЛЯЧАС'}
              <meshStandardMaterial color={handsColor} metalness={0.4} roughness={0.4} opacity={0.4} transparent />
            </Text3D>
          </Center>
        </group>
      </group>
    );
  }

  // Center mode: multi-line text
  const lines = trimmed.split('\n').filter(Boolean).slice(0, 4);
  const maxLen = Math.max(...lines.map(l => l.length), 1);
  const fontSize = Math.min(0.28, Math.max(0.08, 0.7 / maxLen));
  const lineH = fontSize * 1.4;
  const totalH = (lines.length - 1) * lineH;

  return (
    <group position={[0, 0, 0.61]}>
      {lines.map((line, i) => {
        const yOff = totalH / 2 - i * lineH;
        return (
          <group key={i} position={[0, yOff, 0]}>
            <Center>
              <Text3D
                font={FONT_URL}
                size={fontSize}
                height={TEXT_DEPTH}
                bevelEnabled
                bevelSize={0.012}
                bevelThickness={0.012}
                bevelSegments={3}
                curveSegments={8}
              >
                {line}
                {mat}
              </Text3D>
            </Center>
          </group>
        );
      })}
      {/* Brand label */}
      <group position={[0, -totalH / 2 - fontSize * 0.85, 0]}>
        <Center>
          <Text3D
            font={FONT_URL}
            size={0.06}
            height={0.02}
            bevelEnabled={false}
            curveSegments={4}
          >
            {'ЧЕБЛЯЧАС'}
            <meshStandardMaterial color={handsColor} metalness={0.4} roughness={0.4} opacity={0.3} transparent />
          </Text3D>
        </Center>
      </group>
    </group>
  );
}

// ─── Strap renderers ──────────────────────────────────────────────────────

function SegmentedStrap({ posY, color }: { posY: number; color: string }) {
  const count = 9;
  const segH = 0.28;
  const gap = 0.06;
  const totalH = count * (segH + gap);
  return (
    <group position={[0, posY, 0]}>
      {Array.from({ length: count }).map((_, i) => (
        <mesh key={i} position={[0, i * (segH + gap) - totalH / 2 + segH / 2, 0]} castShadow>
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
  const metalness = mat.includes('metal') ? 0.85 : isResin ? 0.0 : 0.0;
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

// ─── Camera controller ────────────────────────────────────────────────────

const INTERACTION_PAUSE_MS = 10_000;

export function CameraRig({ step, lastInteractionRef }: {
  step: number;
  lastInteractionRef?: React.RefObject<number>;
}) {
  const { camera } = useThree();
  const targets: [number, number, number][] = [
    [0, 0.5, 9],
    [0, 0.5, 9],
    [0, -3.5, 8],
    [0, 0.5, 9],
    [0, 0.5, 9],
  ];
  const pos = targets[Math.min(step, targets.length - 1)];
  const vec = useMemo(() => new THREE.Vector3(...pos), [step]);

  useFrame(() => {
    const userActive = lastInteractionRef?.current
      ? Date.now() - lastInteractionRef.current < INTERACTION_PAUSE_MS
      : false;
    if (userActive) return;
    camera.position.lerp(vec, 0.05);
    camera.lookAt(0, 0, 0);
  });
  return null;
}

// ─── Main watch model ─────────────────────────────────────────────────────

export interface WatchModelProps {
  step?: number;
  lastInteractionRef?: React.RefObject<number>;
}

export default function WatchModel({ step = 0, lastInteractionRef }: WatchModelProps) {
  const { config } = useWatchConfig();
  const groupRef = useRef<THREE.Group>(null);
  const prevStepRef = useRef(step);
  const faceSnapTargetRef = useRef<number | null>(null);

  useEffect(() => {
    if (step === 3 && prevStepRef.current !== 3 && groupRef.current) {
      const curY = groupRef.current.rotation.y;
      faceSnapTargetRef.current = Math.round(curY / (Math.PI * 2)) * Math.PI * 2;
    } else if (step !== 3) {
      faceSnapTargetRef.current = null;
    }
    prevStepRef.current = step;
  }, [step]);

  const { tiltX } = useSpring({
    tiltX: step === 2 ? 0.55 : 0,
    config: { mass: 1, tension: 110, friction: 22 },
  });

  const { spread } = useSpring({
    spread: step === 2 ? 0.5 : 0,
    config: { mass: 1, tension: 120, friction: 20 },
  });

  useFrame(() => {
    if (!groupRef.current) return;
    const userActive = lastInteractionRef?.current
      ? Date.now() - lastInteractionRef.current < INTERACTION_PAUSE_MS
      : false;
    if (userActive) return;

    if (faceSnapTargetRef.current !== null) {
      const target = faceSnapTargetRef.current;
      groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, target, 0.06);
      if (Math.abs(groupRef.current.rotation.y - target) < 0.001) {
        groupRef.current.rotation.y = target;
        faceSnapTargetRef.current = null;
      }
    } else {
      groupRef.current.rotation.y += 0.004;
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

  const discGeo = useMemo(() => {
    const shape = buildFaceShape(config.watchfaceGeometry);
    return new THREE.ShapeGeometry(shape, 72);
  }, [config.watchfaceGeometry]);

  const crystalGeo = useMemo(() => {
    const shape = buildFaceShape(config.watchfaceGeometry);
    return new THREE.ShapeGeometry(shape, 72);
  }, [config.watchfaceGeometry]);

  const isCircular = (config.watchfaceTextMode ?? 'center') === 'circular';

  const faceTexture = useMemo(
    () => buildFaceTexture(
      config.watchfaceColor,
      config.handsColor,
      config.watchfaceGeometry,
      isCircular,
    ),
    [config.watchfaceColor, config.handsColor, config.watchfaceGeometry, isCircular]
  );

  const isMetal = config.watchfaceMaterial === 'metal';
  const caseMat = useMemo(() => ({
    color: config.watchfaceColor,
    metalness: isMetal ? 0.88 : 0.05,
    roughness: isMetal ? 0.12 : 0.72,
  }), [config.watchfaceColor, config.watchfaceMaterial]);

  const isSegmented = config.braceletMaterial === 'metal_segmented';
  const hasText = (config.watchfaceText ?? '').trim().length > 0;

  return (
    <animated.group ref={groupRef} rotation-x={tiltX}>

      <mesh castShadow receiveShadow>
        <primitive object={bodyGeo} />
        <meshStandardMaterial {...caseMat} />
      </mesh>

      {/* Face disc with corrected UV texture */}
      <mesh position={[0, 0, 0.48]}>
        <primitive object={discGeo} />
        <meshStandardMaterial map={faceTexture} roughness={0.25} metalness={0.05} />
      </mesh>

      {/* 3D extruded text — Suspense so font load doesn't block render */}
      {hasText && (
        <Suspense fallback={null}>
          <WatchFaceText3D
            text={config.watchfaceText ?? ''}
            mode={config.watchfaceTextMode ?? 'center'}
            handsColor={config.handsColor}
          />
        </Suspense>
      )}

      {/* Crystal glass layer */}
      <mesh position={[0, 0, 0.52]}>
        <primitive object={crystalGeo} />
        <meshStandardMaterial transparent opacity={0.16} metalness={0.0} roughness={0.0} color="#e0f0ff" />
      </mesh>

      {config.handsEnabled && (
        <group position={[0, 0, 0.58]}>
          <mesh rotation={[0, 0, Math.PI / 5]} castShadow>
            <boxGeometry args={[0.065, 0.8, 0.04]} />
            <meshStandardMaterial color={config.handsColor} metalness={0.92} roughness={0.08} />
          </mesh>
          <mesh rotation={[0, 0, -Math.PI / 3.5]} castShadow>
            <boxGeometry args={[0.045, 1.1, 0.04]} />
            <meshStandardMaterial color={config.handsColor} metalness={0.92} roughness={0.08} />
          </mesh>
          {(config.handsCount ?? 3) >= 3 && (
            <mesh rotation={[0, 0, Math.PI * 0.75]} castShadow>
              <boxGeometry args={[0.028, 1.0, 0.04]} />
              <meshStandardMaterial color="#ef4444" metalness={0.7} roughness={0.2} />
            </mesh>
          )}
          <mesh>
            <cylinderGeometry args={[0.07, 0.07, 0.06, 16]} />
            <meshStandardMaterial color={config.handsColor} metalness={1} roughness={0.05} />
          </mesh>
        </group>
      )}

      <mesh position={[1.68, 0, 0.05]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.1, 0.1, 0.38, 16]} />
        <meshStandardMaterial {...caseMat} />
      </mesh>

      {[1.78, -1.78].map((y) => (
        <mesh key={y} position={[0, y, 0.02]} castShadow>
          <boxGeometry args={[1.22, 0.2, 0.18]} />
          <meshStandardMaterial {...caseMat} />
        </mesh>
      ))}

      <animated.group position-z={spread}>
        {isSegmented
          ? <SegmentedStrap posY={3.3} color={config.braceletColor} />
          : <SolidStrap posY={3.3} color={config.braceletColor} mat={config.braceletMaterial} />
        }
      </animated.group>

      <animated.group position-z={spread}>
        {isSegmented
          ? <SegmentedStrap posY={-3.3} color={config.braceletColor} />
          : <SolidStrap posY={-3.3} color={config.braceletColor} mat={config.braceletMaterial} />
        }
      </animated.group>

    </animated.group>
  );
}
