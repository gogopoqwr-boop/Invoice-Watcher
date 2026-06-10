import React, { useEffect, useState } from 'react';
import { useParams, useLocation } from 'wouter';
import { QRCodeSVG } from 'qrcode.react';
import { useGetOrder } from '@workspace/api-client-react';
import { cn } from '@/lib/utils';

export default function Payment() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const orderId = params.orderId;
  const { data: order, isLoading } = useGetOrder(Number(orderId), {
    query: { enabled: !!orderId, refetchInterval: 3000 },
  } as any);
  const [copied, setCopied] = useState(false);

  const botUsername = 'na_utrah_4_bot';
  const deepLink = `tg://resolve?domain=${botUsername}&start=pay_${orderId}`;
  const webLink = `https://t.me/${botUsername}?start=pay_${orderId}`;

  // Redirect when payment is confirmed (status moves from payment_pending)
  useEffect(() => {
    if (order?.status && order.status !== 'payment_pending' && order.status !== 'cancelled') {
      setTimeout(() => setLocation('/orders'), 2000);
    }
  }, [order?.status, setLocation]);

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

  if (!order) {
    return (
      <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center gap-4 p-4">
        <p className="text-muted-foreground">Заказ не найден</p>
        <button onClick={() => setLocation('/configure')} className="liquid-button px-6 py-3 text-sm font-semibold">
          Вернуться к настройке
        </button>
      </div>
    );
  }

  const isPaid = order.status !== 'payment_pending' && order.status !== 'cancelled';

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center p-4">

      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-blue-100/50 blur-[100px] pointer-events-none" />

      <div className="liquid-glass rounded-3xl p-8 max-w-sm w-full flex flex-col items-center text-center relative z-10 gap-5">

        {isPaid ? (
          <>
            <div className="text-5xl">✅</div>
            <h1 className="text-2xl font-bold">Оплачено!</h1>
            <p className="text-muted-foreground text-sm">Перенаправляем в мои заказы…</p>
          </>
        ) : (
          <>
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Заказ #{orderId}</p>
              <h1 className="text-2xl font-bold tracking-tight">Оплата</h1>
            </div>

            <div className="text-4xl font-bold text-primary">{order.totalStars} ⭐</div>

            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <QRCodeSVG value={webLink} size={180} level="M" />
            </div>
            <p className="text-xs text-muted-foreground">Отсканируй QR-код в Telegram</p>

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

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              Ожидание оплаты…
            </div>
          </>
        )}
      </div>
    </div>
  );
}
