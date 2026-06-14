import React, { useState, lazy, Suspense } from 'react';
import { useGetConfiguration } from '@workspace/api-client-react';
import { cn } from '@/lib/utils';
import { TgStar } from '@/components/TgStar';
import { ClipboardList, Check } from 'lucide-react';

const WatchBoxScene = lazy(() => import('@/components/WatchBoxScene'));

// ── Shared breakdown logic (mirrors api-server/src/lib/receipt.ts) ─────────

interface BreakdownItem { label: string; stars: number; isInfo?: boolean }

const BRACELET_PRICES: Record<string, number> = {
  plastic_solid: 0, plastic_segmented: 1, metal_solid: 3, metal_segmented: 4,
  resin: 2, leather: 3, cotton_fabric: 1,
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
const BOX_PRICES: Record<string, number> = { standard: 0, premium: 5, collector: 15 };
const BOX_LABELS: Record<string, string> = {
  standard: 'Стандартная коробка', premium: 'Коробка Премиум', collector: 'Коробка Коллекционная',
};

function buildBreakdown(cfg: any): { breakdown: BreakdownItem[]; total: number } {
  const items: BreakdownItem[] = [];

  if (cfg.presetPriceStars != null) {
    const baseLabel = cfg.presetName ? `Часы «${cfg.presetName}»` : 'Корпус часов';
    items.push({ label: baseLabel, stars: cfg.presetPriceStars });

    const geoLabel = GEOMETRY_LABELS[cfg.watchfaceGeometry] ?? cfg.watchfaceGeometry;
    const matLabel = MATERIAL_LABELS[cfg.watchfaceMaterial] ?? cfg.watchfaceMaterial;
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
    items.push({ label: 'Базовая цена', stars: 5 });

    const geo = cfg.watchfaceGeometry ?? 'circle';
    const geoPrice = GEOMETRY_PRICES[geo] ?? 0;
    const geoLabel = GEOMETRY_LABELS[geo] ?? geo;
    const matLabel = MATERIAL_LABELS[cfg.watchfaceMaterial] ?? cfg.watchfaceMaterial;
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

  if (cfg.giftWrap) items.push({ label: 'Атласная лента с бантом', stars: 2 });

  const total = Math.min(50, Math.max(1,
    items.filter(i => !i.isInfo).reduce((s, i) => s + i.stars, 0),
  ));
  return { breakdown: items, total };
}

// ── Component ──────────────────────────────────────────────────────────────

export interface ConfigReceiptProps {
  configId: number | null | undefined;
  totalStars?: number | null;
  alwaysOpen?: boolean;
  compact?: boolean;
}

export default function ConfigReceipt({ configId, totalStars, alwaysOpen, compact }: ConfigReceiptProps) {
  const [open, setOpen] = useState(false);
  const [boxOpen, setBoxOpen] = useState(false);
  const shouldFetch = alwaysOpen || open;

  const { data: cfg, isLoading } = useGetConfiguration(configId as number, {
    query: { enabled: !!configId && shouldFetch },
  } as any);

  if (!configId) return null;

  const receipt = cfg ? buildBreakdown(cfg as any) : null;
  const displayTotal = totalStars ?? receipt?.total ?? 0;

  if (alwaysOpen) {
    return <ReceiptBody receipt={receipt} displayTotal={displayTotal} isLoading={isLoading} compact={compact} />;
  }

  return (
    <div>
      <button
        onClick={() => setOpen(v => !v)}
        className={cn(
          'flex items-center gap-1.5 text-xs font-semibold transition-colors',
          compact
            ? 'text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg hover:bg-muted/40'
            : 'liquid-button px-3 py-1.5 mt-2'
        )}
      >
        <ClipboardList size={13} className="shrink-0" />
        {compact ? 'Состав' : 'Состав заказа'}
      </button>

      {open && (
        <div className={cn('mt-2', compact ? 'ml-0' : '')}>
          {!compact && cfg && (
            <Suspense fallback={null}>
              <WatchBoxScene
                config={{
                  watchfaceGeometry: (cfg as any).watchfaceGeometry,
                  watchfaceColor:    (cfg as any).watchfaceColor,
                  braceletMaterial:  (cfg as any).braceletMaterial,
                  braceletColor:     (cfg as any).braceletColor,
                  handsEnabled:      (cfg as any).handsEnabled,
                  handsColor:        (cfg as any).handsColor,
                }}
                boxType={(cfg as any).boxType ?? 'standard'}
                open={boxOpen}
                autoOpen
                onToggle={() => setBoxOpen(v => !v)}
                className="h-56 mb-3"
              />
            </Suspense>
          )}
          <ReceiptBody receipt={receipt} displayTotal={displayTotal} isLoading={isLoading} compact={compact} />
        </div>
      )}
    </div>
  );
}

// ── Receipt body ───────────────────────────────────────────────────────────

function StarBadge({ item, index }: { item: BreakdownItem; index: number }) {
  if (item.stars === 0) return null;
  const isBase = index === 0 && item.stars > 0;
  const cls = isBase
    ? 'text-foreground'
    : item.stars > 0 ? 'text-emerald-600' : 'text-blue-500';
  const sign = isBase ? '' : item.stars > 0 ? '+' : '';
  return (
    <span className={cn('font-bold tabular-nums font-mono whitespace-nowrap flex items-center gap-0.5', cls)}>
      {sign}{item.stars} <TgStar size={11} />
    </span>
  );
}

function ReceiptBody({
  receipt, displayTotal, isLoading, compact,
}: {
  receipt: { breakdown: BreakdownItem[]; total: number } | null;
  displayTotal: number;
  isLoading: boolean;
  compact?: boolean;
}) {
  if (isLoading) {
    return (
      <div className={cn('space-y-1.5', compact ? 'p-2' : 'p-3 liquid-glass rounded-2xl')}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-3 rounded bg-muted/60 animate-pulse" style={{ width: `${45 + i * 13}%` }} />
        ))}
      </div>
    );
  }
  if (!receipt) return null;

  const priceItems = receipt.breakdown.filter(i => !i.isInfo);

  if (compact) {
    return (
      <div className="rounded-xl overflow-hidden border border-border/40 text-[11px]">
        <table className="w-full">
          <tbody>
            {receipt.breakdown.map((item, i) => {
              const priceIdx = priceItems.indexOf(item);
              return (
                <tr key={i} className={cn(
                  'border-b border-border/20 last:border-0',
                  item.isInfo ? 'bg-muted/10' : ''
                )}>
                  <td className={cn('py-1 px-2.5', item.isInfo ? 'text-muted-foreground/70' : 'text-muted-foreground')}>
                    {item.isInfo
                      ? <span className="flex items-center gap-1"><Check size={10} className="text-muted-foreground/50 shrink-0" />{item.label}</span>
                      : item.label}
                  </td>
                  <td className="py-1 px-2.5 text-right tabular-nums whitespace-nowrap">
                    {item.isInfo ? (
                      <span className="text-muted-foreground/40 text-[10px]">—</span>
                    ) : (
                      <StarBadge item={item} index={priceIdx} />
                    )}
                  </td>
                </tr>
              );
            })}
            <tr className="bg-muted/20">
              <td className="py-1.5 px-2.5 font-black text-foreground">Итого</td>
              <td className="py-1.5 px-2.5 text-right font-black text-primary tabular-nums">
                <span className="flex items-center justify-end gap-0.5">{displayTotal} <TgStar size={11} /></span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="liquid-glass rounded-2xl overflow-hidden p-4">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-3">Состав заказа</p>
      <div className="space-y-1.5">
        {receipt.breakdown.map((item, i) => {
          const priceIdx = priceItems.indexOf(item);
          return (
            <div key={i} className={cn(
              'flex items-start justify-between gap-3 text-xs',
              item.isInfo ? 'text-muted-foreground/60' : ''
            )}>
              <span className="flex items-center gap-1.5">
                {item.isInfo && <Check size={10} className="shrink-0 mt-0.5 text-muted-foreground/40" />}
                {item.label}
              </span>
              {item.isInfo
                ? <span className="text-muted-foreground/30 text-[10px] shrink-0">—</span>
                : <StarBadge item={item} index={priceIdx} />}
            </div>
          );
        })}
      </div>
      <div className="border-t border-border/40 mt-3 pt-3 flex items-center justify-between">
        <span className="font-black text-foreground text-sm">Итого</span>
        <span className="font-black text-primary text-base tabular-nums flex items-center gap-0.5">
          {displayTotal} <TgStar size={13} />
        </span>
      </div>
    </div>
  );
}
