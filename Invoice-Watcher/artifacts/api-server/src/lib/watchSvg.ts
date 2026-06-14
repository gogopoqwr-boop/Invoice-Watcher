interface WatchConfig {
  watchfaceGeometry?: string | null;
  watchfaceColor?: string | null;
  braceletColor?: string | null;
  braceletMaterial?: string | null;
  braceletType?: string | null;
  handsEnabled?: boolean | null;
  handsColor?: string | null;
  watchfaceText?: string | null;
  watchfaceTextMode?: string | null;
  watchfaceBackgroundType?: string | null;
  watchfaceGradientEnd?: string | null;
  name?: string | null;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function generateWatchSVG(cfg: WatchConfig, size = 400): string {
  const geo = cfg.watchfaceGeometry ?? 'rounded';
  const faceColor = cfg.watchfaceColor ?? '#1e293b';
  const strapColor = cfg.braceletColor ?? '#0f172a';
  const handsColor = cfg.handsColor ?? '#cbd5e1';
  const handsEnabled = cfg.handsEnabled !== false;
  const watchfaceText = cfg.watchfaceText ?? '';
  const watchfaceTextMode = cfg.watchfaceTextMode ?? 'center';
  const bgType = cfg.watchfaceBackgroundType ?? 'solid';
  const gradEnd = cfg.watchfaceGradientEnd ?? '#0f172a';
  const braceletMat = cfg.braceletMaterial ?? 'metal_solid';

  const cx = 200, cy = 280, faceR = 130;
  const viewW = 400, viewH = 560;
  const scale = size / viewW;

  const showMesh = braceletMat === 'metal_segmented';
  const showLinks = braceletMat === 'metal_solid';
  const showLeather = braceletMat === 'leather';
  const showNato = braceletMat === 'cotton_fabric';
  const showRubber = braceletMat === 'plastic_solid' || braceletMat === 'resin';
  const strapW = showNato ? 84 : showRubber ? 78 : 72;
  const strapX = cx - strapW / 2;

  function faceShape(fill: string, stroke: string, strokeWidth: number): string {
    if (geo === 'circle') {
      return `<circle cx="${cx}" cy="${cy}" r="${faceR}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;
    } else if (geo === 'square') {
      return `<rect x="${cx - faceR}" y="${cy - faceR}" width="${faceR * 2}" height="${faceR * 2}" rx="18" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;
    } else if (geo === 'drawn') {
      return `<rect x="${cx - faceR}" y="${cy - faceR}" width="${faceR * 2}" height="${faceR * 2}" rx="66" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;
    } else {
      return `<rect x="${cx - faceR}" y="${cy - faceR * 0.85}" width="${faceR * 2}" height="${faceR * 1.7}" rx="90" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;
    }
  }

  function clipShape(id: string): string {
    if (geo === 'circle') return `<clipPath id="${id}"><circle cx="${cx}" cy="${cy}" r="${faceR - 4}"/></clipPath>`;
    if (geo === 'square') return `<clipPath id="${id}"><rect x="${cx - faceR + 4}" y="${cy - faceR + 4}" width="${(faceR - 4) * 2}" height="${(faceR - 4) * 2}" rx="15"/></clipPath>`;
    if (geo === 'drawn') return `<clipPath id="${id}"><rect x="${cx - faceR + 4}" y="${cy - faceR + 4}" width="${(faceR - 4) * 2}" height="${(faceR - 4) * 2}" rx="60"/></clipPath>`;
    return `<clipPath id="${id}"><rect x="${cx - faceR + 4}" y="${cy - faceR * 0.85 + 4}" width="${(faceR - 4) * 2}" height="${faceR * 1.7 - 8}" rx="84"/></clipPath>`;
  }

  const markers = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((angle, i) => {
    const rad = (angle - 90) * Math.PI / 180;
    const r = faceR - 20;
    const x = cx + r * Math.cos(rad);
    const y = cy + r * Math.sin(rad);
    const isQ = i % 3 === 0;
    if (isQ) {
      return `<rect x="${x - 3}" y="${y - 9}" width="6" height="${isQ ? 16 : 8}" fill="${handsColor}" opacity="0.8" transform="rotate(${angle}, ${x}, ${y})"/>`;
    }
    return `<circle cx="${x}" cy="${y}" r="3.5" fill="${handsColor}" opacity="0.5"/>`;
  }).join('');

  let watchfaceTextSVG = '';
  if (watchfaceText && !watchfaceText.startsWith('EYE:')) {
    const lines = watchfaceText.split('\n').slice(0, 4);
    if (watchfaceTextMode === 'circular') {
      const circR = faceR - 18;
      const circStartX = cx + circR * Math.cos((-150 * Math.PI) / 180);
      const circStartY = cy + circR * Math.sin((-150 * Math.PI) / 180);
      const circEndX = cx + circR * Math.cos((-30 * Math.PI) / 180);
      const circEndY = cy + circR * Math.sin((-30 * Math.PI) / 180);
      const d = `M ${circStartX.toFixed(1)},${circStartY.toFixed(1)} A ${circR},${circR} 0 1,1 ${circEndX.toFixed(1)},${circEndY.toFixed(1)}`;
      watchfaceTextSVG = `<defs><path id="ctp" d="${d}" fill="none"/></defs><text font-size="13" font-family="system-ui,sans-serif" font-weight="700" fill="${handsColor}" opacity="0.85" letter-spacing="3.5"><textPath href="#ctp" startOffset="50%" text-anchor="middle">${esc(watchfaceText.replace(/\n/g, ' · ').toUpperCase())}</textPath></text>`;
    } else {
      const lineH = Math.min(30, 100 / lines.length);
      const totalH = lineH * lines.length;
      const startY = cy - totalH / 2 + lineH * 0.8;
      const maxLen = Math.max(...lines.map(l => l.length || 1));
      const fontSize = Math.max(12, Math.min(30, (faceR * 1.5) / maxLen));
      watchfaceTextSVG = lines.map((line, i) =>
        `<text x="${cx}" y="${(startY + i * lineH).toFixed(1)}" text-anchor="middle" fill="${handsColor}" font-size="${fontSize.toFixed(1)}" font-family="system-ui,sans-serif" font-weight="600" letter-spacing="1.5" opacity="0.9">${esc(line.toUpperCase())}</text>`
      ).join('');
    }
  }

  const hourHandAngle = 210;
  const minHandAngle = 60;
  const secHandAngle = 120;

  let leatherLines = '';
  if (showLeather) {
    leatherLines = [28, 56, 84, 112, 140, 392, 420, 448, 476, 504].map(y =>
      `<line x1="${strapX + 6}" y1="${y}" x2="${strapX + strapW - 6}" y2="${y}" stroke="rgba(0,0,0,0.18)" stroke-width="1.8"/>`
    ).join('');
  }

  let natoLines = '';
  if (showNato) {
    natoLines = `
      <line x1="${strapX + 12}" y1="0" x2="${strapX + 12}" y2="162" stroke="rgba(255,255,255,0.2)" stroke-width="3"/>
      <line x1="${strapX + strapW - 12}" y1="0" x2="${strapX + strapW - 12}" y2="162" stroke="rgba(255,255,255,0.2)" stroke-width="3"/>
      <line x1="${strapX + 12}" y1="396" x2="${strapX + 12}" y2="560" stroke="rgba(255,255,255,0.2)" stroke-width="3"/>
      <line x1="${strapX + strapW - 12}" y1="396" x2="${strapX + strapW - 12}" y2="560" stroke="rgba(255,255,255,0.2)" stroke-width="3"/>
    `;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewW} ${viewH}" width="${size}" height="${Math.round(viewH * scale)}">
  <defs>
    <linearGradient id="faceGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${faceColor}"/>
      <stop offset="100%" stop-color="${bgType === 'gradient' ? gradEnd : faceColor}"/>
    </linearGradient>
    <linearGradient id="bgGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0d0d18"/>
      <stop offset="100%" stop-color="#08080f"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${faceColor}" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="transparent" stop-opacity="0"/>
    </radialGradient>
    ${clipShape('faceClip')}
    ${showMesh ? `<pattern id="mesh" x="0" y="0" width="12" height="12" patternUnits="userSpaceOnUse">
      <line x1="0" y1="12" x2="12" y2="0" stroke="rgba(255,255,255,0.18)" stroke-width="2.4"/>
    </pattern>` : ''}
    ${showLinks ? `<pattern id="links" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
      <line x1="0" y1="21" x2="24" y2="21" stroke="rgba(0,0,0,0.25)" stroke-width="3"/>
    </pattern>` : ''}
  </defs>

  <!-- Background -->
  <rect width="${viewW}" height="${viewH}" fill="url(#bgGrad)"/>

  <!-- Glow behind watch -->
  <ellipse cx="${cx}" cy="${cy}" rx="200" ry="200" fill="url(#glow)" opacity="0.6"/>

  <!-- Top strap -->
  <rect x="${strapX}" y="0" width="${strapW}" height="162" rx="${showRubber ? 24 : 15}" fill="${strapColor}" opacity="0.9"/>
  ${showMesh ? `<rect x="${strapX}" y="0" width="${strapW}" height="162" rx="${showRubber ? 24 : 15}" fill="url(#mesh)"/>` : ''}
  ${showLinks ? `<rect x="${strapX}" y="0" width="${strapW}" height="162" fill="url(#links)"/>` : ''}
  ${leatherLines}
  ${natoLines}

  <!-- Bottom strap -->
  <rect x="${strapX}" y="396" width="${strapW}" height="164" rx="${showRubber ? 24 : 15}" fill="${strapColor}" opacity="0.9"/>
  ${showMesh ? `<rect x="${strapX}" y="396" width="${strapW}" height="164" rx="${showRubber ? 24 : 15}" fill="url(#mesh)"/>` : ''}
  ${showLinks ? `<rect x="${strapX}" y="396" width="${strapW}" height="164" fill="url(#links)"/>` : ''}

  <!-- Case shadow -->
  ${faceShape('rgba(0,0,0,0.45)', 'none', 0).replace('fill="rgba(0,0,0,0.45)"', 'fill="rgba(0,0,0,0.45)" transform="translate(0,8)"')}

  <!-- Case outer -->
  ${faceShape(faceColor, 'rgba(255,255,255,0.12)', 3)}

  <!-- Face interior -->
  <g clip-path="url(#faceClip)">
    <rect x="${cx - faceR}" y="${cy - faceR}" width="${faceR * 2}" height="${faceR * 2}" fill="url(#faceGrad)" opacity="0.96"/>
    <ellipse cx="${cx - 30}" cy="${cy - 55}" rx="54" ry="30" fill="rgba(255,255,255,0.06)" transform="rotate(-20, ${cx - 30}, ${cy - 55})"/>

    <!-- Hour markers -->
    ${(!watchfaceText || watchfaceTextMode === 'circular') ? markers : ''}

    <!-- Watchface text -->
    ${watchfaceTextSVG}

    <!-- Center dot -->
    ${handsEnabled ? `<circle cx="${cx}" cy="${cy}" r="7.5" fill="${handsColor}" opacity="0.9"/>` : ''}

    <!-- Hour hand -->
    ${handsEnabled ? `<g transform="rotate(${hourHandAngle}, ${cx}, ${cy})">
      <rect x="${cx - 4}" y="${cy - 54}" width="8.4" height="66" rx="3" fill="${handsColor}" opacity="0.95"/>
      <rect x="${cx - 7}" y="${cy}" width="14" height="15" rx="3" fill="${handsColor}" opacity="0.85"/>
    </g>` : ''}

    <!-- Minute hand -->
    ${handsEnabled ? `<g transform="rotate(${minHandAngle}, ${cx}, ${cy})">
      <rect x="${cx - 2.7}" y="${cy - 81}" width="5.4" height="99" rx="2.7" fill="${handsColor}" opacity="0.95"/>
      <rect x="${cx - 5.4}" y="${cy}" width="10.8" height="18" rx="2.7" fill="${handsColor}" opacity="0.85"/>
    </g>` : ''}

    <!-- Second hand -->
    ${handsEnabled ? `<g transform="rotate(${secHandAngle}, ${cx}, ${cy})">
      <rect x="${cx - 1.2}" y="${cy - 90}" width="2.4" height="108" rx="1.2" fill="#ef4444" opacity="0.95"/>
      <circle cx="${cx}" cy="${cy - 90 + 9}" r="6.6" fill="#ef4444"/>
      <rect x="${cx - 3.6}" y="${cy + 6}" width="7.2" height="24" rx="3" fill="#ef4444" opacity="0.8"/>
    </g>` : ''}
  </g>

  <!-- Crown -->
  <rect x="${cx + faceR + 3}" y="${cy - 21}" width="15" height="42" rx="7.5" fill="${faceColor}" stroke="rgba(255,255,255,0.15)" stroke-width="1.5"/>

  <!-- Buckle -->
  <rect x="${cx - 27}" y="492" width="54" height="21" rx="6" fill="#334155"/>
  <line x1="${cx}" y1="492" x2="${cx}" y2="513" stroke="#64748b" stroke-width="3"/>

  <!-- Brand text -->
  <text x="${cx}" y="${cy + faceR + 36}" text-anchor="middle" font-size="18" font-family="system-ui,sans-serif" font-weight="900" fill="rgba(255,255,255,0.22)" letter-spacing="6">ЧЕБЛЯЧАС</text>
</svg>`;

  return svg;
}
