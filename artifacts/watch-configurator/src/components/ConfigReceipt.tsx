import React, { useState } from 'react';
import { useGetConfiguration } from '@workspace/api-client-react';
import { cn } from '@/lib/utils';

// ── Shared breakdown logic (mirrors api-server/src/lib/receipt.ts) ─────────

interface BreakdownItem { label: string; stars: number }

const GEOM_PRICES: Record<string, number> = { circle: 0, rounded: 0, square: 1 };
const GEOM_LABELS: Record<string, string> = {
  circle: 'Круглая форма', rounded: 'Скруглённая форма', square: 'Квадратная форма',
};
const MAT_PRICES: Record<string, number> = { plastic: 0, metal: 3 };
const MAT_LABELS: Record<string, string> = {
  plastic: 'Пластиковый корпус', metal: 'Металлический корпус',
};
const BRACELET_PRICES: Record<string, number> = {
  plastic_solid: 0, plastic_segmented: 1, metal_solid: 3, metal_segmented: 4,
  resin: 2, leather: 3, cotton_fabric: 1,
};
const BRACELET_LABELS: Record<string, string> = {
  plastic_solid: 'Пластиковый ремешок', plastic_segmented: 'Пластик сегментированный',
  metal_solid: 'Металлический браслет', metal_segmented: 'Металл сегментированный',
  resin: 'Смоляной ремешок', leather: 'Кожаный ремешок', cotton_fabric: 'Тканевый ремешок',
};
const BOX_PRICES: Record<string, number> = { standard: 0, premium: 5, collector: 15 };
const BOX_LABELS: Record<string, string> = {
  premium: 'Коробка Премиум', collector: 'Коробка Коллекционная',
};

function buildBreakdown(cfg: any): { breakdown: BreakdownItem[]; total: number } {
  const items: BreakdownItem[] = [{ label: 'Базовая цена', stars: 5 }];

  const geom = cfg.watchfaceGeometry ?? 'circle';
  const geomPrice = GEOM_PRICES[geom] ?? 0;
  if (geomPrice > 0) items.push({ label: GEOM_LABELS[geom] ?? geom, stars: geomPrice });

  const mat = cfg.watchfaceMaterial ?? 'metal';
  const matPrice = MAT_PRICES[mat] ?? 0;
  if (matPrice > 0) items.push({ label: MAT_LABELS[mat] ?? mat, stars: matPrice });

  const bracelet = cfg.braceletMaterial ?? 'metal_solid';
  const braceletPrice = BRACELET_PRICES[bracelet] ?? 0;
  if (braceletPrice > 0) items.push({ label: BRACELET_LABELS[bracelet] ?? bracelet, stars: braceletPrice });

  if (cfg.handsEnabled === false) items.push({ label: 'Без стрелок', stars: -1 });
  if (cfg.watchfaceText) items.push({ label: `Надпись: "${cfg.watchfaceText}"`, stars: 1 });
  if (cfg.customWatchfaceUrl) items.push({ label: 'Кастомный циферблат', stars: 1 });
  if (cfg.skinFullUrl) items.push({ label: 'Скин на корпус', stars: 1 });
  if (cfg.skinStripeUrl) items.push({ label: 'Скин на ремешок', stars: 1 });

  const box = cfg.boxType ?? 'standard';
  const boxPrice = BOX_PRICES[box] ?? 0;
  if (boxPrice > 0) items.push({ label: BOX_LABELS[box] ?? `Коробка: ${box}`, stars: boxPrice });

  const total = Math.min(50, Math.max(1, items.reduce((s, i) => s + i.stars, 0)));
  return { breakdown: items, total };
}

// ── Component ──────────────────────────────────────────────────────────────

export interface ConfigReceiptProps {
  configId: number | null | undefined;
  /** Authoritative total from the order — overrides the recalculated breakdown sum */
  totalStars?: number | null;
  /** If true, renders inline without a toggle (always open) */
  alwaysOpen?: boolean;
  /** Compact mode for admin table rows */
  compact?: boolean;
}

export default function ConfigReceipt({ configId, totalStars, alwaysOpen, compact }: ConfigReceiptProps) {
  const [open, setOpen] = useState(false);
  const shouldFetch = alwaysOpen || open;

  const { data: cfg, isLoading } = useGetConfiguration(configId as number, {
    query: { enabled: !!configId && shouldFetch },
  } as any);

  if (!configId) return null;

  const receipt = cfg ? buildBreakdown(cfg) : null;
  // Use the authoritative order total when provided; fall back to recalculated
  const displayTotal = totalStars ?? receipt?.total ?? 0;

  if (alwaysOpen) {
    return (
      <ReceiptBody receipt={receipt} displayTotal={displayTotal} isLoading={isLoading} compact={compact} />
    );
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
        <span>{open ? '▾' : '▸'}</span>
        {compact ? 'Состав' : '📋 Состав заказа'}
      </button>

      {open && (
        <div className={cn('mt-2', compact ? 'ml-0' : '')}>
          <ReceiptBody receipt={receipt} displayTotal={displayTotal} isLoading={isLoading} compact={compact} />
        </div>
      )}
    </div>
  );
}

function ReceiptBody({
  receipt,
  displayTotal,
  isLoading,
  compact,
}: {
  receipt: { breakdown: BreakdownItem[]; total: number } | null;
  displayTotal: number;
  isLoading: boolean;
  compact?: boolean;
}) {
  if (isLoading) {
    return (
      <div className={cn('space-y-1.5', compact ? 'p-2' : 'p-3 liquid-glass rounded-2xl')}>
        {[1, 2, 3].map(i => (
          <div key={i} className="h-3 rounded bg-muted/60 animate-pulse" style={{ width: `${55 + i * 12}%` }} />
        ))}
      </div>
    );
  }

  if (!receipt) return null;

  return (
    <div className={cn(
      'rounded-2xl overflow-hidden',
      compact ? 'border border-border/40 text-[11px]' : 'liquid-glass p-4 text-xs'
    )}>
      {compact ? (
        <table className="w-full">
          <tbody>
            {receipt.breakdown.map((item, i) => (
              <tr key={i} className="border-b border-border/20 last:border-0">
                <td className="py-1 px-2.5 text-muted-foreground">{item.label}</td>
                <td className="py-1 px-2.5 text-right font-mono font-bold tabular-nums whitespace-nowrap">
                  {item.label === 'Базовая цена'
                    ? <span className="text-foreground">{item.stars} ⭐</span>
                    : item.stars > 0
                      ? <span className="text-emerald-600">+{item.stars} ⭐</span>
                      : <span className="text-blue-500">{item.stars} ⭐</span>}
                </td>
              </tr>
            ))}
            <tr className="bg-muted/20">
              <td className="py-1.5 px-2.5 font-black text-foreground">Итого</td>
              <td className="py-1.5 px-2.5 text-right font-black text-primary tabular-nums">
                {displayTotal} ⭐
              </td>
            </tr>
          </tbody>
        </table>
      ) : (
        <div className="space-y-1.5">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">Состав заказа</p>
          {receipt.breakdown.map((item, i) => (
            <div key={i} className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">{item.label}</span>
              <span className={cn(
                'font-bold tabular-nums font-mono whitespace-nowrap',
                item.label === 'Базовая цена' ? 'text-foreground'
                  : item.stars > 0 ? 'text-emerald-600'
                  : 'text-blue-500'
              )}>
                {item.label === 'Базовая цена' ? `${item.stars} ⭐` : item.stars > 0 ? `+${item.stars} ⭐` : `${item.stars} ⭐`}
              </span>
            </div>
          ))}
          <div className="border-t border-border/40 mt-2 pt-2 flex items-center justify-between">
            <span className="font-black text-foreground text-sm">Итого</span>
            <span className="font-black text-primary text-base tabular-nums">{displayTotal} ⭐</span>
          </div>
        </div>
      )}
    </div>
  );
}
