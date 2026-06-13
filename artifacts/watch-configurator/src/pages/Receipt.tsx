import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'wouter';
import { useGetOrder } from '@workspace/api-client-react';
import WatchSVG from '@/components/WatchSVG';
import { cn } from '@/lib/utils';
import { CheckCircle2, Settings2, Truck, Package, Check } from 'lucide-react';
import { TgStar } from '@/components/TgStar';

function receiptCode(orderId: number): string {
  return `ЧАС-${orderId.toString(36).toUpperCase().padStart(5, '0')}`;
}

const TIMELINE = [
  { status: 'paid',       label: 'Оплачено',        icon: <CheckCircle2 size={18} /> },
  { status: 'processing', label: 'В производстве',   icon: <Settings2 size={18} /> },
  { status: 'shipping',   label: 'Отправлен',        icon: <Truck size={18} /> },
  { status: 'arrived',    label: 'Доставлен',        icon: <Package size={18} /> },
];

const STATUS_ORDER = ['payment_pending', 'paid', 'processing', 'shipping', 'arrived'];

export default function Receipt() {
  const params = useParams();
  const orderId = Number(params.orderId);
  const { data: order, isLoading } = useGetOrder(orderId, {
    query: { enabled: !!orderId && !isNaN(orderId), refetchInterval: 12000 },
  } as any);
  const [copied, setCopied] = useState(false);
  const [watchAngle, setWatchAngle] = useState(0);

  useEffect(() => {
    let raf: number;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      setWatchAngle(a => (a + dt * 0.04) % 360);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const code = receiptCode(orderId);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {}
  };

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] bg-background flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  const config = (order as any)?.config ?? null;
  const currentStatusIndex = STATUS_ORDER.indexOf(order?.status ?? '');

  const watchConfig = config ? {
    watchfaceGeometry: (config.watchfaceGeometry ?? 'circle') as any,
    watchfaceColor: config.watchfaceColor ?? '#C0C0C0',
    braceletColor: config.braceletColor ?? '#888888',
    braceletMaterial: (config.braceletMaterial ?? 'metal_solid') as any,
    braceletType: (config.braceletType ?? 'solid') as any,
    handsEnabled: config.handsEnabled ?? true,
    handsColor: config.handsColor ?? '#FFFFFF',
    handsCount: 3,
    watchfaceText: config.handsStyle ?? '',
    watchfaceTextMode: 'center' as const,
    watchfaceBackgroundType: 'solid' as const,
  } : null;

  const isCancelled = order?.status === 'cancelled';

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center p-4 pb-10 relative overflow-hidden">
      <div
        className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[700px] h-[600px] rounded-full pointer-events-none"
        style={{ background: 'var(--orb-1)', filter: 'blur(130px)', opacity: 0.4 }}
      />

      <Link href="/orders">
        <button className="absolute top-4 left-4 z-10 liquid-button px-3 py-1.5 text-xs font-semibold">
          ← Мои заказы
        </button>
      </Link>

      <div className="relative z-10 w-full max-w-sm flex flex-col gap-4 animate-fade-up">

        {/* Receipt card */}
        <div className="liquid-glass rounded-3xl overflow-hidden shadow-2xl">

          {/* Header strip */}
          <div className="bg-primary/10 border-b border-primary/20 px-6 pt-5 pb-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.35em] text-muted-foreground font-semibold">Чеблячас</p>
              <h1 className="text-2xl font-black tracking-tight leading-tight">Квитанция</h1>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Заказ</p>
              <p className="text-xl font-black font-mono text-primary">#{orderId}</p>
            </div>
          </div>

          {/* Watch preview — slowly swinging */}
          <div className="flex justify-center pt-7 pb-4 bg-gradient-to-b from-transparent to-muted/10">
            <div
              style={{
                width: 88,
                height: 152,
                transform: `perspective(600px) rotateY(${Math.sin(watchAngle * Math.PI / 180) * 28}deg) rotateX(${Math.cos(watchAngle * Math.PI / 180) * 6}deg)`,
                transition: 'none',
              }}
            >
              {watchConfig && <WatchSVG config={watchConfig} />}
              {!watchConfig && (
                <div className="w-full h-full flex items-center justify-center text-5xl">⌚</div>
              )}
            </div>
          </div>

          {/* Receipt code */}
          <div className="px-6 pb-2">
            <div className="bg-background/60 border border-border rounded-2xl p-4 text-center mb-3">
              <p className="text-[10px] uppercase tracking-[0.4em] text-muted-foreground mb-1.5 font-semibold">
                Код квитанции
              </p>
              <p className="text-3xl font-black font-mono tracking-[0.15em] text-primary">{code}</p>
            </div>
            <button
              onClick={handleCopy}
              className={cn(
                'w-full py-2.5 rounded-xl text-sm font-bold transition-all',
                copied
                  ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-400/40'
                  : 'liquid-button'
              )}
            >
              {copied ? <span className="flex items-center justify-center gap-1.5"><Check size={14} /> Скопировано!</span> : 'Скопировать код'}
            </button>
          </div>

          {/* Dashed divider */}
          <div className="mx-6 my-4 border-t border-dashed border-border/50" />

          {/* Order details */}
          <div className="px-6 pb-2 space-y-2 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Сумма</span>
              <span className="font-black text-lg text-yellow-500 flex items-center gap-1">{order?.totalStars ?? '—'} <TgStar size={16} /></span>
            </div>
            {config?.watchfaceGeometry && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Форма</span>
                <span className="font-semibold capitalize">{config.watchfaceGeometry}</span>
              </div>
            )}
            {config?.watchfaceMaterial && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Корпус</span>
                <span className="font-semibold capitalize">{config.watchfaceMaterial}</span>
              </div>
            )}
            {config?.braceletMaterial && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ремешок</span>
                <span className="font-semibold capitalize">{config.braceletMaterial}</span>
              </div>
            )}
            {config?.serialNumber && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Серийный №</span>
                <span className="font-mono text-xs bg-muted/50 px-2 py-0.5 rounded-md">{config.serialNumber}</span>
              </div>
            )}
          </div>

          {/* Dashed divider */}
          <div className="mx-6 my-4 border-t border-dashed border-border/50" />

          {/* Status timeline */}
          <div className="px-6 pb-5">
            <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-3 font-semibold">
              {isCancelled ? 'Заказ отменён' : 'Статус заказа'}
            </p>
            {isCancelled ? (
              <div className="flex items-center gap-3 text-red-500">
                <div className="w-7 h-7 rounded-full bg-red-500/15 border-2 border-red-400 flex items-center justify-center text-xs">❌</div>
                <span className="text-sm font-semibold">Отменён</span>
              </div>
            ) : (
              <div className="space-y-2.5">
                {TIMELINE.map((step) => {
                  const stepIndex = STATUS_ORDER.indexOf(step.status);
                  const isDone = currentStatusIndex > stepIndex && currentStatusIndex > 0;
                  const isCurrent = order?.status === step.status;
                  return (
                    <div
                      key={step.status}
                      className={cn('flex items-center gap-3 transition-opacity', isDone || isCurrent ? 'opacity-100' : 'opacity-25')}
                    >
                      <div
                        className={cn(
                          'w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs shrink-0 transition-all',
                          isDone
                            ? 'bg-primary border-primary text-white'
                            : isCurrent
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border text-muted-foreground'
                        )}
                      >
                        {isDone ? <Check size={13} /> : step.icon}
                      </div>
                      <span className={cn('text-sm font-semibold flex-1', isCurrent ? 'text-primary' : isDone ? 'text-foreground' : 'text-muted-foreground')}>
                        {step.label}
                      </span>
                      {isCurrent && <div className="w-2 h-2 rounded-full bg-primary animate-pulse shrink-0" />}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="bg-muted/20 border-t border-border/30 px-6 py-2.5 text-center">
            <p className="text-[10px] uppercase tracking-[0.4em] text-muted-foreground/40 font-semibold">
              Чеблячас © 2026 · все права у меня
            </p>
          </div>
        </div>

        <Link href="/collections">
          <button className="w-full liquid-button py-3.5 text-sm font-bold text-center rounded-2xl">
            + Выбрать ещё часы
          </button>
        </Link>
      </div>
    </div>
  );
}
