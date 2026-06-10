import React from "react";
import { useWatchConfig } from "@/hooks/use-watch-config";
import { useGetMyOrders } from "@workspace/api-client-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<string, string> = {
  payment_pending: 'Ожидает оплаты',
  processing: 'В производстве',
  shipping: 'Отправлен',
  arrived: 'Доставлен',
  cancelled: 'Отменён',
};

const STATUS_COLORS: Record<string, string> = {
  payment_pending: 'text-amber-600 bg-amber-50 border-amber-200',
  processing: 'text-blue-600 bg-blue-50 border-blue-200',
  shipping: 'text-violet-600 bg-violet-50 border-violet-200',
  arrived: 'text-emerald-600 bg-emerald-50 border-emerald-200',
  cancelled: 'text-red-600 bg-red-50 border-red-200',
};

export default function Orders() {
  const { sessionId } = useWatchConfig();
  const { data: orders, isLoading } = useGetMyOrders({ sessionId }, { query: { enabled: !!sessionId } } as any);

  return (
    <div className="min-h-[100dvh] bg-background p-6 md:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground mb-1">История</p>
            <h1 className="text-3xl font-bold tracking-tight">Мои заказы</h1>
          </div>
          <Link href="/presets">
            <button className="liquid-button px-4 py-2 text-sm font-semibold">+ Новый</button>
          </Link>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="liquid-glass rounded-2xl h-20 animate-pulse" />)}
          </div>
        ) : !orders?.length ? (
          <div className="liquid-glass rounded-3xl p-12 flex flex-col items-center text-center">
            <div className="text-5xl mb-4">⌚</div>
            <h2 className="text-xl font-bold mb-2">Заказов пока нет</h2>
            <p className="text-muted-foreground mb-6 text-sm">Создайте свои уникальные часы</p>
            <Link href="/presets">
              <button className="bg-primary text-white rounded-full px-8 py-3 font-bold text-sm tracking-widest hover:bg-primary/90 transition-all active:scale-[0.98]">
                Начать
              </button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order: any) => (
              <div key={order.id} className="liquid-glass rounded-2xl p-5 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className="font-bold text-sm font-mono text-foreground">#{order.id}</span>
                    <span className={cn('text-xs px-2.5 py-0.5 rounded-full font-semibold border', STATUS_COLORS[order.status] ?? 'text-muted-foreground bg-muted border-border')}>
                      {STATUS_LABELS[order.status] ?? order.status}
                    </span>
                  </div>
                  <p className="text-xl font-bold text-primary">{order.totalStars} ⭐</p>
                </div>

                {order.status === 'payment_pending' && (
                  <Link href={`/payment/${order.id}`}>
                    <button className="bg-primary text-white rounded-full px-4 py-2 text-xs font-bold tracking-widest hover:bg-primary/90 transition-all whitespace-nowrap">
                      Оплатить
                    </button>
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
