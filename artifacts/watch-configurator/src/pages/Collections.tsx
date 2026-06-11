import React, { useState } from 'react';
import { useListPresets } from '@workspace/api-client-react';
import { useLocation, Link } from 'wouter';
import { useWatchConfig } from '@/hooks/use-watch-config';
import WatchSVG from '@/components/WatchSVG';

const PAGE_SIZE = 6;

const MAT_LABELS: Record<string, string> = {
  metal: 'Нержавейка',
  plastic: 'Пластик',
  metal_solid: 'Металл',
  metal_segmented: 'Сетка',
  plastic_solid: 'Резина',
  leather: 'Кожа',
  cotton_fabric: 'NATO нейлон',
  resin: 'Смола',
};

export default function Collections() {
  const { data: presets, isLoading } = useListPresets();
  const [, setLocation] = useLocation();
  const { updateConfig } = useWatchConfig();
  const [page, setPage] = useState(0);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const totalPages = Math.ceil((presets?.length ?? 0) / PAGE_SIZE);
  const pagePresets = presets?.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE) ?? [];

  const expandedPreset = expandedId !== null
    ? (presets as any[] | undefined)?.find((p: any) => p.id === expandedId) ?? null
    : null;

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
      <div className="absolute bottom-[-5%] left-[-5%] w-[400px] h-[400px] rounded-full pointer-events-none"
        style={{ background: "var(--orb-2)", filter: "blur(90px)", opacity: 0.35 }} />

      <div className="relative z-10 max-w-5xl mx-auto px-5 py-8 md:py-12">
        {/* Header */}
        <div className="flex items-end justify-between mb-8">
          <div>
            <Link href="/">
              <button className="text-xs text-muted-foreground hover:text-foreground transition-colors mb-3 flex items-center gap-1 liquid-button px-3 py-1.5">
                ← Назад
              </button>
            </Link>
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground mb-1 animate-fade-up">
              Чеблячас · Коллекции
            </p>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight animate-fade-up delay-100">
              Готовые<br/>коллекции
            </h1>
          </div>
          <div className="flex flex-col items-end gap-2 animate-fade-up delay-200">
            <button
              disabled
              className="liquid-button px-6 py-3 text-sm font-bold tracking-widest uppercase opacity-30 cursor-not-allowed"
              title="Конфигуратор временно недоступен"
            >
              С нуля —
            </button>
            <p className="text-[10px] text-muted-foreground/50 tracking-wider text-right">скоро</p>
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
              <div key={i} className="liquid-glass rounded-3xl h-72 animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {(pagePresets as any[]).map((preset: any, idx: number) => {
                const isExpanded = expandedId === preset.id;
                return (
                  <button
                    key={preset.id}
                    onClick={() => setExpandedId(isExpanded ? null : preset.id)}
                    className="liquid-glass rounded-3xl overflow-hidden text-left group focus:outline-none focus:ring-2 focus:ring-primary/40 animate-fade-up transition-all duration-300"
                    style={{
                      animationDelay: `${idx * 0.07}s`,
                      transform: isExpanded ? 'scale(1.03)' : 'scale(1)',
                      boxShadow: isExpanded ? '0 8px 40px rgba(99,102,241,0.25)' : undefined,
                      border: isExpanded ? '1.5px solid rgba(99,102,241,0.4)' : undefined,
                    }}
                  >
                    {/* Watch preview */}
                    <div
                      className="h-48 flex items-center justify-center overflow-hidden p-4 relative transition-transform duration-300 group-hover:scale-[1.04]"
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
                      {/* Price badge */}
                      <div className="absolute top-2 right-2 bg-black/40 backdrop-blur-sm rounded-full px-2 py-0.5 text-xs font-black text-yellow-300">
                        {preset.priceStars} ⭐
                      </div>
                    </div>

                    {/* Info */}
                    <div className="p-4">
                      <p className="font-black text-sm tracking-tight mb-0.5">{preset.name}</p>
                      {preset.description && (
                        <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{preset.description}</p>
                      )}

                      {/* Expanded materials view */}
                      <div
                        className="overflow-hidden transition-all duration-300"
                        style={{ maxHeight: isExpanded ? '200px' : '0px', opacity: isExpanded ? 1 : 0 }}
                      >
                        <div className="border-t border-border/30 pt-2 mb-3 space-y-1">
                          <div className="flex justify-between text-[11px]">
                            <span className="text-muted-foreground">Корпус</span>
                            <span className="font-semibold">{MAT_LABELS[preset.watchfaceMaterial] ?? preset.watchfaceMaterial}</span>
                          </div>
                          <div className="flex justify-between text-[11px]">
                            <span className="text-muted-foreground">Ремешок</span>
                            <span className="font-semibold">{MAT_LABELS[preset.braceletMaterial] ?? preset.braceletMaterial}</span>
                          </div>
                          <div className="flex justify-between text-[11px]">
                            <span className="text-muted-foreground">Форма</span>
                            <span className="font-semibold capitalize">{preset.watchfaceGeometry}</span>
                          </div>
                          <div className="flex justify-between text-[11px]">
                            <span className="text-muted-foreground">Стрелки</span>
                            <span className="font-semibold">{preset.handsEnabled ? '✓' : '✗'}</span>
                          </div>
                        </div>
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={(e) => { e.stopPropagation(); handleSelectPreset(preset); }}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); handleSelectPreset(preset); } }}
                          className="w-full py-2 rounded-xl bg-primary text-white text-xs font-bold tracking-widest uppercase text-center cursor-pointer hover:bg-primary/90 transition-colors active:scale-[0.98]"
                        >
                          Выбрать эту коллекцию →
                        </div>
                      </div>

                      {!isExpanded && (
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-[10px] text-muted-foreground uppercase tracking-widest">
                            {MAT_LABELS[preset.braceletMaterial] ?? preset.braceletMaterial}
                          </span>
                          <span className="text-xs text-primary font-bold group-hover:text-primary/80 transition-colors">
                            Смотреть →
                          </span>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
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

      {/* Expanded preset fullscreen overlay */}
      {expandedPreset && (
        <div
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4 md:p-8"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(12px)' }}
          onClick={() => setExpandedId(null)}
        >
          <div
            className="liquid-glass rounded-3xl w-full max-w-sm md:max-w-md overflow-hidden animate-fade-up"
            onClick={e => e.stopPropagation()}
          >
            {/* Big watch preview */}
            <div
              className="h-64 flex items-center justify-center relative"
              style={{
                background: `linear-gradient(135deg, ${expandedPreset.watchfaceColor}33, ${expandedPreset.braceletColor}22)`,
              }}
            >
              <div className="w-32 h-52">
                <WatchSVG
                  config={{
                    watchfaceGeometry: expandedPreset.watchfaceGeometry as any,
                    watchfaceColor: expandedPreset.watchfaceColor,
                    braceletColor: expandedPreset.braceletColor,
                    braceletMaterial: expandedPreset.braceletMaterial as any,
                    braceletType: expandedPreset.braceletType as any,
                    handsEnabled: expandedPreset.handsEnabled,
                    handsColor: expandedPreset.handsColor ?? '#cbd5e1',
                    handsCount: 3,
                    watchfaceBackgroundType: 'solid',
                  }}
                />
              </div>
              <button
                onClick={() => setExpandedId(null)}
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/40 text-white text-sm flex items-center justify-center hover:bg-black/60 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Details */}
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-2xl font-black tracking-tight">{expandedPreset.name}</h2>
                  {expandedPreset.description && (
                    <p className="text-sm text-muted-foreground mt-1">{expandedPreset.description}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black text-yellow-400">{expandedPreset.priceStars}</p>
                  <p className="text-xs text-muted-foreground">⭐ звёзд</p>
                </div>
              </div>

              {/* Materials grid */}
              <div className="grid grid-cols-2 gap-2 mb-5">
                {[
                  ['Корпус', MAT_LABELS[expandedPreset.watchfaceMaterial] ?? expandedPreset.watchfaceMaterial],
                  ['Ремешок', MAT_LABELS[expandedPreset.braceletMaterial] ?? expandedPreset.braceletMaterial],
                  ['Форма', expandedPreset.watchfaceGeometry],
                  ['Стрелки', expandedPreset.handsEnabled ? '3 стрелки' : 'без стрелок'],
                ].map(([k, v]) => (
                  <div key={k} className="bg-white/5 rounded-xl px-3 py-2">
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-0.5">{k}</p>
                    <p className="text-sm font-bold capitalize">{v}</p>
                  </div>
                ))}
              </div>

              <button
                onClick={() => handleSelectPreset(expandedPreset)}
                className="w-full py-3.5 rounded-2xl bg-primary text-white font-black text-sm tracking-widest uppercase shadow-lg hover:bg-primary/90 active:scale-[0.98] transition-all"
              >
                Выбрать эту коллекцию →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
