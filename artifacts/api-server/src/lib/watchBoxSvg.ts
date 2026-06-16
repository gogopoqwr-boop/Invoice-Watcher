interface WatchConfig {
  watchfaceColor?: string | null;
  watchfaceGeometry?: string | null;
  braceletColor?: string | null;
  braceletMaterial?: string | null;
  boxType?: string | null;
  giftWrap?: boolean | null;
  handsEnabled?: boolean | null;
  watchfaceText?: string | null;
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

// Isometric coordinate system (original viewBox 28 24 58 54, SCALE=7.5)
// Box corners (top face, interior visible):
//   E(54,37.6)  F(80.1,52.7)  G(62.5,62.9)  H(36.4,47.8)
// Per box-unit screen offsets (derived from W=4.3 spanning E→F):
//   +1 along box-X (across/width):    (+6.07, +3.51)
//   +1 along box-Y (depth/back→front):(-6.07, +3.52)
//   +1 along box-Z (height, upward):  (0,     -6.96) approx

const SCALE = 7.5;
const TX = 290 - 59 * SCALE;   // -152.5 — centres the box at x=290
const TY = 270 - 49 * SCALE;   // -97.5  — centres at y=270

// Watch centre inside the box (in original coord space)
const WX = 59.7;
const WY = 50.5;

// Isometric axis unit vectors (screen units per 1 box unit)
const AX = 6.07,  AY = 3.51;   // box-X axis (left→right across box)
const BX = -6.07, BY = 3.52;   // box-Y axis (back→front depth)

function isoXY(boxX: number, boxY: number): [number, number] {
  return [WX + boxX * AX + boxY * BX, WY + boxX * AY + boxY * BY];
}

// ── Watch face shape ────────────────────────────────────────────────────────
// Returns SVG <path> data for the watch top face projected isometrically.
// size = half-dimension in box units.
function faceOutlinePath(geom: string, size: number): string {
  if (geom === 'circle') {
    // Ellipse: use parametric approximation via 4-bezier segments
    const [cx, cy] = isoXY(0, 0);
    const rx = size * Math.sqrt(AX * AX + AY * AY);   // ~7.13 per box-unit
    const ry = size * Math.sqrt(BX * BX + BY * BY);   // ~7.14 — nearly same!
    // The two axes happen to be equal length in screen; the "ellipse" looks like
    // an axis-aligned ellipse rotated ~30°. For simplicity use SVG ellipse element
    // rotated to match isometric angle.
    // Major axis direction: angle of AX,AY = atan2(3.51,6.07) ≈ 30°
    return `ellipse:${cx},${cy},${rx * size},${ry * size * 0.58}`;
  } else {
    // Square/rounded — isometric diamond (rhombus)
    const d = size;
    const [top]   = [isoXY(-d, -d)];
    const [right] = [isoXY( d, -d)];
    const [bot]   = [isoXY( d,  d)];
    const [left]  = [isoXY(-d,  d)];
    return `polygon:${top[0]},${top[1]} ${right[0]},${right[1]} ${bot[0]},${bot[1]} ${left[0]},${left[1]}`;
  }
}

function darken(hex: string, factor = 0.6): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.floor(((n >> 16) & 255) * factor);
  const g = Math.floor(((n >> 8)  & 255) * factor);
  const b = Math.floor(((n >> 0)  & 255) * factor);
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}

export function generateWatchBoxSVG(cfg: WatchConfig, width = 600, height = 500, lidOpenFraction = 1.0): string {
  const boxType  = cfg.boxType ?? 'standard';
  const s        = BOX_STYLES[boxType] ?? BOX_STYLES.standard;
  const faceCol  = cfg.watchfaceColor  ?? '#1e293b';
  const strapCol = cfg.braceletColor   ?? '#888888';
  const geom     = cfg.watchfaceGeometry ?? 'circle';
  const handsOn  = cfg.handsEnabled !== false;
  const text     = cfg.watchfaceText?.trim() ?? '';
  const isPremCollect = boxType === 'premium' || boxType === 'collector';
  const hasGift  = cfg.giftWrap === true;

  // ── Case rim colour (darker face colour)
  const rimDark = darken(faceCol, 0.55);

  // ── Watch face shape params ──────────────────────────────────────────────
  // The watch sits flat (face-up) in the box. In isometric projection,
  // a circular face appears as an ellipse; a square face as a rhombus.
  // We work in the original viewBox coord space and apply SCALE later.
  const R  = 1.18;   // watch case radius in box units
  const SQ = R;      // square half-side

  // Ellipse semi-axes in screen coords (original space)
  // Along AX,AY direction: magnitude per box unit = sqrt(6.07²+3.51²) ≈ 7.01
  // Along BX,BY direction: magnitude per box unit = sqrt(6.07²+3.52²) ≈ 7.02
  // For isometric top ellipse, major axis = 7.01*R at 30°, minor = 7.01*R*sin30°/... 
  // In practice the projected ellipse has rx≈R*7.01*cos30°≈R*6.07 and ry≈R*7.01*sin30°≈R*3.51
  const ERX = R * 7.01;          // 8.27  — major screen radius (in original space)
  const ERY = R * 7.01 * 0.573;  // 4.74  — minor screen radius (foreshortening)
  // Rotation angle (major axis at 30° from horizontal)
  const EROT = 30;

  // ── Helper: points for the rhombus (square geom)
  const sqPoints = [
    isoXY(-SQ, -SQ), isoXY( SQ, -SQ),
    isoXY( SQ,  SQ), isoXY(-SQ,  SQ),
  ];
  const sqPts = sqPoints.map(p => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ');

  // ── Straps: parallelogram bands along the ±Y (depth) axis ──────────────
  // Strap width: 0.45 box-X units, start at case edge, end at box wall
  const swHalf = 0.42; // strap half-width in box-X direction

  // Upper strap (going toward back of box, -Y direction) — visible above "12"
  const us0L = isoXY(-swHalf, -R);    const us0R = isoXY( swHalf, -R);
  const us1L = isoXY(-swHalf, -1.38); const us1R = isoXY( swHalf, -1.38);
  const upperStrap = `M${us0L[0].toFixed(1)},${us0L[1].toFixed(1)} L${us0R[0].toFixed(1)},${us0R[1].toFixed(1)} L${us1R[0].toFixed(1)},${us1R[1].toFixed(1)} L${us1L[0].toFixed(1)},${us1L[1].toFixed(1)} Z`;

  // Lower strap (going toward front of box, +Y direction) — visible below "6"
  const ls0L = isoXY( swHalf,  R);    const ls0R = isoXY(-swHalf,  R);
  const ls1L = isoXY( swHalf,  1.38); const ls1R = isoXY(-swHalf,  1.38);
  const lowerStrap = `M${ls0L[0].toFixed(1)},${ls0L[1].toFixed(1)} L${ls0R[0].toFixed(1)},${ls0R[1].toFixed(1)} L${ls1R[0].toFixed(1)},${ls1R[1].toFixed(1)} L${ls1L[0].toFixed(1)},${ls1L[1].toFixed(1)} Z`;

  // ── Metal-link segmented strap accent lines (for metal/segmented)
  const isMetal = (cfg.braceletMaterial ?? '').includes('metal');
  const segLines: string[] = [];
  if (isMetal) {
    for (const ySeg of [-R-0.18, -R-0.36, -R-0.54, -R-0.72, R+0.18, R+0.36, R+0.54, R+0.72]) {
      if (Math.abs(ySeg) < 1.4) {
        const l = isoXY(-swHalf, ySeg);
        const r = isoXY( swHalf, ySeg);
        segLines.push(`<line x1="${l[0].toFixed(1)}" y1="${l[1].toFixed(1)}" x2="${r[0].toFixed(1)}" y2="${r[1].toFixed(1)}" stroke="${darken(strapCol,0.7)}" stroke-width="0.14" opacity="0.7"/>`);
      }
    }
  }

  // ── Case rim: lower half of top ellipse + band of height ~1.6px ──────────
  // We draw a path: left point of ellipse → lower arc → right point → lower band
  const caseH = 1.6; // case thickness in screen pixels (original space)

  // ── Hour-tick marks (12 short lines around the ellipse, projected) ────────
  const tickSvg: string[] = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    // Isometric ellipse: parametric = (cos(a)*AX + sin(a)*BX, cos(a)*AY + sin(a)*BY)
    const ex = Math.cos(a) * AX + Math.sin(a) * BX;
    const ey = Math.cos(a) * AY + Math.sin(a) * BY;
    const len = Math.sqrt(ex * ex + ey * ey);
    const ux = ex / len, uy = ey / len;
    const outerR = R * len;
    const inner  = outerR - 0.65, outer = outerR;
    tickSvg.push(
      `<line x1="${(WX + ux * inner).toFixed(2)}" y1="${(WY + uy * inner).toFixed(2)}" x2="${(WX + ux * outer).toFixed(2)}" y2="${(WY + uy * outer).toFixed(2)}" stroke="rgba(255,255,255,0.30)" stroke-width="${i % 3 === 0 ? '0.28' : '0.18'}"/>`
    );
  }

  // ── Hands (hour & minute, in isometric projection) ───────────────────────
  // 10:09 look — minute toward "10" (315° clock = -45° from 12), hour toward "2" (60°)
  function handEnd(clockDeg: number, length: number): [number, number] {
    const rad = (clockDeg - 90) * Math.PI / 180;
    // In isometric floor, clockwise rotation: "12" = -BX,-BY direction, "3" = AX,AY direction
    // Interpolate: angle 0=12=(-BX,-BY), angle 90=3=(AX,AY)
    const a = clockDeg * Math.PI / 180;
    const ex = Math.sin(a) * AX - Math.cos(a) * BX;
    const ey = Math.sin(a) * AY - Math.cos(a) * BY;
    const len = Math.sqrt(ex * ex + ey * ey);
    return [WX + (ex / len) * length, WY + (ey / len) * length];
  }

  const [hx, hy] = handEnd(60,  3.9);  // hour at ~2 o'clock
  const [mx, my] = handEnd(300, 5.5);  // minute at ~10 o'clock
  const [sx, sy] = handEnd(200, 5.0);  // second at ~7 o'clock

  const handsSvg = handsOn ? `
    <!-- minute hand -->
    <line x1="${WX.toFixed(2)}" y1="${WY.toFixed(2)}" x2="${mx.toFixed(2)}" y2="${my.toFixed(2)}" stroke="rgba(255,255,255,0.92)" stroke-width="0.26" stroke-linecap="round"/>
    <!-- hour hand -->
    <line x1="${WX.toFixed(2)}" y1="${WY.toFixed(2)}" x2="${hx.toFixed(2)}" y2="${hy.toFixed(2)}" stroke="rgba(255,255,255,0.92)" stroke-width="0.36" stroke-linecap="round"/>
    <!-- second hand -->
    <line x1="${WX.toFixed(2)}" y1="${WY.toFixed(2)}" x2="${sx.toFixed(2)}" y2="${sy.toFixed(2)}" stroke="#ef4444" stroke-width="0.14" stroke-linecap="round"/>
    <!-- center dot -->
    <circle cx="${WX.toFixed(2)}" cy="${WY.toFixed(2)}" r="0.45" fill="rgba(255,255,255,0.9)"/>
  ` : `<!-- center dot (no hands) --><circle cx="${WX.toFixed(2)}" cy="${WY.toFixed(2)}" r="0.55" fill="rgba(255,255,255,0.55)"/>`;

  // ── Watch text on face (isometric transform) ─────────────────────────────
  // We apply an isometric shear matrix so text lies on the watch face plane.
  // Matrix for isometric top-face text: x-axis along AX,AY; y-axis along BX,BY (inverted for SVG coords).
  // Normalised: x_hat = (AX,AY)/|AX,AY|, y_hat = (-BY,-BX)/|BX,BY| (perpendicular, pointing "inward")
  // SVG matrix(a,b,c,d,e,f): x' = a*x + c*y + e, y' = b*x + d*y + f
  const textScale = 1.3; // font size in original coords
  const alen = Math.sqrt(AX * AX + AY * AY);
  const a11 = AX / alen, a21 = AY / alen;
  // y-direction (pointing from "bottom" to "top" of face = -BY, -BX normalised)
  const blen = Math.sqrt(BX * BX + BY * BY);
  const a12 = -BY / blen, a22 = -BX / blen;
  // Scale both axes to textScale
  const matA = (a11 * textScale).toFixed(4);
  const matB = (a21 * textScale).toFixed(4);
  const matC = (a12 * textScale * 0.58).toFixed(4);
  const matD = (a22 * textScale * 0.58).toFixed(4);
  const matE = WX.toFixed(2);
  const matF = (WY + 1.2).toFixed(2);

  const displayText = text ? text.toUpperCase().slice(0, 14) : '';
  const textSvg = displayText ? `
    <text transform="matrix(${matA},${matB},${matC},${matD},${matE},${matF})"
      text-anchor="middle" dominant-baseline="middle"
      font-size="0.92" font-family="system-ui,-apple-system,sans-serif"
      font-weight="700" letter-spacing="0.05"
      fill="rgba(255,255,255,0.65)">${displayText}</text>
  ` : '';

  // ── Parameterised lid geometry ────────────────────────────────────────────
  // Hinge edge: H(36.4,47.8) – G(62.5,62.9)  (stays fixed)
  // Far edge when closed: E(54,37.6) – F(80.1,52.7) (covers the top face)
  // Far edge when fully open: (36.4,29.8) – (62.5,44.9)
  // Delta from closed → open: (-17.6, -7.8) per unit of lidOpenFraction
  const f = Math.max(0, Math.min(1, lidOpenFraction));
  const lidEtx = (54   - 17.6 * f).toFixed(2);
  const lidEty = (37.6 -  7.8 * f).toFixed(2);
  const lidFtx = (80.1 - 17.6 * f).toFixed(2);
  const lidFty = (52.7 -  7.8 * f).toFixed(2);
  const lidPts = `36.4,47.8 62.5,62.9 ${lidFtx},${lidFty} ${lidEtx},${lidEty}`;
  // Opacity of the "closed-lid cover" drawn on top of the watch (fades out as lid opens)
  const lidCoverOpacity = Math.max(0, 1 - f * 3).toFixed(3);

  const accentPlate = isPremCollect && f > 0.5
    ? `<polygon points="42.5,44.8 56.5,39.4 56.5,35.4 42.5,40.8" fill="${s.accentColor}" opacity="${(f * 2 - 1).toFixed(2)}"/>`
    : '';

  // ── Compose face element (circle vs rhombus) ─────────────────────────────
  const faceEl = geom === 'circle'
    ? `<ellipse cx="${WX}" cy="${WY}" rx="${ERX.toFixed(2)}" ry="${ERY.toFixed(2)}" transform="rotate(${EROT},${WX},${WY})" fill="${faceCol}" opacity="0.97"/>`
    : `<polygon points="${sqPts}" fill="${faceCol}" opacity="0.97"/>`;

  const faceGrad = geom === 'circle'
    ? `<ellipse cx="${WX}" cy="${WY}" rx="${ERX.toFixed(2)}" ry="${ERY.toFixed(2)}" transform="rotate(${EROT},${WX},${WY})" fill="url(#face-vignette)"/>`
    : `<polygon points="${sqPts}" fill="url(#face-vignette)"/>`;

  const crystalEl = geom === 'circle'
    ? `<ellipse cx="${(WX-1.2).toFixed(2)}" cy="${(WY-1.0).toFixed(2)}" rx="${(ERX*0.52).toFixed(2)}" ry="${(ERY*0.52).toFixed(2)}" transform="rotate(${EROT},${(WX-1.2).toFixed(2)},${(WY-1.0).toFixed(2)})" fill="rgba(255,255,255,0.14)"/>`
    : `<polygon points="${sqPoints.map(([px,py]) => `${(px*0.52+WX*0.48).toFixed(2)},${(py*0.52+WY*0.48).toFixed(2)}`).join(' ')}" fill="rgba(255,255,255,0.10)"/>`;

  // ── Case shadow behind the case ──────────────────────────────────────────
  const shadowEl = geom === 'circle'
    ? `<ellipse cx="${(WX+0.4).toFixed(2)}" cy="${(WY+1.8).toFixed(2)}" rx="${(ERX+0.6).toFixed(2)}" ry="${(ERY+0.35).toFixed(2)}" transform="rotate(${EROT},${(WX+0.4).toFixed(2)},${(WY+1.8).toFixed(2)})" fill="rgba(0,0,0,0.55)"/>`
    : `<polygon points="${sqPoints.map(([px,py]) => `${(px+0.4).toFixed(2)},${(py+1.8).toFixed(2)}`).join(' ')}" fill="rgba(0,0,0,0.5)"/>`;

  // ── Case rim band (lower half of case visible in isometric) ───────────────
  // Approximate the rim by drawing a lower-arc path connecting face bottom to case bottom
  const rimEl = geom === 'circle' ? `
    <path d="M${(WX-ERX*0.96).toFixed(2)},${(WY+ERY*0.3).toFixed(2)}
             A${ERX.toFixed(2)},${ERY.toFixed(2)} ${EROT} 0 0 ${(WX+ERX*0.96).toFixed(2)},${(WY+ERY*0.3).toFixed(2)}
             L${(WX+ERX*0.96).toFixed(2)},${(WY+ERY*0.3+caseH).toFixed(2)}
             A${ERX.toFixed(2)},${ERY.toFixed(2)} ${EROT} 0 1 ${(WX-ERX*0.96).toFixed(2)},${(WY+ERY*0.3+caseH).toFixed(2)}
             Z"
      fill="${rimDark}"/>
  ` : `
    <polygon points="${sqPoints.map(([px,py]) => `${px.toFixed(2)},${(py+caseH).toFixed(2)}`).join(' ')}" fill="${rimDark}"/>
  `;

  // ── Bezel ring ────────────────────────────────────────────────────────────
  const bezelEl = geom === 'circle'
    ? `<ellipse cx="${WX}" cy="${WY}" rx="${(ERX+0.35).toFixed(2)}" ry="${(ERY+0.2).toFixed(2)}" transform="rotate(${EROT},${WX},${WY})" fill="none" stroke="${rimDark}" stroke-width="0.5" opacity="0.8"/>`
    : `<polygon points="${sqPoints.map(([px,py]) => `${(px+0.3).toFixed(2)},${(py+0.17).toFixed(2)}`).join(' ')}" fill="none" stroke="${rimDark}" stroke-width="0.5" opacity="0.8"/>`;

  // ── Full SVG ─────────────────────────────────────────────────────────────
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <defs>
    <linearGradient id="bg-top" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#090e18"/>
      <stop offset="100%" stop-color="#060a12"/>
    </linearGradient>
    <radialGradient id="glow-orb" cx="50%" cy="55%" r="45%">
      <stop offset="0%" stop-color="${s.bgGlow}" stop-opacity="0.6"/>
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
    <radialGradient id="face-vignette" cx="35%" cy="30%" r="65%">
      <stop offset="0%" stop-color="rgba(255,255,255,0.18)"/>
      <stop offset="60%" stop-color="rgba(0,0,0,0)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0.30)"/>
    </radialGradient>
    <radialGradient id="cushion-grad" cx="40%" cy="30%" r="65%">
      <stop offset="0%" stop-color="${s.cushionColor}" stop-opacity="1"/>
      <stop offset="100%" stop-color="${darken(s.cushionColor,0.65)}" stop-opacity="1"/>
    </radialGradient>
    <filter id="box-shadow">
      <feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#000" flood-opacity="0.65"/>
    </filter>
    <filter id="watch-glow">
      <feGaussianBlur stdDeviation="6" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
  </defs>

  <!-- Background -->
  <rect width="${width}" height="${height}" fill="url(#bg-top)"/>
  <ellipse cx="${width/2}" cy="${height*0.55}" rx="${width*0.55}" ry="${height*0.45}" fill="url(#glow-orb)"/>

  <!-- Isometric box + watch group (all in original viewBox coords, then scaled) -->
  <g transform="translate(${TX.toFixed(1)},${TY.toFixed(1)}) scale(${SCALE})" filter="url(#box-shadow)">

    <!-- ── Lid (parameterised: closed=covers top, open=stands upright) ── -->
    <polygon points="${lidPts}" fill="url(#lid-grad)"/>
    <line x1="36.4" y1="47.8" x2="62.5" y2="62.9" stroke="${s.rimColor}" stroke-width="0.16" opacity="0.8"/>
    ${accentPlate}
    <!-- lid highlight -->
    <polygon points="${lidPts}" fill="rgba(255,255,255,0.04)"/>
    <line x1="${lidEtx}" y1="${lidEty}" x2="${lidFtx}" y2="${lidFty}" stroke="${s.rimColor}" stroke-width="0.08" opacity="0.5"/>

    <!-- ── Box front face ── -->
    <polygon points="54,47 80.1,62.1 80.1,52.7 54,37.6" fill="url(#front-grad)"/>

    <!-- ── Box right face ── -->
    <polygon points="80.1,62.1 62.5,72.3 62.5,62.9 80.1,52.7" fill="url(#right-grad)"/>

    <!-- ── Box interior / top face ── -->
    <polygon points="54,37.6 80.1,52.7 62.5,62.9 36.4,47.8" fill="${s.interiorColor}"/>

    <!-- Interior cushion (oval) -->
    <ellipse cx="${WX}" cy="${WY+1.2}" rx="12.5" ry="7.2" transform="rotate(30,${WX},${WY+1.2})" fill="url(#cushion-grad)" opacity="0.85"/>
    <!-- Cushion highlight -->
    <ellipse cx="${(WX-1.2).toFixed(1)}" cy="${(WY-0.2).toFixed(1)}" rx="5.5" ry="2.8" transform="rotate(30,${(WX-1.2).toFixed(1)},${(WY-0.2).toFixed(1)})" fill="rgba(255,255,255,0.07)"/>

    <!-- ── Straps ── -->
    <path d="${upperStrap}" fill="${strapCol}" opacity="0.88"/>
    <path d="${lowerStrap}" fill="${strapCol}" opacity="0.88"/>
    <!-- Strap shading -->
    <path d="${upperStrap}" fill="rgba(0,0,0,0.18)"/>
    <path d="${lowerStrap}" fill="rgba(0,0,0,0.18)"/>
    ${segLines.join('\n    ')}

    <!-- ── Case shadow ── -->
    ${shadowEl}

    <!-- ── Case rim (3-D depth band) ── -->
    ${rimEl}

    <!-- ── Bezel ring ── -->
    ${bezelEl}

    <!-- ── Watch face ── -->
    ${faceEl}
    ${faceGrad}

    <!-- ── Hour tick marks ── -->
    ${tickSvg.join('\n    ')}

    <!-- ── Face text inscription ── -->
    ${textSvg}

    <!-- ── Crystal glass highlight ── -->
    ${crystalEl}

    <!-- ── Watch hands ── -->
    ${handsSvg}

    <!-- ── Box edge highlights ── -->
    <line x1="54" y1="37.6" x2="80.1" y2="52.7" stroke="${s.rimColor}" stroke-width="0.14" opacity="0.7"/>
    <line x1="54" y1="37.6" x2="36.4" y2="47.8" stroke="${s.rimColor}" stroke-width="0.10" opacity="0.5"/>
    <line x1="80.1" y1="62.1" x2="80.1" y2="52.7" stroke="${s.rimColor}" stroke-width="0.08" opacity="0.4"/>
    <line x1="54"   y1="47"   x2="54"   y2="37.6" stroke="${s.rimColor}" stroke-width="0.08" opacity="0.35"/>
    <line x1="80.1" y1="62.1" x2="62.5" y2="72.3" stroke="${s.rimColor}" stroke-width="0.06" opacity="0.3"/>

    ${isPremCollect ? `
    <!-- Premium/Collector accent corners -->
    <rect x="${(WX-10.5).toFixed(1)}" y="${(WY-5.8).toFixed(1)}" width="2" height="0.4" fill="${s.accentColor}" opacity="0.6" transform="rotate(30,${WX},${WY})"/>
    ` : ''}

    <!-- ── Closed-lid cover: fades out as lid opens ── -->
    ${parseFloat(lidCoverOpacity) > 0 ? `
    <polygon points="54,37.6 80.1,52.7 62.5,62.9 36.4,47.8" fill="${s.lidColor}" opacity="${lidCoverOpacity}"/>
    <polygon points="54,37.6 80.1,52.7 62.5,62.9 36.4,47.8" fill="rgba(255,255,255,0.04)" opacity="${lidCoverOpacity}"/>
    ` : ''}
  </g>

  <!-- Brand label -->
  <text x="${width/2}" y="${height-20}" text-anchor="middle"
    font-size="13" font-family="system-ui,-apple-system,sans-serif"
    font-weight="900" fill="rgba(255,255,255,0.20)" letter-spacing="6">ЧЕБЛЯЧАС</text>
</svg>`;

  return svg;
}
