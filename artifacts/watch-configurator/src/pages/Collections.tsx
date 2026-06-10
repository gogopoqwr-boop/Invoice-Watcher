import React, { useState } from 'react';
import { useListPresets } from '@workspace/api-client-react';
import { useLocation, Link } from 'wouter';
import { useWatchConfig } from '@/hooks/use-watch-config';
import WatchSVG from '@/components/WatchSVG';

const PAGE_SIZE = 6;

export default function Collections() {
  const { data: presets, isLoading } = useListPresets();
  const [, setLocation] = useLocation();
  const { updateConfig } = useWatchConfig();
  const [page, setPage] = useState(0);

  const totalPages = Math.ceil((presets?.length ?? 0) / PAGE_SIZE);
  const pagePresets = presets?.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE) ?? [];

  const handleSelectPreset = (preset: any) => {
    updateConfig({
      presetId: preset.id,
      watchfaceGeometry: preset.watchfaceGeometry,
      watchfaceMaterial: preset.watchfaceMaterial,
      watchfaceColor: preset.watchfaceColor,
      braceletMaterial: preset.braceletMaterial,
      braceletType: preset.braceletType,
      braceletColor: preset.braceletColor,
      handsEnabled: preset.handsEnabled,
      handsColor: preset.handsColor ?? '#cbd5e1',
      watchfaceText: '',
      handsCount: 3,
    });
    setLocation('/configure');
  };

  return (
    <div className="min-h-[100dvh] bg-background relative overflow-hidden">
      {/* Ambient orb */}
      <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{ background: "var(--orb-1)", filter: "blur(100px)", opacity: 0.5 }} />

      <div className="relative z-10 max-w-5xl mx-auto px-6 py-8 md:py-12">
        {/* Header */}
        <div className="flex items-end justify-between mb-10">
          <div>
            <Link href="/">
              <button className="text-xs text-muted-foreground hover:text-foreground transition-colors mb-3 flex items-center gap-1 liquid-button px-3 py-1.5">
                ← Главная
              </button>
            </Link>
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground mb-1 animate-fade-up">
              Готовые коллекции
            </p>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight animate-fade-up delay-100">
              Коллекции
            </h1>
          </div>
          <div className="flex flex-col items-end gap-2 animate-fade-up delay-200">
            <Link href="/configure">
              <button className="liquid-button px-6 py-3 text-sm font-bold tracking-widest uppercase">
                С нуля →
              </button>
            </Link>
            <Link href="/orders">
              <button className="liquid-button px-4 py-2 text-xs font-semibold">
                📦 Мои заказы
              </button>
            </Link>
          </div>
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="liquid-glass rounded-3xl h-64 animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {(pagePresets as any[]).map((preset: any, idx: number) => (
                <button
                  key={preset.id}
                  onClick={() => handleSelectPreset(preset)}
                  className="liquid-glass rounded-3xl overflow-hidden text-left group focus:outline-none focus:ring-2 focus:ring-primary/40 animate-fade-up"
                  style={{ animationDelay: `${idx * 0.07}s` }}
                >
                  {/* Watch preview */}
                  <div
                    className="h-44 flex items-center justify-center overflow-hidden p-4 relative transition-transform duration-300 group-hover:scale-[1.03]"
                    style={{
                      background: `linear-gradient(135deg, ${preset.watchfaceColor}22, ${preset.braceletColor}18)`,
                    }}
                  >
                    <div className="w-24 h-40">
                      <WatchSVG
                        mini
                        config={{
                          watchfaceGeometry: preset.watchfaceGeometry as any,
                          watchfaceColor: preset.watchfaceColor,
                          braceletColor: preset.braceletColor,
                          braceletMaterial: preset.braceletMaterial as any,
                          braceletType: preset.braceletType as any,
                          handsEnabled: preset.handsEnabled,
                          handsColor: preset.handsColor ?? '#cbd5e1',
                          handsCount: 3,
                          watchfaceBackgroundType: 'solid',
                        }}
                      />
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-4">
                    <p className="font-bold text-sm tracking-tight truncate mb-0.5">{preset.name}</p>
                    {preset.description && (
                      <p className="text-xs text-muted-foreground truncate mb-1.5">{preset.description}</p>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-black text-primary">{preset.priceStars} ⭐</span>
                      <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                        Выбрать →
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-4 mt-8 animate-fade-up delay-300">
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="liquid-button w-10 h-10 flex items-center justify-center text-sm font-bold disabled:opacity-30"
                >
                  ‹
                </button>
                <span className="text-sm text-muted-foreground font-medium">
                  {page + 1} / {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page === totalPages - 1}
                  className="liquid-button w-10 h-10 flex items-center justify-center text-sm font-bold disabled:opacity-30"
                >
                  ›
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
