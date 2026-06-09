import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useWatchConfig } from '@/hooks/use-watch-config';
import * as THREE from 'three';
import { useSpring, animated } from '@react-spring/three';

export default function WatchModel() {
  const { config, activePart } = useWatchConfig();
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (groupRef.current && !activePart) {
      groupRef.current.rotation.y += 0.005;
    }
  });

  const getMaterialProps = (materialType: string, color: string, isActive: boolean) => {
    const isMetal = materialType.includes('metal');
    return {
      color: new THREE.Color(color),
      roughness: isMetal ? 0.2 : 0.8,
      metalness: isMetal ? 0.9 : 0.1,
      emissive: isActive ? new THREE.Color(color) : new THREE.Color(0x000000),
      emissiveIntensity: isActive ? 0.5 : 0,
    };
  };

  const faceProps = getMaterialProps(config.watchfaceMaterial, config.watchfaceColor, activePart === 'watchFace');
  const strapProps = getMaterialProps(config.braceletMaterial, config.braceletColor, activePart === 'strap');

  const { rotation } = useSpring({
    rotation: activePart === 'strap' ? [Math.PI / 4, 0, 0] : [0, 0, 0],
    config: { mass: 1, tension: 170, friction: 26 }
  });

  return (
    <animated.group ref={groupRef} rotation={rotation as any}>
      {/* Case */}
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[1.5, 1.5, 0.4, 64]} />
        <meshStandardMaterial {...faceProps} />
      </mesh>
      
      {/* Bezel */}
      <mesh castShadow receiveShadow position={[0, 0.2, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.4, 0.1, 16, 64]} />
        <meshStandardMaterial {...faceProps} color={new THREE.Color(config.watchfaceColor).offsetHSL(0, 0, 0.2)} />
      </mesh>

      {/* Face Inner */}
      <mesh position={[0, 0.21, 0]}>
        <cylinderGeometry args={[1.4, 1.4, 0.01, 64]} />
        <meshStandardMaterial color={0x000000} roughness={0.1} metalness={0.8} />
      </mesh>

      {/* Hands */}
      {config.handsEnabled && (
        <group position={[0, 0.25, 0]}>
          <mesh rotation={[0, Math.PI / 4, 0]}>
            <boxGeometry args={[0.05, 0.02, 1.2]} />
            <meshStandardMaterial color={new THREE.Color(config.handsColor)} metalness={1} roughness={0.1} />
          </mesh>
          <mesh rotation={[0, -Math.PI / 6, 0]}>
            <boxGeometry args={[0.08, 0.02, 0.8]} />
            <meshStandardMaterial color={new THREE.Color(config.handsColor)} metalness={1} roughness={0.1} />
          </mesh>
        </group>
      )}

      {/* Top Strap */}
      <mesh position={[0, 0, -2]} castShadow receiveShadow>
        <boxGeometry args={[1.2, 0.2, 2.5]} />
        <meshStandardMaterial {...strapProps} />
      </mesh>

      {/* Bottom Strap */}
      <mesh position={[0, 0, 2]} castShadow receiveShadow>
        <boxGeometry args={[1.2, 0.2, 2.5]} />
        <meshStandardMaterial {...strapProps} />
      </mesh>
    </animated.group>
  );
}
