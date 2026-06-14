export interface BreakdownItem {
  label: string;
  stars: number;
}

const BRACELET_PRICES: Record<string, number> = {
  plastic_solid: 0,
  plastic_segmented: 1,
  metal_solid: 3,
  metal_segmented: 4,
  resin: 2,
  leather: 3,
  cotton_fabric: 1,
};
const BRACELET_LABELS: Record<string, string> = {
  plastic_solid: 'Пластиковый ремешок',
  plastic_segmented: 'Пластик сегментированный',
  metal_solid: 'Металлический браслет',
  metal_segmented: 'Металл сегментированный',
  resin: 'Смоляной ремешок',
  leather: 'Кожаный ремешок',
  cotton_fabric: 'Тканевый ремешок',
};

const BOX_PRICES: Record<string, number> = { standard: 0, premium: 5, collector: 15 };
const BOX_LABELS: Record<string, string> = {
  premium: 'Коробка Премиум',
  collector: 'Коробка Коллекционная',
};

export interface ConfigForReceipt {
  watchfaceGeometry?: string | null;
  watchfaceMaterial?: string | null;
  braceletMaterial?: string | null;
  handsEnabled?: boolean | null;
  watchfaceText?: string | null;
  customWatchfaceUrl?: string | null;
  skinFullUrl?: string | null;
  skinStripeUrl?: string | null;
  boxType?: string | null;
  giftWrap?: boolean | null;
  presetPriceStars?: number | null;
  presetBraceletMaterial?: string | null;
  presetName?: string | null;
}

export function buildBreakdown(config: ConfigForReceipt): { breakdown: BreakdownItem[]; total: number } {
  const items: BreakdownItem[] = [];

  if (config.presetPriceStars != null) {
    const label = config.presetName ? `Часы «${config.presetName}»` : 'Корпус часов';
    items.push({ label, stars: config.presetPriceStars });

    const origBracelet = config.presetBraceletMaterial ?? config.braceletMaterial ?? 'metal_solid';
    const curBracelet  = config.braceletMaterial ?? origBracelet;
    const delta = (BRACELET_PRICES[curBracelet] ?? 0) - (BRACELET_PRICES[origBracelet] ?? 0);
    if (delta !== 0) {
      items.push({
        label: delta > 0
          ? `Замена: ${BRACELET_LABELS[curBracelet] ?? curBracelet}`
          : `Замена: ${BRACELET_LABELS[curBracelet] ?? curBracelet}`,
        stars: delta,
      });
    }
  } else {
    items.push({ label: 'Базовая цена', stars: 5 });
    const bracelet = config.braceletMaterial ?? 'metal_solid';
    const braceletPrice = BRACELET_PRICES[bracelet] ?? 0;
    if (braceletPrice > 0) items.push({ label: BRACELET_LABELS[bracelet] ?? bracelet, stars: braceletPrice });
  }

  if (config.handsEnabled === false) items.push({ label: 'Без стрелок', stars: -1 });
  if (config.watchfaceText) items.push({ label: `Гравировка: "${config.watchfaceText}"`, stars: 1 });
  if (config.customWatchfaceUrl) items.push({ label: 'Кастомный циферблат', stars: 1 });
  if (config.skinFullUrl) items.push({ label: 'Скин на корпус', stars: 1 });
  if (config.skinStripeUrl) items.push({ label: 'Скин на ремешок', stars: 1 });

  const box = config.boxType ?? 'standard';
  const boxPrice = BOX_PRICES[box] ?? 0;
  if (boxPrice > 0) items.push({ label: BOX_LABELS[box] ?? `Коробка: ${box}`, stars: boxPrice });

  if (config.giftWrap) items.push({ label: 'Атласная лента с бантом', stars: 2 });

  const total = Math.min(50, Math.max(1, items.reduce((s, i) => s + i.stars, 0)));
  return { breakdown: items, total };
}

export function formatReceiptText(breakdown: BreakdownItem[], total: number): string {
  const lines = breakdown.map(item => {
    const isBase = item.stars > 0 && breakdown.indexOf(item) === 0;
    const sign = isBase ? `${item.stars}` : item.stars > 0 ? `+${item.stars}` : `${item.stars}`;
    return `  ${item.label}: ${sign} ⭐`;
  });
  return lines.join('\n') + '\n  ─────────────────\n' + `  *Итого: ${total} ⭐*`;
}
