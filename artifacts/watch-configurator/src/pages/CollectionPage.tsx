import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useLocation, Link } from 'wouter';
import { AnimatePresence, motion } from 'framer-motion';
import { useListPresets, useGetMyOrders } from '@workspace/api-client-react';
import { useWatchConfig } from '@/hooks/use-watch-config';
import WatchMiniCanvas from '@/components/WatchMiniCanvas';
import { BRACELET_COMBOS } from '@/components/WatchFullscreenViewer';
import { cn } from '@/lib/utils';

const MAT_LABELS: Record<string, string> = {
  metal: 'Нержавейка', plastic: 'Пластик', metal_solid: 'Металл',
  metal_segmented: 'Сетка', plastic_solid: 'Резина', leather: 'Кожа',
  cotton_fabric: 'NATO нейлон', resin: 'Смола',
};

const COLLECTION_ORDER = ['РОФЛ', 'ГИПЕРСЕРЬЕЗНОСТЬ', 'ЖИВНОСТЬ'];
const MAX_PER = 6;
type InventoryData = Record<string, { sold: number; max: number }>;

const TRANSITION_DURATION = 0.42;
const SCROLL_COOLDOWN = 700;

function useParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let w = (canvas.width = window.innerWidth);
    let h = (canvas.height = window.innerHeight);
    const onResize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', onResize);
    const particles = Array.from({ length: 50 }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.random() * 1.8 + 0.4,
      dx: (Math.random() - 0.5) * 0.25,
      dy: (Math.random() - 0.5) * 0.25,
      alpha: Math.random() * 0.35 + 0.08,
    }));
    let raf: number;
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      particles.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(120,160,255,${p.alpha})`;
        ctx.fill();
        p.x += p.dx; p.y += p.dy;
        if (p.x < 0) p.x = w; if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h; if (p.y > h) p.y = 0;
      });
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', onResize); };
  }, []);
  return canvasRef;
}

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

export default function CollectionPage() {
  const params = useParams<{ index: string }>();
  const index = Math.max(0, parseInt(params.index ?? '0', 10));
  const [, setLocation] = useLocation();
  const { data: presets, isLoading } = useListPresets();
  const { sessionId } = useWatchConfig();
  const { data: myOrders } = useGetMyOrders({ sessionId }, { query: { enabled: !!sessionId } } as any);
  const hasOrders = Array.isArray(myOrders) && (myOrders as any[]).length > 0;
  const particlesRef = useParticles();

  const [buyModal, setBuyModal] = useState<any | null>(null);
  const [buyStrapColor, setBuyStrapColor] = useState('');
  const [buyStrapMat, setBuyStrapMat] = useState('leather');
  const [buying, setBuying] = useState(false);
  const [buyError, setBuyError] = useState('');
  const [inventory, setInventory] = useState<InventoryData>({});

  // direction: 1 = going to next (slide up), -1 = going to prev (slide down)
  const [direction, setDirection] = useState(1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const outerRef = useRef<HTMLDivElement>(null);
  const lastScrollTime = useRef(0);
  const isTransitioning = useRef(false);
  const touchStartY = useRef<number | null>(null);
  const touchStartX = useRef<number | null>(null);

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
      items: allPresets.filter((p: any) => p.collectionName === name).slice(0, MAX_PER),
    })).filter(g => g.items.length > 0),
    ...(classics.length > 0 ? [{ name: null, displayName: 'КЛАССИКА', items: classics.slice(0, MAX_PER) }] : []),
  ];

  const safeIndex = Math.min(index, Math.max(0, collections.length - 1));
  const group = collections[safeIndex];
  const hasNext = safeIndex < collections.length - 1;
  const hasPrev = safeIndex > 0;

  const goTo = useCallback((nextIndex: number, dir: number) => {
    const now = Date.now();
    if (isTransitioning.current || now - lastScrollTime.current < SCROLL_COOLDOWN) return;
    lastScrollTime.current = now;
    isTransitioning.current = true;
    setDirection(dir);
    setLocation(`/collections/${nextIndex}`);
    setTimeout(() => { isTransitioning.current = false; }, SCROLL_COOLDOWN);
  }, [setLocation]);

  // Prevent browser pull-to-refresh when at top of inner scroll and swiping down
  useEffect(() => {
    const outer = outerRef.current;
    if (!outer) return;
    const preventPullToRefresh = (e: TouchEvent) => {
      const inner = scrollRef.current;
      const atTop = !inner || inner.scrollTop <= 0;
      if (atTop && touchStartY.current !== null) {
        const dy = touchStartY.current - e.touches[0].clientY;
        if (dy < 0) e.preventDefault();
      }
    };
    outer.addEventListener('touchmove', preventPullToRefresh, { passive: false });
    return () => outer.removeEventListener('touchmove', preventPullToRefresh);
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    touchStartX.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartY.current === null || touchStartX.current === null) return;
    if (buyModal) return;
    const deltaY = touchStartY.current - e.changedTouches[0].clientY;
    const deltaX = Math.abs(touchStartX.current - e.changedTouches[0].clientX);
    touchStartY.current = null;
    touchStartX.current = null;
    // Ignore if mostly horizontal or too short a swipe
    if (Math.abs(deltaY) < 50 || deltaX > Math.abs(deltaY) * 0.8) return;
    const inner = scrollRef.current;
    const atBottom = !inner || inner.scrollTop + inner.clientHeight >= inner.scrollHeight - 8;
    const atTop = !inner || inner.scrollTop <= 8;
    if (deltaY > 0 && hasNext && atBottom) {
      goTo(safeIndex + 1, 1);
    } else if (deltaY < 0 && hasPrev && atTop) {
      goTo(safeIndex - 1, -1);
    }
  }, [buyModal, hasNext, hasPrev, safeIndex, goTo]);

  // Scroll wheel navigation
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (buyModal) return;
      const inner = scrollRef.current;
      if (!inner) return;

      const atBottom = inner.scrollTop + inner.clientHeight >= inner.scrollHeight - 4;
      const atTop = inner.scrollTop <= 4;

      if (e.deltaY > 0 && hasNext && atBottom) {
        e.preventDefault();
        goTo(safeIndex + 1, 1);
      } else if (e.deltaY < 0 && hasPrev && atTop) {
        e.preventDefault();
        goTo(safeIndex - 1, -1);
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, [safeIndex, hasNext, hasPrev, buyModal, goTo]);

  // Reset inner scroll to top on collection change
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [safeIndex]);

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
        body: JSON.stringify({ configId: cfg.id, sessionId, totalStars: buyModal.priceStars }),
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
      const root = e.currentTarget.closest('[data-card-root]') as HTMLElement | null;
      if (!root) return;
      setExpanding(true);
      const rect = root.getBoundingClientRect();
      try {
        sessionStorage.setItem('presetOriginRect', JSON.stringify({
          top: rect.top, left: rect.left, right: rect.right, bottom: rect.bottom,
          width: rect.width, height: rect.height, x: rect.x, y: rect.y,
        }));
      } catch { /* ignore */ }
      setTimeout(() => { setExpanding(false); setLocation(`/preset/${preset.id}`); }, 160);
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
            className="h-44 overflow-hidden relative"
            style={{ background: `linear-gradient(135deg, ${preset.watchfaceColor}22, ${preset.braceletColor}18)` }}
          >
            <WatchMiniCanvas preset={preset} paused={false} forceMount />

            {/* Price badge */}
            {preset.priceStars != null && (
              <div className="absolute top-2 right-2 z-10 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-black tabular-nums"
                style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff' }}>
                от {preset.priceStars} <svg width="10" height="10" viewBox="0 0 24 24" fill="#f59e0b" stroke="#d97706" strokeWidth="0.8" strokeLinejoin="round" style={{display:'inline',verticalAlign:'middle'}} aria-hidden="true"><path d="M12 2L14.9 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L9.1 8.26L12 2Z"/></svg>
              </div>
            )}

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
            <span className="text-[9px] text-primary/60 font-semibold ml-1 shrink-0">Смотреть →</span>
          </div>
        </button>
      </div>
    );
  };

  // Animation variants: direction 1 = next (slide up), -1 = prev (slide down)
  const variants = {
    enter: (dir: number) => ({
      y: dir > 0 ? '6%' : '-6%',
      opacity: 0,
      filter: 'blur(8px)',
    }),
    center: {
      y: '0%',
      opacity: 1,
      filter: 'blur(0px)',
    },
    exit: (dir: number) => ({
      y: dir > 0 ? '-6%' : '6%',
      opacity: 0,
      filter: 'blur(8px)',
    }),
  };

  return (
    <div ref={outerRef} className="fixed inset-0 overflow-hidden bg-background" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      {/* Particles */}
      <canvas ref={particlesRef} className="fixed inset-0 pointer-events-none z-0" style={{ opacity: 0.8 }} />

      {/* Ambient orbs */}
      <div className="fixed top-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full pointer-events-none z-0"
        style={{ background: 'var(--orb-1)', filter: 'blur(100px)', opacity: 0.35 }} />
      <div className="fixed bottom-[-5%] left-[-5%] w-[400px] h-[400px] rounded-full pointer-events-none z-0"
        style={{ background: 'var(--orb-2)', filter: 'blur(90px)', opacity: 0.22 }} />
      <div className="fixed top-[50%] right-[10%] w-[260px] h-[260px] rounded-full pointer-events-none z-0"
        style={{ background: 'var(--orb-3)', filter: 'blur(70px)', opacity: 0.18 }} />

      {/* Top nav */}
      <div className="fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-5 py-4">
        <Link href="/">
          <button className="text-xs text-muted-foreground hover:text-foreground transition-colors liquid-button px-3 py-1.5">
            ← Назад
          </button>
        </Link>
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-black uppercase tracking-[0.3em] px-2.5 py-1 rounded-full border border-primary/40 text-primary/70 bg-primary/5">
            ПРЕДЗАКАЗ
          </span>
          {hasOrders && (
            <Link href="/orders">
              <button className="liquid-button px-4 py-2 text-xs font-semibold">Мои заказы</button>
            </Link>
          )}
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center h-full">
          <div className="grid grid-cols-2 gap-3 px-5 w-full max-w-md">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="liquid-glass rounded-2xl h-44 animate-pulse" />
            ))}
          </div>
        </div>
      ) : (
        <AnimatePresence mode="wait" custom={direction}>
          {group && (
            <motion.div
              key={safeIndex}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{
                duration: TRANSITION_DURATION,
                ease: [0.32, 0.72, 0, 1],
              }}
              className="flex flex-col h-full pt-16"
            >
              {/* Centered collection title */}
              <div className="flex-none flex flex-col items-center justify-center px-5 pt-6 pb-4 text-center">
                <p className="text-[9px] uppercase tracking-[0.45em] text-muted-foreground/40 mb-2">
                  Коллекция {safeIndex + 1} / {collections.length}
                </p>
                <h2
                  className="font-black tracking-tight leading-none text-foreground"
                  style={{ fontSize: 'clamp(2.2rem, 10vw, 4.5rem)' }}
                >
                  {group.displayName}
                </h2>
                <p className="text-[10px] text-muted-foreground/40 uppercase tracking-widest mt-2">
                  {group.items.length} моделей · только предзаказ
                </p>
              </div>

              {/* Cards */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-none px-5 pb-28 min-h-0">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-w-3xl mx-auto">
                  {group.items.map((preset: any, idx: number) => (
                    <PresetCard key={preset.id} preset={preset} idx={idx} />
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* Collection dots — scroll hint only */}
      {!isLoading && collections.length > 1 && (
        <div className="fixed bottom-6 left-0 right-0 z-30 flex justify-center">
          <div className="flex items-center gap-2">
            {collections.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i, i > safeIndex ? 1 : -1)}
                className="transition-all rounded-full"
                style={{
                  width: i === safeIndex ? 20 : 6,
                  height: 6,
                  background: i === safeIndex ? 'var(--primary)' : 'rgba(255,255,255,0.25)',
                }}
              />
            ))}
          </div>
        </div>
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
              <p className="text-xs text-muted-foreground mb-1">Выберите ремешок</p>
              <p className="text-[10px] text-primary/60 mb-3 uppercase tracking-widest">· Предзаказ — оплата после подтверждения ·</p>
              <div className="grid grid-cols-4 gap-1.5 mb-4 max-h-36 overflow-y-auto pr-1">
                {BRACELET_COMBOS.map(combo => {
                  const isActive = buyStrapColor === combo.color && buyStrapMat === combo.material;
                  return (
                    <button
                      key={combo.id}
                      onClick={() => { setBuyStrapColor(combo.color); setBuyStrapMat(combo.material); }}
                      className={cn('flex flex-col items-center gap-1 p-1.5 rounded-xl transition-all',
                        isActive ? 'ring-2 ring-primary bg-primary/10' : 'hover:bg-white/5')}
                    >
                      <div className="w-6 h-6 rounded-full border-2"
                        style={{ backgroundColor: combo.color, borderColor: isActive ? 'var(--primary)' : 'rgba(255,255,255,0.2)' }} />
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
                {buying ? 'Оформляем…' : 'Оформить предзаказ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
