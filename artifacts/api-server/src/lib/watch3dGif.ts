interface WatchConfig {
  watchfaceGeometry?: string | null;
  watchfaceColor?: string | null;
  braceletColor?: string | null;
  braceletMaterial?: string | null;
  handsEnabled?: boolean | null;
  handsColor?: string | null;
  watchfaceText?: string | null;
  watchfaceTextMode?: string | null;
  watchfaceBackgroundType?: string | null;
  watchfaceGradientEnd?: string | null;
}

function clamp(v: number, lo = 0, hi = 255) { return Math.max(lo, Math.min(hi, v)); }

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function lightenHex(hex: string, amt: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `#${[r, g, b].map(c => clamp(c + amt).toString(16).padStart(2, '0')).join('')}`;
}

function darkenHex(hex: string, amt: number): string {
  return lightenHex(hex, -amt);
}

function mixHex(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  return `#${[
    clamp(Math.round(ar + (br - ar) * t)),
    clamp(Math.round(ag + (bg - ag) * t)),
    clamp(Math.round(ab + (bb - ab) * t)),
  ].map(c => c.toString(16).padStart(2, '0')).join('')}`;
}

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Generates a single SVG frame of a 3D-perspective watch at a given rotation angle.
 * angle=0 → front face, angle=π → back face
 */
function generateWatch3dFrame(cfg: WatchConfig, size: number, angle: number): string {
  const geo = cfg.watchfaceGeometry ?? 'rounded';
  const faceColor = cfg.watchfaceColor ?? '#1e293b';
  const strapColor = cfg.braceletColor ?? '#0f172a';
  const handsColor = cfg.handsColor ?? '#cbd5e1';
  const handsEnabled = cfg.handsEnabled !== false;
  const watchText = cfg.watchfaceText?.trim() ?? '';
  const bgType = cfg.watchfaceBackgroundType ?? 'solid';
  const gradEnd = cfg.watchfaceGradientEnd ?? '#0f172a';
  const braceletMat = cfg.braceletMaterial ?? 'metal_solid';

  // Perspective foreshortening: cosA drives how "wide" the watch looks
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);
  const isFront = cosA >= 0;
  const perspScale = Math.abs(cosA);  // 0 at edge, 1 at front/back

  const W = size;
  const H = size;
  const cx = W / 2;
  const cy = H / 2;

  // The watch occupies ~80% of the canvas height
  const watchH = H * 0.82;
  const faceR = watchH * 0.215;

  // Strap dimensions
  const strapHalfW = faceR * 0.52 * perspScale;
  const strapFullW = faceR * 0.52;  // used for lighting
  const topStrapH = H * 0.155;
  const botStrapH = H * 0.145;
  const strapY1 = cy - faceR * 1.05;  // top strap bottom edge
  const strapY0 = strapY1 - topStrapH; // top strap top edge
  const strapY2 = cy + faceR * 1.05;  // bottom strap top edge
  const strapY3 = strapY2 + botStrapH; // bottom strap bottom edge

  // Case width under perspective
  const caseW = faceR * 2.08 * perspScale;
  const caseH_thick = faceR * 0.13;  // side-on thickness of case

  // Light comes from upper-left; as watch rotates the lit side sweeps
  // When facing front (angle=0), lit side is top-left
  // As it rotates, the lighting shifts to give a convincing 3D impression
  const lightFactor = 0.5 + 0.5 * Math.cos(angle); // 1 at front, 0 at back

  // Color helpers for this frame
  const faceHighlight = lightenHex(faceColor, Math.round(lightFactor * 55));
  const faceShadow = darkenHex(faceColor, 30);
  const strapHighlight = lightenHex(strapColor, Math.round(lightFactor * 45));
  const strapShadow = darkenHex(strapColor, 20);

  // Crown (side button) appears on right side, shrinks as watch rotates away
  const crownX = cx + caseW / 2;
  const crownVisible = cosA > 0.05;
  const crownOpacity = Math.max(0, (cosA - 0.05) / 0.95).toFixed(3);

  // Bracelet material patterns
  const showMesh = braceletMat === 'metal_segmented';
  const showLinks = braceletMat === 'metal_solid';
  const showLeather = braceletMat === 'leather';
  const showRubber = braceletMat === 'plastic_solid' || braceletMat === 'resin';

  // Link/segment count visible under perspective
  const linkH = topStrapH / 7;

  // Face shape path (foreshortened ellipse or rounded rect)
  function casePath(rx: number, ry: number, yOff = 0): string {
    if (geo === 'circle') {
      return `<ellipse cx="${cx}" cy="${cy + yOff}" rx="${rx}" ry="${ry}"/>`;
    } else if (geo === 'square') {
      const rad = Math.max(3, rx * 0.13);
      return `<rect x="${cx - rx}" y="${cy - ry + yOff}" width="${rx * 2}" height="${ry * 2}" rx="${rad}"/>`;
    } else if (geo === 'drawn') {
      const rad = Math.max(3, rx * 0.5);
      return `<rect x="${cx - rx}" y="${cy - ry + yOff}" width="${rx * 2}" height="${ry * 2}" rx="${rad}"/>`;
    } else {
      // rounded (pill)
      const rad = Math.max(3, rx * 0.85);
      return `<rect x="${cx - rx}" y="${cy - ry * 0.88 + yOff}" width="${rx * 2}" height="${ry * 1.76}" rx="${rad}"/>`;
    }
  }

  // Hour marker ticks around the face
  const faceRx = caseW / 2 - faceR * 0.06;
  const faceRy = faceR - faceR * 0.06;
  const ticks = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
    // In perspective, x-axis is compressed by perspScale
    const px = cx + Math.cos(a) * faceRx * 0.84;
    const py = cy + Math.sin(a) * faceRy * 0.84;
    const isHour = i % 3 === 0;
    const tLen = isHour ? faceRy * 0.14 : faceRy * 0.08;
    const ex = cx + Math.cos(a) * faceRx * (0.84 + tLen / faceRx);
    const ey = cy + Math.sin(a) * faceRy * (0.84 + tLen / faceRy);
    return `<line x1="${px.toFixed(1)}" y1="${py.toFixed(1)}" x2="${ex.toFixed(1)}" y2="${ey.toFixed(1)}"
      stroke="${handsColor}" stroke-width="${isHour ? 2.5 : 1.5}" stroke-opacity="${isHour ? 0.85 : 0.5}" stroke-linecap="round"/>`;
  }).join('');

  // Hands at 10:10 look
  const hourA = ((2 * 30 + 30) - 90) * Math.PI / 180;   // 2 o'clock
  const minA  = (10 * 6 - 90) * Math.PI / 180;           // 10 min marker
  const secA  = (35 * 6 - 90) * Math.PI / 180;

  const handLine = (a: number, len: number, w: number, color: string) => {
    const hx = cx + Math.cos(a) * faceRx * len;
    const hy = cy + Math.sin(a) * faceRy * len;
    return `<line x1="${cx}" y1="${cy}" x2="${hx.toFixed(1)}" y2="${hy.toFixed(1)}"
      stroke="${color}" stroke-width="${w}" stroke-linecap="round" opacity="0.95"/>`;
  };

  // Face text
  let faceTextSvg = '';
  if (watchText && !watchText.startsWith('EYE:') && isFront && perspScale > 0.2) {
    const textOpacity = Math.min(1, (perspScale - 0.2) / 0.4);
    const lines = watchText.split('\n').slice(0, 2);
    const fontSize = Math.max(9, Math.min(18, (faceRx * 1.1) / Math.max(...lines.map(l => l.length || 1))));
    faceTextSvg = lines.map((line, i) =>
      `<text x="${cx}" y="${cy + (i - (lines.length - 1) / 2) * fontSize * 1.3}"
        text-anchor="middle" dominant-baseline="middle"
        font-size="${fontSize}" font-family="system-ui,sans-serif" font-weight="700"
        fill="${handsColor}" opacity="${(textOpacity * 0.85).toFixed(2)}" letter-spacing="1">${esc(line.toUpperCase())}</text>`
    ).join('');
  }

  // Back face content
  const backFaceSvg = !isFront ? `
    <!-- Caseback engravings -->
    <circle cx="${cx}" cy="${cy}" r="${faceRy * 0.72}" fill="none"
      stroke="${handsColor}" stroke-width="1" stroke-opacity="0.12"/>
    <circle cx="${cx}" cy="${cy}" r="${faceRy * 0.45}" fill="none"
      stroke="${handsColor}" stroke-width="0.8" stroke-opacity="0.08"/>
    ${[[-1,-1],[1,-1],[1,1],[-1,1]].map(([sx, sy]) => {
      const scx = cx + sx * faceRx * 0.6;
      const scy = cy + sy * faceRy * 0.6;
      return `<circle cx="${scx.toFixed(1)}" cy="${scy.toFixed(1)}" r="${faceRy * 0.05}"
        fill="${darkenHex(faceColor, 10)}" stroke="${handsColor}" stroke-width="0.8" stroke-opacity="0.2"/>
        <line x1="${(scx - faceRy * 0.03).toFixed(1)}" y1="${scy.toFixed(1)}"
              x2="${(scx + faceRy * 0.03).toFixed(1)}" y2="${scy.toFixed(1)}"
              stroke="${handsColor}" stroke-width="1" stroke-opacity="0.3"/>
        <line x1="${scx.toFixed(1)}" y1="${(scy - faceRy * 0.03).toFixed(1)}"
              x2="${scx.toFixed(1)}" y2="${(scy + faceRy * 0.03).toFixed(1)}"
              stroke="${handsColor}" stroke-width="1" stroke-opacity="0.3"/>`;
    }).join('')}
    <text x="${cx}" y="${cy - faceRy * 0.12}" text-anchor="middle" dominant-baseline="middle"
      font-size="${faceRy * 0.13}" font-family="system-ui,sans-serif" font-weight="900"
      fill="${handsColor}" opacity="0.22" letter-spacing="${faceRy * 0.04}">ЧЕБЛЯЧАС</text>
    <text x="${cx}" y="${cy + faceRy * 0.15}" text-anchor="middle" dominant-baseline="middle"
      font-size="${faceRy * 0.09}" font-family="system-ui,sans-serif"
      fill="${handsColor}" opacity="0.14" letter-spacing="2">CUSTOM WATCH</text>
  ` : '';

  // Strap link segments
  const strapLinks = (yTop: number, yBot: number, side: 'top' | 'bot') => {
    if (!showLinks && !showMesh) return '';
    const lines: string[] = [];
    const count = Math.round((yBot - yTop) / linkH);
    for (let i = 1; i < count; i++) {
      const ly = yTop + i * linkH;
      lines.push(`<line x1="${(cx - strapHalfW).toFixed(1)}" y1="${ly.toFixed(1)}"
        x2="${(cx + strapHalfW).toFixed(1)}" y2="${ly.toFixed(1)}"
        stroke="${darkenHex(strapColor, 25)}" stroke-width="1.5" stroke-opacity="0.5"/>`);
    }
    if (showMesh) {
      const spacing = 8;
      for (let i = 0; i < 30; i++) {
        const ly = yTop + i * spacing;
        if (ly > yBot) break;
        const lx = cx - strapHalfW + (i % 2) * spacing / 2;
        lines.push(`<line x1="${lx.toFixed(1)}" y1="${ly.toFixed(1)}"
          x2="${(lx + spacing).toFixed(1)}" y2="${(ly + spacing).toFixed(1)}"
          stroke="rgba(255,255,255,0.12)" stroke-width="1"/>`);
      }
    }
    return lines.join('');
  };

  // Leather stitch lines
  const leatherStitch = (yTop: number, yBot: number) => {
    if (!showLeather) return '';
    const lines: string[] = [];
    for (let y = yTop + 12; y < yBot; y += 16) {
      lines.push(`<line x1="${(cx - strapHalfW + 6).toFixed(1)}" y1="${y.toFixed(1)}"
        x2="${(cx + strapHalfW - 6).toFixed(1)}" y2="${y.toFixed(1)}"
        stroke="rgba(0,0,0,0.2)" stroke-width="1.5"/>`);
    }
    return lines.join('');
  };

  // Buckle on bottom strap
  const buckleY = strapY3 - botStrapH * 0.35;
  const buckleW = strapHalfW * 0.9;
  const buckleSvg = perspScale > 0.08 ? `
    <rect x="${(cx - buckleW).toFixed(1)}" y="${(buckleY - 7).toFixed(1)}"
      width="${(buckleW * 2).toFixed(1)}" height="14" rx="4"
      fill="#334155" stroke="rgba(255,255,255,0.15)" stroke-width="1"/>
    <line x1="${cx}" y1="${(buckleY - 7).toFixed(1)}" x2="${cx}" y2="${(buckleY + 7).toFixed(1)}"
      stroke="#64748b" stroke-width="2"/>
  ` : '';

  // Unique gradient IDs per frame to avoid SVG caching collisions
  const uid = Math.random().toString(36).slice(2, 7);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <radialGradient id="bg${uid}" cx="50%" cy="48%" r="55%">
      <stop offset="0%" stop-color="#141428"/>
      <stop offset="100%" stop-color="#09090f"/>
    </radialGradient>
    <radialGradient id="glow${uid}" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${faceColor}" stop-opacity="0.28"/>
      <stop offset="100%" stop-color="${faceColor}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="faceGrad${uid}" x1="${isFront ? '0.25' : '0.75'}" y1="0.1" x2="${isFront ? '0.85' : '0.15'}" y2="0.95">
      <stop offset="0%" stop-color="${faceHighlight}"/>
      <stop offset="55%" stop-color="${faceColor}"/>
      <stop offset="100%" stop-color="${faceShadow}"/>
    </linearGradient>
    <linearGradient id="strapGrad${uid}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${strapShadow}"/>
      <stop offset="35%" stop-color="${strapHighlight}"/>
      <stop offset="100%" stop-color="${strapShadow}"/>
    </linearGradient>
    <linearGradient id="glassGrad${uid}" x1="0.2" y1="0.05" x2="0.85" y2="0.95">
      <stop offset="0%" stop-color="rgba(255,255,255,0.22)"/>
      <stop offset="45%" stop-color="rgba(255,255,255,0.05)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0.15)"/>
    </linearGradient>
    <linearGradient id="rimSideGrad${uid}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${lightenHex(faceColor, 30)}"/>
      <stop offset="100%" stop-color="${darkenHex(faceColor, 40)}"/>
    </linearGradient>
    <clipPath id="faceClip${uid}">
      ${geo === 'circle'
        ? `<ellipse cx="${cx}" cy="${cy}" rx="${caseW / 2 - 2}" ry="${faceR - 2}"/>`
        : geo === 'square'
          ? `<rect x="${cx - caseW / 2 + 2}" y="${cy - faceR + 2}" width="${caseW - 4}" height="${faceR * 2 - 4}" rx="${Math.max(2, caseW * 0.06)}"/>`
          : geo === 'drawn'
            ? `<rect x="${cx - caseW / 2 + 2}" y="${cy - faceR + 2}" width="${caseW - 4}" height="${faceR * 2 - 4}" rx="${Math.max(2, caseW * 0.4)}"/>`
            : `<rect x="${cx - caseW / 2 + 2}" y="${cy - faceR * 0.88 + 2}" width="${caseW - 4}" height="${faceR * 1.76 - 4}" rx="${Math.max(2, caseW * 0.82)}"/>`
      }
    </clipPath>
    <filter id="shadow${uid}" x="-20%" y="-10%" width="140%" height="130%">
      <feDropShadow dx="0" dy="${faceR * 0.08}" stdDeviation="${faceR * 0.12}" flood-color="#000" flood-opacity="0.7"/>
    </filter>
    <filter id="glow2${uid}">
      <feGaussianBlur stdDeviation="3" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
  </defs>

  <!-- Background -->
  <rect width="${W}" height="${H}" fill="url(#bg${uid})"/>

  <!-- Ambient glow behind watch -->
  <ellipse cx="${cx}" cy="${cy}" rx="${W * 0.38}" ry="${H * 0.42}" fill="url(#glow${uid})"/>

  <!-- ── Top strap ── -->
  ${perspScale > 0.04 ? `
  <rect x="${(cx - strapHalfW).toFixed(1)}" y="${strapY0.toFixed(1)}"
    width="${(strapHalfW * 2).toFixed(1)}" height="${topStrapH.toFixed(1)}"
    rx="${showRubber ? strapHalfW * 0.4 : strapHalfW * 0.2}"
    fill="url(#strapGrad${uid})" filter="url(#shadow${uid})"/>
  ${strapLinks(strapY0, strapY1, 'top')}
  ${leatherStitch(strapY0, strapY1)}
  <!-- strap edge highlight -->
  <rect x="${(cx - strapHalfW).toFixed(1)}" y="${strapY0.toFixed(1)}"
    width="${(strapHalfW * 2).toFixed(1)}" height="${topStrapH.toFixed(1)}"
    rx="${showRubber ? strapHalfW * 0.4 : strapHalfW * 0.2}"
    fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="1.5"/>
  ` : ''}

  <!-- ── Bottom strap ── -->
  ${perspScale > 0.04 ? `
  <rect x="${(cx - strapHalfW).toFixed(1)}" y="${strapY2.toFixed(1)}"
    width="${(strapHalfW * 2).toFixed(1)}" height="${botStrapH.toFixed(1)}"
    rx="${showRubber ? strapHalfW * 0.4 : strapHalfW * 0.2}"
    fill="url(#strapGrad${uid})" filter="url(#shadow${uid})"/>
  ${strapLinks(strapY2, strapY3, 'bot')}
  ${leatherStitch(strapY2, strapY3)}
  <rect x="${(cx - strapHalfW).toFixed(1)}" y="${strapY2.toFixed(1)}"
    width="${(strapHalfW * 2).toFixed(1)}" height="${botStrapH.toFixed(1)}"
    rx="${showRubber ? strapHalfW * 0.4 : strapHalfW * 0.2}"
    fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="1.5"/>
  ${buckleSvg}
  ` : ''}

  <!-- ── Watch case shadow ── -->
  <g opacity="0.7">
    ${casePath(caseW / 2 + faceR * 0.04, faceR + faceR * 0.04, faceR * 0.06)
      .replace('/>', ` fill="rgba(0,0,0,0.55)"/>`)}
  </g>

  <!-- ── Watch case (side rim visible when rotating) ── -->
  ${caseH_thick > 0.5 && perspScale < 0.98 ? `
  <g opacity="${(0.85 * (1 - perspScale * 0.6)).toFixed(2)}">
    ${casePath(caseW / 2 + caseH_thick * (1 - perspScale), faceR + caseH_thick * 0.3, caseH_thick * 0.5)
      .replace('/>', ` fill="url(#rimSideGrad${uid})"/>`)}
  </g>
  ` : ''}

  <!-- ── Watch case face ── -->
  <g filter="url(#shadow${uid})">
    ${casePath(caseW / 2, faceR, 0).replace('/>', ` fill="url(#faceGrad${uid})"/>`)}
  </g>
  <!-- Case bezel ring -->
  ${casePath(caseW / 2, faceR, 0).replace('/>', ` fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="2.5"/>`)}

  <!-- ── Face interior (clipped) ── -->
  <g clip-path="url(#faceClip${uid})">
    <!-- Face fill with gradient -->
    ${casePath(caseW / 2, faceR, 0).replace('/>', ` fill="${bgType === 'gradient' ? `url(#faceGrad${uid})` : faceColor}"/>`)}

    ${isFront ? `
    <!-- Inner glow/vignette -->
    <ellipse cx="${(cx - caseW * 0.15).toFixed(1)}" cy="${(cy - faceR * 0.35).toFixed(1)}"
      rx="${(caseW * 0.35).toFixed(1)}" ry="${(faceR * 0.28).toFixed(1)}"
      fill="rgba(255,255,255,0.07)" transform="rotate(-15,${cx},${cy})"/>

    <!-- Hour markers -->
    ${ticks}

    <!-- Watch text -->
    ${faceTextSvg}

    <!-- Center dot -->
    ${handsEnabled ? `<circle cx="${cx}" cy="${cy}" r="${faceR * 0.055}" fill="${handsColor}" opacity="0.95"/>` : ''}

    <!-- Hour hand -->
    ${handsEnabled ? handLine(hourA, 0.48, faceR * 0.045, handsColor) : ''}
    <!-- Minute hand -->
    ${handsEnabled ? handLine(minA, 0.68, faceR * 0.032, handsColor) : ''}
    <!-- Second hand -->
    ${handsEnabled ? handLine(secA, 0.74, faceR * 0.018, '#ef4444') : ''}
    ${handsEnabled ? `<circle cx="${cx}" cy="${cy}" r="${faceR * 0.03}" fill="#ef4444"/>` : ''}
    ` : backFaceSvg}
  </g>

  <!-- ── Crystal glass highlight ── -->
  <g clip-path="url(#faceClip${uid})" opacity="${(0.85 * perspScale).toFixed(2)}">
    ${casePath(caseW / 2, faceR, 0).replace('/>', ` fill="url(#glassGrad${uid})"/>`)}
  </g>

  <!-- ── Crown ── -->
  ${crownVisible ? `
  <rect x="${crownX.toFixed(1)}" y="${(cy - faceR * 0.16).toFixed(1)}"
    width="${(faceR * 0.1 * parseFloat(crownOpacity)).toFixed(1)}" height="${(faceR * 0.32).toFixed(1)}"
    rx="${faceR * 0.05}"
    fill="${darkenHex(faceColor, 5)}" stroke="rgba(255,255,255,0.18)" stroke-width="1.2"
    opacity="${crownOpacity}"/>
  ` : ''}

  <!-- ── Brand label ── -->
  <text x="${cx}" y="${H - H * 0.05}" text-anchor="middle"
    font-size="${H * 0.032}" font-family="system-ui,sans-serif" font-weight="900"
    fill="rgba(255,255,255,0.18)" letter-spacing="${H * 0.007}">ЧЕБЛЯЧАС</text>
</svg>`;
}

export async function generateWatch3dRotatingGif(
  cfg: WatchConfig,
  outputSize = 360,
  frames = 36,
  delayMs = 55,
): Promise<Buffer> {
  const [{ default: GIFEncoder }, { default: sharp }] = await Promise.all([
    import('gif-encoder-2'),
    import('sharp'),
  ]);

  const BG = { r: 9, g: 9, b: 15, alpha: 255 as const };

  const encoder = new GIFEncoder(outputSize, outputSize, 'octree', true);
  encoder.setDelay(delayMs);
  encoder.setRepeat(0);
  encoder.setQuality(6);
  encoder.start();

  // Full 360° rotation, pausing on front and back faces
  // Build angle sequence: front pause → rotate → back pause → rotate back
  const angles: number[] = [];

  const frontPause = 8;   // frames holding the front face
  const backPause  = 4;   // frames holding the back face
  const spinFrames = (frames - frontPause - backPause) / 2;

  // Front pause
  for (let i = 0; i < frontPause; i++) angles.push(0);
  // Rotate to back (0 → π)
  for (let i = 1; i <= spinFrames; i++) {
    angles.push((i / spinFrames) * Math.PI);
  }
  // Back pause
  for (let i = 0; i < backPause; i++) angles.push(Math.PI);
  // Rotate back to front (π → 2π = 0)
  for (let i = 1; i <= spinFrames; i++) {
    angles.push(Math.PI + (i / spinFrames) * Math.PI);
  }

  for (const angle of angles) {
    const svgStr = generateWatch3dFrame(cfg, outputSize, angle);
    const svgBuf = Buffer.from(svgStr);

    const framePixels = await sharp(svgBuf)
      .resize(outputSize, outputSize, { fit: 'fill' })
      .flatten({ background: BG })
      .ensureAlpha()
      .raw()
      .toBuffer();

    encoder.addFrame(framePixels);
  }

  encoder.finish();
  return encoder.out.getData() as Buffer;
}
