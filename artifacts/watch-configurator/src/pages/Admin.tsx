import React, { useState } from "react";
import {
  useListOrders,
  useUpdateOrderStatus,
  useGetAnalyticsSummary,
} from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import ConfigReceipt from "@/components/ConfigReceipt";

const STATUS_LABELS: Record<string, string> = {
  payment_pending: "Ожидает оплаты",
  paid: "Оплачен",
  cancel_requested: "Запрос отмены",
  processing: "В производстве",
  shipping: "Отправлен",
  arrived: "Доставлен",
  cancelled: "Отменён",
};

const STATUS_COLORS: Record<string, string> = {
  payment_pending: "text-amber-600 bg-amber-50 border-amber-200",
  paid: "text-emerald-600 bg-emerald-50 border-emerald-200",
  cancel_requested: "text-orange-600 bg-orange-50 border-orange-200",
  processing: "text-blue-600 bg-blue-50 border-blue-200",
  shipping: "text-violet-600 bg-violet-50 border-violet-200",
  arrived: "text-emerald-700 bg-emerald-100 border-emerald-300",
  cancelled: "text-red-600 bg-red-50 border-red-200",
};

const NEXT_STATUSES: Record<string, string> = {
  payment_pending: "processing",
  paid: "processing",
  cancel_requested: "cancelled",
  processing: "shipping",
  shipping: "arrived",
};

const PAGE_SIZE = 20;
type Tab = "orders" | "analytics" | "bot" | "couriers";

// ── helpers ──────────────────────────────────────────────────────────────────

async function callRefundWithComment(orderId: number, comment: string): Promise<{ ok: boolean; msg: string }> {
  try {
    const jwt = localStorage.getItem("jwt") ?? "";
    const res = await fetch(`/api/orders/${orderId}/refund`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
      body: JSON.stringify({ adminComment: comment || undefined }),
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

async function createCourierAccount(username: string, password: string): Promise<{ ok: boolean; msg: string }> {
  try {
    const jwt = localStorage.getItem("jwt") ?? "";
    const res = await fetch("/api/auth/couriers", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { ok: false, msg: err.error ?? "Ошибка" };
    }
    return { ok: true, msg: "Курьер создан ✓" };
  } catch {
    return { ok: false, msg: "Ошибка сети" };
  }
}

// ── Comment modal ─────────────────────────────────────────────────────────────

interface ActionModal {
  type: "refund" | "cancel" | "cancel_and_refund" | "approve_cancel";
  orderId: number;
  hasCharge: boolean;
}

function CommentModal({
  modal,
  onConfirm,
  onClose,
  loading,
}: {
  modal: ActionModal;
  onConfirm: (comment: string) => void;
  onClose: () => void;
  loading: boolean;
}) {
  const [comment, setComment] = useState("");

  const titles: Record<ActionModal["type"], string> = {
    refund: "Возврат звёзд",
    cancel: "Отмена заказа",
    cancel_and_refund: "Отмена + Возврат",
    approve_cancel: "Одобрить отмену",
  };

  const descs: Record<ActionModal["type"], string> = {
    refund: "Вернуть звёзды покупателю. Комментарий (необязательно):",
    cancel: "Отменить заказ. Укажите причину (необязательно):",
    cancel_and_refund: "Отменить заказ и вернуть звёзды. Комментарий (необязательно):",
    approve_cancel: "Одобрить запрос на отмену и вернуть звёзды. Комментарий (необязательно):",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}>
      <div className="liquid-glass rounded-3xl p-6 w-full max-w-sm space-y-4 animate-shimmer-in">
        <h3 className="text-lg font-black">{titles[modal.type]}</h3>
        <p className="text-sm text-muted-foreground">Заказ #{modal.orderId}</p>
        <p className="text-sm">{descs[modal.type]}</p>
        <textarea
          rows={3}
          placeholder="Комментарий для администратора…"
          value={comment}
          onChange={e => setComment(e.target.value)}
          className="w-full rounded-2xl px-4 py-3 text-sm border border-border bg-background/60 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
          autoFocus
        />
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 liquid-button py-2.5 text-sm font-semibold"
            disabled={loading}
          >
            Отмена
          </button>
          <button
            onClick={() => onConfirm(comment)}
            disabled={loading}
            className={cn(
              "flex-1 py-2.5 text-sm font-bold rounded-full text-white transition-all disabled:opacity-50",
              modal.type === "refund" ? "bg-amber-500 hover:bg-amber-600" : "bg-red-500 hover:bg-red-600"
            )}
          >
            {loading ? "…" : "Подтвердить"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function Admin() {
  const [, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const [tab, setTab] = useState<Tab>("orders");
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [actionModal, setActionModal] = useState<ActionModal | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMsgs, setActionMsgs] = useState<Record<number, { ok: boolean; msg: string }>>({});

  const [webhookInfo, setWebhookInfo] = useState<any>(null);
  const [webhookLoading, setWebhookLoading] = useState(false);
  const [customWebhookUrl, setCustomWebhookUrl] = useState("");
  const [webhookRegResult, setWebhookRegResult] = useState<any>(null);

  // Couriers
  const [courierUsername, setCourierUsername] = useState("");
  const [courierPassword, setCourierPassword] = useState("");
  const [courierResult, setCourierResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [courierLoading, setCourierLoading] = useState(false);

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

  const openModal = (modal: ActionModal) => setActionModal(modal);

  const handleModalConfirm = async (comment: string) => {
    if (!actionModal) return;
    setActionLoading(true);
    let result: { ok: boolean; msg: string };

    try {
      if (actionModal.type === "refund") {
        result = await callRefundWithComment(actionModal.orderId, comment);
      } else if (actionModal.type === "cancel") {
        await updateStatus.mutateAsync({ id: actionModal.orderId, data: { status: "cancelled" as any } });
        result = { ok: true, msg: "Отменён ✓" };
      } else if (actionModal.type === "cancel_and_refund" || actionModal.type === "approve_cancel") {
        await updateStatus.mutateAsync({ id: actionModal.orderId, data: { status: "cancelled" as any } });
        result = await callRefundWithComment(actionModal.orderId, comment);
      } else {
        result = { ok: false, msg: "Неизвестное действие" };
      }
    } catch {
      result = { ok: false, msg: "Ошибка сети" };
    }

    setActionMsgs(prev => ({ ...prev, [actionModal.orderId]: result }));
    setActionLoading(false);
    setActionModal(null);
    refetch();
  };

  const handleLoadWebhookInfo = async () => {
    setWebhookLoading(true);
    try { setWebhookInfo(await fetchWebhookInfo()); }
    finally { setWebhookLoading(false); }
  };

  const handleRegisterWebhook = async (url: string) => {
    setWebhookLoading(true);
    try {
      setWebhookRegResult(await registerWebhook(url));
      await handleLoadWebhookInfo();
    } finally { setWebhookLoading(false); }
  };

  const handleCreateCourier = async () => {
    if (!courierUsername || !courierPassword) return;
    setCourierLoading(true);
    const result = await createCourierAccount(courierUsername, courierPassword);
    setCourierResult(result);
    setCourierLoading(false);
    if (result.ok) { setCourierUsername(""); setCourierPassword(""); }
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
    ...(user.role === "admin" ? [
      { id: "analytics" as Tab, label: "Аналитика" },
      { id: "couriers" as Tab, label: "Курьеры" },
      { id: "bot" as Tab, label: "Бот" },
    ] : []),
  ];

  return (
    <div className="min-h-[100dvh] bg-background">
      {/* Modal */}
      {actionModal && (
        <CommentModal
          modal={actionModal}
          onConfirm={handleModalConfirm}
          onClose={() => setActionModal(null)}
          loading={actionLoading}
        />
      )}

      {/* Header */}
      <div className="border-b border-border px-6 py-4 flex items-center justify-between liquid-glass">
        <div>
          <h1 className="text-lg font-black tracking-tight">Панель управления</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {user.role === "admin" ? "Администратор" : "Курьер"} — {user.username}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/">
            <button className="liquid-button px-3 py-1.5 text-xs font-semibold">🏠 Главная</button>
          </Link>
          <Link href="/orders">
            <button className="liquid-button px-3 py-1.5 text-xs font-semibold">📦 Заказы</button>
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
        <div className="flex gap-1 mb-6 liquid-glass rounded-full p-1 w-fit">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "px-5 py-2 rounded-full text-sm font-semibold transition-all",
                tab === t.id
                  ? "bg-primary text-white shadow"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── ORDERS TAB ── */}
        {tab === "orders" && (
          <div className="space-y-4">
            {/* Status filters */}
            <div className="flex gap-2 flex-wrap">
              {["", "payment_pending", "paid", "cancel_requested", "processing", "shipping", "arrived", "cancelled"].map((s) => (
                <button
                  key={s}
                  onClick={() => { setStatusFilter(s); setPage(1); }}
                  className={cn("option-btn text-xs", statusFilter === s && "active")}
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
                    <div
                      key={order.id}
                      className={cn(
                        "liquid-glass rounded-2xl p-4",
                        order.status === "cancel_requested" && "ring-2 ring-orange-400"
                      )}
                    >
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                        {/* Left: info */}
                        <div className="flex flex-col gap-1.5 min-w-0">
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className="font-black text-sm font-mono">#{order.id}</span>
                            <span className={cn("text-xs px-2.5 py-0.5 rounded-full font-semibold border", STATUS_COLORS[order.status] ?? "text-muted-foreground bg-muted border-border")}>
                              {STATUS_LABELS[order.status] ?? order.status}
                            </span>
                            <span className="text-primary font-black text-sm">{order.totalStars} ⭐</span>
                          </div>

                          {/* Telegram info */}
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
                                <span className="text-xs text-muted-foreground font-mono">ID: {order.telegramId}</span>
                              )}
                            </div>
                          )}

                          <span className="text-xs text-muted-foreground font-mono">
                            session: {String(order.sessionId ?? "").slice(0, 8)}…
                          </span>

                          {order.cancelComment && (
                            <span className="text-xs text-orange-600 italic">"{order.cancelComment}"</span>
                          )}

                          {order.status === "cancel_requested" && (
                            <span className="text-xs font-bold text-orange-600 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full w-fit">
                              ⚠️ Ожидает решения
                            </span>
                          )}

                          {order.configId && (
                            <ConfigReceipt configId={order.configId} compact />
                          )}
                        </div>

                        {/* Right: actions */}
                        <div className="flex items-start gap-2 flex-wrap shrink-0">
                          {/* Advance status (non-admin only sees their assigned orders) */}
                          {NEXT_STATUSES[order.status] && (
                            <button
                              onClick={() => {
                                if (order.status === "cancel_requested") {
                                  openModal({ type: "approve_cancel", orderId: order.id, hasCharge: !!order.telegramPaymentChargeId });
                                } else {
                                  handleStatusUpdate(order.id, NEXT_STATUSES[order.status]);
                                }
                              }}
                              disabled={updateStatus.isPending}
                              className={cn(
                                "px-3 py-1.5 rounded-full text-xs font-bold transition-colors whitespace-nowrap disabled:opacity-50",
                                order.status === "cancel_requested"
                                  ? "bg-red-50 text-red-600 border border-red-200 hover:bg-red-100"
                                  : "bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20"
                              )}
                            >
                              {order.status === "cancel_requested"
                                ? "✓ Одобрить отмену"
                                : `→ ${STATUS_LABELS[NEXT_STATUSES[order.status]]}`}
                            </button>
                          )}

                          {/* Cancel button for non-terminal non-cancel_requested orders */}
                          {order.status !== "cancelled" && order.status !== "cancel_requested" && (
                            <button
                              onClick={() => openModal({
                                type: order.telegramPaymentChargeId ? "cancel_and_refund" : "cancel",
                                orderId: order.id,
                                hasCharge: !!order.telegramPaymentChargeId,
                              })}
                              disabled={updateStatus.isPending}
                              className="px-3 py-1.5 bg-red-50 text-red-500 border border-red-100 rounded-full text-xs font-bold hover:bg-red-100 transition-colors disabled:opacity-50 whitespace-nowrap"
                            >
                              {order.telegramPaymentChargeId ? "Отмена + Возврат ⭐" : "Отменить"}
                            </button>
                          )}

                          {/* ALWAYS show refund if charge ID exists */}
                          {order.telegramPaymentChargeId && (
                            <button
                              onClick={() => openModal({ type: "refund", orderId: order.id, hasCharge: true })}
                              className="px-3 py-1.5 bg-amber-50 text-amber-600 border border-amber-200 rounded-full text-xs font-bold hover:bg-amber-100 transition-colors whitespace-nowrap"
                            >
                              Рефанд ⭐
                            </button>
                          )}

                          {/* Action result message */}
                          {actionMsgs[order.id] && (
                            <span className={cn("text-xs font-medium self-center", actionMsgs[order.id].ok ? "text-emerald-600" : "text-red-500")}>
                              {actionMsgs[order.id].msg}
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
                    { label: "Всего заказов", value: (analytics as any).totalOrders ?? 0, emoji: "📋" },
                    { label: "В обработке", value: (analytics as any).processingOrders ?? 0, emoji: "⚙️" },
                    { label: "Звёзд получено", value: `${(analytics as any).totalStarsEarned ?? 0} ⭐`, emoji: "💫" },
                    {
                      label: "Конверсия",
                      value: (analytics as any).totalOrders > 0
                        ? `${Math.round(((analytics as any).processingOrders / (analytics as any).totalOrders) * 100)}%`
                        : "0%",
                      emoji: "📈",
                    },
                  ].map((stat) => (
                    <div key={stat.label} className="liquid-glass rounded-2xl p-4 animate-fade-up">
                      <p className="text-2xl mb-2">{stat.emoji}</p>
                      <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">{stat.label}</p>
                      <p className="text-2xl font-black">{stat.value}</p>
                    </div>
                  ))}
                </div>

                {(analytics as any).statusBreakdown && (
                  <div className="liquid-glass rounded-2xl p-5">
                    <h3 className="text-sm font-black tracking-widest mb-4 uppercase">По статусу</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {Object.entries((analytics as any).statusBreakdown).map(([status, count]) => (
                        <div key={status} className={cn("rounded-xl p-3 border", STATUS_COLORS[status] ?? "bg-muted/50 border-border")}>
                          <p className="text-xs font-bold">{STATUS_LABELS[status] ?? status}</p>
                          <p className="text-xl font-black mt-1">{count as number}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(analytics as any).topPresets?.length > 0 && (
                  <div className="liquid-glass rounded-2xl p-5">
                    <h3 className="text-sm font-black tracking-widest mb-4 uppercase">Топ коллекции</h3>
                    <div className="space-y-3">
                      {(analytics as any).topPresets.map((p: any, i: number) => (
                        <div key={p.presetName} className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground w-5 font-mono font-bold">{i + 1}</span>
                          <div className="flex-1">
                            <div className="flex justify-between text-sm mb-1">
                              <span className="font-medium">{p.presetName}</span>
                              <span className="text-primary font-bold">{p.count}</span>
                            </div>
                            <div className="h-1.5 bg-black/5 dark:bg-white/10 rounded-full">
                              <div
                                className="h-full bg-primary rounded-full transition-all"
                                style={{ width: `${(p.count / (analytics as any).topPresets[0].count) * 100}%` }}
                              />
                            </div>
                          </div>
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

        {/* ── COURIERS TAB ── */}
        {tab === "couriers" && user.role === "admin" && (
          <div className="space-y-6 max-w-lg">
            <div className="liquid-glass rounded-3xl p-6 space-y-4 animate-shimmer-in">
              <h2 className="font-black text-lg">Создать курьера</h2>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground uppercase tracking-widest mb-1.5 block font-semibold">Логин</label>
                  <input
                    type="text"
                    placeholder="courier_name"
                    value={courierUsername}
                    onChange={e => setCourierUsername(e.target.value)}
                    className="w-full rounded-2xl px-4 py-3 text-sm border border-border bg-background/60 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground uppercase tracking-widest mb-1.5 block font-semibold">Пароль</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={courierPassword}
                    onChange={e => setCourierPassword(e.target.value)}
                    className="w-full rounded-2xl px-4 py-3 text-sm border border-border bg-background/60 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <button
                  onClick={handleCreateCourier}
                  disabled={courierLoading || !courierUsername || !courierPassword}
                  className="w-full bg-primary text-white rounded-full py-3 font-bold text-sm tracking-widest hover:bg-primary/90 transition-all disabled:opacity-40"
                >
                  {courierLoading ? "…" : "Создать курьера"}
                </button>
                {courierResult && (
                  <p className={cn("text-sm font-semibold text-center", courierResult.ok ? "text-emerald-600" : "text-red-500")}>
                    {courierResult.msg}
                  </p>
                )}
              </div>
            </div>

            <div className="liquid-glass rounded-3xl p-6">
              <p className="text-sm text-muted-foreground text-center">
                Курьеры могут управлять статусами заказов: Оплачен → В производстве → Отправлен → Доставлен
              </p>
            </div>
          </div>
        )}

        {/* ── BOT TAB ── */}
        {tab === "bot" && (
          <div className="space-y-4 max-w-xl">
            <div className="liquid-glass rounded-2xl p-5 space-y-4">
              <h2 className="font-black text-sm tracking-widest uppercase">Вебхук Telegram бота</h2>
              <div className="flex gap-2 flex-wrap">
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
                <div className="bg-black/5 dark:bg-white/5 rounded-xl p-3 font-mono text-xs space-y-1 break-all">
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
                    className="flex-1 bg-background/60 border border-border rounded-full px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
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
