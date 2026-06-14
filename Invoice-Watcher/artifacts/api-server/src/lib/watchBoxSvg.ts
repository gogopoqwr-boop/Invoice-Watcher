interface WatchConfig {
  watchfaceColor?: string | null;
  braceletColor?: string | null;
  boxType?: string | null;
}

const BOX_STYLES: Record<string, {
  bodyColor: string; lidColor: string; interiorColor: string;
  cushionColor: string; accentColor: string; rimColor: string; bgGlow: string;
}> = {
  standard: {
    bodyColor:     '#1e293b',
    lidColor:      '#253347',
    interiorColor: '#0f172a',
    cushionColor:  '#162032',
    accentColor:   '#475569',
    rimColor:      '#334155',
    bgGlow:        '#1e3a5f',
  },
  premium: {
    bodyColor:     '#100800',
    lidColor:      '#1c0d00',
    interiorColor: '#2e1030',
    cushionColor:  '#3d1540',
    accentColor:   '#c9970a',
    rimColor:      '#b8860b',
    bgGlow:        '#2a1a00',
  },
  collector: {
    bodyColor:     '#5c3d1e',
    lidColor:      '#7c5228',
    interiorColor: '#1a3050',
    cushionColor:  '#122040',
    accentColor:   '#c9970a',
    rimColor:      '#a07030',
    bgGlow:        '#3d2a10',
  },
};

// All isometric box coordinates are in the original "28 24 58 54" viewBox space.
// We render at 600×500 and apply a group transform to scale & center.
// Original box center ≈ (59, 49). Scale = 7.5. Target center = (290, 270).
// transform: translate(290 - 59*7.5, 270 - 49*7.5) = translate(-152.5, -97.5) — applied after scale inside g.
// Because SVG transforms apply RTL: scale first, then translate in scaled space.

const SCALE = 7.5;
// After scaling, box center (59,49) → (442.5, 367.5). Shift to (290,270):
const TX = 290 - 59 * SCALE;  // -152.5
const TY = 270 - 49 * SCALE;  // -97.5

export function generateWatchBoxSVG(cfg: WatchConfig, width = 600, height = 500): string {
  const boxType = cfg.boxType ?? 'standard';
  const s = BOX_STYLES[boxType] ?? BOX_STYLES.standard;
  const faceCol  = cfg.watchfaceColor ?? '#C0C0C0';
  const strapCol = cfg.braceletColor  ?? '#555555';
  const isPremium = boxType === 'premium' || boxType === 'collector';

  // Brand label on the lid accent plate, only for premium/collector
  const accentPlate = isPremium
    ? `<polygon points="42.5,44.8 56.5,39.4 56.5,35.4 42.5,40.8" fill="${s.accentColor}" opacity="0.9"/>`
    : '';

  // Gift ribbon bow on the lid (simple cross)
  const ribbonColor = '#d63370';
  const ribbon = `
    <!-- ribbon cross on lid -->
    <line x1="47" y1="37.5" x2="51" y2="35" stroke="${ribbonColor}" stroke-width="0.55" opacity="0.9"/>
    <line x1="47" y1="37.5" x2="43" y2="35.5" stroke="${ribbonColor}" stroke-width="0.55" opacity="0.9"/>
    <circle cx="47" cy="37.5" r="0.9" fill="${ribbonColor}" opacity="0.95"/>
  `;

  const svgContent = `
    <defs>
      <linearGradient id="bg-top" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#090e18"/>
        <stop offset="100%" stop-color="#060a12"/>
      </linearGradient>
      <radialGradient id="glow-orb" cx="50%" cy="55%" r="45%">
        <stop offset="0%" stop-color="${s.bgGlow}" stop-opacity="0.55"/>
        <stop offset="100%" stop-color="${s.bgGlow}" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="lid-grad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${s.lidColor}"/>
        <stop offset="100%" stop-color="${s.bodyColor}"/>
      </linearGradient>
      <linearGradient id="front-grad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${s.rimColor}" stop-opacity="0.9"/>
        <stop offset="100%" stop-color="${s.bodyColor}"/>
      </linearGradient>
      <linearGradient id="right-grad" x1="1" y1="0" x2="0" y2="0">
        <stop offset="0%" stop-color="${s.bodyColor}"/>
        <stop offset="100%" stop-color="${s.rimColor}" stop-opacity="0.7"/>
      </linearGradient>
      <filter id="box-shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000000" flood-opacity="0.6"/>
      </filter>
    </defs>

    <!-- Background -->
    <rect width="${width}" height="${height}" fill="url(#bg-top)"/>
    <ellipse cx="${width / 2}" cy="${height * 0.55}" rx="${width * 0.52}" ry="${height * 0.42}" fill="url(#glow-orb)"/>

    <!-- Isometric box group — scaled up and centred -->
    <g transform="translate(${TX.toFixed(1)},${TY.toFixed(1)}) scale(${SCALE})" filter="url(#box-shadow)">

      <!-- ── Open lid (standing upright behind box) ── -->
      <polygon points="36.4,47.8 62.5,62.9 62.5,44.9 36.4,29.8" fill="url(#lid-grad)"/>
      <!-- hinge edge -->
      <line x1="36.4" y1="47.8" x2="62.5" y2="62.9" stroke="${s.rimColor}" stroke-width="0.16" opacity="0.8"/>
      ${accentPlate}
      ${isPremium ? '' : ribbon}
      <!-- lid highlight -->
      <polygon points="36.4,47.8 62.5,62.9 62.5,44.9 36.4,29.8" fill="rgba(255,255,255,0.05)"/>
      <!-- lid top edge -->
      <line x1="36.4" y1="29.8" x2="62.5" y2="44.9" stroke="${s.rimColor}" stroke-width="0.08" opacity="0.5"/>

      <!-- ── Box front face A→B→F→E ── -->
      <polygon points="54,47 80.1,62.1 80.1,52.7 54,37.6" fill="url(#front-grad)"/>

      <!-- ── Box right face B→D→H→F ── -->
      <polygon points="80.1,62.1 62.5,72.3 62.5,62.9 80.1,52.7" fill="url(#right-grad)"/>

      <!-- ── Box top / interior face E→F→H→G ── -->
      <polygon points="54,37.6 80.1,52.7 62.5,62.9 36.4,47.8" fill="${s.interiorColor}"/>

      <!-- Interior cushion -->
      <polygon points="57.5,40.4 77.2,51.5 61.8,60.1 42.2,49.1" fill="${s.cushionColor}" opacity="0.8"/>
      <!-- Cushion highlight -->
      <polygon points="57.5,40.4 77.2,51.5 61.8,60.1 42.2,49.1" fill="rgba(255,255,255,0.04)"/>

      <!-- ── Watch silhouette inside box (isometric oval) ── -->
      <!-- bottom strap segment -->
      <line x1="54.2" y1="52.4" x2="50.2" y2="55.0" stroke="${strapCol}" stroke-width="0.47" stroke-linecap="round" opacity="0.8"/>
      <!-- top strap segment -->
      <line x1="65.2" y1="48.8" x2="69.2" y2="46.2" stroke="${strapCol}" stroke-width="0.47" stroke-linecap="round" opacity="0.8"/>
      <!-- case shadow -->
      <ellipse cx="59.7" cy="51.3" rx="10.3" ry="6.1" fill="rgba(0,0,0,0.35)"/>
      <!-- watch case / face -->
      <ellipse cx="59.7" cy="50.5" rx="10" ry="5.8" fill="${faceCol}" opacity="0.93"/>
      <!-- face inner glow -->
      <ellipse cx="57.8" cy="49.0" rx="3.5" ry="2.0" fill="rgba(255,255,255,0.28)"/>
      <!-- face hands hint -->
      <line x1="59.7" y1="50.5" x2="59.7" y2="46.8" stroke="rgba(255,255,255,0.55)" stroke-width="0.28" stroke-linecap="round"/>
      <line x1="59.7" y1="50.5" x2="62.6" y2="51.8" stroke="rgba(255,255,255,0.55)" stroke-width="0.28" stroke-linecap="round"/>
      <!-- center dot -->
      <circle cx="59.7" cy="50.5" r="0.55" fill="rgba(255,255,255,0.8)"/>

      <!-- ── Edge highlights ── -->
      <line x1="54" y1="37.6" x2="80.1" y2="52.7" stroke="${s.rimColor}" stroke-width="0.12" opacity="0.7"/>
      <line x1="54" y1="37.6" x2="36.4" y2="47.8" stroke="${s.rimColor}" stroke-width="0.09" opacity="0.5"/>
      <line x1="80.1" y1="62.1" x2="80.1" y2="52.7" stroke="${s.rimColor}" stroke-width="0.07" opacity="0.4"/>
      <line x1="54"   y1="47"   x2="54"   y2="37.6" stroke="${s.rimColor}" stroke-width="0.07" opacity="0.35"/>
      <line x1="80.1" y1="62.1" x2="62.5" y2="72.3" stroke="${s.rimColor}" stroke-width="0.05" opacity="0.3"/>
    </g>

    <!-- Brand label -->
    <text x="${width / 2}" y="${height - 22}" text-anchor="middle"
      font-size="13" font-family="system-ui, -apple-system, sans-serif"
      font-weight="900" fill="rgba(255,255,255,0.18)" letter-spacing="6">ЧЕБЛЯЧАС</text>
  `;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${svgContent}</svg>`;
}
