import { generateWatchBoxSVG } from './watchBoxSvg.js';

interface BoxCfg {
  watchfaceColor?: string | null;
  watchfaceGeometry?: string | null;
  braceletColor?: string | null;
  braceletMaterial?: string | null;
  handsEnabled?: boolean | null;
  watchfaceText?: string | null;
  boxType?: string | null;
  giftWrap?: boolean | null;
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

export async function generateBoxOpeningGif(
  cfg: BoxCfg,
  outputSize = 360,
  totalFrames = 44,
  delayMs = 55,
): Promise<Buffer> {
  const [{ default: GIFEncoder }, { default: sharp }] = await Promise.all([
    import('gif-encoder-2'),
    import('sharp'),
  ]);

  const BG = { r: 9, g: 14, b: 24, alpha: 255 };

  const encoder = new GIFEncoder(outputSize, outputSize, 'octree', true);
  encoder.setDelay(delayMs);
  encoder.setRepeat(0);
  encoder.setQuality(8);
  encoder.start();

  // Animation phases:
  // Phase 1 (frames 0-1):  hold closed (short pause before opening)
  // Phase 2 (frames 1-14): lid opens  0 → 1  (ease-in-out)
  // Phase 3 (frames 14-40): hold open  (watch visible)
  // Phase 4 (frames 40-44): gentle re-close 1 → 0.72 (teaser before loop)

  const HOLD_CLOSED  = 2;
  const OPEN_FRAMES  = 13;
  const HOLD_OPEN    = 26;
  const RECLOSE      = 3;

  const svgW = outputSize;
  const svgH = Math.round(outputSize * (500 / 600));

  for (let i = 0; i < totalFrames; i++) {
    let lidT: number;

    if (i < HOLD_CLOSED) {
      lidT = 0;
    } else if (i < HOLD_CLOSED + OPEN_FRAMES) {
      const t = (i - HOLD_CLOSED) / OPEN_FRAMES;
      lidT = easeInOut(t);
    } else if (i < HOLD_CLOSED + OPEN_FRAMES + HOLD_OPEN) {
      lidT = 1;
    } else {
      const t = (i - HOLD_CLOSED - OPEN_FRAMES - HOLD_OPEN) / RECLOSE;
      lidT = 1 - easeInOut(t) * 0.28;
    }

    const svgStr = generateWatchBoxSVG(cfg, svgW, svgH, lidT);
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
