import React, { useState, useEffect } from 'react';
import { useLocation, Link } from 'wouter';
import { useWatchConfig, BoxType } from '@/hooks/use-watch-config';
import {
  useCreateConfiguration,
  useCreateOrder,
  useCalculatePrice,
} from '@workspace/api-client-react';
import { cn } from '@/lib/utils';

// ─── Box SVG illustrations ──────────────────────────────────────────────────

function StandardBoxSVG({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 220 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <defs>
        <linearGradient id="std-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1e293b" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>
        <linearGradient id="std-lid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#334155" />
          <stop offset="100%" stopColor="#1e293b" />
        </linearGradient>
        <linearGradient id="std-interior" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0f172a" />
          <stop offset="100%" stopColor="#020617" />
        </linearGradient>
      </defs>
      {/* Box body */}
      <rect x="20" y="100" width="180" height="90" rx="6" fill="url(#std-body)" />
      {/* Interior visible when open */}
      {open && (
        <rect x="26" y="106" width="168" height="78" rx="4" fill="url(#std-interior)" />
      )}
      {/* Watch pillow inside */}
      {open && (
        <>
          <ellipse cx="110" cy="145" rx="42" ry="22" fill="#1e293b" stroke="#334155" strokeWidth="1" />
          <ellipse cx="110" cy="145" rx="16" ry="10" fill="#0f172a" stroke="#475569" strokeWidth="0.5" />
        </>
      )}
      {/* Lid */}
      <rect
        x="20" y={open ? 10 : 58} width="180" height="48" rx="6"
        fill="url(#std-lid)"
        style={{ transition: 'y 0.6s cubic-bezier(0.34,1.56,0.64,1)' }}
      />
      {/* Magnetic dot */}
      <circle cx="110" cy={open ? 34 : 82} r="4" fill="#475569"
        style={{ transition: 'cy 0.6s cubic-bezier(0.34,1.56,0.64,1)' }} />
      <circle cx="110" cy={open ? 34 : 82} r="2" fill="#64748b"
        style={{ transition: 'cy 0.6s cubic-bezier(0.34,1.56,0.64,1)' }} />
      {/* Brand */}
      <text x="110" y={open ? 26 : 76} textAnchor="middle" fill="#475569" fontSize="7" fontFamily="system-ui" letterSpacing="2"
        style={{ transition: 'y 0.6s cubic-bezier(0.34,1.56,0.64,1)' }}>
        ЧЕБЛЯЧАС
      </text>
      {/* Side detail lines */}
      <line x1="20" y1="112" x2="200" y2="112" stroke="#334155" strokeWidth="0.5" />
      <line x1="20" y1="183" x2="200" y2="183" stroke="#334155" strokeWidth="0.5" />
    </svg>
  );
}

function PremiumBoxSVG({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 220 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <defs>
        <linearGradient id="prm-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1a0a00" />
          <stop offset="100%" stopColor="#0d0500" />
        </linearGradient>
        <linearGradient id="prm-lid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2d1100" />
          <stop offset="100%" stopColor="#1a0a00" />
        </linearGradient>
        <linearGradient id="prm-velvet" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4a1942" />
          <stop offset="100%" stopColor="#2d0f29" />
        </linearGradient>
      </defs>
      {/* Box body */}
      <rect x="20" y="100" width="180" height="90" rx="6" fill="url(#prm-body)" />
      {/* Gold border body */}
      <rect x="20" y="100" width="180" height="90" rx="6" fill="none" stroke="#b8860b" strokeWidth="1.5" />
      {/* Velvet interior */}
      {open && (
        <rect x="26" y="106" width="168" height="78" rx="4" fill="url(#prm-velvet)" />
      )}
      {/* Watch cushion */}
      {open && (
        <>
          <ellipse cx="110" cy="145" rx="42" ry="22" fill="#3d1538" stroke="#6b3060" strokeWidth="1" />
          <ellipse cx="110" cy="145" rx="16" ry="10" fill="#2d0f29" stroke="#c0a060" strokeWidth="0.5" />
        </>
      )}
      {/* Lid */}
      <rect x="20" y={open ? 10 : 58} width="180" height="48" rx="6"
        fill="url(#prm-lid)"
        style={{ transition: 'y 0.6s cubic-bezier(0.34,1.56,0.64,1)' }}
      />
      <rect x="20" y={open ? 10 : 58} width="180" height="48" rx="6"
        fill="none" stroke="#b8860b" strokeWidth="1.5"
        style={{ transition: 'y 0.6s cubic-bezier(0.34,1.56,0.64,1)' }}
      />
      {/* Gold hinge */}
      <rect x="100" y={open ? 55 : 103} width="20" height="5" rx="2.5" fill="#b8860b"
        style={{ transition: 'y 0.6s cubic-bezier(0.34,1.56,0.64,1)' }} />
      {/* Brand on lid */}
      <text x="110" y={open ? 40 : 88} textAnchor="middle" fill="#b8860b" fontSize="8" fontFamily="system-ui" letterSpacing="3"
        style={{ transition: 'y 0.6s cubic-bezier(0.34,1.56,0.64,1)' }}>
        ЧЕБЛЯЧАС
      </text>
      <text x="110" y={open ? 50 : 98} textAnchor="middle" fill="#7a5c00" fontSize="5" fontFamily="system-ui" letterSpacing="1"
        style={{ transition: 'y 0.6s cubic-bezier(0.34,1.56,0.64,1)' }}>
        PREMIUM
      </text>
      {/* Corner accents */}
      {[{x:20,y:100},{x:196,y:100},{x:20,y:186},{x:196,y:186}].map((c, i) => (
        <circle key={i} cx={c.x} cy={c.y} r="3" fill="#b8860b" />
      ))}
    </svg>
  );
}

function CollectorBoxSVG({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 220 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <defs>
        <linearGradient id="col-body" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#5c3d1e" />
          <stop offset="100%" stopColor="#3b2410" />
        </linearGradient>
        <linearGradient id="col-lid" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7c5228" />
          <stop offset="100%" stopColor="#5c3d1e" />
        </linearGradient>
        <linearGradient id="col-satin" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1e3a5f" />
          <stop offset="100%" stopColor="#0f1f35" />
        </linearGradient>
      </defs>
      {/* Box body */}
      <rect x="20" y="100" width="180" height="90" rx="4" fill="url(#col-body)" />
      {/* Wood grain lines */}
      {[108,116,124,132,140,148,156,164,172,180].map((y, i) => (
        <line key={i} x1="20" y1={y} x2="200" y2={y} stroke="#4a3018" strokeWidth="0.5" strokeOpacity="0.6" />
      ))}
      {/* Satin interior */}
      {open && (
        <rect x="26" y="106" width="168" height="78" rx="3" fill="url(#col-satin)" />
      )}
      {/* Watch cushion */}
      {open && (
        <>
          <ellipse cx="110" cy="145" rx="44" ry="24" fill="#142847" stroke="#1e3a5f" strokeWidth="1" />
          <ellipse cx="110" cy="145" rx="17" ry="11" fill="#0f1f35" stroke="#9ca3af" strokeWidth="0.5" />
        </>
      )}
      {/* Lid */}
      <rect x="20" y={open ? 8 : 56} width="180" height="50" rx="4"
        fill="url(#col-lid)"
        style={{ transition: 'y 0.6s cubic-bezier(0.34,1.56,0.64,1)' }}
      />
      {/* Wood grain on lid */}
      {[open ? 20 : 68, open ? 28 : 76, open ? 36 : 84, open ? 44 : 92, open ? 52 : 100].map((y, i) => (
        <line key={i} x1="20" y1={y} x2="200" y2={y} stroke="#4a3018" strokeWidth="0.4" strokeOpacity="0.5"
          style={{ transition: 'y 0.6s cubic-bezier(0.34,1.56,0.64,1)' }} />
      ))}
      {/* Brass corners — body */}
      {([{x:20,y:100},{x:200,y:100},{x:20,y:190},{x:200,y:190}] as {x:number;y:number}[]).map((c, i) => (
        <g key={i}>
          <rect x={c.x - 5} y={c.y - 5} width="10" height="10" rx="1" fill="#b8860b" />
          <rect x={c.x - 3} y={c.y - 3} width="6" height="6" rx="0.5" fill="#daa520" />
        </g>
      ))}
      {/* Brass plate on lid */}
      <rect x="75" y={open ? 22 : 70} width="70" height="22" rx="2" fill="#b8860b"
        style={{ transition: 'y 0.6s cubic-bezier(0.34,1.56,0.64,1)' }}
      />
      <rect x="77" y={open ? 24 : 72} width="66" height="18" rx="1.5" fill="#daa520"
        style={{ transition: 'y 0.6s cubic-bezier(0.34,1.56,0.64,1)' }}
      />
      <text x="110" y={open ? 36 : 84} textAnchor="middle" fill="#3b2410" fontSize="7" fontFamily="system-ui" fontWeight="bold" letterSpacing="1"
        style={{ transition: 'y 0.6s cubic-bezier(0.34,1.56,0.64,1)' }}>
        ЧЕБЛЯЧАС
      </text>
    </svg>
  );
}

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
  const [previewOpen, setPreviewOpen] = useState(false);
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

  // Animate box open on mount
  useEffect(() => {
    const t = setTimeout(() => setPreviewOpen(true), 400);
    return () => clearTimeout(t);
  }, []);

  // Re-animate on box type change
  useEffect(() => {
    setPreviewOpen(false);
    const t = setTimeout(() => setPreviewOpen(true), 300);
    return () => clearTimeout(t);
  }, [selectedBox]);

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

  const BoxPreview =
    selectedBox === 'standard' ? StandardBoxSVG :
    selectedBox === 'premium'  ? PremiumBoxSVG  :
                                 CollectorBoxSVG;

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

        <div className="w-full max-w-[280px] aspect-square drop-shadow-2xl">
          <BoxPreview open={previewOpen} />
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
                <span className="text-2xl">🎀</span>
                <div>
                  <p className="text-sm font-semibold text-left">Атласная лента с бантом</p>
                  <p className="text-xs text-muted-foreground text-left">Двойной узел, фирменная карточка</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-muted-foreground">+2 ⭐</span>
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
            {[
              ['Базовая стоимость', basePrice !== null ? `${basePrice} ⭐` : '…'],
              ['Упаковка', boxOption.surcharge > 0 ? `+${boxOption.surcharge} ⭐` : 'бесплатно'],
              ['Лента', giftWrap ? '+2 ⭐' : '—'],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <span className="text-muted-foreground">{k}</span>
                <span className="font-medium">{v}</span>
              </div>
            ))}
            <div className="flex justify-between border-t border-border/40 pt-2 mt-1">
              <span className="font-bold">Итого</span>
              <span className="font-black text-primary">
                {basePrice !== null ? `${totalStars} ⭐` : '…'}
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
              ? `Оплатить — ${totalStars} ⭐`
              : 'Оплатить →'}
          </button>
        </div>
      </div>
    </div>
  );
}
