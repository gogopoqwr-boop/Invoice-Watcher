import React, { useState, useMemo, lazy, Suspense } from 'react';
import { useLocation, Link } from 'wouter';
import { useWatchConfig, BoxType } from '@/hooks/use-watch-config';
import { useCreateConfiguration, useCreateOrder } from '@workspace/api-client-react';
import { cn } from '@/lib/utils';
import { Ribbon, MapPin, Mail, X } from 'lucide-react';
import { TgStar } from '@/components/TgStar';

const WatchBoxScene = lazy(() => import('@/components/WatchBoxScene'));

const BRACELET_PRICES: Record<string, number> = {
  plastic_solid: 0, plastic_segmented: 1, metal_solid: 3, metal_segmented: 4,
  resin: 2, leather: 3, cotton_fabric: 1,
};


// ─── Box options data ────────────────────────────────────────────────────────

const BOX_OPTIONS: {
  id: BoxType;
  label: string;
  sublabel: string;
  desc: string;
  surcharge: number;
  accentColor: string;
  textColor: string;
}[] = [
  {
    id: 'standard',
    label: 'Стандарт',
    sublabel: 'Матовый',
    desc: 'Магнитная крышка, фирменное тиснение, мягкая подушка для часов',
    surcharge: 0,
    accentColor: '#475569',
    textColor: '#cbd5e1',
  },
  {
    id: 'premium',
    label: 'Премиум',
    sublabel: 'Лаковый',
    desc: 'Лакированный корпус, велюровый интерьер, позолоченные петли',
    surcharge: 5,
    accentColor: '#b8860b',
    textColor: '#fde68a',
  },
  {
    id: 'collector',
    label: 'Коллекционер',
    sublabel: 'Дерево + латунь',
    desc: 'Массив дуба, атласный интерьер, латунная накладка с гравировкой',
    surcharge: 15,
    accentColor: '#7c5228',
    textColor: '#fbbf24',
  },
];

// ─── Page ────────────────────────────────────────────────────────────────────

export default function BoxSetup() {
  const { config, updateConfig, sessionId } = useWatchConfig();
  const [, setLocation] = useLocation();

  const [selectedBox, setSelectedBox] = useState<BoxType>(config.boxType ?? 'standard');
  const [message, setMessage] = useState(config.boxMessage ?? '');
  const [giftWrap, setGiftWrap] = useState(config.giftWrap ?? false);
  const [boxOpen, setBoxOpen] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);

  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [deliveryEmail, setDeliveryEmail] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryErrors, setDeliveryErrors] = useState<{ email?: string; address?: string }>({});

  const createConfig = useCreateConfiguration();
  const createOrder = useCreateOrder();

  const boxOption = BOX_OPTIONS.find(b => b.id === selectedBox)!;

  // Client-side price: preset base + bracelet delta + text/hands + box + ribbon
  const totalStars = useMemo(() => {
    const base = config.priceStars ?? 0;
    const origBracelet = config.presetBraceletMaterial ?? config.braceletMaterial ?? 'metal_solid';
    const curBracelet  = config.braceletMaterial ?? origBracelet;
    const braceletDelta = (BRACELET_PRICES[curBracelet] ?? 0) - (BRACELET_PRICES[origBracelet] ?? 0);
    const textCharge   = config.watchfaceText ? 1 : 0;
    const handsDiscount = config.handsEnabled === false ? -1 : 0;
    const raw = base + braceletDelta + textCharge + handsDiscount + boxOption.surcharge + (giftWrap ? 2 : 0);
    return Math.min(50, Math.max(1, raw));
  }, [config.priceStars, config.presetBraceletMaterial, config.braceletMaterial,
      config.watchfaceText, config.handsEnabled, boxOption.surcharge, giftWrap]);

  const handleOrder = async (email: string, address: string) => {
    setSubmitting(true);
    setOrderError(null);
    updateConfig({ boxType: selectedBox, boxMessage: message, giftWrap });
    try {
      const cfg = await createConfig.mutateAsync({
        data: {
          watchfaceGeometry: config.watchfaceGeometry,
          watchfaceMaterial: config.watchfaceMaterial,
          watchfaceColor: config.watchfaceColor,
          braceletMaterial: config.braceletMaterial,
          braceletType: config.braceletType,
          braceletColor: config.braceletColor,
          handsEnabled: config.handsEnabled,
          handsColor: config.handsColor,
          handsStyle: config.watchfaceText || undefined,
          watchfaceText: config.watchfaceText || undefined,
          serialNumber: undefined,
          sessionId,
          boxType: selectedBox,
          giftWrap,
          presetPriceStars: config.priceStars ?? undefined,
          presetBraceletMaterial: config.presetBraceletMaterial ?? undefined,
          presetName: config.presetName ?? undefined,
        } as any,
      });
      const order = await createOrder.mutateAsync({
        data: { configId: cfg.id, sessionId, totalStars, deliveryEmail: email, deliveryAddress: address, boxMessage: message || undefined } as any,
      });
      setLocation(`/payment/${order.id}`);
    } catch (e) {
      console.error(e);
      setOrderError('Не удалось создать заказ. Проверьте соединение и попробуйте снова.');
      setSubmitting(false);
    }
  };

  const handleDeliverySubmit = () => {
    const errs: { email?: string; address?: string } = {};
    if (!deliveryEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(deliveryEmail.trim())) {
      errs.email = 'Введите корректный e-mail';
    }
    if (deliveryAddress.trim().length < 10) {
      errs.address = 'Введите полный адрес (не менее 10 символов)';
    }
    setDeliveryErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setShowDeliveryModal(false);
    handleOrder(deliveryEmail.trim(), deliveryAddress.trim());
  };

  return (
    <>
    <div className="w-full bg-background flex flex-col md:flex-row md:overflow-hidden md:h-screen">

      {/* ── Left — Box preview */}
      <div className="sticky top-0 z-10 w-full md:static md:w-[52%] md:h-screen shrink-0 flex flex-col canvas-box-bg">

        {/* 3D canvas — fills remaining height */}
        <div className="relative flex-1 overflow-hidden min-h-0 h-[52dvh] md:h-auto">
          {/* Back button */}
          <Link href="/configure">
            <button className="absolute top-3 left-3 z-10 canvas-overlay-btn px-3 py-1.5 text-xs font-semibold">← Настройка</button>
          </Link>

          {/* Box scene */}
          <Suspense fallback={
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
          }>
            <WatchBoxScene
              config={config}
              boxType={selectedBox}
              open={boxOpen}
              giftWrap={giftWrap}
              className="h-full rounded-none"
              onToggle={() => setBoxOpen(v => !v)}
            />
          </Suspense>

          {/* Top-right — watch name badge */}
          {config.presetName && (
            <div className="pointer-events-none absolute top-3 right-3 z-10">
              <div
                className="px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-wider backdrop-blur-md border"
                style={{
                  background: `${boxOption.accentColor}22`,
                  borderColor: `${boxOption.accentColor}55`,
                  color: boxOption.textColor,
                }}
              >
                {config.presetName}
              </div>
            </div>
          )}
        </div>

        {/* Box type indicator + open/close toggle — below the 3D canvas */}
        <div className="shrink-0 flex items-center justify-between px-4 py-2 bg-background border-t border-border/50">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span
                className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60"
                style={{ background: boxOption.accentColor }}
              />
              <span
                className="relative inline-flex rounded-full h-2 w-2"
                style={{ background: boxOption.accentColor }}
              />
            </span>
            <p className="text-[11px] uppercase tracking-[0.22em] font-semibold text-muted-foreground">
              {boxOption.label} · {boxOption.sublabel}
            </p>
          </div>
          <button
            onClick={() => setBoxOpen(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold border border-border/60 bg-muted/40 hover:bg-muted/70 active:scale-95 transition-all"
          >
            <span>{boxOpen ? '📦' : '🎁'}</span>
            <span className="uppercase tracking-wide">{boxOpen ? 'Закрыть' : 'Открыть'}</span>
          </button>
        </div>
      </div>

      {/* ── Right — Options panel ── */}
      <div className="w-full md:w-[48%] md:h-screen flex flex-col bg-background border-l border-border/60 md:overflow-hidden">

        {/* Header */}
        <div className="px-5 pt-5 pb-3 border-b border-border/40 shrink-0">
          <h1 className="text-2xl font-black tracking-tight">Выбор упаковки</h1>
        </div>

        {/* Scrollable options */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-6 pb-4">

          {/* ── Box type ── */}
          <div>
            <h2 className="text-base font-bold mb-3">Тип коробки</h2>
            <div className="space-y-2.5">
              {BOX_OPTIONS.map(opt => {
                const isSelected = selectedBox === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => setSelectedBox(opt.id)}
                    className={cn(
                      'w-full flex items-center gap-4 p-4 rounded-2xl text-left transition-all duration-150',
                      isSelected
                        ? 'bg-card shadow-md border border-border/40'
                        : 'border border-border/60 bg-muted/40 hover:bg-muted/70',
                    )}
                    style={isSelected ? {
                      outline: `2px solid ${opt.accentColor}`,
                      outlineOffset: '-2px',
                    } : {}}
                  >
                    {/* Color swatch — gradient from body to accent to give depth */}
                    <div
                      className="w-10 h-10 rounded-xl shrink-0 shadow-sm border border-border/30 flex-none"
                      style={{
                        background: `linear-gradient(135deg, ${opt.accentColor}cc 0%, ${opt.accentColor} 100%)`,
                        boxShadow: isSelected ? `0 0 0 2px ${opt.accentColor}44, 0 2px 6px ${opt.accentColor}33` : undefined,
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        {/* Label uses accentColor (dark enough in both themes) — textColor is for canvas overlays only */}
                        <span
                          className="text-sm font-bold text-foreground"
                          style={isSelected ? { color: opt.accentColor } : {}}
                        >
                          {opt.label}
                        </span>
                        <span className="text-xs text-muted-foreground">{opt.sublabel}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{opt.desc}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      {opt.surcharge === 0 ? (
                        <span className="text-xs text-muted-foreground">бесплатно</span>
                      ) : (
                        <span className="text-sm font-bold flex items-center gap-0.5" style={{ color: opt.accentColor }}>+{opt.surcharge} <TgStar size={13} /></span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Gift ribbon ── */}
          <div>
            <h2 className="text-base font-bold mb-3">Подарочная лента</h2>
            <button
              onClick={() => setGiftWrap(v => !v)}
              className={cn(
                'w-full flex items-center justify-between p-4 rounded-2xl transition-all duration-150',
                giftWrap
                  ? 'ring-2 ring-rose-500/60 bg-rose-500/10'
                  : 'border border-border/60 bg-card/40 hover:bg-card/60'
              )}
            >
              <div className="flex items-center gap-3">
                <Ribbon size={22} className="text-rose-400 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-left">Атласная лента с бантом</p>
                  <p className="text-xs text-muted-foreground text-left">Двойной узел, фирменная карточка</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-muted-foreground flex items-center gap-0.5">+2 <TgStar size={11} /></span>
                <div className={cn(
                  'w-11 h-6 rounded-full transition-all duration-200 relative',
                  giftWrap ? 'bg-rose-500' : 'bg-muted'
                )}>
                  <div className={cn(
                    'absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all duration-200',
                    giftWrap ? 'left-6' : 'left-1'
                  )} />
                </div>
              </div>
            </button>
          </div>

          {/* ── Gift message ── */}
          <div>
            <h2 className="text-base font-bold mb-1">Сообщение-вкладыш</h2>
            <p className="text-xs text-muted-foreground mb-3">Распечатаем на карточке и вложим в коробку</p>
            <textarea
              maxLength={120}
              rows={3}
              placeholder="Например: «С днём рождения! Пусть время работает на тебя.»"
              value={message}
              onChange={e => setMessage(e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-sm text-foreground border border-border/60 bg-card/80 focus:outline-none focus:ring-2 focus:ring-primary/60 placeholder:text-muted-foreground/50 resize-none"
            />
            <p className="text-[11px] text-muted-foreground text-right mt-1">{message.length} / 120</p>
          </div>

          {/* ── Summary ── */}
          <div className="liquid-glass rounded-2xl p-4 space-y-2 text-sm">
            {([
              ['Базовая стоимость', config.priceStars != null ? <span className="flex items-center gap-0.5 font-medium">{config.priceStars} <TgStar size={11} /></span> : <span className="font-medium">…</span>],
              ['Упаковка',         boxOption.surcharge > 0 ? <span className="flex items-center gap-0.5 font-medium">+{boxOption.surcharge} <TgStar size={11} /></span> : <span className="font-medium">бесплатно</span>],
              ['Лента',            giftWrap ? <span className="flex items-center gap-0.5 font-medium">+2 <TgStar size={11} /></span> : <span className="font-medium">—</span>],
            ] as [string, React.ReactNode][]).map(([k, v]) => (
              <div key={k} className="flex justify-between items-center">
                <span className="text-muted-foreground">{k}</span>
                {v}
              </div>
            ))}
            <div className="flex justify-between items-center border-t border-border/40 pt-2 mt-1">
              <span className="font-bold">Итого</span>
              <span className="font-black text-primary flex items-center gap-0.5">
                {totalStars} <TgStar size={12} />
              </span>
            </div>
          </div>

          {orderError && (
            <p className="text-xs text-red-400 text-center">{orderError}</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-6 pt-3 border-t border-border/40 shrink-0 space-y-3 sticky bottom-0 z-10 bg-background">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs text-muted-foreground uppercase tracking-widest">Итого</span>
            <span className="text-sm font-bold flex items-center gap-0.5">
              {totalStars} <TgStar size={13} />
            </span>
          </div>
          <div className="flex gap-3">
            <Link href="/configure" className="flex-none">
              <button className="liquid-button h-full px-5 py-3 text-sm font-semibold">← Назад</button>
            </Link>
            <button
              onClick={() => { setOrderError(null); setShowDeliveryModal(true); }}
              disabled={submitting}
              className="flex-1 py-3 rounded-full text-sm font-bold tracking-widest uppercase bg-primary text-white shadow-lg hover:bg-primary/90 active:scale-[0.98] disabled:opacity-60 transition-all"
            >
              {submitting
                ? 'Оформление...'
                : <span className="flex items-center justify-center gap-1">Оплатить — {totalStars} <TgStar size={13} /></span>}
            </button>
          </div>
          {orderError && (
            <p className="text-xs text-red-400 text-center">{orderError}</p>
          )}
        </div>
      </div>
    </div>

    {/* ── Delivery info modal ── */}
    {showDeliveryModal && (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}>
        <div className="w-full max-w-md rounded-3xl p-6 space-y-5 shadow-2xl bg-card border border-border/30">

          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black tracking-tight">Данные доставки</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Предзаказ · отправим через 2 месяца</p>
            </div>
            <button onClick={() => setShowDeliveryModal(false)}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted/60 text-muted-foreground transition-colors">
              <X size={16} />
            </button>
          </div>

          {/* Presale notice */}
          <div className="flex gap-3 items-start rounded-2xl px-4 py-3 text-sm"
            style={{ background: 'rgba(79,70,229,0.12)', border: '1px solid rgba(79,70,229,0.25)' }}>
            <span className="text-2xl leading-none">📦</span>
            <p className="text-muted-foreground leading-snug">
              Это <strong className="text-foreground">предзаказ</strong>. Ваши часы будут изготовлены и отправлены в течение <strong className="text-foreground">2 месяцев</strong> после оплаты.
            </p>
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
              <Mail size={11} /> E-mail для уведомлений
            </label>
            <input
              type="email"
              placeholder="your@email.com"
              value={deliveryEmail}
              onChange={e => { setDeliveryEmail(e.target.value); setDeliveryErrors(v => ({ ...v, email: undefined })); }}
              className={cn(
                'w-full px-4 py-3 rounded-xl text-sm text-foreground border bg-background/70 placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/60 transition-all',
                deliveryErrors.email ? 'border-red-400' : 'border-border/60'
              )}
            />
            {deliveryErrors.email && <p className="text-xs text-red-400">{deliveryErrors.email}</p>}
          </div>

          {/* Address */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
              <MapPin size={11} /> Адрес доставки
            </label>
            <textarea
              rows={3}
              placeholder="Страна, город, улица, дом, квартира, индекс"
              value={deliveryAddress}
              onChange={e => { setDeliveryAddress(e.target.value); setDeliveryErrors(v => ({ ...v, address: undefined })); }}
              className={cn(
                'w-full px-4 py-3 rounded-xl text-sm text-foreground border bg-background/70 placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/60 resize-none transition-all',
                deliveryErrors.address ? 'border-red-400' : 'border-border/60'
              )}
            />
            {deliveryErrors.address && <p className="text-xs text-red-400">{deliveryErrors.address}</p>}
          </div>

          <button
            onClick={handleDeliverySubmit}
            disabled={submitting}
            className="w-full py-3.5 rounded-full text-sm font-bold tracking-widest uppercase bg-primary text-white shadow-lg hover:bg-primary/90 active:scale-[0.98] disabled:opacity-60 transition-all flex items-center justify-center gap-2"
          >
            {submitting
              ? <><span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" /> Оформление…</>
              : <span className="flex items-center gap-1.5">Перейти к оплате — {totalStars} <TgStar size={13} /></span>}
          </button>
        </div>
      </div>
    )}
    </>
  );
}
