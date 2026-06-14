import { generateWatchSVG } from './watchSvg.js';

interface WatchCfg {
  watchfaceColor?: string | null;
  watchfaceGeometry?: string | null;
  braceletColor?: string | null;
  braceletMaterial?: string | null;
  handsEnabled?: boolean | null;
  handsColor?: string | null;
  watchfaceText?: string | null;
  watchfaceTextMode?: string | null;
  watchfaceBackgroundType?: string | null;
  watchfaceGradientEnd?: string | null;
}

// ─── Back-face SVG (plain metallic plate with screws + brand) ────────────────

function generateBackSVG(cfg: WatchCfg, size: number): string {
  const faceColor = cfg.watchfaceColor ?? '#1e293b';
  const handsColor = cfg.handsColor ?? '#cbd5e1';
  const cx = 200, cy = 200, r = 130;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="${size}" height="${size}">
  <defs>
    <radialGradient id="bg2" cx="50%" cy="50%" r="55%">
      <stop offset="0%" stop-color="#131320"/>
      <stop offset="100%" stop-color="#0a0a14"/>
    </radialGradient>
    <radialGradient id="plate2" cx="35%" cy="35%" r="65%">
      <stop offset="0%" stop-color="${lighten(faceColor, 25)}"/>
      <stop offset="60%" stop-color="${faceColor}"/>
      <stop offset="100%" stop-color="${darken(faceColor, 20)}"/>
    </radialGradient>
    <radialGradient id="glow2" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${faceColor}" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="transparent" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="400" height="400" fill="url(#bg2)"/>
  <ellipse cx="${cx}" cy="${cy}" rx="190" ry="190" fill="url(#glow2)" opacity="0.7"/>
  <!-- Back plate shadow -->
  <circle cx="${cx}" cy="${cy + 6}" r="${r + 6}" fill="rgba(0,0,0,0.45)"/>
  <!-- Back plate -->
  <circle cx="${cx}" cy="${cy}" r="${r + 5}" fill="url(#plate2)" stroke="rgba(255,255,255,0.1)" stroke-width="2.5"/>
  <!-- Engraved ring -->
  <circle cx="${cx}" cy="${cy}" r="${r - 14}" fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="5"/>
  <!-- Screws at corners -->
  ${[[-1,-1],[1,-1],[1,1],[-1,1]].map(([sx,sy]) => {
    const scx = cx + sx * (r - 22);
    const scy = cy + sy * (r - 22);
    return `<circle cx="${scx}" cy="${scy}" r="7" fill="${darken(faceColor,10)}" stroke="rgba(255,255,255,0.15)" stroke-width="1.5"/>
            <line x1="${scx - 4}" y1="${scy}" x2="${scx + 4}" y2="${scy}" stroke="rgba(255,255,255,0.3)" stroke-width="1.5"/>
            <line x1="${scx}" y1="${scy - 4}" x2="${scx}" y2="${scy + 4}" stroke="rgba(255,255,255,0.3)" stroke-width="1.5"/>`;
  }).join('')}
  <!-- Brand engraving -->
  <text x="${cx}" y="${cy - 12}" text-anchor="middle" font-size="16" font-family="system-ui,sans-serif"
        font-weight="900" fill="${handsColor}" opacity="0.3" letter-spacing="5">ЧЕБЛЯЧАС</text>
  <text x="${cx}" y="${cy + 14}" text-anchor="middle" font-size="11" font-family="system-ui,sans-serif"
        font-weight="400" fill="${handsColor}" opacity="0.18" letter-spacing="2">CUSTOM WATCH</text>
  <!-- Caseback ring highlight -->
  <circle cx="${cx}" cy="${cy}" r="${r + 5}" fill="none" stroke="rgba(255,255,255,0.04)" stroke-width="8"/>
</svg>`;
}

function clamp(v: number) { return Math.max(0, Math.min(255, Math.round(v))); }

function lighten(hex: string, amount: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `#${[r, g, b].map(c => clamp(c + amount).toString(16).padStart(2, '0')).join('')}`;
}

function darken(hex: string, amount: number): string {
  return lighten(hex, -amount);
}

// ─── Main GIF generator ───────────────────────────────────────────────────────

const BG = { r: 13, g: 13, b: 24, alpha: 255 as const };

export async function generateWatchRotatingGif(
  cfg: WatchCfg,
  outputSize = 360,
  frames = 30,
  delayMs = 60,
): Promise<Buffer> {
  const [{ default: GIFEncoder }, { default: sharp }] = await Promise.all([
    import('gif-encoder-2'),
    import('sharp'),
  ]);

  // Render front & back faces at a larger size then crop/scale
  const svgSize = Math.round(outputSize * (400 / 300));  // generate wide enough to crop face

  // Front: use full watch SVG, crop to face area (viewBox 70,148,260,260 out of 400x560)
  const frontSvgBuf = Buffer.from(generateWatchSVG(cfg, svgSize));
  const frontFull = await sharp(frontSvgBuf).png().toBuffer();
  const svgMeta = await sharp(frontFull).metadata();
  const sw = svgMeta.width!;
  const sh = svgMeta.height!;

  // Face bounding box in SVG coords: x=[70,330], y=[150,410] → 260×260 square
  const cropL = Math.round(sw * (70 / 400));
  const cropT = Math.round(sh * (150 / 560));
  const cropSz = Math.round(sw * (260 / 400));

  const frontFace = await sharp(frontFull)
    .extract({ left: cropL, top: cropT, width: Math.min(cropSz, sw - cropL), height: Math.min(cropSz, sh - cropT) })
    .resize(outputSize, outputSize, { fit: 'fill' })
    .flatten({ background: BG })
    .png()
    .toBuffer();

  // Back face
  const backSvgBuf = Buffer.from(generateBackSVG(cfg, outputSize));
  const backFace = await sharp(backSvgBuf)
    .flatten({ background: BG })
    .png()
    .toBuffer();

  // Solid background tile
  const bgTile = await sharp({
    create: { width: outputSize, height: outputSize, channels: 4, background: BG },
  }).png().toBuffer();

  // Build GIF
  const encoder = new GIFEncoder(outputSize, outputSize, 'octree', true);
  encoder.setDelay(delayMs);
  encoder.setRepeat(0);   // loop forever
  encoder.setQuality(10);
  encoder.start();

  for (let i = 0; i < frames; i++) {
    const angle = (i / frames) * Math.PI * 2;
    const cosA = Math.cos(angle);
    const isFront = cosA >= 0;
    const absScale = Math.abs(cosA);

    // At the very edge (absScale ≈ 0) show a thin 2px sliver
    const squeezeW = Math.max(2, Math.round(outputSize * absScale));
    const offsetL = Math.floor((outputSize - squeezeW) / 2);
    const offsetR = outputSize - squeezeW - offsetL;

    const source = isFront ? frontFace : backFace;

    const squeezed = await sharp(source)
      .resize(squeezeW, outputSize, { fit: 'fill' })
      .flatten({ background: BG })
      .png()
      .toBuffer();

    const framePixels = await sharp(bgTile)
      .composite([{ input: squeezed, left: offsetL, top: 0 }])
      .ensureAlpha()
      .raw()
      .toBuffer();

    encoder.addFrame(framePixels);
  }

  encoder.finish();
  return encoder.out.getData() as Buffer;
}
