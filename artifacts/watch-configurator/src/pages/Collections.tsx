import React, { useState, useEffect, useCallback } from 'react';
import { useListPresets, useGetMyOrders } from '@workspace/api-client-react';
import { useLocation, Link } from 'wouter';
import { useWatchConfig } from '@/hooks/use-watch-config';
import { useCart } from '@/hooks/use-cart';
import WatchSVG from '@/components/WatchSVG';
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

const COLLECTION_META: Record<string, { emoji: string; subtitle: string; accentColor: string }> = {
  'РОФЛ': {
    emoji: '😂',
    subtitle: 'Смешно, ярко, слишком громко — на запястье',
    accentColor: '#dc2626',
  },
  'ГИПЕРСЕРЬЕЗНОСТЬ': {
    emoji: '🖤',
    subtitle: 'Минимализм как религия. Никаких лишних движений.',
    accentColor: '#18181b',
  },
  'ЖИВНОСТЬ': {
    emoji: '🌿',
    subtitle: '5 живых часов. Природа на запястье.',
    accentColor: '#14532d',
  },
};

const STRAP_COLORS = [
  '#0f172a', '#1e293b', '#78350f', '#1c1917',
  '#064e3b', '#1e1b4b', '#c0c0c0', '#374151',
  '#7f1d1d', '#3b0764', '#0c4a6e', '#f8fafc',
];

const PAGE_SIZE = 10;

type InventoryData = Record<string, { sold: number; max: number }>;

// ── Tilt physics ──────────────────────────────────────────────────────────────
function useTilt() {
  const [tilt, setTilt] = useState<{ rx: number; ry: number } | null>(null);
  const onMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ rx: y * 14, ry: x * -14 });
  }, []);
  const onLeave = useCallback(() => setTilt(null), []);
  return { tilt, onMove, onLeave };
}

// ── Comments thread ───────────────────────────────────────────────────────────
function PresetComments({ presetId }: { presetId: number }) {
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [authorName, setAuthorName] = useState('');
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/presets/${presetId}/comments`)
      .then(r => r.json())
      .then(data => { setComments(Array.isArray(data) ? data : []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [presetId]);

  const submit = async () => {
    if (!text.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/presets/${presetId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authorName: authorName.trim() || 'Аноним', text: text.trim() }),
      });
      if (res.ok) {
        const comment = await res.json();
        setComments(prev => [comment, ...prev]);
        setText('');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="border-t border-border/20 pt-4 mt-2">
      <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3 font-semibold">Обсуждение</p>
      {loading ? (
        <div className="h-8 bg-muted/20 rounded-lg animate-pulse mb-3" />
      ) : comments.length === 0 ? (
        <p className="text-xs text-muted-foreground/50 text-center py-3 mb-3">Будьте первым — напишите комментарий</p>
      ) : (
        <div className="space-y-2 mb-3 max-h-40 overflow-y-auto pr-1 scrollbar-thin">
          {comments.map((c: any) => (
            <div key={c.id} className="bg-white/5 rounded-xl p-2.5">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-xs font-bold">{c.authorName}</span>
                <span className="text-[10px] text-muted-foreground/40">
                  {new Date(c.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{c.text}</p>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          placeholder="Имя"
          value={authorName}
          onChange={e => setAuthorName(e.target.value)}
          className="w-24 bg-background/60 border border-border rounded-full px-3 py-1.5 text-xs focus:outline-none focus:border-primary/60 transition-colors"
          maxLength={30}
        />
        <input
          placeholder="Ваш комментарий..."
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) submit(); }}
          className="flex-1 bg-background/60 border border-border rounded-full px-3 py-1.5 text-xs focus:outline-none focus:border-primary/60 transition-colors"
          maxLength={500}
        />
        <button
          onClick={submit}
          disabled={!text.trim() || submitting}
          className="bg-primary/20 text-primary rounded-full px-3 py-1.5 text-xs font-bold hover:bg-primary/30 transition-colors disabled:opacity-40 shrink-0"
        >
          {submitting ? '…' : '→'}
        </button>
      </div>
    </div>
  );
}

// ── Filter pill ───────────────────────────────────────────────────────────────
const FILTER_OPTIONS = [
  { key: 'all', label: 'Все', emoji: '🌐' },
  { key: 'РОФЛ', label: 'РОФЛ', emoji: '😂' },
  { key: 'ГИПЕРСЕРЬЕЗНОСТЬ', label: 'ГИПЕРСЕРЬЕЗНОСТЬ', emoji: '🖤' },
  { key: 'ЖИВНОСТЬ', label: 'ЖИВНОСТЬ', emoji: '🌿' },
  { key: 'classics', label: 'Классика', emoji: '⌚' },
];

// ── Main component ────────────────────────────────────────────────────────────
export default function Collections() {
  const { data: presets, isLoading } = useListPresets();
  const [, setLocation] = useLocation();
  const { updateConfig, sessionId } = useWatchConfig();
  const { items: cartItems, addItem: addToCart, removeItem: removeFromCart } = useCart();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const { data: myOrders } = useGetMyOrders({ sessionId }, { query: { enabled: !!sessionId } } as any);
  const hasOrders = Array.isArray(myOrders) && (myOrders as any[]).length > 0;

  const [buyModal, setBuyModal] = useState<any | null>(null);
  const [buyStrapColor, setBuyStrapColor] = useState('');
  const [buying, setBuying] = useState(false);
  const [buyError, setBuyError] = useState('');

  const [inventory, setInventory] = useState<InventoryData>({});
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [cartOpen, setCartOpen] = useState(false);

  useEffect(() => {
    fetch('/api/presets/inventory')
      .then(r => r.json())
      .then(data => { if (data?.byCollection) setInventory(data.byCollection); })
      .catch(() => {});
  }, []);

  // Reset page on filter change
  useEffect(() => { setCurrentPage(1); }, [activeFilter]);

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
          braceletMaterial: buyModal.braceletMaterial,
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

      const priceRes = await fetch('/api/price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          watchfaceMaterial: buyModal.watchfaceMaterial,
          braceletMaterial: buyModal.braceletMaterial,
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

  const allPresets = (presets as any[] | undefined) ?? [];
  const collectionOrder = ['РОФЛ', 'ГИПЕРСЕРЬЕЗНОСТЬ', 'ЖИВНОСТЬ'];
  const classics = allPresets.filter((p: any) => !p.collectionName);

  // Filtered flat list for paginated view
  const filteredFlat: any[] = activeFilter === 'all'
    ? allPresets
    : activeFilter === 'classics'
    ? classics
    : allPresets.filter((p: any) => p.collectionName === activeFilter);

  const totalPages = Math.ceil(filteredFlat.length / PAGE_SIZE);
  const paginatedItems = filteredFlat.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // Grouped view (only for "Все")
  const grouped: Array<{ name: string | null; items: any[] }> = [
    ...collectionOrder.map(name => ({
      name,
      items: allPresets.filter((p: any) => p.collectionName === name),
    })).filter(g => g.items.length > 0),
    ...(classics.length > 0 ? [{ name: null, items: classics }] : []),
  ];

  // Cart total
  const cartTotal = cartItems.reduce((s, i) => s + i.priceStars, 0);

  // ── Preset Card ─────────────────────────────────────────────────────────────
  const PresetCard = ({ preset, idx }: { preset: any; idx: number }) => {
    const isExpanded = expandedId === preset.id;
    const { tilt, onMove, onLeave } = useTilt();
    const collectionKey = preset.collectionName ?? 'classics';
    const inv = inventory[collectionKey];
    const soldOut = inv ? inv.sold >= inv.max : false;
    const inCart = cartItems.some(i => i.presetId === preset.id);

    return (
      <div
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        className="relative"
        style={{
          transform: tilt
            ? `perspective(800px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg) scale(1.03)`
            : 'perspective(800px) rotateX(0deg) rotateY(0deg) scale(1)',
          transition: tilt ? 'transform 0.05s ease-out' : 'transform 0.35s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        <button
          onClick={() => setExpandedId(isExpanded ? null : preset.id)}
          className={cn(
            'liquid-glass rounded-3xl overflow-hidden text-left group focus:outline-none focus:ring-2 focus:ring-primary/40 animate-fade-up transition-all duration-300 w-full',
            isExpanded && 'ring-2 ring-primary/40',
          )}
          style={{ animationDelay: `${idx * 0.06}s` }}
        >
          {/* Watch preview */}
          <div
            className="h-44 flex items-center justify-center overflow-hidden p-4 relative"
            style={{ background: `linear-gradient(135deg, ${preset.watchfaceColor}22, ${preset.braceletColor}18)` }}
          >
            <div className="w-20 h-36">
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
                  watchfaceText: preset.watchfaceText ?? '',
                  watchfaceTextMode: preset.watchfaceTextMode ?? 'center',
                  watchfaceBackgroundType: 'solid',
                }}
              />
            </div>
            <div className="absolute top-2 right-2 bg-black/40 backdrop-blur-sm rounded-full px-2 py-0.5 text-xs font-black text-yellow-300">
              {preset.priceStars} ⭐
            </div>
            {inCart && (
              <div className="absolute top-2 left-2 bg-primary/80 backdrop-blur-sm rounded-full px-2 py-0.5 text-xs font-black text-white">
                В корзине
              </div>
            )}
            {soldOut && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-t-3xl">
                <span className="text-white text-xs font-black uppercase tracking-widest bg-black/60 px-3 py-1.5 rounded-full">
                  Распродано
                </span>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="p-4">
            <p className="font-black text-sm tracking-tight mb-0.5">{preset.name}</p>
            {preset.description && (
              <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{preset.description}</p>
            )}

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
                className="w-full py-2 rounded-xl bg-primary/20 text-primary text-xs font-bold tracking-widest uppercase text-center cursor-pointer hover:bg-primary/30 transition-colors active:scale-[0.98] border border-primary/30"
              >
                Настроить →
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

        {/* КУПИТЬ button */}
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
              Готовые<br />коллекции
            </h1>
          </div>
          <div className="flex flex-col items-end gap-2 animate-fade-up delay-200">
            <Link href="/configure">
              <button className="liquid-button px-6 py-3 text-sm font-bold tracking-widest uppercase">
                С нуля →
              </button>
            </Link>
            {cartItems.length > 0 && (
              <button
                onClick={() => setCartOpen(true)}
                className="liquid-button px-4 py-2 text-xs font-semibold relative"
              >
                🛒 Корзина
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-primary text-white rounded-full text-[10px] font-black flex items-center justify-center">
                  {cartItems.length}
                </span>
              </button>
            )}
            {hasOrders && (
              <Link href="/orders">
                <button className="liquid-button px-4 py-2 text-xs font-semibold">
                  📦 Мои заказы
                </button>
              </Link>
            )}
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 flex-wrap mb-8 animate-fade-up">
          {FILTER_OPTIONS.map(opt => (
            <button
              key={opt.key}
              onClick={() => setActiveFilter(opt.key)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold tracking-wide transition-all',
                activeFilter === opt.key
                  ? 'bg-primary text-white shadow-md shadow-primary/25'
                  : 'liquid-glass text-muted-foreground hover:text-foreground'
              )}
            >
              <span>{opt.emoji}</span>
              <span>{opt.label}</span>
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-10">
            {[0, 1, 2].map(s => (
              <div key={s}>
                <div className="h-8 w-48 bg-muted/40 rounded-xl mb-4 animate-pulse" />
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="liquid-glass rounded-3xl h-64 animate-pulse" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : activeFilter === 'all' ? (
          /* ── Grouped view ── */
          <div className="space-y-14">
            {grouped.map((group, gi) => {
              const meta = group.name ? COLLECTION_META[group.name] : null;
              const inv = group.name ? inventory[group.name] : null;
              const remaining = inv ? Math.max(0, inv.max - inv.sold) : null;
              const soldOut = inv ? inv.sold >= inv.max : false;

              return (
                <section key={group.name ?? '__classics'} className="animate-fade-up" style={{ animationDelay: `${gi * 0.1}s` }}>
                  {group.name ? (
                    <div className="flex items-center gap-3 mb-5">
                      <div
                        className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl shrink-0"
                        style={{ background: `${meta?.accentColor}22`, border: `1.5px solid ${meta?.accentColor}44` }}
                      >
                        {meta?.emoji}
                      </div>
                      <div>
                        <h2 className="text-2xl font-black tracking-tight leading-none">{group.name}</h2>
                        {meta?.subtitle && (
                          <p className="text-xs text-muted-foreground mt-0.5">{meta.subtitle}</p>
                        )}
                      </div>
                      <div className="ml-auto text-right">
                        {remaining !== null ? (
                          <>
                            <p className={cn('text-xs font-black tabular-nums', soldOut ? 'text-red-500' : remaining < 50 ? 'text-orange-500' : 'text-muted-foreground')}>
                              {soldOut ? '— распродано' : `${remaining} / 1000`}
                            </p>
                            <p className="text-[10px] text-muted-foreground/50 uppercase tracking-widest">осталось</p>
                          </>
                        ) : (
                          <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50 font-semibold">
                            {group.items.length} моделей · 1000 экз
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 mb-5">
                      <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl shrink-0 bg-muted/30 border border-border/30">
                        ⌚
                      </div>
                      <div>
                        <h2 className="text-2xl font-black tracking-tight leading-none">Классика</h2>
                        <p className="text-xs text-muted-foreground mt-0.5">Проверенные временем</p>
                      </div>
                    </div>
                  )}
                  {meta && (
                    <div
                      className="h-px mb-5 rounded-full"
                      style={{ background: `linear-gradient(to right, ${meta.accentColor}80, transparent)` }}
                    />
                  )}
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    {group.items.map((preset: any, idx: number) => (
                      <PresetCard key={preset.id} preset={preset} idx={idx} />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        ) : (
          /* ── Filtered + paginated view ── */
          <div className="space-y-6">
            {paginatedItems.length === 0 ? (
              <div className="liquid-glass rounded-3xl p-12 text-center">
                <p className="text-muted-foreground text-sm">Моделей в этой коллекции пока нет</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  {paginatedItems.map((preset: any, idx: number) => (
                    <PresetCard key={preset.id} preset={preset} idx={idx} />
                  ))}
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-3 pt-4">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="liquid-button px-4 py-2 text-xs font-bold disabled:opacity-30"
                    >
                      ← Назад
                    </button>
                    <span className="text-sm text-muted-foreground">
                      <span className="font-black text-foreground">{currentPage}</span> / {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="liquid-button px-4 py-2 text-xs font-bold disabled:opacity-30"
                    >
                      Вперёд →
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <div className="mt-20 text-center">
          <p className="text-[11px] uppercase tracking-[0.4em] text-muted-foreground/30 font-semibold">
            Чеблячас © 2026
          </p>
        </div>
      </div>

      {/* Expanded preset overlay */}
      {expandedPreset && (
        <div
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4 md:p-8"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(16px)' }}
          onClick={() => setExpandedId(null)}
        >
          <div
            className="liquid-glass rounded-3xl w-full max-w-sm md:max-w-md overflow-hidden animate-fade-up"
            style={{ maxHeight: '90dvh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}
          >
            <div
              className="h-64 flex items-center justify-center relative shrink-0"
              style={{ background: `linear-gradient(135deg, ${expandedPreset.watchfaceColor}33, ${expandedPreset.braceletColor}22)` }}
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
                    watchfaceText: expandedPreset.watchfaceText ?? '',
                    watchfaceTextMode: expandedPreset.watchfaceTextMode ?? 'center',
                    watchfaceBackgroundType: 'solid',
                  }}
                />
              </div>
              {expandedPreset.collectionName && COLLECTION_META[expandedPreset.collectionName] && (
                <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/40 backdrop-blur-sm rounded-full px-3 py-1">
                  <span>{COLLECTION_META[expandedPreset.collectionName].emoji}</span>
                  <span className="text-white text-[10px] font-bold uppercase tracking-widest">{expandedPreset.collectionName}</span>
                </div>
              )}
              <button
                onClick={() => setExpandedId(null)}
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/40 text-white text-sm flex items-center justify-center hover:bg-black/60 transition-colors"
              >
                ✕
              </button>
            </div>

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

              <div className="flex gap-3 mb-2">
                <button
                  onClick={() => { setExpandedId(null); handleBuyOpen({ stopPropagation: () => {} } as any, expandedPreset); }}
                  className="flex-1 py-3.5 rounded-2xl bg-primary text-white font-black text-sm tracking-widest uppercase shadow-lg hover:bg-primary/90 active:scale-[0.98] transition-all"
                >
                  Купить
                </button>
                <button
                  onClick={() => handleSelectPreset(expandedPreset)}
                  className="flex-1 py-3.5 rounded-2xl liquid-glass font-black text-sm tracking-widest uppercase active:scale-[0.98] transition-all"
                >
                  Настроить
                </button>
              </div>

              {/* Cart add button */}
              {cartItems.some(i => i.presetId === expandedPreset.id) ? (
                <button
                  onClick={() => {
                    const item = cartItems.find(i => i.presetId === expandedPreset.id);
                    if (item) removeFromCart(item.key);
                  }}
                  className="w-full py-2 rounded-2xl border border-destructive/30 text-destructive text-xs font-bold hover:bg-destructive/10 transition-colors"
                >
                  ✕ Убрать из корзины
                </button>
              ) : (
                <button
                  onClick={() => addToCart({
                    presetId: expandedPreset.id,
                    presetName: expandedPreset.name,
                    priceStars: expandedPreset.priceStars,
                    braceletColor: expandedPreset.braceletColor,
                    watchfaceColor: expandedPreset.watchfaceColor,
                  })}
                  className="w-full py-2 rounded-2xl border border-border text-muted-foreground text-xs font-bold hover:bg-muted/30 transition-colors"
                >
                  + В корзину
                </button>
              )}

              {/* Comments */}
              <PresetComments presetId={expandedPreset.id} />
            </div>
          </div>
        </div>
      )}

      {/* КУПИТЬ modal — strap color picker */}
      {buyModal && (
        <div
          className="fixed inset-0 z-[60] flex items-end md:items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(20px)' }}
          onClick={() => { if (!buying) setBuyModal(null); }}
        >
          <div
            className="liquid-glass rounded-3xl w-full max-w-xs overflow-hidden animate-fade-up"
            onClick={e => e.stopPropagation()}
          >
            <div
              className="h-52 flex items-center justify-center relative"
              style={{ background: `linear-gradient(135deg, ${buyModal.watchfaceColor}33, ${buyStrapColor}22)` }}
            >
              <div className="w-28 h-44">
                <WatchSVG
                  config={{
                    watchfaceGeometry: buyModal.watchfaceGeometry as any,
                    watchfaceColor: buyModal.watchfaceColor,
                    braceletColor: buyStrapColor,
                    braceletMaterial: buyModal.braceletMaterial as any,
                    braceletType: buyModal.braceletType as any,
                    handsEnabled: buyModal.handsEnabled,
                    handsColor: buyModal.handsColor ?? '#FFFFFF',
                    handsCount: 3,
                    watchfaceText: buyModal.watchfaceText ?? '',
                    watchfaceTextMode: buyModal.watchfaceTextMode ?? 'center',
                    watchfaceBackgroundType: 'solid',
                  }}
                />
              </div>
              <button
                onClick={() => setBuyModal(null)}
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/40 text-white text-sm flex items-center justify-center hover:bg-black/60 transition-colors"
              >
                ✕
              </button>
              <div className="absolute top-3 left-3 bg-black/40 backdrop-blur-sm rounded-full px-3 py-1">
                <p className="text-yellow-300 text-xs font-black">{buyModal.priceStars} ⭐</p>
              </div>
            </div>

            <div className="p-5">
              <h3 className="text-lg font-black mb-0.5">{buyModal.name}</h3>
              <p className="text-xs text-muted-foreground mb-4">Выберите цвет ремешка</p>

              <div className="flex flex-wrap gap-2 mb-5">
                {STRAP_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setBuyStrapColor(c)}
                    className={cn(
                      'w-8 h-8 rounded-full transition-all border-2',
                      buyStrapColor === c ? 'border-primary scale-110 shadow-md shadow-primary/30' : 'border-transparent hover:scale-105'
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
                <label className="relative w-8 h-8 rounded-full overflow-hidden cursor-pointer border-2 border-transparent hover:scale-105 transition-all">
                  <input
                    type="color"
                    value={buyStrapColor}
                    onChange={e => setBuyStrapColor(e.target.value)}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  <div
                    className="w-full h-full rounded-full border border-white/20"
                    style={{ backgroundColor: buyStrapColor }}
                  />
                </label>
              </div>

              {buyError && (
                <p className="text-xs text-red-500 mb-3 font-semibold">{buyError}</p>
              )}

              <button
                onClick={handleBuyConfirm}
                disabled={buying}
                className="w-full py-3.5 rounded-2xl bg-primary text-white font-black text-sm tracking-widest uppercase shadow-lg hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-60"
              >
                {buying ? 'Оформляем…' : `Купить — ${buyModal.priceStars} ⭐`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cart drawer */}
      {cartOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-end md:items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(16px)' }}
          onClick={() => setCartOpen(false)}
        >
          <div
            className="liquid-glass rounded-3xl w-full max-w-sm overflow-hidden animate-fade-up"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-xl font-black">Корзина 🛒</h2>
                <button
                  onClick={() => setCartOpen(false)}
                  className="w-8 h-8 rounded-full bg-muted/50 text-muted-foreground text-sm flex items-center justify-center hover:bg-muted transition-colors"
                >
                  ✕
                </button>
              </div>

              {cartItems.length === 0 ? (
                <p className="text-center text-muted-foreground text-sm py-8">Корзина пуста</p>
              ) : (
                <div className="space-y-3 mb-5">
                  {cartItems.map(item => (
                    <div key={item.key} className="flex items-center gap-3 bg-white/5 rounded-2xl p-3">
                      <div
                        className="w-10 h-10 rounded-full border-2 border-white/20 shrink-0"
                        style={{ backgroundColor: item.watchfaceColor }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate">{item.presetName}</p>
                        <p className="text-xs text-yellow-400 font-black">{item.priceStars} ⭐</p>
                      </div>
                      <button
                        onClick={() => removeFromCart(item.key)}
                        className="text-muted-foreground hover:text-destructive text-xs transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {cartItems.length > 0 && (
                <>
                  <div className="flex justify-between text-sm font-bold mb-4 px-1">
                    <span className="text-muted-foreground">Итого</span>
                    <span className="text-yellow-400 font-black">{cartTotal} ⭐</span>
                  </div>
                  <p className="text-xs text-muted-foreground text-center mb-2">
                    Для оплаты откройте каждый товар по отдельности
                  </p>
                  <Link href="/orders">
                    <button
                      onClick={() => setCartOpen(false)}
                      className="w-full py-3 rounded-2xl bg-primary text-white font-black text-sm tracking-widest uppercase hover:bg-primary/90 transition-all active:scale-[0.98]"
                    >
                      Мои заказы
                    </button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
