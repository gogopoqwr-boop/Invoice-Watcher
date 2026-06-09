import React from "react";
import { GlassPanel } from "@/components/ui/glass-panel";
import { useWatchConfig } from "@/hooks/use-watch-config";
import { useGetMyOrders } from "@workspace/api-client-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<string, string> = {
  pending: 'Ожидает оплаты',
  paid: 'Оплачен',
  in_production: 'В производстве',
  shipped: 'Отправлен',
  delivered: 'Доставлен',
  cancelled: 'Отменён',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'text-yellow-400 bg-yellow-400/10',
  paid: 'text-green-400 bg-green-400/10',
  in_production: 'text-blue-400 bg-blue-400/10',
  shipped: 'text-purple-400 bg-purple-400/10',
  delivered: 'text-emerald-400 bg-emerald-400/10',
  cancelled: 'text-red-400 bg-red-400/10',
};

export default function Orders() {
  const { sessionId } = useWatchConfig();
  const { data: orders, isLoading } = useGetMyOrders({ sessionId }, { query: { enabled: !!sessionId } });

  return (
    <div className="min-h-[100dvh] bg-background text-white p-6 md:p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold tracking-widest">МОИ ЗАКАЗЫ</h1>
          <Link href="/presets">
            <button className="text-sm text-primary hover:text-primary/80 transition-colors tracking-widest">+ НОВЫЙ ЗАКАЗ</button>
          </Link>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => <GlassPanel key={i} className="h-24 animate-pulse" />)}
          </div>
        ) : !orders?.length ? (
          <GlassPanel className="p-12 flex flex-col items-center text-center">
            <div className="text-5xl mb-4">⌚</div>
            <h2 className="text-xl font-bold mb-2">Заказов пока нет</h2>
            <p className="text-muted-foreground mb-6">Создайте свои уникальные часы</p>
            <Link href="/presets">
              <button className="px-6 py-3 bg-primary text-white rounded-lg font-bold tracking-widest hover:bg-primary/90 transition-colors">
                НАЧАТЬ
              </button>
            </Link>
          </GlassPanel>
        ) : (
          <div className="space-y-4">
            {orders.map(order => (
              <GlassPanel key={order.id} className="p-5 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-bold tracking-wider text-sm">#{order.id}</span>
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', STATUS_COLORS[order.status] ?? 'text-muted-foreground')}>
                      {STATUS_LABELS[order.status] ?? order.status}
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-primary">{order.totalStars} ⭐</p>
                  {order.trackingCode && (
                    <p className="text-xs text-muted-foreground mt-1 font-mono">Трек: {order.trackingCode}</p>
                  )}
                </div>

                <div className="flex flex-col gap-2 items-end">
                  {order.status === 'pending' && (
                    <Link href={`/payment/${order.id}`}>
                      <button className="px-4 py-2 bg-primary/20 text-primary border border-primary/30 rounded-lg text-xs font-bold tracking-widest hover:bg-primary/30 transition-colors whitespace-nowrap">
                        ОПЛАТИТЬ
                      </button>
                    </Link>
                  )}
                </div>
              </GlassPanel>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
