import React, { useState, useEffect } from 'react';
import { useLocation, Link } from 'wouter';
import { useWatchConfig, BoxType } from '@/hooks/use-watch-config';
import {
  useCreateConfiguration,
  useCreateOrder,
  useCalculatePrice,
} from '@workspace/api-client-react';
import { cn } from '@/lib/utils';
import WatchBoxScene from '@/components/WatchBoxScene';
import { Ribbon } from 'lucide-react';
import { TgStar } from '@/components/TgStar';


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
  const [submitting, setSubmitting] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [basePrice, setBasePrice] = useState<number | null>(null);

  const createConfig = useCreateConfiguration();
  const createOrder = useCreateOrder();
  const calcPrice = useCalculatePrice();

  useEffect(() => {
    const timer = setTimeout(() => {
      calcPrice.mutateAsync({
        data: {
          watchfaceGeometry: config.watchfaceGeometry,
          watchfaceMaterial: config.watchfaceMaterial,
          braceletMaterial: config.braceletMaterial,
          handsEnabled: config.handsEnabled,
          watchfaceText: config.watchfaceText || undefined,
        },
      }).then(r => setBasePrice(r.totalStars)).catch(() => {});
    }, 200);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const boxOption = BOX_OPTIONS.find(b => b.id === selectedBox)!;
  const totalStars = (basePrice ?? 0) + boxOption.surcharge + (giftWrap ? 2 : 0);

  const handleOrder = async () => {
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
          serialNumber: undefined,
          sessionId,
          boxType: selectedBox,
        },
      });
      const priceResult = await calcPrice.mutateAsync({
        data: {
          watchfaceGeometry: config.watchfaceGeometry,
          watchfaceMaterial: config.watchfaceMaterial,
          braceletMaterial: config.braceletMaterial,
          handsEnabled: config.handsEnabled,
          watchfaceText: config.watchfaceText || undefined,
          boxType: selectedBox,
        },
      });
      const finalStars = priceResult.totalStars + (giftWrap ? 2 : 0);
      const order = await createOrder.mutateAsync({
        data: { configId: cfg.id, sessionId, totalStars: finalStars },
      });
      setLocation(`/payment/${order.id}`);
    } catch (e) {
      console.error(e);
      setOrderError('Не удалось создать заказ. Проверьте соединение и попробуйте снова.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">

      {/* ── Left — Box preview ── */}
      <div className="w-full md:w-[44%] md:h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background to-card/60 p-8 gap-6">
        {/* Step indicator */}
        <div className="flex items-center gap-2 self-start mb-2">
          <Link href="/configure">
            <button className="liquid-button px-4 py-2 text-xs font-semibold">← Настройка</button>
          </Link>
          <div className="flex items-center gap-1.5 ml-2">
            <div className="w-2 h-2 rounded-full bg-primary/30" />
            <div className="w-2 h-2 rounded-full bg-primary/30" />
            <div className="w-2.5 h-2.5 rounded-full bg-primary shadow-sm shadow-primary/50" />
          </div>
        </div>

        <div className="w-full max-w-[360px]">
          <WatchBoxScene
            config={config}
            boxType={selectedBox}
            autoOpen
            className="h-72 md:h-80"
          />
        </div>

        <div className="text-center space-y-1">
          <p
            className="text-xl font-bold tracking-tight transition-colors duration-300"
            style={{ color: boxOption.textColor }}
          >
            {boxOption.label}
          </p>
          <p className="text-sm text-muted-foreground">{boxOption.sublabel}</p>
          <p className="text-xs text-muted-foreground/70 max-w-[220px] leading-relaxed">
            {boxOption.desc}
          </p>
        </div>
      </div>

      {/* ── Right — Options panel ── */}
      <div className="w-full md:w-[56%] md:h-screen flex flex-col bg-background/80 backdrop-blur-xl border-l border-border/60">

        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <p className="text-xs font-black text-primary uppercase tracking-widest mb-0.5">Шаг 3 из 3</p>
          <h1 className="text-2xl font-black tracking-tight">Выбор упаковки</h1>
          <p className="text-sm text-muted-foreground mt-1">Каждые часы заслуживают идеальной коробки</p>
        </div>

        {/* Scrollable options */}
        <div className="flex-1 overflow-y-auto px-6 py-2 space-y-6 pb-4">

          {/* ── Box type ── */}
          <div>
            <h2 className="text-base font-bold mb-3">Тип коробки</h2>
            <div className="space-y-2.5">
              {BOX_OPTIONS.map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setSelectedBox(opt.id)}
                  className={cn(
                    'w-full flex items-center gap-4 p-4 rounded-2xl text-left transition-all duration-150',
                    selectedBox === opt.id
                      ? 'ring-2 bg-card/80 shadow-sm'
                      : 'border border-border/60 bg-card/40 hover:bg-card/60',
                  )}
                  style={selectedBox === opt.id ? { '--tw-ring-color': opt.accentColor } as React.CSSProperties : {}}
                >
                  {/* Color swatch */}
                  <div
                    className="w-10 h-10 rounded-xl shrink-0 shadow-sm border border-white/10"
                    style={{ backgroundColor: opt.accentColor }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className={cn(
                        'text-sm font-bold',
                        selectedBox === opt.id ? '' : 'text-foreground'
                      )}
                        style={selectedBox === opt.id ? { color: opt.textColor } : {}}
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
                      <span className="text-sm font-bold text-primary">+{opt.surcharge} ⭐</span>
                    )}
                  </div>
                </button>
              ))}
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
              ['Базовая стоимость', basePrice !== null ? <span className="flex items-center gap-0.5 font-medium">{basePrice} <TgStar size={11} /></span> : <span className="font-medium">…</span>],
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
                {basePrice !== null ? <>{totalStars} <TgStar size={12} /></> : '…'}
              </span>
            </div>
          </div>

          {orderError && (
            <p className="text-xs text-red-400 text-center">{orderError}</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 pt-3 border-t border-border/40">
          <button
            onClick={handleOrder}
            disabled={submitting}
            className="w-full py-3.5 rounded-full text-sm font-bold tracking-widest uppercase bg-primary text-white shadow-lg hover:bg-primary/90 active:scale-[0.98] disabled:opacity-60 transition-all"
          >
            {submitting
              ? 'Оформление...'
              : basePrice !== null
              ? `Оплатить — ${totalStars} ★`
              : 'Оплатить →'}
          </button>
        </div>
      </div>
    </div>
  );
}
