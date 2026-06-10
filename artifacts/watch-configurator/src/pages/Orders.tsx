import React, { useState } from "react";
import { useWatchConfig } from "@/hooks/use-watch-config";
import { useGetMyOrders } from "@workspace/api-client-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";

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
  payment_pending: 'text-amber-600 bg-amber-50 border-amber-200',
  paid: 'text-emerald-600 bg-emerald-50 border-emerald-200',
  cancel_requested: 'text-orange-600 bg-orange-50 border-orange-200',
  processing: 'text-blue-600 bg-blue-50 border-blue-200',
  shipping: 'text-violet-600 bg-violet-50 border-violet-200',
  arrived: 'text-emerald-700 bg-emerald-100 border-emerald-300',
  cancelled: 'text-red-600 bg-red-50 border-red-200',
};

const STATUS_ICONS: Record<string, string> = {
  payment_pending: '💳',
  paid: '✅',
  cancel_requested: '⏳',
  processing: '⚙️',
  shipping: '🚚',
  arrived: '📦',
  cancelled: '❌',
};

async function requestCancel(orderId: number): Promise<{ ok: boolean; msg: string }> {
  try {
    const jwt = localStorage.getItem("jwt") ?? "";
    const res = await fetch(`/api/orders/${orderId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
      body: JSON.stringify({ status: "cancel_requested" }),
    });
    if (!res.ok) throw new Error();
    return { ok: true, msg: "Запрос отправлен" };
  } catch {
    return { ok: false, msg: "Ошибка сети" };
  }
}

async function cancelFree(orderId: number): Promise<{ ok: boolean; msg: string }> {
  try {
    const jwt = localStorage.getItem("jwt") ?? "";
    const res = await fetch(`/api/orders/${orderId}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
      body: JSON.stringify({ cancelComment: "Отменён пользователем" }),
    });
    if (!res.ok) throw new Error();
    return { ok: true, msg: "Отменён" };
  } catch {
    return { ok: false, msg: "Ошибка сети" };
  }
}

export default function Orders() {
  const { sessionId } = useWatchConfig();
  const { user } = useAuth();
  const { data: orders, isLoading, refetch } = useGetMyOrders({ sessionId }, { query: { enabled: !!sessionId } } as any);

  const [actionId, setActionId] = useState<number | null>(null);
  const [msgs, setMsgs] = useState<Record<number, { ok: boolean; msg: string }>>({});

  const isAdmin = user?.role === "admin";

  const handleAction = async (orderId: number, action: () => Promise<{ ok: boolean; msg: string }>) => {
    setActionId(orderId);
    const result = await action();
    setMsgs(prev => ({ ...prev, [orderId]: result }));
    setActionId(null);
    refetch();
  };

  return (
    <div className="min-h-[100dvh] bg-background relative overflow-hidden">
      {/* Ambient orb */}
      <div className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full pointer-events-none"
        style={{ background: "var(--orb-1)", filter: "blur(90px)", opacity: 0.4 }} />

      <div className="relative z-10 max-w-2xl mx-auto px-6 py-8 md:py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link href="/">
              <button className="text-xs text-muted-foreground hover:text-foreground transition-colors mb-3 flex items-center gap-1 liquid-button px-3 py-1.5">
                ← Главная
              </button>
            </Link>
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground mb-1 animate-fade-up">История</p>
            <h1 className="text-4xl font-black tracking-tight animate-fade-up delay-100">Мои заказы</h1>
          </div>
          <div className="flex flex-col gap-2 items-end animate-fade-up delay-200">
            <Link href="/collections">
              <button className="liquid-button px-5 py-2.5 text-sm font-bold">+ Новый</button>
            </Link>
            {isAdmin && (
              <Link href="/admin">
                <button className="liquid-button px-4 py-2 text-xs font-semibold">⚙️ Панель</button>
              </Link>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="liquid-glass rounded-2xl h-24 animate-pulse" />)}
          </div>
        ) : !orders?.length ? (
          <div className="liquid-glass rounded-3xl p-12 flex flex-col items-center text-center animate-shimmer-in">
            <div className="text-6xl mb-4">⌚</div>
            <h2 className="text-2xl font-black mb-2">Заказов пока нет</h2>
            <p className="text-muted-foreground mb-6 text-sm">Создайте свои уникальные часы</p>
            <Link href="/collections">
              <button className="bg-primary text-white rounded-full px-8 py-3.5 font-bold text-sm tracking-widest hover:bg-primary/90 transition-all active:scale-[0.98]">
                Начать
              </button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {(orders as any[]).map((order: any, idx: number) => (
              <div
                key={order.id}
                className="liquid-glass rounded-2xl p-5 animate-fade-up"
                style={{ animationDelay: `${idx * 0.06}s` }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="text-base">{STATUS_ICONS[order.status] ?? '📋'}</span>
                      <span className="font-black text-sm font-mono text-foreground">#{order.id}</span>
                      <span className={cn('text-xs px-2.5 py-0.5 rounded-full font-semibold border', STATUS_COLORS[order.status] ?? 'text-muted-foreground bg-muted border-border')}>
                        {STATUS_LABELS[order.status] ?? order.status}
                      </span>
                    </div>
                    <p className="text-2xl font-black text-primary">{order.totalStars} ⭐</p>
                    {order.cancelComment && (
                      <p className="text-xs text-orange-600 mt-1 italic">"{order.cancelComment}"</p>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-2 shrink-0">
                    {/* Pay button for pending */}
                    {order.status === 'payment_pending' && (
                      <Link href={`/payment/${order.id}`}>
                        <button className="bg-primary text-white rounded-full px-4 py-2 text-xs font-black tracking-widest hover:bg-primary/90 transition-all whitespace-nowrap">
                          Оплатить
                        </button>
                      </Link>
                    )}

                    {/* Free cancel for payment_pending */}
                    {!isAdmin && order.status === 'payment_pending' && (
                      <button
                        onClick={() => handleAction(order.id, () => cancelFree(order.id))}
                        disabled={actionId === order.id}
                        className="px-3 py-1.5 bg-red-50 text-red-500 border border-red-100 rounded-full text-xs font-bold hover:bg-red-100 transition-colors disabled:opacity-50 whitespace-nowrap"
                      >
                        {actionId === order.id ? '…' : 'Отменить'}
                      </button>
                    )}

                    {/* Request cancellation for paid/processing */}
                    {!isAdmin && (order.status === 'paid' || order.status === 'processing') && (
                      <button
                        onClick={() => handleAction(order.id, () => requestCancel(order.id))}
                        disabled={actionId === order.id}
                        className="px-3 py-1.5 bg-orange-50 text-orange-600 border border-orange-200 rounded-full text-xs font-bold hover:bg-orange-100 transition-colors disabled:opacity-50 whitespace-nowrap"
                      >
                        {actionId === order.id ? '…' : 'Запросить отмену'}
                      </button>
                    )}

                    {msgs[order.id] && (
                      <span className={cn('text-xs font-medium', msgs[order.id].ok ? 'text-emerald-600' : 'text-red-500')}>
                        {msgs[order.id].msg}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
