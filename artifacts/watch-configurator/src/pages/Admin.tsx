import React, { useState } from "react";
import { GlassPanel } from "@/components/ui/glass-panel";
import {
  useListOrders,
  useUpdateOrderStatus,
  useGetAnalyticsSummary,
} from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";

const STATUS_LABELS: Record<string, string> = {
  pending: "Ожидает",
  paid: "Оплачен",
  in_production: "Производство",
  shipped: "Отправлен",
  delivered: "Доставлен",
  cancelled: "Отменён",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "text-yellow-400",
  paid: "text-green-400",
  in_production: "text-blue-400",
  shipped: "text-purple-400",
  delivered: "text-emerald-400",
  cancelled: "text-red-400",
};

const NEXT_STATUSES: Record<string, string> = {
  pending: "paid",
  paid: "in_production",
  in_production: "shipped",
  shipped: "delivered",
};

type Tab = "orders" | "analytics";

export default function Admin() {
  const [, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const [tab, setTab] = useState<Tab>("orders");
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [trackingInput, setTrackingInput] = useState<Record<number, string>>({});

  const { data: ordersData, isLoading: ordersLoading, refetch } = useListOrders(
    { page, limit: 20, status: (statusFilter as any) || undefined },
    { query: { keepPreviousData: true } as any }
  );

  const { data: analytics, isLoading: analyticsLoading } = useGetAnalyticsSummary({
    query: { enabled: tab === "analytics" },
  });

  const updateStatus = useUpdateOrderStatus();

  const handleStatusUpdate = async (orderId: number, newStatus: string, trackingCode?: string) => {
    await updateStatus.mutateAsync({ id: orderId, data: { status: newStatus as any, trackingCode } });
    refetch();
  };

  if (!user) {
    setLocation("/login");
    return null;
  }

  const orders: any[] = (ordersData as any)?.orders ?? [];
  const totalPages: number = (ordersData as any)?.totalPages ?? 1;

  return (
    <div className="min-h-[100dvh] bg-background text-white">
      {/* Header */}
      <div className="border-b border-white/5 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-widest">ПАНЕЛЬ УПРАВЛЕНИЯ</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {user.role === "admin" ? "Администратор" : "Курьер"} — {user.username}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/orders">
            <button className="text-xs text-muted-foreground hover:text-white transition-colors tracking-widest">
              МОИ ЗАКАЗЫ
            </button>
          </Link>
          <button
            onClick={logout}
            className="text-xs text-red-400 hover:text-red-300 transition-colors tracking-widest"
          >
            ВЫЙТИ
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        {/* Tabs — admin only */}
        {user.role === "admin" && (
          <div className="flex gap-1 mb-6 bg-white/5 rounded-xl p-1 w-fit">
            {(["orders", "analytics"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "px-5 py-2 rounded-lg text-sm font-bold tracking-widest transition-all",
                  tab === t ? "bg-primary text-white" : "text-muted-foreground hover:text-white"
                )}
              >
                {t === "orders" ? "ЗАКАЗЫ" : "АНАЛИТИКА"}
              </button>
            ))}
          </div>
        )}

        {/* ── ORDERS TAB ── */}
        {tab === "orders" && (
          <div className="space-y-4">
            {/* Status filters */}
            <div className="flex gap-2 flex-wrap">
              {["", "pending", "paid", "in_production", "shipped", "delivered"].map((s) => (
                <button
                  key={s}
                  onClick={() => { setStatusFilter(s); setPage(1); }}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-bold tracking-widest transition-all",
                    statusFilter === s
                      ? "bg-primary text-white"
                      : "bg-white/5 hover:bg-white/10 text-muted-foreground"
                  )}
                >
                  {s ? STATUS_LABELS[s] : "ВСЕ"}
                </button>
              ))}
            </div>

            {ordersLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => <GlassPanel key={i} className="h-16 animate-pulse" />)}
              </div>
            ) : orders.length === 0 ? (
              <GlassPanel className="p-8 text-center text-muted-foreground">Заказов нет</GlassPanel>
            ) : (
              <>
                <div className="space-y-3">
                  {orders.map((order) => (
                    <GlassPanel key={order.id} className="p-4">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div className="flex items-center gap-4 flex-wrap">
                          <span className="font-bold text-sm font-mono">#{order.id}</span>
                          <span className={cn("text-xs font-bold", STATUS_COLORS[order.status])}>
                            {STATUS_LABELS[order.status]}
                          </span>
                          <span className="text-primary font-bold">{order.totalStars} ⭐</span>
                          <span className="text-xs text-muted-foreground font-mono">
                            {String(order.sessionId ?? "").slice(0, 8)}…
                          </span>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          {order.status === "paid" && (
                            <input
                              type="text"
                              placeholder="Трек-номер"
                              value={trackingInput[order.id] ?? ""}
                              onChange={(e) =>
                                setTrackingInput((prev) => ({ ...prev, [order.id]: e.target.value }))
                              }
                              className="w-32 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs font-mono text-white placeholder:text-white/20 focus:outline-none focus:border-primary/50"
                            />
                          )}

                          {NEXT_STATUSES[order.status] && (
                            <button
                              onClick={() =>
                                handleStatusUpdate(
                                  order.id,
                                  NEXT_STATUSES[order.status],
                                  order.status === "paid" ? trackingInput[order.id] : undefined
                                )
                              }
                              disabled={updateStatus.isPending}
                              className="px-3 py-1.5 bg-primary/20 text-primary border border-primary/30 rounded-lg text-xs font-bold tracking-widest hover:bg-primary/30 transition-colors whitespace-nowrap disabled:opacity-50"
                            >
                              → {STATUS_LABELS[NEXT_STATUSES[order.status]]}
                            </button>
                          )}

                          {order.status !== "cancelled" && order.status !== "delivered" && (
                            <button
                              onClick={() => handleStatusUpdate(order.id, "cancelled")}
                              disabled={updateStatus.isPending}
                              className="px-3 py-1.5 bg-red-400/10 text-red-400 border border-red-400/20 rounded-lg text-xs font-bold tracking-widest hover:bg-red-400/20 transition-colors disabled:opacity-50"
                            >
                              ОТМЕНА
                            </button>
                          )}
                        </div>
                      </div>

                      {order.trackingCode && (
                        <p className="text-xs text-muted-foreground mt-2 font-mono">
                          Трек: {order.trackingCode}
                        </p>
                      )}
                    </GlassPanel>
                  ))}
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-3 mt-6">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="px-4 py-2 bg-white/5 rounded-lg text-sm disabled:opacity-30 hover:bg-white/10 transition-colors"
                    >
                      ←
                    </button>
                    <span className="text-sm text-muted-foreground">
                      {page} / {totalPages}
                    </span>
                    <button
                      onClick={() => setPage((p) => p + 1)}
                      disabled={page === totalPages}
                      className="px-4 py-2 bg-white/5 rounded-lg text-sm disabled:opacity-30 hover:bg-white/10 transition-colors"
                    >
                      →
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── ANALYTICS TAB ── */}
        {tab === "analytics" && (
          <div className="space-y-6">
            {analyticsLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => <GlassPanel key={i} className="h-24 animate-pulse" />)}
              </div>
            ) : analytics ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: "Всего заказов", value: (analytics as any).totalOrders ?? 0 },
                    { label: "Оплачено", value: (analytics as any).paidOrders ?? 0 },
                    { label: "Звёзд получено", value: (analytics as any).totalStarsEarned ?? 0 },
                    {
                      label: "Конверсия",
                      value:
                        (analytics as any).totalOrders > 0
                          ? `${Math.round(((analytics as any).paidOrders / (analytics as any).totalOrders) * 100)}%`
                          : "0%",
                    },
                  ].map((stat) => (
                    <GlassPanel key={stat.label} className="p-4">
                      <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">
                        {stat.label}
                      </p>
                      <p className="text-2xl font-bold">{stat.value}</p>
                    </GlassPanel>
                  ))}
                </div>

                {(analytics as any).topPresets?.length > 0 && (
                  <GlassPanel className="p-5">
                    <h3 className="text-sm font-bold tracking-widest mb-4">ТОП ПРЕСЕТЫ</h3>
                    <div className="space-y-3">
                      {(analytics as any).topPresets.map((p: any, i: number) => (
                        <div key={p.presetName} className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground w-4">{i + 1}</span>
                          <div className="flex-1">
                            <div className="flex justify-between text-sm mb-1">
                              <span>{p.presetName}</span>
                              <span className="text-primary">{p.count}</span>
                            </div>
                            <div className="h-1.5 bg-white/5 rounded-full">
                              <div
                                className="h-full bg-primary rounded-full"
                                style={{
                                  width: `${(p.count / (analytics as any).topPresets[0].count) * 100}%`,
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </GlassPanel>
                )}

                {(analytics as any).statusBreakdown && (
                  <GlassPanel className="p-5">
                    <h3 className="text-sm font-bold tracking-widest mb-4">ПО СТАТУСУ</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {Object.entries((analytics as any).statusBreakdown).map(([status, count]) => (
                        <div key={status} className="bg-white/5 rounded-lg p-3">
                          <p className={cn("text-xs font-bold", STATUS_COLORS[status])}>
                            {STATUS_LABELS[status]}
                          </p>
                          <p className="text-xl font-bold mt-1">{count as number}</p>
                        </div>
                      ))}
                    </div>
                  </GlassPanel>
                )}
              </>
            ) : (
              <GlassPanel className="p-8 text-center text-muted-foreground">Нет данных</GlassPanel>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
