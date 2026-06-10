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
  payment_pending: "Ожидает оплаты",
  paid: "Оплачен",
  processing: "В производстве",
  shipping: "Отправлен",
  arrived: "Доставлен",
  cancelled: "Отменён",
};

const STATUS_COLORS: Record<string, string> = {
  payment_pending: "text-amber-600 bg-amber-50 border-amber-200",
  paid: "text-emerald-600 bg-emerald-50 border-emerald-200",
  processing: "text-blue-600 bg-blue-50 border-blue-200",
  shipping: "text-violet-600 bg-violet-50 border-violet-200",
  arrived: "text-emerald-700 bg-emerald-100 border-emerald-300",
  cancelled: "text-red-600 bg-red-50 border-red-200",
};

const NEXT_STATUSES: Record<string, string> = {
  payment_pending: "processing",
  paid: "processing",
  processing: "shipping",
  shipping: "arrived",
};

const PAGE_SIZE = 20;
type Tab = "orders" | "analytics" | "bot";

async function callRefund(orderId: number): Promise<{ ok: boolean; msg: string }> {
  try {
    const jwt = localStorage.getItem("jwt") ?? "";
    const res = await fetch(`/api/orders/${orderId}/refund`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
      body: JSON.stringify({}),
    });
    const json = await res.json();
    const tgResult = json.telegramRefundResult;
    if (tgResult?.ok === false) {
      const desc: string = tgResult.description ?? "Telegram error";
      if (desc.includes("CHARGE_ALREADY_REFUNDED")) return { ok: true, msg: "Уже возвращено ранее" };
      return { ok: false, msg: desc };
    }
    return { ok: true, msg: "Звёзды возвращены ✓" };
  } catch {
    return { ok: false, msg: "Ошибка сети" };
  }
}

async function fetchWebhookInfo() {
  const res = await fetch("/api/bot/webhook-info");
  return res.json();
}

async function registerWebhook(url: string) {
  const jwt = localStorage.getItem("jwt") ?? "";
  const res = await fetch("/api/bot/register-webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
    body: JSON.stringify({ url }),
  });
  return res.json();
}

export default function Admin() {
  const [, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const [tab, setTab] = useState<Tab>("orders");
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [refundingId, setRefundingId] = useState<number | null>(null);
  const [refundMsg, setRefundMsg] = useState<Record<number, { ok: boolean; msg: string }>>({});

  // Bot tab state
  const [webhookInfo, setWebhookInfo] = useState<any>(null);
  const [webhookLoading, setWebhookLoading] = useState(false);
  const [customWebhookUrl, setCustomWebhookUrl] = useState("");
  const [webhookRegResult, setWebhookRegResult] = useState<any>(null);

  const { data: ordersData, isLoading: ordersLoading, refetch } = useListOrders(
    { limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE, status: (statusFilter as any) || undefined }
  );

  const { data: analytics, isLoading: analyticsLoading } = useGetAnalyticsSummary(
    { query: { enabled: tab === "analytics" } } as any
  );

  const updateStatus = useUpdateOrderStatus();

  const handleStatusUpdate = async (orderId: number, newStatus: string) => {
    await updateStatus.mutateAsync({ id: orderId, data: { status: newStatus as any } });
    refetch();
  };

  const handleRefund = async (orderId: number) => {
    setRefundingId(orderId);
    const result = await callRefund(orderId);
    setRefundMsg(prev => ({ ...prev, [orderId]: result }));
    setRefundingId(null);
    refetch();
  };

  const handleCancelAndRefund = async (orderId: number) => {
    setRefundingId(orderId);
    await updateStatus.mutateAsync({ id: orderId, data: { status: "cancelled" as any } });
    const result = await callRefund(orderId);
    setRefundMsg(prev => ({ ...prev, [orderId]: result }));
    setRefundingId(null);
    refetch();
  };

  const handleLoadWebhookInfo = async () => {
    setWebhookLoading(true);
    try {
      const info = await fetchWebhookInfo();
      setWebhookInfo(info);
    } finally {
      setWebhookLoading(false);
    }
  };

  const handleRegisterWebhook = async (url: string) => {
    setWebhookLoading(true);
    try {
      const result = await registerWebhook(url);
      setWebhookRegResult(result);
      await handleLoadWebhookInfo();
    } finally {
      setWebhookLoading(false);
    }
  };

  if (!user) {
    setLocation("/login");
    return null;
  }

  const orders: any[] = (ordersData as any)?.orders ?? [];
  const total: number = (ordersData as any)?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE) || 1;

  const tabs: { id: Tab; label: string }[] = [
    { id: "orders", label: "Заказы" },
    ...(user.role === "admin" ? [{ id: "analytics" as Tab, label: "Аналитика" }, { id: "bot" as Tab, label: "Бот" }] : []),
  ];

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
        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-black/5 rounded-full p-1 w-fit">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "px-5 py-2 rounded-full text-sm font-semibold transition-all",
                tab === t.id ? "bg-white shadow text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── ORDERS TAB ── */}
        {tab === "orders" && (
          <div className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              {["", "payment_pending", "paid", "processing", "shipping", "arrived", "cancelled"].map((s) => (
                <button
                  key={s}
                  onClick={() => { setStatusFilter(s); setPage(1); }}
                  className={cn("option-btn", statusFilter === s && "active")}
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
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                        {/* Left: order info */}
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className="font-bold text-sm font-mono">#{order.id}</span>
                            <span className={cn("text-xs px-2.5 py-0.5 rounded-full font-semibold border", STATUS_COLORS[order.status] ?? "text-muted-foreground bg-muted border-border")}>
                              {STATUS_LABELS[order.status] ?? order.status}
                            </span>
                            <span className="text-primary font-bold text-sm">{order.totalStars} ⭐</span>
                          </div>

                          {/* Telegram user info */}
                          {(order.telegramUsername || order.telegramId) && (
                            <div className="flex items-center gap-2 flex-wrap">
                              {order.telegramUsername && (
                                <a
                                  href={`https://t.me/${order.telegramUsername}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-blue-500 hover:text-blue-600 font-mono font-semibold hover:underline"
                                >
                                  @{order.telegramUsername}
                                </a>
                              )}
                              {order.telegramId && (
                                <span className="text-xs text-muted-foreground font-mono">
                                  ID: {order.telegramId}
                                </span>
                              )}
                            </div>
                          )}

                          <span className="text-xs text-muted-foreground font-mono">
                            session: {String(order.sessionId ?? "").slice(0, 8)}…
                          </span>
                        </div>

                        {/* Right: actions */}
                        <div className="flex items-center gap-2 flex-wrap">
                          {NEXT_STATUSES[order.status] && (
                            <button
                              onClick={() => handleStatusUpdate(order.id, NEXT_STATUSES[order.status])}
                              disabled={updateStatus.isPending || refundingId === order.id}
                              className="px-3 py-1.5 bg-primary/10 text-primary border border-primary/20 rounded-full text-xs font-bold hover:bg-primary/20 transition-colors whitespace-nowrap disabled:opacity-50"
                            >
                              → {STATUS_LABELS[NEXT_STATUSES[order.status]]}
                            </button>
                          )}

                          {/* Cancel: for paid orders also triggers refund */}
                          {order.status !== "cancelled" && order.status !== "arrived" && (
                            <button
                              onClick={() =>
                                order.telegramPaymentChargeId
                                  ? handleCancelAndRefund(order.id)
                                  : handleStatusUpdate(order.id, "cancelled")
                              }
                              disabled={updateStatus.isPending || refundingId === order.id}
                              className="px-3 py-1.5 bg-red-50 text-red-500 border border-red-100 rounded-full text-xs font-bold hover:bg-red-100 transition-colors disabled:opacity-50 whitespace-nowrap"
                            >
                              {refundingId === order.id
                                ? "…"
                                : order.telegramPaymentChargeId
                                ? "Отмена + Возврат ⭐"
                                : "Отмена"}
                            </button>
                          )}

                          {/* Manual refund retry (already cancelled, has charge id, no message yet) */}
                          {order.status === "cancelled" && order.telegramPaymentChargeId && !refundMsg[order.id] && (
                            <button
                              onClick={() => handleRefund(order.id)}
                              disabled={refundingId === order.id}
                              className="px-3 py-1.5 bg-amber-50 text-amber-600 border border-amber-200 rounded-full text-xs font-bold hover:bg-amber-100 transition-colors disabled:opacity-50"
                            >
                              {refundingId === order.id ? "…" : "Рефанд ⭐"}
                            </button>
                          )}

                          {refundMsg[order.id] && (
                            <span className={cn("text-xs font-medium", refundMsg[order.id].ok ? "text-emerald-600" : "text-red-500")}>
                              {refundMsg[order.id].msg}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-3 mt-6">
                    <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="liquid-button px-4 py-2 text-sm disabled:opacity-30">←</button>
                    <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
                    <button onClick={() => setPage((p) => p + 1)} disabled={page === totalPages} className="liquid-button px-4 py-2 text-sm disabled:opacity-30">→</button>
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
                    { label: "В обработке", value: (analytics as any).processingOrders ?? 0 },
                    { label: "Звёзд получено", value: (analytics as any).totalStarsEarned ?? 0 },
                    {
                      label: "Конверсия",
                      value: (analytics as any).totalOrders > 0
                        ? `${Math.round(((analytics as any).processingOrders / (analytics as any).totalOrders) * 100)}%`
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
                              <div className="h-full bg-primary rounded-full" style={{ width: `${(p.count / (analytics as any).topPresets[0].count) * 100}%` }} />
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
                          <p className="text-xs font-bold">{STATUS_LABELS[status] ?? status}</p>
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

        {/* ── BOT TAB ── */}
        {tab === "bot" && (
          <div className="space-y-4 max-w-xl">
            <div className="liquid-glass rounded-2xl p-5 space-y-4">
              <h2 className="font-bold text-sm tracking-widest">Вебхук Telegram бота</h2>

              <div className="flex gap-2">
                <button
                  onClick={handleLoadWebhookInfo}
                  disabled={webhookLoading}
                  className="liquid-button px-4 py-2 text-xs font-semibold disabled:opacity-50"
                >
                  {webhookLoading ? "…" : "Проверить статус"}
                </button>
                <button
                  onClick={() => handleRegisterWebhook(window.location.origin)}
                  disabled={webhookLoading}
                  className="px-4 py-2 bg-primary/10 text-primary border border-primary/20 rounded-full text-xs font-bold hover:bg-primary/20 transition-colors disabled:opacity-50"
                >
                  Зарегистрировать для {window.location.hostname}
                </button>
              </div>

              {webhookInfo && (
                <div className="bg-black/5 rounded-xl p-3 font-mono text-xs space-y-1 break-all">
                  <p><span className="text-muted-foreground">URL: </span>{webhookInfo.result?.url || "—"}</p>
                  <p><span className="text-muted-foreground">Ожидающих: </span>{webhookInfo.result?.pending_update_count ?? "—"}</p>
                  <p><span className="text-muted-foreground">Ошибка: </span>{webhookInfo.result?.last_error_message || "нет"}</p>
                </div>
              )}

              {webhookRegResult && (
                <p className={cn("text-xs font-semibold", webhookRegResult.ok ? "text-emerald-600" : "text-red-500")}>
                  {webhookRegResult.ok ? "✓ Вебхук зарегистрирован" : `Ошибка: ${webhookRegResult.description ?? JSON.stringify(webhookRegResult)}`}
                </p>
              )}

              <div className="space-y-2 pt-2 border-t border-border/40">
                <p className="text-xs text-muted-foreground font-semibold">Зарегистрировать вручную</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="https://your-app.replit.app"
                    value={customWebhookUrl}
                    onChange={(e) => setCustomWebhookUrl(e.target.value)}
                    className="flex-1 bg-white/60 border border-border rounded-full px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
                  />
                  <button
                    onClick={() => customWebhookUrl && handleRegisterWebhook(customWebhookUrl)}
                    disabled={webhookLoading || !customWebhookUrl}
                    className="px-4 py-1.5 bg-primary text-white rounded-full text-xs font-bold hover:bg-primary/90 transition-colors disabled:opacity-40"
                  >
                    OK
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
