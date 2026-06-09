import React from 'react';
import { useWatchConfig } from '@/hooks/use-watch-config';

export default function WatchSVG() {
  const { config, activePart, setActivePart } = useWatchConfig();

  const isCircle = config.watchfaceGeometry !== 'square' && config.watchfaceGeometry !== 'cushion';
  const rx = config.watchfaceGeometry === 'cushion' ? 22 : isCircle ? 50 : 8;

  const faceActive = activePart === 'watchFace';
  const strapActive = activePart === 'strap';

  return (
    <svg
      viewBox="0 0 120 200"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-full max-h-[420px]"
      style={{ filter: 'drop-shadow(0 0 24px rgba(99,102,241,0.3))' }}
    >
      {/* Top strap */}
      <rect
        x="44" y="0" width="32" height="55"
        rx="6"
        fill={config.braceletColor}
        opacity={strapActive ? 1 : 0.8}
        stroke={strapActive ? '#818cf8' : 'transparent'}
        strokeWidth="2"
        style={{ cursor: 'pointer' }}
        onClick={() => setActivePart(activePart === 'strap' ? null : 'strap')}
      />

      {/* Bottom strap */}
      <rect
        x="44" y="145" width="32" height="55"
        rx="6"
        fill={config.braceletColor}
        opacity={strapActive ? 1 : 0.8}
        stroke={strapActive ? '#818cf8' : 'transparent'}
        strokeWidth="2"
        style={{ cursor: 'pointer' }}
        onClick={() => setActivePart(activePart === 'strap' ? null : 'strap')}
      />

      {/* Watch case */}
      <rect
        x="10" y="50" width="100" height="100"
        rx={rx}
        fill={config.watchfaceColor}
        opacity={faceActive ? 1 : 0.9}
        stroke={faceActive ? '#818cf8' : '#334155'}
        strokeWidth={faceActive ? 3 : 1.5}
        style={{ cursor: 'pointer' }}
        onClick={() => setActivePart(activePart === 'watchFace' ? null : 'watchFace')}
      />

      {/* Glass face */}
      <rect
        x="16" y="56" width="88" height="88"
        rx={Math.max(rx - 4, 4)}
        fill="#0f172a"
        opacity="0.9"
        pointerEvents="none"
      />

      {/* Hour markers */}
      {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((angle, i) => {
        const rad = (angle - 90) * Math.PI / 180;
        const r = 36;
        const cx = 60 + r * Math.cos(rad);
        const cy = 100 + r * Math.sin(rad);
        return (
          <circle key={i} cx={cx} cy={cy} r={i % 3 === 0 ? 2.5 : 1.2}
            fill={i % 3 === 0 ? config.handsColor : '#475569'}
            pointerEvents="none"
          />
        );
      })}

      {/* Hour hand */}
      {config.handsEnabled && (
        <line
          x1="60" y1="100"
          x2={60 + 20 * Math.cos((210 - 90) * Math.PI / 180)}
          y2={100 + 20 * Math.sin((210 - 90) * Math.PI / 180)}
          stroke={config.handsColor}
          strokeWidth="3"
          strokeLinecap="round"
          pointerEvents="none"
        />
      )}

      {/* Minute hand */}
      {config.handsEnabled && (
        <line
          x1="60" y1="100"
          x2={60 + 30 * Math.cos((60 - 90) * Math.PI / 180)}
          y2={100 + 30 * Math.sin((60 - 90) * Math.PI / 180)}
          stroke={config.handsColor}
          strokeWidth="2"
          strokeLinecap="round"
          pointerEvents="none"
        />
      )}

      {/* Second hand */}
      {config.handsEnabled && (
        <line
          x1="60" y1="100"
          x2={60 + 32 * Math.cos((120 - 90) * Math.PI / 180)}
          y2={100 + 32 * Math.sin((120 - 90) * Math.PI / 180)}
          stroke="#ef4444"
          strokeWidth="1"
          strokeLinecap="round"
          pointerEvents="none"
        />
      )}

      {/* Crown dot */}
      <circle cx="60" cy="100" r="3" fill={config.handsColor} pointerEvents="none" />

      {/* Crown stem */}
      <rect x="108" y="90" width="6" height="14" rx="3" fill={config.watchfaceColor} pointerEvents="none" />

      {/* Strap buckle */}
      <rect x="50" y="170" width="20" height="8" rx="2" fill="#334155" pointerEvents="none" />
      <line x1="60" y1="170" x2="60" y2="178" stroke="#64748b" strokeWidth="1" pointerEvents="none" />
    </svg>
  );
}
