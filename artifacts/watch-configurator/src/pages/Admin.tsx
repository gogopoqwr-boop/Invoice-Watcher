import React, { useState } from "react";
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
  pending: "text-amber-600 bg-amber-50 border-amber-200",
  paid: "text-green-600 bg-green-50 border-green-200",
  in_production: "text-blue-600 bg-blue-50 border-blue-200",
  shipped: "text-violet-600 bg-violet-50 border-violet-200",
  delivered: "text-emerald-600 bg-emerald-50 border-emerald-200",
  cancelled: "text-red-600 bg-red-50 border-red-200",
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
    <div className="min-h-[100dvh] bg-background">
      {/* Header */}
      <div className="border-b border-border px-6 py-4 flex items-center justify-between bg-white/60 backdrop-blur-md">
        <div>
          <h1 className="text-lg font-bold tracking-tight">Панель управления</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {user.role === "admin" ? "Администратор" : "Курьер"} — {user.username}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/orders">
            <button className="liquid-button px-4 py-2 text-xs font-semibold">Мои заказы</button>
          </Link>
          <button
            onClick={logout}
            className="px-4 py-2 rounded-full text-xs font-semibold text-red-500 bg-red-50 border border-red-100 hover:bg-red-100 transition-colors"
          >
            Выйти
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6">
        {/* Tabs — admin only */}
        {user.role === "admin" && (
          <div className="flex gap-1 mb-6 bg-black/5 rounded-full p-1 w-fit">
            {(["orders", "analytics"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "px-5 py-2 rounded-full text-sm font-semibold transition-all",
                  tab === t ? "bg-white shadow text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t === "orders" ? "Заказы" : "Аналитика"}
              </button>
            ))}
          </div>
        )}

        {/* ── ORDERS TAB ── */}
        {tab === "orders" && (
          <div className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              {["", "pending", "paid", "in_production", "shipped", "delivered"].map((s) => (
                <button
                  key={s}
                  onClick={() => { setStatusFilter(s); setPage(1); }}
                  className={cn(
                    "option-btn",
                    statusFilter === s && "active"
                  )}
                >
                  {s ? STATUS_LABELS[s] : "Все"}
                </button>
              ))}
            </div>

            {ordersLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => <div key={i} className="liquid-glass rounded-2xl h-16 animate-pulse" />)}
              </div>
            ) : orders.length === 0 ? (
              <div className="liquid-glass rounded-2xl p-8 text-center text-muted-foreground">Заказов нет</div>
            ) : (
              <>
                <div className="space-y-3">
                  {orders.map((order) => (
                    <div key={order.id} className="liquid-glass rounded-2xl p-4">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="font-bold text-sm font-mono">#{order.id}</span>
                          <span className={cn("text-xs px-2.5 py-0.5 rounded-full font-semibold border", STATUS_COLORS[order.status])}>
                            {STATUS_LABELS[order.status]}
                          </span>
                          <span className="text-primary font-bold text-sm">{order.totalStars} ⭐</span>
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
                              className="w-32 bg-white/60 border border-border rounded-full px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20"
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
                              className="px-3 py-1.5 bg-primary/10 text-primary border border-primary/20 rounded-full text-xs font-bold hover:bg-primary/20 transition-colors whitespace-nowrap disabled:opacity-50"
                            >
                              → {STATUS_LABELS[NEXT_STATUSES[order.status]]}
                            </button>
                          )}

                          {order.status !== "cancelled" && order.status !== "delivered" && (
                            <button
                              onClick={() => handleStatusUpdate(order.id, "cancelled")}
                              disabled={updateStatus.isPending}
                              className="px-3 py-1.5 bg-red-50 text-red-500 border border-red-100 rounded-full text-xs font-bold hover:bg-red-100 transition-colors disabled:opacity-50"
                            >
                              Отмена
                            </button>
                          )}
                        </div>
                      </div>

                      {order.trackingCode && (
                        <p className="text-xs text-muted-foreground mt-2 font-mono">
                          Трек: {order.trackingCode}
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-3 mt-6">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="liquid-button px-4 py-2 text-sm disabled:opacity-30"
                    >←</button>
                    <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
                    <button
                      onClick={() => setPage((p) => p + 1)}
                      disabled={page === totalPages}
                      className="liquid-button px-4 py-2 text-sm disabled:opacity-30"
                    >→</button>
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
                {[1, 2, 3, 4].map((i) => <div key={i} className="liquid-glass rounded-2xl h-24 animate-pulse" />)}
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
                      value: (analytics as any).totalOrders > 0
                        ? `${Math.round(((analytics as any).paidOrders / (analytics as any).totalOrders) * 100)}%`
                        : "0%",
                    },
                  ].map((stat) => (
                    <div key={stat.label} className="liquid-glass rounded-2xl p-4">
                      <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">{stat.label}</p>
                      <p className="text-2xl font-bold">{stat.value}</p>
                    </div>
                  ))}
                </div>

                {(analytics as any).topPresets?.length > 0 && (
                  <div className="liquid-glass rounded-2xl p-5">
                    <h3 className="text-sm font-bold tracking-widest mb-4">Топ пресеты</h3>
                    <div className="space-y-3">
                      {(analytics as any).topPresets.map((p: any, i: number) => (
                        <div key={p.presetName} className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground w-4">{i + 1}</span>
                          <div className="flex-1">
                            <div className="flex justify-between text-sm mb-1">
                              <span>{p.presetName}</span>
                              <span className="text-primary font-semibold">{p.count}</span>
                            </div>
                            <div className="h-1.5 bg-black/5 rounded-full">
                              <div
                                className="h-full bg-primary rounded-full"
                                style={{ width: `${(p.count / (analytics as any).topPresets[0].count) * 100}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(analytics as any).statusBreakdown && (
                  <div className="liquid-glass rounded-2xl p-5">
                    <h3 className="text-sm font-bold tracking-widest mb-4">По статусу</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {Object.entries((analytics as any).statusBreakdown).map(([status, count]) => (
                        <div key={status} className={cn("rounded-xl p-3 border", STATUS_COLORS[status] ?? "bg-muted/50 border-border")}>
                          <p className="text-xs font-bold">{STATUS_LABELS[status]}</p>
                          <p className="text-xl font-bold mt-1">{count as number}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="liquid-glass rounded-2xl p-8 text-center text-muted-foreground">Нет данных</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
