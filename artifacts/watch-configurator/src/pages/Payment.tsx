import React, { useEffect, useState, lazy, Suspense } from 'react';
import { useParams, useLocation, Link } from 'wouter';
import { QRCodeSVG } from 'qrcode.react';
import { useGetOrder, useGetConfiguration, useCreateOrder } from '@workspace/api-client-react';
import { cn } from '@/lib/utils';
import { Package, CheckCircle2, RefreshCw, Check } from 'lucide-react';
import { TgStar } from '@/components/TgStar';

const WatchBoxScene = lazy(() => import('@/components/WatchBoxScene'));

const PAYMENT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

function formatCountdown(ms: number): string {
  if (ms <= 0) return '0:00';
  const totalSecs = Math.floor(ms / 1000);
  const m = Math.floor(totalSecs / 60);
  const s = totalSecs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ─── Watch + box preview panel ──────────────────────────────────────────────

function WatchPreviewPanel({ configId }: { configId: number }) {
  const { data: cfg } = useGetConfiguration(configId, {
    query: { enabled: !!configId },
  } as any);
  const [open, setOpen] = useState(false);

  return (
    <div className="relative w-full h-full min-h-[260px] flex items-center justify-center overflow-hidden">
      <Suspense fallback={
        <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
          <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      }>
        <WatchBoxScene
          config={{
            watchfaceGeometry:    cfg?.watchfaceGeometry,
            watchfaceMaterial:    cfg?.watchfaceMaterial,
            watchfaceColor:       cfg?.watchfaceColor,
            braceletMaterial:     cfg?.braceletMaterial,
            braceletType:         cfg?.braceletType,
            braceletColor:        cfg?.braceletColor,
            handsEnabled:         cfg?.handsEnabled,
            handsColor:           cfg?.handsColor,
            handsCount:           (cfg as any)?.handsCount,
            watchfaceText:        (cfg as any)?.watchfaceText ?? (cfg as any)?.handsStyle,
            watchfaceTextMode:    (cfg as any)?.watchfaceTextMode,
            watchfaceTextColor:   (cfg as any)?.watchfaceTextColor,
            watchfaceSize:        (cfg as any)?.watchfaceSize,
            strapWidth:           (cfg as any)?.strapWidth,
            skinFullUrl:          (cfg as any)?.skinFullUrl,
            skinStripeUrl:        (cfg as any)?.skinStripeUrl,
          } as any}
          boxType={cfg?.boxType ?? 'standard'}
          open={open}
          autoOpen
          onToggle={() => setOpen(v => !v)}
          className="h-full w-full"
        />
      </Suspense>
    </div>
  );
}

// ─── Payment page ───────────────────────────────────────────────────────────

export default function Payment() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const orderId = params.orderId;

  const { data: order, isLoading, isError } = useGetOrder(Number(orderId), {
    query: {
      enabled: !!orderId && !isNaN(Number(orderId)),
      retry: (failureCount: number, error: any) => {
        if (error?.status === 404 || error?.status === 400) return false;
        return failureCount < 2;
      },
      refetchInterval: (query: any) => {
        const status = (query.state.data as any)?.status;
        if (!status || status === 'payment_pending') return 3000;
        return false;
      },
    },
  } as any);

  const { mutateAsync: createOrder, isPending: isCreating } = useCreateOrder();
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  const botUsername = import.meta.env.VITE_TELEGRAM_BOT_USERNAME || 'bebebeabot';
  const payParam = (order as any)?.paymentToken ? `pay_${(order as any).paymentToken}` : `pay_${orderId}`;
  const deepLink = `tg://resolve?domain=${botUsername}&start=${payParam}`;
  const webLink = `https://t.me/${botUsername}?start=${payParam}`;

  useEffect(() => {
    if (order?.status && order.status !== 'payment_pending' && order.status !== 'cancelled') {
      setTimeout(() => setLocation('/orders'), 2000);
    }
  }, [order?.status, setLocation]);

  useEffect(() => {
    if (!order?.createdAt) return;
    const deadline = new Date(order.createdAt).getTime() + PAYMENT_WINDOW_MS;
    const tick = () => {
      const remaining = deadline - Date.now();
      setTimeLeft(remaining > 0 ? remaining : 0);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [order?.createdAt]);

  const handleRepeatPayment = async () => {
    if (!order?.configId || !order?.totalStars) return;
    try {
      const newOrder = await createOrder({ data: { configId: order.configId, totalStars: order.totalStars } });
      setLocation(`/payment/${newOrder.id}`);
    } catch {}
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(webLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] bg-background flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!order || isError) {
    return (
      <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center gap-4 p-4">
        <div className="mb-2 text-muted-foreground/30"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg></div>
        <p className="text-lg font-bold">Заказ не найден</p>
        <p className="text-sm text-muted-foreground">Проверьте ссылку или создайте новый заказ</p>
        <div className="flex gap-3 mt-2">
          <Link href="/orders">
            <button className="liquid-button px-6 py-3 text-sm font-semibold flex items-center gap-2"><Package size={14} /> Мои заказы</button>
          </Link>
          <Link href="/configure">
            <button className="bg-primary text-white rounded-full px-6 py-3 text-sm font-bold hover:bg-primary/90 transition-all">
              Настроить заново
            </button>
          </Link>
        </div>
      </div>
    );
  }

  const isPaid = order.status !== 'payment_pending' && order.status !== 'cancelled';
  const expired = timeLeft === 0;

  return (
    <div className="min-h-[100dvh] bg-background relative overflow-x-hidden">
      {/* Ambient orbs */}
      <div className="fixed top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full pointer-events-none"
        style={{ background: "var(--orb-1)", filter: "blur(110px)", opacity: 0.45 }} />

      {/* Top nav — fixed so it never scrolls away */}
      <div className="fixed top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-3 pointer-events-none">
        <Link href="/configure" className="pointer-events-auto">
          <button className="liquid-button px-3 py-1.5 text-xs font-semibold">← К настройке</button>
        </Link>
        <Link href="/orders" className="pointer-events-auto">
          <button className="liquid-button px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5"><Package size={12} /> Мои заказы</button>
        </Link>
      </div>

      {/* Scrollable content — padded under the fixed nav */}
      <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-center
                      min-h-[100dvh] pt-14 px-4 pb-4 gap-4 animate-shimmer-in max-w-2xl mx-auto">

        {/* ── Watch preview — compact on mobile, taller on desktop ── */}
        <div className="liquid-glass rounded-3xl overflow-hidden md:w-[44%] flex-none flex flex-col">
          <div className="h-[180px] md:h-[300px]">
            {order.configId ? (
              <WatchPreviewPanel configId={order.configId} />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
                Ваши часы
              </div>
            )}
          </div>
          {/* Config badge */}
          <div className="px-5 pb-4 pt-2 text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-widest">Заказ #{orderId}</p>
            <p className="text-lg font-black tabular-nums mt-0.5 flex items-center justify-center gap-1">{order.totalStars} <TgStar size={15} /></p>
          </div>
        </div>

        {/* ── Right: Payment card ── */}
        <div className="liquid-glass rounded-3xl p-6 flex-1 flex flex-col items-center text-center gap-4">

          {isPaid ? (
            <>
              <div className="mt-4"><CheckCircle2 size={64} className="text-emerald-500" /></div>
              <h1 className="text-2xl font-black">Оплачено!</h1>
              <p className="text-muted-foreground text-sm">Перенаправляем в мои заказы…</p>
            </>
          ) : expired ? (
            <>
              <div className="mt-4"><svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/50" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div>
              <h1 className="text-2xl font-black">Время истекло</h1>
              <p className="text-muted-foreground text-sm">Окно оплаты закрылось. Повторите оплату или настройте заново.</p>
              <div className="flex flex-col gap-3 w-full mt-auto">
                <button
                  onClick={handleRepeatPayment}
                  disabled={isCreating}
                  className="w-full bg-primary text-white rounded-full py-3.5 font-bold text-sm tracking-widest uppercase shadow-lg hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-wait flex items-center justify-center gap-2"
                >
                  {isCreating ? (
                    <>
                      <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                      Создаём заказ…
                    </>
                  ) : <span className="flex items-center gap-2"><RefreshCw size={15} /> Повторить оплату</span>}
                </button>
                <Link href="/configure" className="w-full">
                  <button className="liquid-button w-full py-3 text-sm font-semibold">
                    Настроить заново
                  </button>
                </Link>
              </div>
            </>
          ) : (
            <>
              <div>
                <h1 className="text-xl font-black tracking-tight">Оплата Telegram Stars</h1>
                <p className="text-xs text-muted-foreground mt-1">Отсканируй QR или открой в приложении</p>
              </div>

              {/* QR Code */}
              <div className="rounded-2xl p-3 shadow-sm" style={{ background: "white" }}>
                <QRCodeSVG value={webLink} size={160} level="M" />
              </div>

              {/* Pay button */}
              <a href={deepLink} className="w-full" onClick={() => {
                setTimeout(() => window.open(webLink, '_blank'), 500);
              }}>
                <button className="w-full bg-primary text-white rounded-full py-3.5 font-bold text-sm tracking-widest uppercase shadow-lg hover:bg-primary/90 active:scale-[0.98] transition-all">
                  Открыть в Telegram
                </button>
              </a>

              <button onClick={handleCopy} className="liquid-button w-full py-3 text-sm font-semibold">
                {copied ? <span className="flex items-center justify-center gap-1.5"><Check size={14} /> Скопировано!</span> : 'Скопировать ссылку'}
              </button>

              {/* Status + countdown */}
              <div className="flex items-center justify-between w-full text-xs mt-auto">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  Ожидание оплаты…
                </div>
                {timeLeft !== null && (
                  <span className={cn(
                    'font-mono font-bold tabular-nums',
                    timeLeft < 60_000 ? 'text-red-500' : timeLeft < 3 * 60_000 ? 'text-amber-500' : 'text-muted-foreground'
                  )}>
                    {formatCountdown(timeLeft)}
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
