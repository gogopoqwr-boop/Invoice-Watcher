import React, { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useWatchConfig } from '@/hooks/use-watch-config';
import * as THREE from 'three';
import { useSpring, animated } from '@react-spring/three';

// ─── Shape builders ───────────────────────────────────────────────────────────

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
    // drawn / pillow — super-rounded square
    const r = 0.65, w = 1.1;
    s.moveTo(-w + r, -w); s.lineTo(w - r, -w);
    s.quadraticCurveTo(w, -w, w, -w + r); s.lineTo(w, w - r);
    s.quadraticCurveTo(w, w, w - r, w); s.lineTo(-w + r, w);
    s.quadraticCurveTo(-w, w, -w, w - r); s.lineTo(-w, -w + r);
    s.quadraticCurveTo(-w, -w, -w + r, -w);
  }
  return s;
}

// ─── Face texture (canvas) ────────────────────────────────────────────────────

function buildFaceTexture(faceColor: string, handsColor: string, text: string): THREE.CanvasTexture {
  const S = 512;
  const cv = document.createElement('canvas');
  cv.width = S; cv.height = S;
  const ctx = cv.getContext('2d')!;

  ctx.fillStyle = faceColor;
  ctx.fillRect(0, 0, S, S);

  // subtle radial highlight
  const grad = ctx.createRadialGradient(S * 0.35, S * 0.3, 0, S / 2, S / 2, S * 0.55);
  grad.addColorStop(0, 'rgba(255,255,255,0.12)');
  grad.addColorStop(1, 'rgba(0,0,0,0.18)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, S, S);

  // hour markers
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI * 2) / 12 - Math.PI / 2;
    const rr = S * 0.41;
    const x = S / 2 + rr * Math.cos(a);
    const y = S / 2 + rr * Math.sin(a);
    ctx.beginPath();
    ctx.arc(x, y, i % 3 === 0 ? 7 : 3.5, 0, Math.PI * 2);
    ctx.fillStyle = handsColor;
    ctx.globalAlpha = 0.75;
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // text lines
  const lines = (text ?? '').trim().toUpperCase().split('\n').filter(Boolean).slice(0, 4);
  if (lines.length > 0) {
    const maxLen = Math.max(...lines.map(l => l.length), 1);
    const fz = Math.min(52, Math.max(18, Math.floor(S * 0.38 / maxLen)));
    ctx.font = `bold ${fz}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = handsColor;
    const lineH = fz * 1.35;
    const startY = S / 2 - ((lines.length - 1) * lineH) / 2;
    lines.forEach((line, i) => {
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 4;
      ctx.fillText(line, S / 2, startY + i * lineH);
    });
    ctx.shadowBlur = 0;
  }

  // center dot
  ctx.beginPath();
  ctx.arc(S / 2, S / 2, 6, 0, Math.PI * 2);
  ctx.fillStyle = handsColor;
  ctx.fill();

  return new THREE.CanvasTexture(cv);
}

// ─── Strap renderers ──────────────────────────────────────────────────────────

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
    // NATO strap — multiple thin layers
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

// ─── Camera controller ────────────────────────────────────────────────────────

export function CameraRig({ step }: { step: number }) {
  const { camera } = useThree();
  const targets: [number, number, number][] = [
    [0, 0.5, 9],   // 0 shape
    [0, 0.5, 9],   // 1 material
    [0, -3.5, 8],  // 2 bracelet — look down to see strap
    [0, 0.5, 9],   // 3 color
    [0, 0.5, 9],   // 4 details
  ];
  const pos = targets[Math.min(step, targets.length - 1)];
  const vec = useMemo(() => new THREE.Vector3(...pos), [step]);

  useFrame(() => {
    camera.position.lerp(vec, 0.05);
    camera.lookAt(0, 0, 0);
  });
  return null;
}

// ─── Main watch model ─────────────────────────────────────────────────────────

export default function WatchModel({ step = 0 }: { step?: number }) {
  const { config } = useWatchConfig();
  const groupRef = useRef<THREE.Group>(null);

  // idle rotation
  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.rotation.y += 0.004;
    }
  });

  // tilt toward viewer on bracelet step
  const { tiltX } = useSpring({
    tiltX: step === 2 ? 0.55 : 0,
    config: { mass: 1, tension: 110, friction: 22 },
  });

  // strap spread on bracelet step
  const { spread } = useSpring({
    spread: step === 2 ? 0.5 : 0,
    config: { mass: 1, tension: 120, friction: 20 },
  });

  // watchface body geometry
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

  // watchface disc for face texture
  const discGeo = useMemo(() => {
    const shape = buildFaceShape(config.watchfaceGeometry);
    return new THREE.ShapeGeometry(shape, 72);
  }, [config.watchfaceGeometry]);

  // crystal glass disc (same shape, separate geometry so no clone in render)
  const crystalGeo = useMemo(() => {
    const shape = buildFaceShape(config.watchfaceGeometry);
    return new THREE.ShapeGeometry(shape, 72);
  }, [config.watchfaceGeometry]);

  // face texture
  const faceTexture = useMemo(
    () => buildFaceTexture(config.watchfaceColor, config.handsColor, config.watchfaceText ?? ''),
    [config.watchfaceColor, config.handsColor, config.watchfaceText]
  );

  const isMetal = config.watchfaceMaterial === 'metal';
  const caseMat = useMemo(() => ({
    color: config.watchfaceColor,
    metalness: isMetal ? 0.88 : 0.05,
    roughness: isMetal ? 0.12 : 0.72,
  }), [config.watchfaceColor, config.watchfaceMaterial]);

  const isSegmented = config.braceletMaterial === 'metal_segmented';

  return (
    <animated.group ref={groupRef} rotation-x={tiltX}>

      {/* Case body */}
      <mesh castShadow receiveShadow>
        <primitive object={bodyGeo} />
        <meshStandardMaterial {...caseMat} />
      </mesh>

      {/* Face disc — textured */}
      <mesh position={[0, 0, 0.48]}>
        <primitive object={discGeo} />
        <meshStandardMaterial map={faceTexture} roughness={0.25} metalness={0.05} />
      </mesh>

      {/* Crystal glass — subtle reflection */}
      <mesh position={[0, 0, 0.52]}>
        <primitive object={crystalGeo} />
        <meshStandardMaterial transparent opacity={0.16} metalness={0.0} roughness={0.0} color="#e0f0ff" />
      </mesh>

      {/* Watch hands */}
      {config.handsEnabled && (
        <group position={[0, 0, 0.58]}>
          {/* Hour */}
          <mesh rotation={[0, 0, Math.PI / 5]} castShadow>
            <boxGeometry args={[0.065, 0.8, 0.04]} />
            <meshStandardMaterial color={config.handsColor} metalness={0.92} roughness={0.08} />
          </mesh>
          {/* Minute */}
          <mesh rotation={[0, 0, -Math.PI / 3.5]} castShadow>
            <boxGeometry args={[0.045, 1.1, 0.04]} />
            <meshStandardMaterial color={config.handsColor} metalness={0.92} roughness={0.08} />
          </mesh>
          {/* Second (if 3 hands) */}
          {(config.handsCount ?? 3) >= 3 && (
            <mesh rotation={[0, 0, Math.PI * 0.75]} castShadow>
              <boxGeometry args={[0.028, 1.0, 0.04]} />
              <meshStandardMaterial color="#ef4444" metalness={0.7} roughness={0.2} />
            </mesh>
          )}
          {/* Center cap */}
          <mesh>
            <cylinderGeometry args={[0.07, 0.07, 0.06, 16]} />
            <meshStandardMaterial color={config.handsColor} metalness={1} roughness={0.05} />
          </mesh>
        </group>
      )}

      {/* Crown button */}
      <mesh position={[1.68, 0, 0.05]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.1, 0.1, 0.38, 16]} />
        <meshStandardMaterial {...caseMat} />
      </mesh>

      {/* Lug connectors (bars between case and strap) */}
      {[1.78, -1.78].map((y) => (
        <mesh key={y} position={[0, y, 0.02]} castShadow>
          <boxGeometry args={[1.22, 0.2, 0.18]} />
          <meshStandardMaterial {...caseMat} />
        </mesh>
      ))}

      {/* Top strap */}
      <animated.group position-z={spread}>
        {isSegmented
          ? <SegmentedStrap posY={3.3} color={config.braceletColor} />
          : <SolidStrap posY={3.3} color={config.braceletColor} mat={config.braceletMaterial} />
        }
      </animated.group>

      {/* Bottom strap */}
      <animated.group position-z={spread}>
        {isSegmented
          ? <SegmentedStrap posY={-3.3} color={config.braceletColor} />
          : <SolidStrap posY={-3.3} color={config.braceletColor} mat={config.braceletMaterial} />
        }
      </animated.group>

    </animated.group>
  );
}
