import React, { useState, lazy, Suspense } from 'react';
import { Link, useParams, useLocation } from 'wouter';
import { useGetOrder, useGetConfiguration, getConfiguration } from '@workspace/api-client-react';
import { TgStar } from '@/components/TgStar';
import { cn } from '@/lib/utils';
import { useWatchConfig } from '@/hooks/use-watch-config';
import {
  CreditCard, CheckCircle2, Clock, Settings2, Truck, Package,
  XCircle, ClipboardList, RotateCcw, ArrowLeft,
} from 'lucide-react';
import ConfigReceipt from '@/components/ConfigReceipt';

const WatchBoxScene = lazy(() => import('@/components/WatchBoxScene'));

const STATUS_LABELS: Record<string, string> = {
  payment_pending: 'Ожидает оплаты',
  paid: 'Оплачен',
  cancel_requested: 'Отмена на рассмотрении',
  processing: 'В производстве',
  shipping: 'Отправлен',
  arrived: 'Доставлен',
  cancelled: 'Отменён',
};

const STATUS_COLORS: Record<string, string> = {
  payment_pending: 'text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:border-amber-800',
  paid: 'text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800',
  cancel_requested: 'text-orange-600 bg-orange-50 border-orange-200',
  processing: 'text-blue-600 bg-blue-50 border-blue-200',
  shipping: 'text-violet-600 bg-violet-50 border-violet-200',
  arrived: 'text-emerald-700 bg-emerald-100 border-emerald-300',
  cancelled: 'text-red-600 bg-red-50 border-red-200',
};

const STATUS_ICON_MAP: Record<string, React.ReactNode> = {
  payment_pending: <CreditCard size={15} className="text-yellow-500 shrink-0" />,
  paid:            <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />,
  cancel_requested:<Clock size={15} className="text-orange-400 shrink-0" />,
  processing:      <Settings2 size={15} className="text-blue-400 shrink-0" />,
  shipping:        <Truck size={15} className="text-sky-500 shrink-0" />,
  arrived:         <Package size={15} className="text-indigo-500 shrink-0" />,
  cancelled:       <XCircle size={15} className="text-red-500 shrink-0" />,
};

const TIMELINE_STEPS = [
  { status: 'payment_pending', label: 'Ожидает оплаты', icon: CreditCard },
  { status: 'paid',            label: 'Оплачен',         icon: CheckCircle2 },
  { status: 'processing',      label: 'В производстве',  icon: Settings2 },
  { status: 'shipping',        label: 'Отправлен',       icon: Truck },
  { status: 'arrived',         label: 'Доставлен',       icon: Package },
];

function StatusTimeline({ status }: { status: string }) {
  if (status === 'cancelled' || status === 'cancel_requested') return null;
  const current = TIMELINE_STEPS.findIndex(s => s.status === status);
  return (
    <div className="flex items-center gap-0 w-full mb-6">
      {TIMELINE_STEPS.map((step, i) => {
        const done = i < current;
        const active = i === current;
        const Icon = step.icon;
        return (
          <React.Fragment key={step.status}>
            <div className="flex flex-col items-center flex-none">
              <div className={cn(
                'w-7 h-7 rounded-full flex items-center justify-center border-2 transition-all',
                done  ? 'bg-primary border-primary text-white' :
                active ? 'bg-primary/10 border-primary text-primary' :
                         'bg-muted/60 border-border/60 text-muted-foreground/50'
              )}>
                <Icon size={13} />
              </div>
              <span className={cn(
                'text-[9px] mt-1 font-semibold text-center leading-tight max-w-[52px]',
                active ? 'text-primary' : done ? 'text-foreground/60' : 'text-muted-foreground/40'
              )}>{step.label}</span>
            </div>
            {i < TIMELINE_STEPS.length - 1 && (
              <div className={cn('flex-1 h-0.5 mb-4', i < current ? 'bg-primary' : 'bg-border/50')} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

async function cancelFree(orderId: number) {
  const jwt = localStorage.getItem('jwt') ?? '';
  const res = await fetch(`/api/orders/${orderId}/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
    body: JSON.stringify({ cancelComment: 'Отменён пользователем' }),
  });
  if (!res.ok) throw new Error();
}

async function requestCancel(orderId: number, reason: string) {
  const jwt = localStorage.getItem('jwt') ?? '';
  const res = await fetch(`/api/orders/${orderId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
    body: JSON.stringify({ status: 'cancel_requested' }),
  });
  if (!res.ok) throw new Error();
  await fetch(`/api/orders/${orderId}/cancel-reason`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  }).catch(() => {});
}

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const orderId = Number(id);
  const [, navigate] = useLocation();
  const { updateConfig } = useWatchConfig();

  const { data: order, isLoading, isError, refetch } = useGetOrder(orderId, {
    query: { enabled: !!orderId && !isNaN(orderId), refetchInterval: 8000 },
  } as any);

  const configId = (order as any)?.configId;
  const { data: cfg } = useGetConfiguration(configId, {
    query: { enabled: !!configId },
  } as any);

  const [boxOpen, setBoxOpen] = useState(false);
  const [actionPending, setActionPending] = useState(false);
  const [actionMsg, setActionMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [repeatLoading, setRepeatLoading] = useState(false);

  const handleCancelFree = async () => {
    setActionPending(true);
    try {
      await cancelFree(orderId);
      setActionMsg({ ok: true, text: 'Заказ отменён' });
      refetch();
    } catch {
      setActionMsg({ ok: false, text: 'Ошибка — попробуйте снова' });
    } finally {
      setActionPending(false);
    }
  };

  const handleCancelRequest = async () => {
    if (!cancelReason.trim()) return;
    setActionPending(true);
    try {
      await requestCancel(orderId, cancelReason.trim());
      setActionMsg({ ok: true, text: 'Запрос на отмену отправлен' });
      setShowCancelForm(false);
      refetch();
    } catch {
      setActionMsg({ ok: false, text: 'Ошибка — попробуйте снова' });
    } finally {
      setActionPending(false);
    }
  };

  const handleRepeat = async () => {
    if (!configId) return;
    setRepeatLoading(true);
    try {
      const c = await getConfiguration(configId);
      updateConfig({
        watchfaceGeometry: (c as any).watchfaceGeometry,
        watchfaceMaterial: (c as any).watchfaceMaterial,
        watchfaceColor: (c as any).watchfaceColor,
        watchfaceSize: (c as any).watchfaceSize ? parseFloat((c as any).watchfaceSize) : 1.0,
        braceletMaterial: (c as any).braceletMaterial,
        braceletType: (c as any).braceletType,
        braceletColor: (c as any).braceletColor,
        handsEnabled: (c as any).handsEnabled,
        handsColor: (c as any).handsColor ?? undefined,
        presetId: (c as any).presetId ?? undefined,
        serialNumber: (c as any).serialNumber ?? undefined,
        boxType: undefined, boxMessage: undefined, giftWrap: undefined,
      });
      navigate('/configure');
    } catch {
      /* ignore */
    } finally {
      setRepeatLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] bg-background flex items-center justify-center">
        <div className="space-y-3 w-full max-w-sm px-6">
          {[1, 2, 3].map(i => <div key={i} className="h-8 rounded-xl bg-muted/60 animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (isError || !order) {
    return (
      <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground text-sm">Заказ не найден</p>
        <Link href="/orders"><button className="liquid-button px-4 py-2 text-sm font-bold">← Мои заказы</button></Link>
      </div>
    );
  }

  const o = order as any;

  const boxConfig = cfg ? {
    watchfaceGeometry: (cfg as any).watchfaceGeometry,
    watchfaceMaterial: (cfg as any).watchfaceMaterial,
    watchfaceColor: (cfg as any).watchfaceColor,
    braceletMaterial: (cfg as any).braceletMaterial,
    braceletType: (cfg as any).braceletType,
    braceletColor: (cfg as any).braceletColor,
    handsEnabled: (cfg as any).handsEnabled,
    handsColor: (cfg as any).handsColor,
    handsCount: (cfg as any).handsCount,
    watchfaceText: (cfg as any).watchfaceText,
    watchfaceTextMode: (cfg as any).watchfaceTextMode,
    watchfaceTextColor: (cfg as any).watchfaceTextColor,
    watchfaceSize: (cfg as any).watchfaceSize,
    strapWidth: (cfg as any).strapWidth,
    skinFullUrl: (cfg as any).skinFullUrl,
    skinStripeUrl: (cfg as any).skinStripeUrl,
  } : null;

  return (
    <div className="w-full bg-background flex flex-col md:flex-row md:overflow-hidden md:h-screen">

      {/* ── Left — box scene (full height, same pattern as BoxSetup) ── */}
      <div className="sticky top-0 z-10 w-full md:static md:w-[52%] h-[58dvh] md:h-screen shrink-0 overflow-hidden canvas-box-bg">
        {/* Inner relative div — always positioned, never overridden by md:static on the outer */}
        <div className="relative w-full h-full">

          <Link href="/orders">
            <button className="absolute top-3 left-3 z-20 canvas-overlay-btn px-3 py-1.5 text-xs font-semibold flex items-center gap-1">
              <ArrowLeft size={13} /> Заказы
            </button>
          </Link>

          {boxConfig ? (
            <Suspense fallback={
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-10 h-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              </div>
            }>
              <WatchBoxScene
                config={boxConfig as any}
                boxType={(cfg as any)?.boxType ?? 'standard'}
                open={boxOpen}
                autoOpen
                compact
                onToggle={() => setBoxOpen(v => !v)}
                className="absolute inset-0 rounded-none"
              />
            </Suspense>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-10 h-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
          )}
        </div>
      </div>

      {/* ── Right — info panel ── */}
      <div className="flex-1 md:overflow-y-auto">
        <div className="px-6 py-7 md:py-10 max-w-lg mx-auto md:mx-0">

          {/* Order header */}
          <div className="mb-6 animate-fade-up">
            <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-1">Заказ</p>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-4xl font-black tracking-tight">#{o.id}</h1>
              <span className={cn('text-xs px-3 py-1 rounded-full font-bold border flex items-center gap-1.5', STATUS_COLORS[o.status] ?? 'text-muted-foreground bg-muted border-border')}>
                {STATUS_ICON_MAP[o.status]}
                {STATUS_LABELS[o.status] ?? o.status}
              </span>
            </div>
            <p className="text-3xl font-black text-primary flex items-center gap-1.5 mt-3">
              {o.totalStars} <TgStar size={22} />
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              {new Date(o.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
            {o.cancelComment && (
              <p className="text-xs text-orange-600 mt-2 italic">"{o.cancelComment}"</p>
            )}
          </div>

          {/* Status timeline */}
          <div className="animate-fade-up delay-100">
            <StatusTimeline status={o.status} />
          </div>

          {/* Tracking */}
          {o.trackingCode && (
            <div className="liquid-glass rounded-2xl p-4 mb-4 animate-fade-up delay-100">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">Трек-номер</p>
              <p className="font-mono font-bold text-foreground text-sm">{o.trackingCode}</p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 mb-5 animate-fade-up delay-200">
            {o.status === 'payment_pending' && (
              <Link href={`/payment/${o.id}`}>
                <button className="bg-primary text-white rounded-full px-5 py-2.5 text-sm font-black tracking-widest hover:bg-primary/90 transition-all active:scale-[0.98]">
                  Оплатить
                </button>
              </Link>
            )}

            {configId && (
              <button
                onClick={handleRepeat}
                disabled={repeatLoading}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-full text-sm font-bold border border-border/60 bg-secondary/60 text-secondary-foreground hover:bg-secondary transition-colors disabled:opacity-50"
              >
                <RotateCcw size={13} className={repeatLoading ? 'animate-spin' : ''} />
                {repeatLoading ? '…' : 'Повторить'}
              </button>
            )}

            {o.status === 'payment_pending' && !showCancelForm && (
              <button
                onClick={handleCancelFree}
                disabled={actionPending}
                className="px-4 py-2.5 rounded-full text-sm font-bold bg-red-50 text-red-500 border border-red-100 hover:bg-red-100 transition-colors disabled:opacity-50"
              >
                {actionPending ? '…' : 'Отменить'}
              </button>
            )}

            {(o.status === 'paid' || o.status === 'processing') && !showCancelForm && (
              <button
                onClick={() => setShowCancelForm(true)}
                className="px-4 py-2.5 rounded-full text-sm font-bold bg-orange-50 text-orange-600 border border-orange-200 hover:bg-orange-100 transition-colors"
              >
                Запросить отмену
              </button>
            )}
          </div>

          {actionMsg && (
            <p className={cn('text-xs font-semibold mb-4', actionMsg.ok ? 'text-emerald-600' : 'text-red-500')}>
              {actionMsg.text}
            </p>
          )}

          {/* Cancel form */}
          {showCancelForm && (
            <div className="liquid-glass rounded-2xl p-4 mb-5 space-y-2 animate-fade-up">
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-widest">Причина отмены</p>
              <textarea
                autoFocus
                rows={3}
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
                placeholder="Укажите причину..."
                maxLength={300}
                className="w-full bg-background/60 border border-border rounded-2xl px-4 py-2.5 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all resize-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => { setShowCancelForm(false); setCancelReason(''); }}
                  className="flex-1 py-2 rounded-full text-xs font-bold border border-border text-muted-foreground hover:bg-muted/50 transition-colors"
                >Отмена</button>
                <button
                  onClick={handleCancelRequest}
                  disabled={!cancelReason.trim() || actionPending}
                  className="flex-1 py-2 rounded-full bg-orange-500 text-white text-xs font-bold hover:bg-orange-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {actionPending ? '…' : 'Отправить запрос'}
                </button>
              </div>
            </div>
          )}

          {/* Box note */}
          {o.boxMessage && (
            <div className="liquid-glass rounded-2xl p-4 mb-4 animate-fade-up delay-250 flex items-start gap-3">
              <span className="text-2xl leading-none">🗒️</span>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">Сообщение-вкладыш</p>
                <p className="text-sm text-foreground italic leading-relaxed">«{o.boxMessage}»</p>
              </div>
            </div>
          )}

          {/* Receipt breakdown */}
          <div className="animate-fade-up delay-300">
            <ConfigReceipt configId={configId} totalStars={o.totalStars} alwaysOpen compact />
          </div>
        </div>
      </div>
    </div>
  );
}
