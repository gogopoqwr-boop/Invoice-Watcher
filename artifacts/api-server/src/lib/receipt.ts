export interface BreakdownItem {
  label: string;
  stars: number;
  /** true = informational detail, not counted in the total */
  isInfo?: boolean;
}

// ── Price tables ─────────────────────────────────────────────────────────────

const BRACELET_PRICES: Record<string, number> = {
  plastic_solid: 0, plastic_segmented: 100, metal_solid: 300, metal_segmented: 400,
  resin: 200, leather: 300, cotton_fabric: 100,
};
const BRACELET_LABELS: Record<string, string> = {
  plastic_solid: 'Пластиковый ремешок', plastic_segmented: 'Пластик сегментированный',
  metal_solid: 'Металлический браслет', metal_segmented: 'Металл сегментированный',
  resin: 'Смоляной ремешок', leather: 'Кожаный ремешок', cotton_fabric: 'Тканевый ремешок',
};

const GEOMETRY_PRICES: Record<string, number> = { circle: 0, square: 1, star: 2, drawn: 3 };
const GEOMETRY_LABELS: Record<string, string> = {
  circle: 'Круглый', square: 'Квадратный', star: 'Звёздный', drawn: 'Нестандартный',
};

const MATERIAL_LABELS: Record<string, string> = {
  plastic: 'Пластиковый корпус', metal: 'Металлический корпус',
};

const BOX_PRICES: Record<string, number> = { standard: 100, premium: 200, collector: 400 };
const BOX_LABELS: Record<string, string> = {
  standard: 'Стандартная коробка', premium: 'Коробка Премиум', collector: 'Коробка Коллекционная',
};

// ── Main builder ──────────────────────────────────────────────────────────────

export interface ConfigForReceipt {
  watchfaceGeometry?: string | null;
  watchfaceMaterial?: string | null;
  watchfaceColor?: string | null;
  braceletMaterial?: string | null;
  braceletColor?: string | null;
  handsEnabled?: boolean | null;
  handsColor?: string | null;
  watchfaceText?: string | null;
  serialNumber?: string | null;
  customWatchfaceUrl?: string | null;
  skinFullUrl?: string | null;
  skinStripeUrl?: string | null;
  boxType?: string | null;
  giftWrap?: boolean | null;
  presetPriceStars?: number | null;
  presetBraceletMaterial?: string | null;
  presetName?: string | null;
}

export function buildBreakdown(cfg: ConfigForReceipt): { breakdown: BreakdownItem[]; total: number } {
  const items: BreakdownItem[] = [];

  if (cfg.presetPriceStars != null) {
    // ── Preset path ──
    const baseLabel = cfg.presetName ? `Часы «${cfg.presetName}»` : 'Корпус часов';
    items.push({ label: baseLabel, stars: cfg.presetPriceStars });

    const geoLabel = GEOMETRY_LABELS[cfg.watchfaceGeometry ?? ''] ?? (cfg.watchfaceGeometry ?? '');
    const matLabel = MATERIAL_LABELS[cfg.watchfaceMaterial ?? ''] ?? (cfg.watchfaceMaterial ?? '');
    items.push({ label: `Циферблат: ${geoLabel}, ${matLabel}`, stars: 0, isInfo: true });

    const origBracelet = cfg.presetBraceletMaterial ?? cfg.braceletMaterial ?? 'metal_solid';
    const curBracelet  = cfg.braceletMaterial ?? origBracelet;
    const delta = (BRACELET_PRICES[curBracelet] ?? 0) - (BRACELET_PRICES[origBracelet] ?? 0);
    if (delta !== 0) {
      items.push({ label: `Замена браслета: ${BRACELET_LABELS[curBracelet] ?? curBracelet}`, stars: delta });
    } else {
      items.push({ label: `Браслет: ${BRACELET_LABELS[curBracelet] ?? curBracelet}`, stars: 0, isInfo: true });
    }

    if (cfg.handsEnabled === false) {
      items.push({ label: 'Без стрелок', stars: -1 });
    } else {
      items.push({ label: 'Стрелки: включены', stars: 0, isInfo: true });
    }

  } else {
    // ── Fallback path (old orders / no preset) ──
    items.push({ label: 'Базовая цена', stars: 5 });

    const geo = cfg.watchfaceGeometry ?? 'circle';
    const geoPrice = GEOMETRY_PRICES[geo] ?? 0;
    const geoLabel = GEOMETRY_LABELS[geo] ?? geo;
    const matLabel = MATERIAL_LABELS[cfg.watchfaceMaterial ?? ''] ?? (cfg.watchfaceMaterial ?? '');
    if (geoPrice > 0) {
      items.push({ label: `Форма: ${geoLabel}`, stars: geoPrice });
      items.push({ label: matLabel, stars: 0, isInfo: true });
    } else {
      items.push({ label: `Циферблат: ${geoLabel}, ${matLabel}`, stars: 0, isInfo: true });
    }

    const bracelet = cfg.braceletMaterial ?? 'metal_solid';
    const braceletPrice = BRACELET_PRICES[bracelet] ?? 0;
    const braceletLabel = BRACELET_LABELS[bracelet] ?? bracelet;
    if (braceletPrice > 0) {
      items.push({ label: braceletLabel, stars: braceletPrice });
    } else {
      items.push({ label: `Браслет: ${braceletLabel}`, stars: 0, isInfo: true });
    }

    if (cfg.handsEnabled === false) {
      items.push({ label: 'Без стрелок', stars: -1 });
    } else {
      items.push({ label: 'Стрелки: включены', stars: 0, isInfo: true });
    }
  }

  // ── Common add-ons ────────────────────────────────────────────────────────
  if (cfg.watchfaceText) items.push({ label: `Гравировка: "${cfg.watchfaceText}"`, stars: 1 });
  if (cfg.serialNumber)  items.push({ label: `Серийный №: ${cfg.serialNumber}`, stars: 0, isInfo: true });
  if (cfg.customWatchfaceUrl) items.push({ label: 'Кастомный циферблат', stars: 1 });
  if (cfg.skinFullUrl)   items.push({ label: 'Скин на корпус', stars: 1 });
  if (cfg.skinStripeUrl) items.push({ label: 'Скин на ремешок', stars: 1 });

  const box = cfg.boxType ?? 'standard';
  const boxPrice = BOX_PRICES[box] ?? 0;
  if (boxPrice > 0) {
    items.push({ label: BOX_LABELS[box] ?? `Коробка: ${box}`, stars: boxPrice });
  } else {
    items.push({ label: BOX_LABELS['standard'], stars: 0, isInfo: true });
  }

  if (cfg.giftWrap) items.push({ label: 'Атласная лента с бантом', stars: 40 });

  const total = Math.max(1,
    items.filter(i => !i.isInfo).reduce((s, i) => s + i.stars, 0),
  );
  return { breakdown: items, total };
}

export function formatReceiptText(breakdown: BreakdownItem[], total: number): string {
  const priceItems = breakdown.filter(i => !i.isInfo);
  const lines = priceItems.map((item, i) => {
    const sign = i === 0 ? `${item.stars}` : item.stars > 0 ? `+${item.stars}` : `${item.stars}`;
    return `  ${item.label}: ${sign} ⭐`;
  });
  return lines.join('\n') + '\n  ─────────────────\n' + `  *Итого: ${total} ⭐*`;
}
