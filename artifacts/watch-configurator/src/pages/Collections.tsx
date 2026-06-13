import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useListPresets, useGetMyOrders } from '@workspace/api-client-react';
import { useLocation, Link } from 'wouter';
import { useWatchConfig } from '@/hooks/use-watch-config';
import WatchMiniCanvas from '@/components/WatchMiniCanvas';
import WatchFullscreenViewer, { BRACELET_COMBOS } from '@/components/WatchFullscreenViewer';
import { cn } from '@/lib/utils';

const MAT_LABELS: Record<string, string> = {
  metal: 'Нержавейка', plastic: 'Пластик', metal_solid: 'Металл',
  metal_segmented: 'Сетка', plastic_solid: 'Резина', leather: 'Кожа',
  cotton_fabric: 'NATO нейлон', resin: 'Смола',
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
    setTilt({ rx: y * 10, ry: x * -10 });
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

  // ── Page / slide state ──────────────────────────────────────────────────
  const [active, setActive] = useState(0);
  const [animating, setAnimating] = useState(false);
  const lastWheelTs = useRef(0);
  const touchStartY = useRef<number | null>(null);

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
      name, displayName: name,
      items: allPresets.filter((p: any) => p.collectionName === name).slice(0, MAX_PER_COLLECTION),
    })).filter(g => g.items.length > 0),
    ...(classics.length > 0 ? [{ name: null, displayName: 'КЛАССИКА', items: classics.slice(0, MAX_PER_COLLECTION) }] : []),
  ];

  const navigate = useCallback((dir: 1 | -1) => {
    setActive(prev => {
      const next = prev + dir;
      if (next < 0 || next >= collections.length) return prev;
      setAnimating(true);
      setTimeout(() => setAnimating(false), 650);
      return next;
    });
  }, [collections.length]);

  // Wheel scroll
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (fullscreenPreset || buyModal) return;
      const now = Date.now();
      if (now - lastWheelTs.current < 900) return;
      if (Math.abs(e.deltaY) < 30) return;
      lastWheelTs.current = now;
      navigate(e.deltaY > 0 ? 1 : -1);
    };
    window.addEventListener('wheel', onWheel, { passive: true });
    return () => window.removeEventListener('wheel', onWheel);
  }, [navigate, fullscreenPreset, buyModal]);

  // Touch swipe
  useEffect(() => {
    const onStart = (e: TouchEvent) => { touchStartY.current = e.touches[0].clientY; };
    const onEnd = (e: TouchEvent) => {
      if (touchStartY.current === null || fullscreenPreset || buyModal) return;
      const dy = touchStartY.current - e.changedTouches[0].clientY;
      touchStartY.current = null;
      if (Math.abs(dy) < 40) return;
      navigate(dy > 0 ? 1 : -1);
    };
    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchend', onEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchend', onEnd);
    };
  }, [navigate, fullscreenPreset, buyModal]);

  // Keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') navigate(1);
      if (e.key === 'ArrowUp') navigate(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);

  const handleSelectPreset = (preset: any) => {
    updateConfig({
      presetId: preset.id, collectionName: preset.collectionName ?? undefined,
      watchfaceGeometry: preset.watchfaceGeometry, watchfaceMaterial: preset.watchfaceMaterial,
      watchfaceColor: preset.watchfaceColor, braceletMaterial: preset.braceletMaterial,
      braceletType: preset.braceletType, braceletColor: preset.braceletColor,
      handsEnabled: preset.handsEnabled, handsColor: preset.handsColor ?? '#cbd5e1',
      watchfaceText: preset.watchfaceText ?? '', watchfaceTextMode: preset.watchfaceTextMode ?? 'center',
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
    setBuying(true); setBuyError('');
    try {
      const cfgRes = await fetch('/api/configurations', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId, presetId: buyModal.id,
          watchfaceGeometry: buyModal.watchfaceGeometry, watchfaceMaterial: buyModal.watchfaceMaterial,
          watchfaceColor: buyModal.watchfaceColor, braceletMaterial: buyStrapMat || buyModal.braceletMaterial,
          braceletType: buyModal.braceletType, braceletColor: buyStrapColor,
          handsEnabled: buyModal.handsEnabled, handsColor: buyModal.handsColor ?? '#FFFFFF',
          handsStyle: buyModal.watchfaceText ?? '', serialNumber: null,
        }),
      });
      if (!cfgRes.ok) throw new Error('config');
      const cfg = await cfgRes.json();

      const priceRes = await fetch('/api/prices/calculate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          watchfaceMaterial: buyModal.watchfaceMaterial,
          braceletMaterial: buyStrapMat || buyModal.braceletMaterial,
          handsEnabled: buyModal.handsEnabled,
        }),
      });
      if (!priceRes.ok) throw new Error('price');
      const price = await priceRes.json();

      const orderRes = await fetch('/api/orders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ configId: cfg.id, sessionId, totalStars: price.totalStars ?? buyModal.priceStars }),
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

  const PresetCard = ({ preset, idx, bgPaused, forceMount }: { preset: any; idx: number; bgPaused: boolean; forceMount?: boolean }) => {
    const { tilt, onMove, onLeave } = useTilt();
    const collectionKey = preset.collectionName ?? 'classics';
    const inv = inventory[collectionKey];
    const soldOut = inv ? inv.sold >= inv.max : false;
    const [expanding, setExpanding] = useState(false);

    const handleCardClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      const root = e.currentTarget.closest('[data-card-root]') as HTMLElement | null;
      if (!root) return;
      setExpanding(true);
      const rect = root.getBoundingClientRect();
      setTimeout(() => {
        setExpanding(false);
        setFullscreenPreset({ preset, rect: rect as DOMRect });
      }, 160);
    };

    return (
      <div
        data-card-root
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        className="relative"
        style={{
          transform: expanding
            ? 'perspective(800px) scale(1.05)'
            : tilt
              ? `perspective(800px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg) scale(1.03)`
              : 'perspective(800px) scale(1)',
          transition: expanding ? 'transform 0.16s ease' : tilt ? 'transform 0.05s ease-out' : 'transform 0.3s ease',
          zIndex: expanding ? 10 : 'auto',
        }}
      >
        <button
          onClick={handleCardClick}
          className="liquid-glass rounded-2xl overflow-hidden text-left group focus:outline-none w-full"
          style={{ animationDelay: `${idx * 0.05}s` }}
        >
          <div
            className="h-32 overflow-hidden relative"
            style={{ background: `linear-gradient(135deg, ${preset.watchfaceColor}22, ${preset.braceletColor}18)` }}
          >
            <WatchMiniCanvas preset={preset} paused={bgPaused} forceMount={forceMount} />
            <div
              className="absolute bottom-0 left-0 right-0 px-2.5 py-2"
              style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 100%)' }}
            >
              <p className="text-white text-[11px] font-black tracking-tight leading-tight line-clamp-1">{preset.name}</p>
            </div>
            {soldOut && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <span className="text-white text-[10px] font-black uppercase tracking-widest bg-black/60 px-2 py-1 rounded-full">Распродано</span>
              </div>
            )}
          </div>
          <div className="px-2.5 py-1.5 flex items-center justify-between">
            <span className="text-[9px] text-muted-foreground uppercase tracking-widest truncate">
              {MAT_LABELS[preset.braceletMaterial] ?? preset.braceletMaterial}
            </span>
            <span className="text-[9px] text-primary/60 font-semibold ml-1 shrink-0">Смотреть</span>
          </div>
        </button>
        <div
          role="button"
          tabIndex={0}
          onClick={(e) => handleBuyOpen(e, preset)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleBuyOpen(e as any, preset); }}
          className={cn(
            'mt-1.5 w-full py-2 rounded-xl text-[10px] font-black tracking-widest uppercase text-center cursor-pointer transition-all',
            soldOut
              ? 'opacity-30 cursor-not-allowed bg-muted text-muted-foreground pointer-events-none'
              : 'bg-primary text-white hover:bg-primary/90 active:scale-[0.97]'
          )}
          aria-disabled={soldOut}
        >
          {soldOut ? 'Распродано' : 'КУПИТЬ'}
        </div>
      </div>
    );
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 overflow-hidden bg-background">
      {/* Background orbs */}
      <div className="fixed top-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{ background: 'var(--orb-1)', filter: 'blur(100px)', opacity: 0.35 }} />
      <div className="fixed bottom-[-5%] left-[-5%] w-[400px] h-[400px] rounded-full pointer-events-none"
        style={{ background: 'var(--orb-2)', filter: 'blur(90px)', opacity: 0.22 }} />

      {/* Floating nav */}
      <div className="fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-5 py-4">
        <Link href="/">
          <button className="text-xs text-muted-foreground hover:text-foreground transition-colors liquid-button px-3 py-1.5">
            Назад
          </button>
        </Link>
        {hasOrders && (
          <Link href="/orders">
            <button className="liquid-button px-4 py-2 text-xs font-semibold">Мои заказы</button>
          </Link>
        )}
      </div>

      {/* Slide track */}
      {isLoading ? (
        <div className="flex items-center justify-center h-full">
          <div className="grid grid-cols-3 gap-3 px-5 w-full max-w-md">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="liquid-glass rounded-2xl h-44 animate-pulse" />
            ))}
          </div>
        </div>
      ) : (
        <div className="relative w-full h-full">
          {collections.map((group, gi) => {
            const offset = gi - active;
            return (
              <div
                key={group.name ?? '__classics'}
                className="absolute inset-0 flex flex-col"
                style={{
                  transform: `translateY(${offset * 100}%)`,
                  transition: 'transform 0.62s cubic-bezier(0.16,1,0.3,1)',
                  willChange: 'transform',
                  pointerEvents: gi === active ? 'auto' : 'none',
                }}
              >
                {/* Collection name — large watermark */}
                <div className="pt-16 pb-3 px-5 flex-none">
                  <h2
                    className="font-black tracking-tight leading-none"
                    style={{ fontSize: 'clamp(2rem, 8vw, 3.5rem)' }}
                  >
                    {group.displayName}
                  </h2>
                  <p className="text-[10px] text-muted-foreground/40 uppercase tracking-widest mt-1">
                    {group.items.length} моделей · {gi + 1} / {collections.length}
                  </p>
                </div>

                {/* Cards grid */}
                <div className="flex-1 overflow-y-auto px-5 pb-20">
                  <div className="grid grid-cols-3 gap-3 max-w-2xl mx-auto">
                    {group.items.map((preset: any, idx: number) => (
                      <PresetCard key={preset.id} preset={preset} idx={idx} bgPaused={!!fullscreenPreset} forceMount={gi === active} />
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination dots + nav arrows */}
      {!isLoading && collections.length > 1 && (
        <div className="fixed bottom-6 left-0 right-0 z-30 flex flex-col items-center gap-3 pointer-events-none">
          {/* Dots */}
          <div className="flex items-center gap-2">
            {collections.map((_, i) => (
              <button
                key={i}
                onClick={() => { if (!animating) { setAnimating(true); setActive(i); setTimeout(() => setAnimating(false), 650); } }}
                className="transition-all rounded-full pointer-events-auto"
                style={{
                  width: i === active ? 20 : 6,
                  height: 6,
                  background: i === active ? 'var(--primary)' : 'rgba(255,255,255,0.25)',
                }}
              />
            ))}
          </div>

          {/* Arrow down */}
          {active < collections.length - 1 && (
            <button
              onClick={() => navigate(1)}
              className="pointer-events-auto text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors"
              style={{ animation: 'bounce 1.8s infinite' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
          )}
        </div>
      )}

      {/* Fullscreen viewer */}
      {fullscreenPreset && (
        <WatchFullscreenViewer
          preset={fullscreenPreset.preset}
          originRect={fullscreenPreset.rect}
          onClose={() => setFullscreenPreset(null)}
          onBuy={(p, color, mat) => {
            setFullscreenPreset(null);
            setBuyModal(p); setBuyStrapColor(color); setBuyStrapMat(mat); setBuyError('');
          }}
          onConfigure={(p) => { setFullscreenPreset(null); handleSelectPreset(p); }}
        />
      )}

      {/* Buy modal */}
      {buyModal && (
        <div
          className="fixed inset-0 z-[60] flex items-end md:items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.88)' }}
          onClick={() => { if (!buying) setBuyModal(null); }}
        >
          <div
            className="liquid-glass rounded-3xl w-full max-w-sm overflow-hidden animate-fade-up"
            onClick={e => e.stopPropagation()}
          >
            <div
              className="h-40 flex items-center justify-center relative"
              style={{ background: `linear-gradient(135deg, ${buyModal.watchfaceColor}33, ${buyStrapColor}22)` }}
            >
              <div className="w-24 h-32 flex items-center justify-center">
                <WatchMiniCanvas preset={{ ...buyModal, braceletColor: buyStrapColor, braceletMaterial: buyStrapMat }} />
              </div>
              <button
                onClick={() => setBuyModal(null)}
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/40 text-white text-sm flex items-center justify-center hover:bg-black/60 transition-colors"
              >✕</button>
            </div>
            <div className="p-5">
              <h3 className="text-lg font-black mb-0.5">{buyModal.name}</h3>
              <p className="text-xs text-muted-foreground mb-3">Выберите ремешок</p>
              <div className="grid grid-cols-4 gap-1.5 mb-4 max-h-36 overflow-y-auto pr-1">
                {BRACELET_COMBOS.map(combo => {
                  const active2 = buyStrapColor === combo.color && buyStrapMat === combo.material;
                  return (
                    <button
                      key={combo.id}
                      onClick={() => { setBuyStrapColor(combo.color); setBuyStrapMat(combo.material); }}
                      className={cn('flex flex-col items-center gap-1 p-1.5 rounded-xl transition-all',
                        active2 ? 'ring-2 ring-primary bg-primary/10' : 'hover:bg-white/5')}
                    >
                      <div className="w-6 h-6 rounded-full border-2"
                        style={{ backgroundColor: combo.color, borderColor: active2 ? 'var(--primary)' : 'rgba(255,255,255,0.2)' }} />
                      <span className="text-[9px] text-muted-foreground leading-tight text-center line-clamp-2">{combo.label}</span>
                    </button>
                  );
                })}
              </div>
              {buyError && <p className="text-xs text-red-500 mb-3 font-semibold">{buyError}</p>}
              <button
                onClick={handleBuyConfirm}
                disabled={buying}
                className="w-full py-3.5 rounded-2xl bg-primary text-white font-black text-sm tracking-widest uppercase shadow-lg hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-60"
              >
                {buying ? 'Оформляем…' : 'Оформить заказ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
