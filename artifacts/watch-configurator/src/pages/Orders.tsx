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

async function requestCancel(orderId: number): Promise<{ ok: boolean; msg: string }> {
  try {
    const jwt = localStorage.getItem("jwt") ?? "";
    const headers = { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` };
    // payment_pending: free cancel
    // paid/processing: request cancellation (admin reviews)
    const res = await fetch(`/api/orders/${orderId}/status`, {
      method: "PATCH",
      headers,
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

async function adminCancelRefund(orderId: number): Promise<{ ok: boolean; msg: string }> {
  try {
    const jwt = localStorage.getItem("jwt") ?? "";
    const headers = { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` };
    await fetch(`/api/orders/${orderId}/status`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ status: "cancelled" }),
    });
    const refundRes = await fetch(`/api/orders/${orderId}/refund`, {
      method: "POST",
      headers,
      body: JSON.stringify({}),
    });
    const json = await refundRes.json();
    const tgResult = json.telegramRefundResult;
    if (tgResult?.ok === false) {
      const desc: string = tgResult.description ?? "Telegram error";
      if (desc.includes("CHARGE_ALREADY_REFUNDED")) return { ok: true, msg: "Уже возвращено" };
      return { ok: false, msg: desc };
    }
    return { ok: true, msg: "Отменён + возврат ✓" };
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
    <div className="min-h-[100dvh] bg-background p-6 md:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground mb-1">История</p>
            <h1 className="text-3xl font-bold tracking-tight">Мои заказы</h1>
          </div>
          <Link href="/collections">
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
            <Link href="/collections">
              <button className="bg-primary text-white rounded-full px-8 py-3 font-bold text-sm tracking-widest hover:bg-primary/90 transition-all active:scale-[0.98]">
                Начать
              </button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {(orders as any[]).map((order: any) => (
              <div key={order.id} className="liquid-glass rounded-2xl p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className="font-bold text-sm font-mono text-foreground">#{order.id}</span>
                      <span className={cn('text-xs px-2.5 py-0.5 rounded-full font-semibold border', STATUS_COLORS[order.status] ?? 'text-muted-foreground bg-muted border-border')}>
                        {STATUS_LABELS[order.status] ?? order.status}
                      </span>
                    </div>
                    <p className="text-xl font-bold text-primary">{order.totalStars} ⭐</p>
                  </div>

                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    {/* Pay button for pending */}
                    {order.status === 'payment_pending' && (
                      <Link href={`/payment/${order.id}`}>
                        <button className="bg-primary text-white rounded-full px-4 py-2 text-xs font-bold tracking-widest hover:bg-primary/90 transition-all whitespace-nowrap">
                          Оплатить
                        </button>
                      </Link>
                    )}

                    {/* Admin: cancel + refund */}
                    {isAdmin && order.status !== 'cancelled' && order.status !== 'arrived' && (
                      <button
                        onClick={() => handleAction(order.id, () => adminCancelRefund(order.id))}
                        disabled={actionId === order.id}
                        className="px-3 py-1.5 bg-red-50 text-red-500 border border-red-100 rounded-full text-xs font-bold hover:bg-red-100 transition-colors disabled:opacity-50 whitespace-nowrap"
                      >
                        {actionId === order.id ? '…' : order.telegramPaymentChargeId ? 'Отмена + Возврат ⭐' : 'Отменить'}
                      </button>
                    )}

                    {/* User (non-admin): request cancellation */}
                    {!isAdmin && order.status === 'payment_pending' && (
                      <button
                        onClick={() => handleAction(order.id, () => cancelFree(order.id))}
                        disabled={actionId === order.id}
                        className="px-3 py-1.5 bg-red-50 text-red-500 border border-red-100 rounded-full text-xs font-bold hover:bg-red-100 transition-colors disabled:opacity-50 whitespace-nowrap"
                      >
                        {actionId === order.id ? '…' : 'Отменить'}
                      </button>
                    )}

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
