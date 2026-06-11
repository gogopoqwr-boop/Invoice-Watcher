import React from 'react';
import { useWatchConfig, ExtendedConfigState } from '@/hooks/use-watch-config';

function starPoints(cx: number, cy: number, outerR: number, innerR: number, n = 5): string {
  const pts: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const angle = (i * Math.PI / n) - Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    pts.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
  }
  return pts.join(' ');
}

interface WatchSVGProps {
  config?: Partial<ExtendedConfigState>;
  mini?: boolean;
  onClick?: () => void;
}

export default function WatchSVG({ config: propConfig, mini = false, onClick }: WatchSVGProps) {
  const ctx = useWatchConfig();
  const config = propConfig ? { ...ctx.config, ...propConfig } : ctx.config;
  const { activePart, setActivePart } = ctx;

  const geo = config.watchfaceGeometry ?? 'circle';
  const faceColor = config.watchfaceColor ?? '#1e293b';
  const strapColor = config.braceletColor ?? '#0f172a';
  const handsColor = config.handsColor ?? '#cbd5e1';
  const handsEnabled = config.handsEnabled !== false;
  const handsCount = config.handsCount ?? 3;
  const watchfaceText = config.watchfaceText ?? '';
  const watchfaceTextMode = config.watchfaceTextMode ?? 'center';
  const bgType = config.watchfaceBackgroundType ?? 'solid';
  const gradEnd = config.watchfaceGradientEnd ?? '#0f172a';
  const braceletMat = config.braceletMaterial ?? 'metal_solid';

  const faceActive = !mini && activePart === 'watchFace';
  const strapActive = !mini && activePart === 'strap';

  const cx = 60, cy = 100, faceR = 44;

  const FaceShape = ({ fill, stroke, strokeWidth, opacity, ...rest }: any) => {
    if (geo === 'circle') {
      return <circle cx={cx} cy={cy} r={faceR} fill={fill} stroke={stroke} strokeWidth={strokeWidth} opacity={opacity} {...rest} />;
    } else if (geo === 'square') {
      return <rect x={cx - faceR} y={cy - faceR} width={faceR * 2} height={faceR * 2} rx="6" fill={fill} stroke={stroke} strokeWidth={strokeWidth} opacity={opacity} {...rest} />;
    } else if (geo === 'star') {
      return <polygon points={starPoints(cx, cy, faceR, faceR * 0.44)} fill={fill} stroke={stroke} strokeWidth={strokeWidth} opacity={opacity} {...rest} />;
    } else if (geo === 'drawn') {
      return <rect x={cx - faceR} y={cy - faceR} width={faceR * 2} height={faceR * 2} rx="22" fill={fill} stroke={stroke} strokeWidth={strokeWidth} opacity={opacity} {...rest} />;
    } else {
      return <rect x={cx - faceR} y={cy - faceR * 0.85} width={faceR * 2} height={faceR * 1.7} rx="30" fill={fill} stroke={stroke} strokeWidth={strokeWidth} opacity={opacity} {...rest} />;
    }
  };

  const clipId = `clip-${geo}-${mini ? 'mini' : 'full'}`;
  const ClipShape = () => {
    if (geo === 'circle') return <circle cx={cx} cy={cy} r={faceR - 2} />;
    if (geo === 'square') return <rect x={cx - faceR + 2} y={cy - faceR + 2} width={(faceR - 2) * 2} height={(faceR - 2) * 2} rx="5" />;
    if (geo === 'star') return <polygon points={starPoints(cx, cy, faceR - 2, (faceR - 2) * 0.44)} />;
    if (geo === 'drawn') return <rect x={cx - faceR + 2} y={cy - faceR + 2} width={(faceR - 2) * 2} height={(faceR - 2) * 2} rx="20" />;
    return <rect x={cx - faceR + 2} y={cy - faceR * 0.85 + 2} width={(faceR - 2) * 2} height={faceR * 1.7 - 4} rx="28" />;
  };

  const meshPatternId = `mesh-${mini ? 'm' : 'f'}`;
  const linkPatternId = `link-${mini ? 'm' : 'f'}`;
  const circTextPathId = `circ-${mini ? 'm' : 'f'}`;

  const strapFill = strapColor;
  const showMesh = braceletMat === 'metal_segmented';
  const showLinks = braceletMat === 'metal_solid';
  const showLeather = braceletMat === 'leather';
  const showNato = braceletMat === 'cotton_fabric';
  const showRubber = braceletMat === 'plastic_solid' || braceletMat === 'resin' || braceletMat === 'plastic_segmented';

  const strapW = showNato ? 28 : showRubber ? 26 : 24;
  const strapX = cx - strapW / 2;

  const textLines = watchfaceText.split('\n').slice(0, 4);

  const gradId = `bg-grad-${mini ? 'm' : 'f'}`;

  // Circular text path: arc starting at 8 o'clock (lower-left) going clockwise
  // so text is centered at 12 o'clock (top of dial)
  const circR = faceR - 10;
  // Start arc at -150° (i.e., 210° CCW from 3 o'clock = 8 o'clock position)
  // Text centered at top (12 o'clock = 0% of this arc)
  const circStartX = cx + circR * Math.cos((-150 * Math.PI) / 180);
  const circStartY = cy + circR * Math.sin((-150 * Math.PI) / 180);
  const circEndX = cx + circR * Math.cos((-30 * Math.PI) / 180);
  const circEndY = cy + circR * Math.sin((-30 * Math.PI) / 180);
  // 300° arc (5/6 of circle) so startOffset="50%" centers text at 12 o'clock
  const circTextPath = `M ${circStartX.toFixed(2)},${circStartY.toFixed(2)} A ${circR},${circR} 0 1,1 ${circEndX.toFixed(2)},${circEndY.toFixed(2)}`;

  const renderWatchfaceText = () => {
    if (!watchfaceText || textLines.length === 0) return null;

    if (watchfaceTextMode === 'circular') {
      // Render first line of text circularly around the face
      const circText = watchfaceText.replace(/\n/g, ' · ').toUpperCase();
      const fontSize = mini ? 4 : 5;
      return (
        <>
          <defs>
            <path id={circTextPathId} d={circTextPath} fill="none" />
          </defs>
          <text fontSize={fontSize} fontFamily="system-ui, sans-serif" fontWeight="700" fill={handsColor} opacity="0.85" letterSpacing="0.12em">
            <textPath href={`#${circTextPathId}`} startOffset="50%" textAnchor="middle">
              {circText}
            </textPath>
          </text>
        </>
      );
    }

    // Center mode
    const lineH = Math.min(10, 34 / textLines.length);
    const totalH = lineH * textLines.length;
    const startY = cy - totalH / 2 + lineH * 0.8;
    const fontSize = Math.max(4, Math.min(10, (faceR * 1.5) / Math.max(...textLines.map(l => l.length || 1))));
    return (
      <>
        {textLines.map((line, i) => (
          <text
            key={i}
            x={cx}
            y={startY + i * lineH}
            textAnchor="middle"
            fill={handsColor}
            fontSize={fontSize}
            fontFamily="system-ui, sans-serif"
            fontWeight="600"
            letterSpacing="0.05em"
            opacity="0.9"
          >
            {line.toUpperCase()}
          </text>
        ))}
      </>
    );
  };

  return (
    <svg
      viewBox="0 0 120 200"
      xmlns="http://www.w3.org/2000/svg"
      className={mini ? 'w-full h-full' : 'w-full h-full max-h-[420px]'}
      style={mini ? {} : { filter: 'drop-shadow(0 2px 24px rgba(0,0,0,0.18))' }}
      onClick={onClick}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={faceColor} />
          <stop offset="100%" stopColor={bgType === 'gradient' ? gradEnd : faceColor} />
        </linearGradient>
        <pattern id={meshPatternId} x="0" y="0" width="4" height="4" patternUnits="userSpaceOnUse">
          <line x1="0" y1="4" x2="4" y2="0" stroke="rgba(255,255,255,0.18)" strokeWidth="0.8" />
          <line x1="-1" y1="1" x2="1" y2="-1" stroke="rgba(255,255,255,0.18)" strokeWidth="0.8" />
          <line x1="3" y1="5" x2="5" y2="3" stroke="rgba(255,255,255,0.18)" strokeWidth="0.8" />
        </pattern>
        <pattern id={linkPatternId} x="0" y="0" width="8" height="8" patternUnits="userSpaceOnUse">
          <line x1="0" y1="7" x2="8" y2="7" stroke="rgba(0,0,0,0.25)" strokeWidth="1" />
        </pattern>
        <clipPath id={clipId}>
          <ClipShape />
        </clipPath>
      </defs>

      {/* Top strap */}
      <rect x={strapX} y="0" width={strapW} height="58" rx={showRubber ? 8 : 5} fill={strapFill} opacity={strapActive ? 1 : 0.85} stroke={strapActive ? '#6366f1' : 'transparent'} strokeWidth="1.5" style={{ cursor: mini ? 'default' : 'pointer' }} onClick={() => !mini && setActivePart(activePart === 'strap' ? null : 'strap')} />
      {showMesh && <rect x={strapX} y="0" width={strapW} height="58" fill={`url(#${meshPatternId})`} pointerEvents="none" rx={showRubber ? 8 : 5} />}
      {showLinks && <rect x={strapX} y="0" width={strapW} height="58" fill={`url(#${linkPatternId})`} pointerEvents="none" />}
      {showLeather && [10, 20, 30, 40, 50].map(y => <line key={y} x1={strapX + 2} y1={y} x2={strapX + strapW - 2} y2={y} stroke="rgba(0,0,0,0.2)" strokeWidth="0.6" pointerEvents="none" />)}
      {showNato && (
        <>
          <line x1={strapX + 4} y1="0" x2={strapX + 4} y2="58" stroke="rgba(255,255,255,0.2)" strokeWidth="1" pointerEvents="none" />
          <line x1={strapX + strapW - 4} y1="0" x2={strapX + strapW - 4} y2="58" stroke="rgba(255,255,255,0.2)" strokeWidth="1" pointerEvents="none" />
        </>
      )}

      {/* Bottom strap */}
      <rect x={strapX} y="142" width={strapW} height="58" rx={showRubber ? 8 : 5} fill={strapFill} opacity={strapActive ? 1 : 0.85} stroke={strapActive ? '#6366f1' : 'transparent'} strokeWidth="1.5" style={{ cursor: mini ? 'default' : 'pointer' }} onClick={() => !mini && setActivePart(activePart === 'strap' ? null : 'strap')} />
      {showMesh && <rect x={strapX} y="142" width={strapW} height="58" fill={`url(#${meshPatternId})`} pointerEvents="none" rx={showRubber ? 8 : 5} />}
      {showLinks && <rect x={strapX} y="142" width={strapW} height="58" fill={`url(#${linkPatternId})`} pointerEvents="none" />}
      {showLeather && [152, 162, 172, 182, 192].map(y => <line key={y} x1={strapX + 2} y1={y} x2={strapX + strapW - 2} y2={y} stroke="rgba(0,0,0,0.2)" strokeWidth="0.6" pointerEvents="none" />)}
      {showNato && (
        <>
          <line x1={strapX + 4} y1="142" x2={strapX + 4} y2="200" stroke="rgba(255,255,255,0.2)" strokeWidth="1" pointerEvents="none" />
          <line x1={strapX + strapW - 4} y1="142" x2={strapX + strapW - 4} y2="200" stroke="rgba(255,255,255,0.2)" strokeWidth="1" pointerEvents="none" />
        </>
      )}

      {/* Case */}
      <FaceShape
        fill={faceColor}
        stroke={faceActive ? '#6366f1' : 'rgba(0,0,0,0.3)'}
        strokeWidth={faceActive ? 3 : 1.5}
        opacity={1}
        style={{ cursor: mini ? 'default' : 'pointer' }}
        onClick={() => !mini && setActivePart(activePart === 'watchFace' ? null : 'watchFace')}
      />

      {/* Face interior */}
      <g clipPath={`url(#${clipId})`} pointerEvents="none">
        <rect x={cx - faceR} y={cy - faceR} width={faceR * 2} height={faceR * 2} fill={`url(#${gradId})`} opacity="0.95" />
        <ellipse cx={cx - 10} cy={cy - 18} rx="18" ry="10" fill="rgba(255,255,255,0.06)" transform={`rotate(-20, ${cx - 10}, ${cy - 18})`} />

        {/* Hour markers — only if no text or circular mode (circular text leaves center free) */}
        {(!watchfaceText || watchfaceTextMode === 'circular') && [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((angle, i) => {
          const rad = (angle - 90) * Math.PI / 180;
          const r = watchfaceTextMode === 'circular' && watchfaceText ? faceR - 5 : faceR - 9;
          const x = cx + r * Math.cos(rad);
          const y2 = cy + r * Math.sin(rad);
          const isQuarter = i % 3 === 0;
          return isQuarter
            ? <rect key={i} x={x - 1} y={y2 - (isQuarter ? 4 : 2)} width="2" height={isQuarter ? 6 : 3} fill={handsColor} opacity="0.8" transform={`rotate(${angle}, ${x}, ${y2})`} />
            : <circle key={i} cx={x} cy={y2} r="1.2" fill={handsColor} opacity="0.5" />;
        })}

        {/* Watchface text */}
        {renderWatchfaceText()}

        {/* Center dot */}
        {handsEnabled && <circle cx={cx} cy={cy} r="2.5" fill={handsColor} opacity="0.9" />}

        {/* Hour hand */}
        {handsEnabled && handsCount >= 2 && (
          <line x1={cx} y1={cy} x2={cx + 18 * Math.cos((210 - 90) * Math.PI / 180)} y2={cy + 18 * Math.sin((210 - 90) * Math.PI / 180)} stroke={handsColor} strokeWidth="3" strokeLinecap="round" />
        )}

        {/* Minute hand */}
        {handsEnabled && handsCount >= 2 && (
          <line x1={cx} y1={cy} x2={cx + 27 * Math.cos((60 - 90) * Math.PI / 180)} y2={cy + 27 * Math.sin((60 - 90) * Math.PI / 180)} stroke={handsColor} strokeWidth="2" strokeLinecap="round" />
        )}

        {/* Second hand */}
        {handsEnabled && handsCount >= 3 && (
          <line x1={cx} y1={cy} x2={cx + 30 * Math.cos((120 - 90) * Math.PI / 180)} y2={cy + 30 * Math.sin((120 - 90) * Math.PI / 180)} stroke="#ef4444" strokeWidth="1" strokeLinecap="round" />
        )}
      </g>

      {/* Crown */}
      <rect x="104" y="93" width="5" height="14" rx="2.5" fill={faceColor} stroke="rgba(0,0,0,0.3)" strokeWidth="0.8" pointerEvents="none" />

      {/* Buckle */}
      {!mini && (
        <>
          <rect x={cx - 9} y="176" width="18" height="7" rx="2" fill="#334155" pointerEvents="none" />
          <line x1={cx} y1="176" x2={cx} y2="183" stroke="#64748b" strokeWidth="1" pointerEvents="none" />
        </>
      )}
    </svg>
  );
}
