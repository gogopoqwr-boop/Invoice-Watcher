import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useListPresets, useGetMyOrders } from '@workspace/api-client-react';
import { useLocation, Link } from 'wouter';
import { useWatchConfig } from '@/hooks/use-watch-config';
import WatchMiniCanvas from '@/components/WatchMiniCanvas';
import WatchFullscreenViewer, { BRACELET_COMBOS } from '@/components/WatchFullscreenViewer';
import { cn } from '@/lib/utils';

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

const COLLECTION_ORDER = ['РОФЛ', 'ГИПЕРСЕРЬЕЗНОСТЬ', 'ЖИВНОСТЬ'];
const MAX_PER_COLLECTION = 6;

type InventoryData = Record<string, { sold: number; max: number }>;

function useTilt() {
  const [tilt, setTilt] = useState<{ rx: number; ry: number } | null>(null);
  const onMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ rx: y * 12, ry: x * -12 });
  }, []);
  const onLeave = useCallback(() => setTilt(null), []);
  return { tilt, onMove, onLeave };
}

export default function Collections() {
  const { data: presets, isLoading } = useListPresets();
  const [, setLocation] = useLocation();
  const { updateConfig, sessionId } = useWatchConfig();
  const [fullscreenPreset, setFullscreenPreset] = useState<{ preset: any; rect: DOMRect } | null>(null);
  const { data: myOrders } = useGetMyOrders({ sessionId }, { query: { enabled: !!sessionId } } as any);
  const hasOrders = Array.isArray(myOrders) && (myOrders as any[]).length > 0;

  const [buyModal, setBuyModal] = useState<any | null>(null);
  const [buyStrapColor, setBuyStrapColor] = useState('');
  const [buyStrapMat, setBuyStrapMat] = useState('leather');
  const [buying, setBuying] = useState(false);
  const [buyError, setBuyError] = useState('');

  const [inventory, setInventory] = useState<InventoryData>({});
  const [activeIdx, setActiveIdx] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isScrolling = useRef(false);

  useEffect(() => {
    fetch('/api/presets/inventory')
      .then(r => r.json())
      .then(data => { if (data?.byCollection) setInventory(data.byCollection); })
      .catch(() => {});
  }, []);

  const allPresets = (presets as any[] | undefined) ?? [];
  const classics = allPresets.filter((p: any) => !p.collectionName);

  const collections: Array<{ name: string | null; displayName: string; items: any[] }> = [
    ...COLLECTION_ORDER.map(name => ({
      name,
      displayName: name,
      items: allPresets.filter((p: any) => p.collectionName === name).slice(0, MAX_PER_COLLECTION),
    })).filter(g => g.items.length > 0),
    ...(classics.length > 0 ? [{ name: null, displayName: 'КЛАССИКА', items: classics.slice(0, MAX_PER_COLLECTION) }] : []),
  ];

  const scrollToCollection = useCallback((idx: number) => {
    if (!scrollRef.current) return;
    isScrolling.current = true;
    const container = scrollRef.current;
    container.scrollTo({ left: idx * container.clientWidth, behavior: 'smooth' });
    setActiveIdx(idx);
    setTimeout(() => { isScrolling.current = false; }, 600);
  }, []);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const handleScroll = () => {
      if (isScrolling.current) return;
      const idx = Math.round(container.scrollLeft / container.clientWidth);
      setActiveIdx(idx);
    };
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  const handleSelectPreset = (preset: any) => {
    updateConfig({
      presetId: preset.id,
      collectionName: preset.collectionName ?? undefined,
      watchfaceGeometry: preset.watchfaceGeometry,
      watchfaceMaterial: preset.watchfaceMaterial,
      watchfaceColor: preset.watchfaceColor,
      braceletMaterial: preset.braceletMaterial,
      braceletType: preset.braceletType,
      braceletColor: preset.braceletColor,
      handsEnabled: preset.handsEnabled,
      handsColor: preset.handsColor ?? '#cbd5e1',
      watchfaceText: preset.watchfaceText ?? '',
      watchfaceTextMode: preset.watchfaceTextMode ?? 'center',
      handsCount: 3,
    });
    setLocation('/configure');
  };

  const handleBuyOpen = (e: React.MouseEvent, preset: any) => {
    e.stopPropagation();
    setBuyModal(preset);
    setBuyStrapColor(preset.braceletColor);
    setBuyStrapMat(preset.braceletMaterial ?? 'leather');
    setBuyError('');
  };

  const handleBuyConfirm = async () => {
    if (!buyModal || buying) return;
    setBuying(true);
    setBuyError('');
    try {
      const cfgRes = await fetch('/api/configurations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          presetId: buyModal.id,
          watchfaceGeometry: buyModal.watchfaceGeometry,
          watchfaceMaterial: buyModal.watchfaceMaterial,
          watchfaceColor: buyModal.watchfaceColor,
          braceletMaterial: buyStrapMat || buyModal.braceletMaterial,
          braceletType: buyModal.braceletType,
          braceletColor: buyStrapColor,
          handsEnabled: buyModal.handsEnabled,
          handsColor: buyModal.handsColor ?? '#FFFFFF',
          handsStyle: buyModal.watchfaceText ?? '',
          serialNumber: null,
        }),
      });
      if (!cfgRes.ok) throw new Error('config');
      const cfg = await cfgRes.json();

      const priceRes = await fetch('/api/prices/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          watchfaceMaterial: buyModal.watchfaceMaterial,
          braceletMaterial: buyStrapMat || buyModal.braceletMaterial,
          handsEnabled: buyModal.handsEnabled,
        }),
      });
      if (!priceRes.ok) throw new Error('price');
      const price = await priceRes.json();

      const orderRes = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          configId: cfg.id,
          sessionId,
          totalStars: price.totalStars ?? buyModal.priceStars,
        }),
      });
      if (!orderRes.ok) throw new Error('order');
      const order = await orderRes.json();

      setLocation(`/payment/${order.id}`);
    } catch {
      setBuyError('Не удалось создать заказ. Попробуйте ещё раз.');
    } finally {
      setBuying(false);
    }
  };

  const PresetCard = ({ preset, idx }: { preset: any; idx: number }) => {
    const { tilt, onMove, onLeave } = useTilt();
    const collectionKey = preset.collectionName ?? 'classics';
    const inv = inventory[collectionKey];
    const soldOut = inv ? inv.sold >= inv.max : false;
    const [expanding, setExpanding] = useState(false);

    const handleCardClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      const root = e.currentTarget.closest('[data-card-root]');
      if (!root) return;
      setExpanding(true);
      const rect = root.getBoundingClientRect();
      setTimeout(() => {
        setExpanding(false);
        setFullscreenPreset({ preset, rect: rect as DOMRect });
      }, 180);
    };

    return (
      <div
        data-card-root
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        className="relative"
        style={{
          transform: expanding
            ? 'perspective(800px) scale(1.06)'
            : tilt
              ? `perspective(800px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg) scale(1.03)`
              : 'perspective(800px) rotateX(0deg) rotateY(0deg) scale(1)',
          transition: expanding
            ? 'transform 0.18s cubic-bezier(0.4,0,0.2,1)'
            : tilt
              ? 'transform 0.05s ease-out'
              : 'transform 0.35s cubic-bezier(0.4,0,0.2,1)',
          zIndex: expanding ? 10 : 'auto',
        }}
      >
        <button
          onClick={handleCardClick}
          className="liquid-glass rounded-3xl overflow-hidden text-left group focus:outline-none focus:ring-2 focus:ring-primary/40 animate-fade-up transition-all duration-300 w-full"
          style={{ animationDelay: `${idx * 0.06}s` }}
        >
          <div
            className="h-52 overflow-hidden relative"
            style={{ background: `linear-gradient(135deg, ${preset.watchfaceColor}22, ${preset.braceletColor}18)` }}
          >
            <WatchMiniCanvas preset={preset} />

            {/* Watch name text overlay */}
            <div className="absolute bottom-0 left-0 right-0 px-3 py-2.5"
              style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 100%)' }}>
              <p className="text-white text-xs font-black tracking-tight leading-tight line-clamp-1">
                {preset.name}
              </p>
            </div>

            {soldOut && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-t-3xl">
                <span className="text-white text-xs font-black uppercase tracking-widest bg-black/60 px-3 py-1.5 rounded-full">
                  Распродано
                </span>
              </div>
            )}
          </div>

          <div className="px-3 pb-2 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground uppercase tracking-widest">
                {MAT_LABELS[preset.braceletMaterial] ?? preset.braceletMaterial}
              </span>
              <span className="text-xs text-primary font-bold group-hover:text-primary/80 transition-colors">
                Смотреть →
              </span>
            </div>
          </div>
        </button>

        <div
          role="button"
          tabIndex={0}
          onClick={(e) => handleBuyOpen(e, preset)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleBuyOpen(e as any, preset); }}
          className={cn(
            'mt-2 w-full py-2.5 rounded-2xl text-xs font-black tracking-widest uppercase text-center cursor-pointer transition-all',
            soldOut
              ? 'opacity-30 cursor-not-allowed bg-muted text-muted-foreground border border-border pointer-events-none'
              : 'bg-primary text-white hover:bg-primary/90 active:scale-[0.98] shadow-md shadow-primary/20'
          )}
          aria-disabled={soldOut}
        >
          {soldOut ? 'Распродано' : 'КУПИТЬ'}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-[100dvh] bg-background relative overflow-hidden">
      <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{ background: 'var(--orb-1)', filter: 'blur(100px)', opacity: 0.5 }} />
      <div className="absolute bottom-[-5%] left-[-5%] w-[400px] h-[400px] rounded-full pointer-events-none"
        style={{ background: 'var(--orb-2)', filter: 'blur(90px)', opacity: 0.35 }} />

      <div className="relative z-10 flex flex-col min-h-[100dvh]">
        {/* Header */}
        <div className="px-5 py-6 md:px-10 md:py-8 shrink-0">
          <div className="flex items-end justify-between max-w-6xl mx-auto">
            <div>
              <Link href="/">
                <button className="text-xs text-muted-foreground hover:text-foreground transition-colors mb-3 flex items-center gap-1 liquid-button px-3 py-1.5">
                  ← Назад
                </button>
              </Link>
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground mb-1 animate-fade-up">
                ЧЕБЛЯЧАС · КОЛЛЕКЦИИ
              </p>
              <h1 className="text-4xl md:text-5xl font-black tracking-tight animate-fade-up">
                Готовые коллекции
              </h1>
            </div>
            <div className="flex flex-col items-end gap-2 animate-fade-up">
              {hasOrders && (
                <Link href="/orders">
                  <button className="liquid-button px-4 py-2 text-xs font-semibold">
                    Мои заказы
                  </button>
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Collection navigation */}
        {!isLoading && collections.length > 0 && (
          <div className="px-5 md:px-10 mb-5 shrink-0 max-w-6xl mx-auto w-full">
            <div className="flex items-center gap-1">
              {collections.map((c, i) => (
                <button
                  key={i}
                  onClick={() => scrollToCollection(i)}
                  className={cn(
                    'text-xs font-black tracking-widest uppercase transition-all px-3 py-1.5 rounded-full',
                    activeIdx === i
                      ? 'text-foreground'
                      : 'text-muted-foreground/40 hover:text-muted-foreground'
                  )}
                >
                  {c.displayName}
                </button>
              ))}
            </div>
            {/* Progress bar */}
            <div className="mt-2 h-px bg-border/30 relative rounded-full overflow-hidden">
              <div
                className="absolute top-0 left-0 h-full bg-primary rounded-full transition-all duration-500 ease-out"
                style={{
                  width: `${100 / Math.max(collections.length, 1)}%`,
                  transform: `translateX(${activeIdx * 100}%)`,
                }}
              />
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="px-5 md:px-10 max-w-6xl mx-auto w-full">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="liquid-glass rounded-3xl h-64 animate-pulse" />
              ))}
            </div>
          </div>
        ) : (
          /* Horizontal snap scroll container */
          <div className="relative flex-1">
            {/* Prev arrow */}
            {activeIdx > 0 && (
              <button
                onClick={() => scrollToCollection(activeIdx - 1)}
                className="absolute left-2 md:left-5 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full liquid-glass flex items-center justify-center text-foreground hover:scale-110 transition-all shadow-lg"
              >
                ←
              </button>
            )}
            {/* Next arrow */}
            {activeIdx < collections.length - 1 && (
              <button
                onClick={() => scrollToCollection(activeIdx + 1)}
                className="absolute right-2 md:right-5 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full liquid-glass flex items-center justify-center text-foreground hover:scale-110 transition-all shadow-lg"
              >
                →
              </button>
            )}

            <div
              ref={scrollRef}
              className="flex overflow-x-auto scrollbar-none"
              style={{ scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' }}
            >
              {collections.map((group, gi) => (
                <section
                  key={group.name ?? '__classics'}
                  style={{ scrollSnapAlign: 'start', minWidth: '100%' }}
                  className="px-5 md:px-16 pb-12"
                >
                  <div className="max-w-5xl mx-auto">
                    <div className="mb-6">
                      <h2 className="text-3xl md:text-4xl font-black tracking-tight">
                        {group.displayName}
                      </h2>
                      <p className="text-xs text-muted-foreground/50 mt-1 uppercase tracking-widest">
                        {group.items.length} моделей
                      </p>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {group.items.map((preset: any, idx: number) => (
                        <PresetCard key={preset.id} preset={preset} idx={idx} />
                      ))}
                    </div>
                  </div>
                </section>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Fullscreen 3D Viewer */}
      {fullscreenPreset && (
        <WatchFullscreenViewer
          preset={fullscreenPreset.preset}
          originRect={fullscreenPreset.rect}
          onClose={() => setFullscreenPreset(null)}
          onBuy={(p, color, mat) => {
            setFullscreenPreset(null);
            setBuyModal(p);
            setBuyStrapColor(color);
            setBuyStrapMat(mat);
            setBuyError('');
          }}
          onConfigure={(p) => {
            setFullscreenPreset(null);
            handleSelectPreset(p);
          }}
        />
      )}

      {/* КУПИТЬ modal */}
      {buyModal && (
        <div
          className="fixed inset-0 z-[60] flex items-end md:items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(24px)' }}
          onClick={() => { if (!buying) setBuyModal(null); }}
        >
          <div
            className="liquid-glass rounded-3xl w-full max-w-sm overflow-hidden animate-fade-up"
            onClick={e => e.stopPropagation()}
          >
            <div
              className="h-44 flex items-center justify-center relative"
              style={{ background: `linear-gradient(135deg, ${buyModal.watchfaceColor}33, ${buyStrapColor}22)` }}
            >
              <div className="w-28 h-36 flex items-center justify-center">
                <WatchMiniCanvas preset={{ ...buyModal, braceletColor: buyStrapColor, braceletMaterial: buyStrapMat }} />
              </div>
              <button
                onClick={() => setBuyModal(null)}
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/40 text-white text-sm flex items-center justify-center hover:bg-black/60 transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="p-5">
              <h3 className="text-lg font-black mb-0.5">{buyModal.name}</h3>
              <p className="text-xs text-muted-foreground mb-3">Выберите ремешок</p>

              <div className="grid grid-cols-4 gap-1.5 mb-4 max-h-40 overflow-y-auto pr-1">
                {BRACELET_COMBOS.map(combo => {
                  const active = buyStrapColor === combo.color && buyStrapMat === combo.material;
                  return (
                    <button
                      key={combo.id}
                      onClick={() => { setBuyStrapColor(combo.color); setBuyStrapMat(combo.material); }}
                      className={cn(
                        'flex flex-col items-center gap-1 p-1.5 rounded-xl transition-all',
                        active ? 'ring-2 ring-primary bg-primary/10' : 'hover:bg-white/5'
                      )}
                    >
                      <div
                        className="w-6 h-6 rounded-full border-2"
                        style={{ backgroundColor: combo.color, borderColor: active ? 'var(--primary)' : 'rgba(255,255,255,0.2)' }}
                      />
                      <span className="text-[9px] text-muted-foreground leading-tight text-center line-clamp-2">
                        {combo.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              {buyError && (
                <p className="text-xs text-red-500 mb-3 font-semibold">{buyError}</p>
              )}

              <button
                onClick={handleBuyConfirm}
                disabled={buying}
                className="w-full py-3.5 rounded-2xl bg-primary text-white font-black text-sm tracking-widest uppercase shadow-lg hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-60"
              >
                {buying ? 'Оформляем…' : `Оформить заказ`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
