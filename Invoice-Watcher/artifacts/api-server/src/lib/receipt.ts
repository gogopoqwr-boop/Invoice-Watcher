export interface BreakdownItem {
  label: string;
  stars: number;
}

const GEOM_PRICES: Record<string, number> = { circle: 0, rounded: 0, square: 1 };
const GEOM_LABELS: Record<string, string> = {
  circle: 'Круглая форма',
  rounded: 'Скруглённая форма',
  square: 'Квадратная форма',
};

const MAT_PRICES: Record<string, number> = { plastic: 0, metal: 3 };
const MAT_LABELS: Record<string, string> = {
  plastic: 'Пластиковый корпус',
  metal: 'Металлический корпус',
};

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
}

export function buildBreakdown(config: ConfigForReceipt): { breakdown: BreakdownItem[]; total: number } {
  const items: BreakdownItem[] = [];

  items.push({ label: 'Базовая цена', stars: 5 });

  const geom = config.watchfaceGeometry ?? 'circle';
  const geomPrice = GEOM_PRICES[geom] ?? 0;
  if (geomPrice > 0) items.push({ label: GEOM_LABELS[geom] ?? geom, stars: geomPrice });

  const mat = config.watchfaceMaterial ?? 'metal';
  const matPrice = MAT_PRICES[mat] ?? 0;
  if (matPrice > 0) items.push({ label: MAT_LABELS[mat] ?? mat, stars: matPrice });

  const bracelet = config.braceletMaterial ?? 'metal_solid';
  const braceletPrice = BRACELET_PRICES[bracelet] ?? 0;
  if (braceletPrice > 0) items.push({ label: BRACELET_LABELS[bracelet] ?? bracelet, stars: braceletPrice });

  if (config.handsEnabled === false) items.push({ label: 'Без стрелок', stars: -1 });
  if (config.watchfaceText) items.push({ label: `Надпись: "${config.watchfaceText}"`, stars: 1 });
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
    const sign = item.stars > 0 ? `+${item.stars}` : `${item.stars}`;
    const isBase = item.label === 'Базовая цена';
    return `  ${item.label}: ${isBase ? item.stars : sign} ⭐`;
  });
  return lines.join('\n') + '\n  ─────────────────\n' + `  *Итого: ${total} ⭐*`;
}
