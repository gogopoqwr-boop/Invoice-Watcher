import React, { useEffect, useState } from 'react';
import { useParams, useLocation, Link } from 'wouter';
import { QRCodeSVG } from 'qrcode.react';
import { useGetOrder } from '@workspace/api-client-react';
import { cn } from '@/lib/utils';

const PAYMENT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

function formatCountdown(ms: number): string {
  if (ms <= 0) return '0:00';
  const totalSecs = Math.floor(ms / 1000);
  const m = Math.floor(totalSecs / 60);
  const s = totalSecs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function Payment() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const orderId = params.orderId;
  const { data: order, isLoading, isError } = useGetOrder(Number(orderId), {
    query: {
      enabled: !!orderId && !isNaN(Number(orderId)),
      // Don't retry 404s — the order either exists or it doesn't
      retry: (failureCount, error: any) => {
        if (error?.status === 404 || error?.status === 400) return false;
        return failureCount < 2;
      },
      refetchInterval: (query) => {
        // Stop polling once paid, cancelled, or errored
        const status = (query.state.data as any)?.status;
        if (!status || status === 'payment_pending') return 3000;
        return false;
      },
    },
  } as any);
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  const botUsername = import.meta.env.VITE_TELEGRAM_BOT_USERNAME || 'bebebeabot';
  const deepLink = `tg://resolve?domain=${botUsername}&start=pay_${orderId}`;
  const webLink = `https://t.me/${botUsername}?start=pay_${orderId}`;

  // Redirect when payment is confirmed
  useEffect(() => {
    if (order?.status && order.status !== 'payment_pending' && order.status !== 'cancelled') {
      setTimeout(() => setLocation('/orders'), 2000);
    }
  }, [order?.status, setLocation]);

  // 10-minute countdown from order creation
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
        <div className="text-5xl mb-2">🔍</div>
        <p className="text-lg font-bold">Заказ не найден</p>
        <p className="text-sm text-muted-foreground">Проверьте ссылку или создайте новый заказ</p>
        <div className="flex gap-3 mt-2">
          <Link href="/orders">
            <button className="liquid-button px-6 py-3 text-sm font-semibold">📦 Мои заказы</button>
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
    <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full pointer-events-none"
        style={{ background: "var(--orb-1)", filter: "blur(110px)", opacity: 0.5 }} />

      {/* Back to configure */}
      <div className="absolute top-4 left-4 z-10">
        <Link href="/configure">
          <button className="liquid-button px-3 py-1.5 text-xs font-semibold">← К настройке</button>
        </Link>
      </div>

      {/* My orders shortcut */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
        <Link href="/orders">
          <button className="liquid-button px-3 py-1.5 text-xs font-semibold">📦 Мои заказы</button>
        </Link>
      </div>

      <div className="liquid-glass rounded-3xl p-8 max-w-sm w-full flex flex-col items-center text-center relative z-10 gap-5 animate-shimmer-in">

        {isPaid ? (
          <>
            <div className="text-6xl">✅</div>
            <h1 className="text-2xl font-black">Оплачено!</h1>
            <p className="text-muted-foreground text-sm">Перенаправляем в мои заказы…</p>
          </>
        ) : expired ? (
          <>
            <div className="text-6xl">⏰</div>
            <h1 className="text-2xl font-black">Время истекло</h1>
            <p className="text-muted-foreground text-sm">Окно оплаты закрылось. Создайте новый заказ.</p>
            <Link href="/configure" className="w-full">
              <button className="w-full bg-primary text-white rounded-full py-3.5 font-bold text-sm tracking-widest uppercase shadow-lg hover:bg-primary/90 active:scale-[0.98] transition-all">
                Настроить заново
              </button>
            </Link>
          </>
        ) : (
          <>
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Заказ #{orderId}</p>
              <h1 className="text-2xl font-black tracking-tight">Оплата</h1>
            </div>

            <div className="text-4xl font-black text-primary">{order.totalStars} ⭐</div>

            {/* QR Code */}
            <div className="rounded-2xl p-4 shadow-sm" style={{ background: "white" }}>
              <QRCodeSVG value={webLink} size={180} level="M" />
            </div>
            <p className="text-xs text-muted-foreground">Отсканируй QR-код в Telegram</p>

            {/* Pay button */}
            <a href={deepLink} className="w-full" onClick={() => {
              setTimeout(() => window.open(webLink, '_blank'), 500);
            }}>
              <button className="w-full bg-primary text-white rounded-full py-3.5 font-bold text-sm tracking-widest uppercase shadow-lg hover:bg-primary/90 active:scale-[0.98] transition-all">
                Открыть в Telegram
              </button>
            </a>

            <button onClick={handleCopy} className="liquid-button w-full py-3 text-sm font-semibold">
              {copied ? '✓ Скопировано!' : 'Скопировать ссылку'}
            </button>

            {/* Status + countdown */}
            <div className="flex items-center justify-between w-full text-xs">
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
  );
}
