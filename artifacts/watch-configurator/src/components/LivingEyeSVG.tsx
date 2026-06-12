import React, { useRef, useState, useEffect, useCallback } from 'react';

export type EyeType = 'spider' | 'squid' | 'reptile' | 'gremlin' | 'cyber';

interface LivingEyeSVGProps {
  eyeType: EyeType;
  watchfaceColor: string;
  braceletColor: string;
  watchfaceGeometry?: string;
  mini?: boolean;
  pupilNarrow?: boolean;
}

function parseEyeType(text: string | null | undefined): EyeType {
  if (!text) return 'gremlin';
  const match = text.match(/^EYE:(\w+)$/);
  if (!match) return 'gremlin';
  const t = match[1];
  if (t === 'spider' || t === 'squid' || t === 'reptile' || t === 'gremlin' || t === 'cyber') return t;
  return 'gremlin';
}

export { parseEyeType };

export default function LivingEyeSVG({
  eyeType,
  watchfaceColor,
  braceletColor,
  watchfaceGeometry = 'circle',
  mini = false,
  pupilNarrow = false,
}: LivingEyeSVGProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pupilOffset, setPupilOffset] = useState({ x: 0, y: 0 });
  const [blink, setBlink] = useState(false);
  const blinkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleBlink = useCallback(() => {
    const delay = 2000 + Math.random() * 4000;
    blinkTimerRef.current = setTimeout(() => {
      setBlink(true);
      setTimeout(() => {
        setBlink(false);
        scheduleBlink();
      }, 160);
    }, delay);
  }, []);

  useEffect(() => {
    scheduleBlink();
    return () => { if (blinkTimerRef.current) clearTimeout(blinkTimerRef.current); };
  }, [scheduleBlink]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = (e.clientX - cx) / (rect.width / 2);
    const dy = (e.clientY - cy) / (rect.height / 2);
    const maxShift = mini ? 3 : 5;
    setPupilOffset({
      x: Math.max(-maxShift, Math.min(maxShift, dx * maxShift)),
      y: Math.max(-maxShift, Math.min(maxShift, dy * maxShift)),
    });
  }, [mini]);

  const handleMouseLeave = useCallback(() => {
    setPupilOffset({ x: 0, y: 0 });
  }, []);

  const W = mini ? 80 : 130;
  const H = mini ? 140 : 220;
  const cx = W / 2;
  const cy = H / 2;

  const strapW = mini ? 14 : 22;
  const strapH = mini ? 38 : 60;
  const faceR = mini ? 26 : 42;

  const faceClipId = `face-clip-${eyeType}-${mini ? 'm' : 'l'}`;

  const faceShape = () => {
    if (watchfaceGeometry === 'square') return (
      <rect x={cx - faceR} y={cy - faceR} width={faceR * 2} height={faceR * 2} rx={faceR * 0.15} />
    );
    if (watchfaceGeometry === 'star') {
      const pts = [];
      for (let i = 0; i < 10; i++) {
        const angle = (Math.PI / 5) * i - Math.PI / 2;
        const r = i % 2 === 0 ? faceR : faceR * 0.55;
        pts.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
      }
      return <polygon points={pts.join(' ')} />;
    }
    if (watchfaceGeometry === 'drawn') return (
      <rect x={cx - faceR * 0.9} y={cy - faceR} width={faceR * 1.8} height={faceR * 2} rx={faceR * 0.45} />
    );
    return <circle cx={cx} cy={cy} r={faceR} />;
  };

  const eyeContent = () => {
    const ef = pupilNarrow ? 0.15 : 1;
    switch (eyeType) {
      case 'spider': return <SpiderEyes cx={cx} cy={cy} r={faceR} pupilX={pupilOffset.x} pupilY={pupilOffset.y} narrow={ef} mini={mini} />;
      case 'squid': return <SquidEye cx={cx} cy={cy} r={faceR} pupilX={pupilOffset.x} pupilY={pupilOffset.y} narrow={ef} mini={mini} />;
      case 'reptile': return <ReptileEye cx={cx} cy={cy} r={faceR} pupilX={pupilOffset.x} pupilY={pupilOffset.y} narrow={ef} mini={mini} />;
      case 'gremlin': return <GremlinEyes cx={cx} cy={cy} r={faceR} pupilX={pupilOffset.x} pupilY={pupilOffset.y} narrow={ef} mini={mini} />;
      case 'cyber': return <CyberEye cx={cx} cy={cy} r={faceR} pupilX={pupilOffset.x} pupilY={pupilOffset.y} narrow={ef} mini={mini} />;
    }
  };

  const lumeColor = eyeType === 'cyber' ? '#5eead4' : eyeType === 'spider' ? '#4ade80' : '#f0abfc';

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ width: W, height: H, userSelect: 'none' }}
    >
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" overflow="visible">
        <defs>
          <clipPath id={faceClipId}>
            {faceShape()}
          </clipPath>
          <radialGradient id={`eye-bg-${eyeType}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={watchfaceColor} stopOpacity="0.9" />
            <stop offset="100%" stopColor={watchfaceColor} stopOpacity="1" />
          </radialGradient>
          <filter id={`glow-${eyeType}`} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation={mini ? 1.5 : 2.5} result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Top strap */}
        <rect
          x={cx - strapW / 2} y={0}
          width={strapW} height={cy - faceR + 2}
          rx={strapW * 0.4}
          fill={braceletColor}
          opacity={0.9}
        />
        {/* Bottom strap */}
        <rect
          x={cx - strapW / 2} y={cy + faceR - 2}
          width={strapW} height={H - (cy + faceR - 2)}
          rx={strapW * 0.4}
          fill={braceletColor}
          opacity={0.9}
        />

        {/* Watch face */}
        <g clipPath={`url(#${faceClipId})`}>
          {faceShape()}
          <rect x={0} y={0} width={W} height={H} fill={`url(#eye-bg-${eyeType})`} />

          {/* Subtle inner rim */}
          <g fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={mini ? 1 : 1.5}>
            {faceShape()}
          </g>

          {/* Eye content — clipped to face */}
          <g
            style={{
              transition: 'transform 0.08s ease-out',
            }}
          >
            {eyeContent()}
          </g>
        </g>

        {/* Face border */}
        <g fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth={mini ? 1 : 1.5}>
          {faceShape()}
        </g>

        {/* Blink overlay */}
        {blink && (
          <g clipPath={`url(#${faceClipId})`}>
            <rect x={0} y={0} width={W} height={H} fill={watchfaceColor} opacity={1} />
            <line
              x1={cx - faceR * 0.5} y1={cy}
              x2={cx + faceR * 0.5} y2={cy}
              stroke={lumeColor} strokeWidth={mini ? 1.5 : 2.5} strokeLinecap="round"
              filter={`url(#glow-${eyeType})`}
            />
          </g>
        )}

        {/* Crown */}
        <rect
          x={cx + faceR - 1} y={cy - (mini ? 4 : 6)}
          width={mini ? 5 : 8} height={mini ? 8 : 12}
          rx={mini ? 2 : 3}
          fill={braceletColor}
          stroke="rgba(255,255,255,0.15)"
          strokeWidth={0.5}
        />
      </svg>
    </div>
  );
}

// ── Eye variants ──────────────────────────────────────────────────────────────

function SpiderEyes({ cx, cy, r, pupilX, pupilY, narrow, mini }: any) {
  const es = mini ? 5 : 8;
  const ps = mini ? 2.5 : 4;
  const positions = [
    [-r * 0.45, -r * 0.2], [r * 0.45, -r * 0.2],
    [-r * 0.15, -r * 0.42], [r * 0.15, -r * 0.42],
    [-r * 0.55, r * 0.1], [r * 0.55, r * 0.1],
    [-r * 0.2, r * 0.3], [r * 0.2, r * 0.3],
  ];
  return (
    <g>
      {positions.map(([ox, oy], i) => (
        <g key={i}>
          <circle cx={cx + ox} cy={cy + oy} r={es} fill="#0a1a0a" stroke="#4ade80" strokeWidth={0.8} opacity={0.9} />
          <circle
            cx={cx + ox + pupilX * 0.4}
            cy={cy + oy + pupilY * 0.4}
            r={ps * narrow}
            fill="#4ade80"
            opacity={0.9}
          />
          <circle cx={cx + ox - ps * 0.3} cy={cy + oy - ps * 0.3} r={ps * 0.4} fill="rgba(255,255,255,0.5)" />
        </g>
      ))}
    </g>
  );
}

function SquidEye({ cx, cy, r, pupilX, pupilY, narrow, mini }: any) {
  const er = mini ? 12 : 19;
  const prW = mini ? 3 : 5;
  const prH = (mini ? 9 : 15) * narrow;
  return (
    <g>
      <ellipse cx={cx} cy={cy} rx={er} ry={er * 0.75} fill="#001a2e" stroke="#7dd3fc" strokeWidth={1} />
      <ellipse cx={cx} cy={cy} rx={er * 0.65} ry={er * 0.55} fill="#0e3a5c" />
      <ellipse
        cx={cx + pupilX} cy={cy + pupilY}
        rx={prW} ry={prH}
        fill="#0a0a1a"
        opacity={0.95}
      />
      <ellipse
        cx={cx + pupilX} cy={cy + pupilY}
        rx={prW * 0.4} ry={prH * 0.4}
        fill="rgba(125,211,252,0.6)"
      />
      <ellipse cx={cx - er * 0.25} cy={cy - er * 0.3} rx={er * 0.2} ry={er * 0.12} fill="rgba(255,255,255,0.18)" />
    </g>
  );
}

function ReptileEye({ cx, cy, r, pupilX, pupilY, narrow, mini }: any) {
  const er = mini ? 13 : 20;
  const pupilH = (mini ? 10 : 17) * narrow;
  const pupilW = mini ? 3 : 5;
  return (
    <g>
      <ellipse cx={cx} cy={cy} rx={er} ry={er * 0.65} fill="#1a0500" stroke="#f59e0b" strokeWidth={1} />
      <ellipse cx={cx} cy={cy} rx={er * 0.75} ry={er * 0.5} fill="#2d0a00" />
      <ellipse cx={cx} cy={cy} rx={er * 0.55} ry={er * 0.38} fill="#8b3a00" />
      <ellipse
        cx={cx + pupilX} cy={cy + pupilY}
        rx={pupilW} ry={pupilH}
        fill="#050505"
        opacity={0.95}
      />
      <ellipse
        cx={cx + pupilX - pupilW * 0.3} cy={cy + pupilY - pupilH * 0.3}
        rx={pupilW * 0.4} ry={pupilH * 0.25}
        fill="rgba(251,191,36,0.4)"
      />
      <ellipse cx={cx - er * 0.3} cy={cy - er * 0.25} rx={er * 0.2} ry={er * 0.1} fill="rgba(255,255,255,0.12)" />
    </g>
  );
}

function GremlinEyes({ cx, cy, r, pupilX, pupilY, narrow, mini }: any) {
  const er = mini ? 7 : 11;
  const pr = (mini ? 3.5 : 5.5) * narrow;
  const spacing = mini ? 10 : 16;
  return (
    <g>
      {[-1, 1].map(side => (
        <g key={side}>
          <circle cx={cx + side * spacing} cy={cy - r * 0.15} r={er} fill="#1a0020" stroke="#f0abfc" strokeWidth={1} />
          <circle cx={cx + side * spacing} cy={cy - r * 0.15} r={er * 0.65} fill="#2d0040" />
          <circle
            cx={cx + side * spacing + pupilX * 0.5}
            cy={cy - r * 0.15 + pupilY * 0.5}
            r={pr}
            fill="#0a0010"
          />
          <circle
            cx={cx + side * spacing + pupilX * 0.5 - pr * 0.4}
            cy={cy - r * 0.15 + pupilY * 0.5 - pr * 0.4}
            r={pr * 0.35}
            fill="rgba(240,171,252,0.7)"
          />
          <circle
            cx={cx + side * spacing - er * 0.3}
            cy={cy - r * 0.15 - er * 0.3}
            r={er * 0.25}
            fill="rgba(255,255,255,0.2)"
          />
        </g>
      ))}
    </g>
  );
}

function CyberEye({ cx, cy, r, pupilX, pupilY, narrow, mini }: any) {
  const er = mini ? 12 : 19;
  const pupilR = (mini ? 5 : 8) * narrow;
  const rings = mini ? [0.9, 0.7, 0.5] : [0.9, 0.7, 0.5];
  return (
    <g>
      {rings.map((scale, i) => (
        <circle
          key={i}
          cx={cx} cy={cy}
          r={er * scale}
          fill="none"
          stroke={i === 0 ? '#5eead4' : i === 1 ? '#0d9488' : '#134e4a'}
          strokeWidth={i === 0 ? 1 : 0.5}
          strokeDasharray={i === 1 ? `${er * scale * 0.2} ${er * scale * 0.1}` : undefined}
          opacity={0.8}
        />
      ))}
      <circle cx={cx} cy={cy} r={er * 0.4} fill="#042f2e" />
      <circle
        cx={cx + pupilX} cy={cy + pupilY}
        r={pupilR}
        fill="#5eead4"
        opacity={0.9}
      />
      <circle
        cx={cx + pupilX} cy={cy + pupilY}
        r={pupilR * 0.45}
        fill="#042f2e"
      />
      <circle
        cx={cx + pupilX - pupilR * 0.35} cy={cy + pupilY - pupilR * 0.35}
        r={pupilR * 0.2}
        fill="rgba(255,255,255,0.8)"
      />
      <line x1={cx - er} y1={cy} x2={cx + er} y2={cy} stroke="#5eead4" strokeWidth={0.3} opacity={0.3} />
      <line x1={cx} y1={cy - er} x2={cx} y2={cy + er} stroke="#5eead4" strokeWidth={0.3} opacity={0.3} />
    </g>
  );
}
