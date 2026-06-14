import React, { useState, useEffect } from "react";
import {
  useListOrders,
  useUpdateOrderStatus,
  useGetAnalyticsSummary,
} from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import ConfigReceipt from "@/components/ConfigReceipt";
import {
  Home, Package, ClipboardList, Settings2, Sparkles, TrendingUp,
  Check, RefreshCw, Users, Database, DollarSign, Bot, ChevronDown,
  Pencil, Trash2, Plus, Eye, EyeOff, X, Save,
} from 'lucide-react';
import { TgStar } from '@/components/TgStar';

// ── Status maps ───────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  payment_pending: "Ожидает оплаты", paid: "Оплачен",
  cancel_requested: "Запрос отмены", processing: "В производстве",
  shipping: "Отправлен", arrived: "Доставлен", cancelled: "Отменён",
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
  payment_pending: "processing", paid: "processing",
  cancel_requested: "cancelled", processing: "shipping", shipping: "arrived",
};
const PAGE_SIZE = 20;
type Tab = "orders" | "analytics" | "presets" | "users" | "prices" | "bot" | "couriers";

// ── API helpers ───────────────────────────────────────────────────────────────

async function adminFetch(path: string, method = "GET", body?: any) {
  const jwt = localStorage.getItem("jwt") ?? "";
  const res = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "Ошибка");
  return json;
}

// ── Comment modal ────────────────────────────────────────────────────────────

interface ActionModal { type: "refund"|"cancel"|"cancel_and_refund"|"approve_cancel"; orderId: number; hasCharge: boolean; }

function CommentModal({ modal, onConfirm, onClose, loading }: { modal: ActionModal; onConfirm:(c:string)=>void; onClose:()=>void; loading:boolean }) {
  const [comment, setComment] = useState("");
  const titles: Record<string,string> = { refund:"Возврат звёзд", cancel:"Отмена заказа", cancel_and_refund:"Отмена + Возврат", approve_cancel:"Одобрить отмену" };
  const descs: Record<string,string> = {
    refund:"Вернуть звёзды покупателю. Комментарий (необязательно):",
    cancel:"Отменить заказ. Укажите причину (необязательно):",
    cancel_and_refund:"Отменить заказ и вернуть звёзды. Комментарий (необязательно):",
    approve_cancel:"Одобрить запрос на отмену и вернуть звёзды. Комментарий (необязательно):",
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{background:"rgba(0,0,0,0.5)",backdropFilter:"blur(4px)"}}>
      <div className="liquid-glass rounded-3xl p-6 w-full max-w-sm space-y-4 animate-shimmer-in">
        <h3 className="text-lg font-black">{titles[modal.type]}</h3>
        <p className="text-sm text-muted-foreground">Заказ #{modal.orderId}</p>
        <p className="text-sm">{descs[modal.type]}</p>
        <textarea rows={3} placeholder="Комментарий…" value={comment} onChange={e=>setComment(e.target.value)}
          className="w-full rounded-2xl px-4 py-3 text-sm border border-border bg-background/60 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" autoFocus />
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 liquid-button py-2.5 text-sm font-semibold" disabled={loading}>Отмена</button>
          <button onClick={()=>onConfirm(comment)} disabled={loading}
            className={cn("flex-1 py-2.5 text-sm font-bold rounded-full text-white transition-all disabled:opacity-50", modal.type==="refund"?"bg-amber-500 hover:bg-amber-600":"bg-red-500 hover:bg-red-600")}>
            {loading?"…":"Подтвердить"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Preset editor modal ───────────────────────────────────────────────────────

const PRESET_FIELDS = [
  { key:"name", label:"Название", type:"text", required:true },
  { key:"collectionName", label:"Коллекция", type:"text" },
  { key:"description", label:"Описание", type:"text" },
  { key:"priceStars", label:"Цена (⭐)", type:"number" },
  { key:"maxQuantity", label:"Макс. количество", type:"number" },
  { key:"watchfaceGeometry", label:"Форма", type:"select", options:["circle","square","star","drawn"] },
  { key:"watchfaceMaterial", label:"Материал корпуса", type:"select", options:["metal","plastic"] },
  { key:"watchfaceColor", label:"Цвет циферблата", type:"color" },
  { key:"braceletMaterial", label:"Материал браслета", type:"select", options:["metal_solid","metal_segmented","plastic_solid","plastic_segmented","leather","resin","cotton_fabric"] },
  { key:"braceletColor", label:"Цвет браслета", type:"color" },
  { key:"handsEnabled", label:"Стрелки включены", type:"checkbox" },
  { key:"handsColor", label:"Цвет стрелок", type:"color" },
  { key:"boxType", label:"Тип коробки", type:"select", options:["standard","premium","collector"] },
  { key:"watchfaceText", label:"Текст циферблата", type:"text" },
  { key:"watchfaceTextMode", label:"Расположение текста", type:"select", options:["center","circular"] },
];

function PresetModal({ preset, onSave, onClose, loading }: { preset:any|null; onSave:(d:any)=>void; onClose:()=>void; loading:boolean }) {
  const [form, setForm] = useState<any>(preset ?? {
    name:"", collectionName:"", priceStars:10, watchfaceGeometry:"circle",
    watchfaceMaterial:"metal", watchfaceColor:"#1e293b", braceletMaterial:"metal_solid",
    braceletColor:"#0f172a", handsEnabled:true, handsColor:"#cbd5e1", boxType:"standard",
    maxQuantity:1000,
  });
  const set = (k:string, v:any) => setForm((p:any) => ({...p, [k]:v}));
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6" style={{background:"rgba(0,0,0,0.6)",backdropFilter:"blur(6px)"}}>
      <div className="liquid-glass rounded-3xl w-full max-w-lg max-h-[92dvh] flex flex-col animate-shimmer-in">
        <div className="flex items-center justify-between p-5 pb-3 border-b border-border/30">
          <h3 className="text-lg font-black">{preset ? `Редактировать #${preset.id}` : "Новый пресет"}</h3>
          <button onClick={onClose} className="liquid-button p-2"><X size={16}/></button>
        </div>
        <div className="overflow-y-auto p-5 space-y-3 flex-1">
          {PRESET_FIELDS.map(f => (
            <div key={f.key}>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">{f.label}</label>
              {f.type === "text" && (
                <input value={form[f.key] ?? ""} onChange={e=>set(f.key,e.target.value)}
                  className="w-full rounded-xl px-3 py-2 text-sm border border-border bg-background/60 focus:outline-none focus:ring-2 focus:ring-primary/30" />
              )}
              {f.type === "number" && (
                <input type="number" value={form[f.key] ?? ""} onChange={e=>set(f.key,e.target.value)}
                  className="w-full rounded-xl px-3 py-2 text-sm border border-border bg-background/60 focus:outline-none focus:ring-2 focus:ring-primary/30" />
              )}
              {f.type === "color" && (
                <div className="flex items-center gap-2">
                  <input type="color" value={form[f.key] ?? "#000000"} onChange={e=>set(f.key,e.target.value)}
                    className="w-10 h-9 rounded-lg border border-border cursor-pointer" />
                  <input value={form[f.key] ?? ""} onChange={e=>set(f.key,e.target.value)}
                    className="flex-1 rounded-xl px-3 py-2 text-sm border border-border bg-background/60 focus:outline-none focus:ring-2 focus:ring-primary/30 font-mono" />
                </div>
              )}
              {f.type === "select" && (
                <select value={form[f.key] ?? ""} onChange={e=>set(f.key,e.target.value)}
                  className="w-full rounded-xl px-3 py-2 text-sm border border-border bg-background/60 focus:outline-none focus:ring-2 focus:ring-primary/30">
                  {f.options!.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              )}
              {f.type === "checkbox" && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={!!form[f.key]} onChange={e=>set(f.key,e.target.checked)}
                    className="w-4 h-4 rounded" />
                  <span className="text-sm text-foreground">Включено</span>
                </label>
              )}
            </div>
          ))}
        </div>
        <div className="p-5 pt-3 border-t border-border/30 flex gap-3">
          <button onClick={onClose} className="flex-1 liquid-button py-2.5 text-sm font-semibold" disabled={loading}>Отмена</button>
          <button onClick={()=>onSave(form)} disabled={loading || !form.name?.trim()}
            className="flex-1 py-2.5 bg-primary text-white rounded-full text-sm font-bold hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5">
            <Save size={14}/>{loading?"…":"Сохранить"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Admin() {
  const [, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const [tab, setTab] = useState<Tab>("orders");
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [actionModal, setActionModal] = useState<ActionModal|null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMsgs, setActionMsgs] = useState<Record<number,{ok:boolean;msg:string}>>({});

  // Presets state
  const [presets, setPresets] = useState<any[]>([]);
  const [presetsLoading, setPresetsLoading] = useState(false);
  const [presetModal, setPresetModal] = useState<{preset:any|null}|null>(null);
  const [presetSaving, setPresetSaving] = useState(false);
  const [presetMsg, setPresetMsg] = useState("");

  // Users state
  const [users, setUsers] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [editUser, setEditUser] = useState<any|null>(null);
  const [userForm, setUserForm] = useState({ username:"", password:"", role:"courier" });
  const [showPwd, setShowPwd] = useState(false);
  const [editPwd, setEditPwd] = useState("");
  const [showEditPwd, setShowEditPwd] = useState(false);
  const [userMsg, setUserMsg] = useState("");
  const [userLoading, setUserLoading] = useState(false);
  const [createUserOpen, setCreateUserOpen] = useState(false);

  // Prices state
  const [prices, setPrices] = useState<any>(null);
  const [pricesLoading, setPricesLoading] = useState(false);
  const [pricesSaving, setPricesSaving] = useState(false);
  const [pricesMsg, setPricesMsg] = useState("");

  // Bot state
  const [webhookInfo, setWebhookInfo] = useState<any>(null);
  const [webhookLoading, setWebhookLoading] = useState(false);
  const [customWebhookUrl, setCustomWebhookUrl] = useState("");
  const [webhookRegResult, setWebhookRegResult] = useState<any>(null);

  const { data: ordersData, isLoading: ordersLoading, refetch } = useListOrders(
    { limit: PAGE_SIZE, offset: (page-1)*PAGE_SIZE, status: (statusFilter as any)||undefined }
  );
  const { data: analytics, isLoading: analyticsLoading } = useGetAnalyticsSummary(
    { query: { enabled: tab==="analytics" } } as any
  );
  const updateStatus = useUpdateOrderStatus();

  // Fetch presets when tab opens
  useEffect(() => {
    if (tab !== "presets") return;
    setPresetsLoading(true);
    adminFetch("/api/admin/presets").then(setPresets).finally(() => setPresetsLoading(false));
  }, [tab]);

  // Fetch users when tab opens
  useEffect(() => {
    if (tab !== "users") return;
    setUsersLoading(true);
    adminFetch("/api/admin/users").then(setUsers).finally(() => setUsersLoading(false));
  }, [tab]);

  // Fetch prices when tab opens
  useEffect(() => {
    if (tab !== "prices") return;
    setPricesLoading(true);
    adminFetch("/api/admin/prices").then(setPrices).finally(() => setPricesLoading(false));
  }, [tab]);

  const handleStatusUpdate = async (orderId: number, newStatus: string) => {
    await updateStatus.mutateAsync({ id: orderId, data: { status: newStatus as any } });
    refetch();
  };

  const handleModalConfirm = async (comment: string) => {
    if (!actionModal) return;
    setActionLoading(true);
    let result: { ok: boolean; msg: string };
    try {
      const jwt = localStorage.getItem("jwt") ?? "";
      if (actionModal.type === "refund") {
        const res = await fetch(`/api/orders/${actionModal.orderId}/refund`, { method:"POST", headers:{"Content-Type":"application/json",Authorization:`Bearer ${jwt}`}, body:JSON.stringify({adminComment:comment||undefined}) });
        const json = await res.json();
        const tg = json.telegramRefundResult;
        result = tg?.ok===false ? (tg.description?.includes("CHARGE_ALREADY_REFUNDED") ? {ok:true,msg:"Уже возвращено"} : {ok:false,msg:tg.description}) : {ok:true,msg:"Звёзды возвращены"};
      } else if (actionModal.type === "cancel") {
        await updateStatus.mutateAsync({ id: actionModal.orderId, data: { status: "cancelled" as any } });
        result = { ok: true, msg: "Отменён" };
      } else {
        await updateStatus.mutateAsync({ id: actionModal.orderId, data: { status: "cancelled" as any } });
        const res = await fetch(`/api/orders/${actionModal.orderId}/refund`, { method:"POST", headers:{"Content-Type":"application/json",Authorization:`Bearer ${jwt}`}, body:JSON.stringify({adminComment:comment||undefined}) });
        const json = await res.json();
        result = { ok: true, msg: json.telegramRefundResult?.ok===false ? "Отменён (возврат не прошёл)" : "Отменён + возврат" };
      }
    } catch { result = { ok: false, msg: "Ошибка сети" }; }
    setActionMsgs(p => ({...p, [actionModal.orderId]: result}));
    setActionLoading(false);
    setActionModal(null);
    refetch();
  };

  // ── Presets handlers ──────────────────────────────────────────────────────

  const handleSavePreset = async (data: any) => {
    setPresetSaving(true);
    try {
      if (presetModal?.preset) {
        const updated = await adminFetch(`/api/admin/presets/${presetModal.preset.id}`, "PATCH", data);
        setPresets(p => p.map(x => x.id === updated.id ? updated : x));
        setPresetMsg("Сохранено ✓");
      } else {
        const created = await adminFetch("/api/admin/presets", "POST", data);
        setPresets(p => [...p, created]);
        setPresetMsg("Создан ✓");
      }
      setPresetModal(null);
    } catch (e: any) { setPresetMsg(e.message ?? "Ошибка"); }
    finally { setPresetSaving(false); }
  };

  const handleDeletePreset = async (id: number) => {
    if (!confirm(`Удалить пресет #${id}?`)) return;
    await adminFetch(`/api/admin/presets/${id}`, "DELETE");
    setPresets(p => p.filter(x => x.id !== id));
  };

  // ── Users handlers ────────────────────────────────────────────────────────

  const handleCreateUser = async () => {
    if (!userForm.username || !userForm.password) return;
    setUserLoading(true);
    try {
      const u = await adminFetch("/api/admin/users", "POST", userForm);
      setUsers(p => [...p, u]);
      setUserForm({ username:"", password:"", role:"courier" });
      setCreateUserOpen(false);
      setUserMsg("Пользователь создан ✓");
    } catch (e: any) { setUserMsg(e.message ?? "Ошибка"); }
    finally { setUserLoading(false); }
  };

  const handleUpdateUser = async (id: number, patch: any) => {
    setUserLoading(true);
    try {
      const u = await adminFetch(`/api/admin/users/${id}`, "PATCH", patch);
      setUsers(p => p.map(x => x.id === id ? u : x));
      setEditUser(null);
      setEditPwd("");
      setUserMsg("Сохранено ✓");
    } catch (e: any) { setUserMsg(e.message ?? "Ошибка"); }
    finally { setUserLoading(false); }
  };

  const handleDeleteUser = async (id: number, username: string) => {
    if (!confirm(`Удалить пользователя «${username}»?`)) return;
    await adminFetch(`/api/admin/users/${id}`, "DELETE");
    setUsers(p => p.filter(x => x.id !== id));
  };

  // ── Prices handlers ────────────────────────────────────────────────────────

  const setPriceVal = (path: string[], val: any) => {
    setPrices((prev: any) => {
      const next = { ...prev };
      if (path.length === 1) { next[path[0]] = Number(val); return next; }
      next[path[0]] = { ...next[path[0]], [path[1]]: Number(val) };
      return next;
    });
  };

  const handleSavePrices = async () => {
    setPricesSaving(true);
    try {
      await adminFetch("/api/admin/prices", "PUT", prices);
      setPricesMsg("Цены сохранены ✓");
    } catch (e: any) { setPricesMsg(e.message ?? "Ошибка"); }
    finally { setPricesSaving(false); }
  };

  if (!user) { setLocation("/login"); return null; }

  const orders: any[] = (ordersData as any)?.orders ?? [];
  const total: number = (ordersData as any)?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE) || 1;

  const tabs: { id: Tab; label: string; adminOnly?: boolean }[] = [
    { id: "orders", label: "Заказы" },
    ...(user.role === "admin" ? [
      { id: "analytics" as Tab, label: "Аналитика", adminOnly: true },
      { id: "presets"   as Tab, label: "Коллекции", adminOnly: true },
      { id: "users"     as Tab, label: "Пользователи", adminOnly: true },
      { id: "prices"    as Tab, label: "Цены", adminOnly: true },
      { id: "bot"       as Tab, label: "Бот", adminOnly: true },
    ] : []),
  ];

  return (
    <div className="min-h-[100dvh] bg-background">
      {actionModal && <CommentModal modal={actionModal} onConfirm={handleModalConfirm} onClose={()=>setActionModal(null)} loading={actionLoading}/>}
      {presetModal && <PresetModal preset={presetModal.preset} onSave={handleSavePreset} onClose={()=>setPresetModal(null)} loading={presetSaving}/>}

      {/* ── Header ── */}
      <div className="border-b border-border px-4 py-3 liquid-glass">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-base font-black tracking-tight leading-tight">Панель управления</h1>
            <p className="text-[11px] text-muted-foreground">{user.role==="admin"?"Администратор":"Курьер"} — {user.username}</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Link href="/"><button className="liquid-button p-2 md:px-3 md:py-1.5 text-xs font-semibold" title="Главная"><Home size={14}/><span className="hidden md:inline ml-1">Главная</span></button></Link>
            <Link href="/orders"><button className="liquid-button p-2 md:px-3 md:py-1.5 text-xs font-semibold" title="Заказы"><Package size={14}/><span className="hidden md:inline ml-1">Заказы</span></button></Link>
            <button onClick={logout} className="px-3 py-2 rounded-full text-xs font-semibold text-red-500 bg-red-50 border border-red-100 hover:bg-red-100 transition-colors">Выйти</button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-3 md:px-6 py-4 md:py-6">
        {/* ── Tabs — horizontal scroll on mobile ── */}
        <div className="overflow-x-auto pb-1 mb-5 -mx-1 px-1">
          <div className="flex gap-1 liquid-glass rounded-full p-1 w-max min-w-full md:w-fit">
            {tabs.map(t => (
              <button key={t.id} onClick={()=>setTab(t.id)}
                className={cn("px-4 py-2 rounded-full text-sm font-semibold transition-all whitespace-nowrap",
                  tab===t.id ? "bg-primary text-white shadow" : "text-muted-foreground hover:text-foreground")}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* ════════════════════════════════════════════════
            ORDERS TAB
        ════════════════════════════════════════════════ */}
        {tab === "orders" && (
          <div className="space-y-3">
            {/* Status filters — horizontal scroll */}
            <div className="overflow-x-auto -mx-1 px-1 pb-1">
              <div className="flex gap-1.5 w-max">
                {["","payment_pending","paid","cancel_requested","processing","shipping","arrived","cancelled"].map(s => (
                  <button key={s} onClick={()=>{setStatusFilter(s);setPage(1);}}
                    className={cn("px-3 py-1.5 rounded-full text-xs font-semibold border whitespace-nowrap transition-all",
                      statusFilter===s ? "bg-primary text-white border-primary shadow" : "bg-card/60 border-border/60 text-muted-foreground hover:bg-card hover:text-foreground")}>
                    {s ? STATUS_LABELS[s].toUpperCase() : "ВСЕ"}
                  </button>
                ))}
              </div>
            </div>

            {ordersLoading ? (
              <div className="space-y-2">{[1,2,3].map(i=><div key={i} className="liquid-glass rounded-2xl h-16 animate-pulse"/>)}</div>
            ) : orders.length === 0 ? (
              <div className="liquid-glass rounded-2xl p-8 text-center text-muted-foreground">Заказов нет</div>
            ) : (
              <>
                <div className="space-y-2">
                  {orders.map(order => (
                    <div key={order.id} className={cn("liquid-glass rounded-2xl p-3 md:p-4", order.status==="cancel_requested"&&"ring-2 ring-orange-400")}>
                      {/* Top row: id + status + price */}
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <Link href={`/orders/${order.id}`}>
                          <span className="font-black text-sm font-mono hover:text-primary cursor-pointer">#{order.id}</span>
                        </Link>
                        <span className={cn("text-xs px-2 py-0.5 rounded-full font-semibold border", STATUS_COLORS[order.status]??"text-muted-foreground bg-muted border-border")}>
                          {STATUS_LABELS[order.status]??order.status}
                        </span>
                        <span className="text-primary font-black text-sm flex items-center gap-0.5 ml-auto">{order.totalStars}<TgStar size={12}/></span>
                      </div>

                      {/* Telegram info */}
                      {(order.telegramUsername||order.telegramId) && (
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          {order.telegramUsername && <a href={`https://t.me/${order.telegramUsername}`} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 font-mono font-semibold hover:underline">@{order.telegramUsername}</a>}
                          {order.telegramId && <span className="text-xs text-muted-foreground font-mono">ID:{order.telegramId}</span>}
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground font-mono mb-1">session: {String(order.sessionId??"").slice(0,8)}…</p>
                      {order.cancelComment && <p className="text-xs text-orange-600 italic mb-1">"{order.cancelComment}"</p>}
                      {order.status==="cancel_requested" && <span className="text-xs font-bold text-orange-600 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full inline-block mb-2">⚠️ Ожидает решения</span>}

                      {/* Receipt */}
                      {order.configId && <ConfigReceipt configId={order.configId} totalStars={order.totalStars} compact/>}

                      {/* Actions row */}
                      <div className="flex items-center gap-1.5 flex-wrap mt-2">
                        {NEXT_STATUSES[order.status] && (
                          <button onClick={()=>{ if(order.status==="cancel_requested") setActionModal({type:"approve_cancel",orderId:order.id,hasCharge:!!order.telegramPaymentChargeId}); else handleStatusUpdate(order.id,NEXT_STATUSES[order.status]); }}
                            disabled={updateStatus.isPending}
                            className={cn("px-3 py-1.5 rounded-full text-xs font-bold transition-colors whitespace-nowrap disabled:opacity-50",
                              order.status==="cancel_requested" ? "bg-red-50 text-red-600 border border-red-200 hover:bg-red-100" : "bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20")}>
                            {order.status==="cancel_requested" ? <span className="flex items-center gap-1"><Check size={11}/>Одобрить</span> : `→ ${STATUS_LABELS[NEXT_STATUSES[order.status]]}`}
                          </button>
                        )}
                        {order.status!=="cancelled"&&order.status!=="cancel_requested" && (
                          <button onClick={()=>setActionModal({type:order.telegramPaymentChargeId?"cancel_and_refund":"cancel",orderId:order.id,hasCharge:!!order.telegramPaymentChargeId})}
                            className="px-3 py-1.5 bg-red-50 text-red-500 border border-red-100 rounded-full text-xs font-bold hover:bg-red-100 transition-colors whitespace-nowrap">
                            {order.telegramPaymentChargeId?<span className="flex items-center gap-1">Отмена+Рефанд<TgStar size={11}/></span>:"Отменить"}
                          </button>
                        )}
                        {order.telegramPaymentChargeId && (
                          <button onClick={()=>setActionModal({type:"refund",orderId:order.id,hasCharge:true})}
                            className="px-3 py-1.5 bg-amber-50 text-amber-600 border border-amber-200 rounded-full text-xs font-bold hover:bg-amber-100 transition-colors whitespace-nowrap">
                            <span className="flex items-center gap-1">Рефанд<TgStar size={11}/></span>
                          </button>
                        )}
                        {actionMsgs[order.id] && <span className={cn("text-xs font-medium",actionMsgs[order.id].ok?"text-emerald-600":"text-red-500")}>{actionMsgs[order.id].msg}</span>}
                      </div>
                    </div>
                  ))}
                </div>
                {totalPages>1 && (
                  <div className="flex items-center justify-center gap-3 mt-4">
                    <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1} className="liquid-button px-4 py-2 text-sm disabled:opacity-30">←</button>
                    <span className="text-sm text-muted-foreground">{page}/{totalPages}</span>
                    <button onClick={()=>setPage(p=>p+1)} disabled={page===totalPages} className="liquid-button px-4 py-2 text-sm disabled:opacity-30">→</button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════
            ANALYTICS TAB
        ════════════════════════════════════════════════ */}
        {tab === "analytics" && user.role === "admin" && (
          <div className="space-y-6">
            {analyticsLoading ? (
              <div className="grid grid-cols-2 gap-3">{[1,2,3,4].map(i=><div key={i} className="liquid-glass rounded-2xl h-24 animate-pulse"/>)}</div>
            ) : analytics ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {([
                    { label:"Всего заказов", value:String((analytics as any).totalOrders??0), icon:<ClipboardList size={18} className="text-muted-foreground"/> },
                    { label:"Оплачено", value:String((analytics as any).paidOrders??0), icon:<Settings2 size={18} className="text-blue-400"/> },
                    { label:"Звёзд получено", value:`${(analytics as any).totalRevenue??0}`, icon:<Sparkles size={18} className="text-yellow-400"/> },
                    { label:"Конверсия", value:(analytics as any).checkoutStarts>0?`${(analytics as any).conversionRate??0}%`:"—", icon:<TrendingUp size={18} className="text-emerald-400"/> },
                  ] as any[]).map((stat,i)=>(
                    <div key={i} className="liquid-glass rounded-2xl p-4">
                      <div className="flex items-center gap-2 mb-2">{stat.icon}<p className="text-xs text-muted-foreground">{stat.label}</p></div>
                      <p className="text-2xl font-black">{stat.value}</p>
                    </div>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        )}

        {/* ════════════════════════════════════════════════
            PRESETS TAB
        ════════════════════════════════════════════════ */}
        {tab === "presets" && user.role === "admin" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-black text-lg">Коллекции и пресеты</h2>
              <button onClick={()=>setPresetModal({preset:null})} className="flex items-center gap-1.5 bg-primary text-white rounded-full px-4 py-2 text-sm font-bold hover:bg-primary/90 transition-all">
                <Plus size={14}/> Создать
              </button>
            </div>
            {presetMsg && <p className={cn("text-sm font-semibold",presetMsg.includes("✓")?"text-emerald-600":"text-red-500")}>{presetMsg}</p>}
            {presetsLoading ? (
              <div className="space-y-2">{[1,2,3].map(i=><div key={i} className="liquid-glass rounded-2xl h-14 animate-pulse"/>)}</div>
            ) : (
              <div className="space-y-2">
                {presets.map(p => (
                  <div key={p.id} className="liquid-glass rounded-2xl p-3 flex items-center gap-3">
                    {/* Color preview */}
                    <div className="w-9 h-9 rounded-xl shrink-0 border border-border/40" style={{background:`linear-gradient(135deg,${p.watchfaceColor},${p.braceletColor})`}}/>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.collectionName??'—'} · {p.priceStars}⭐ · {p.watchfaceGeometry}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button onClick={()=>setPresetModal({preset:p})} className="liquid-button p-2 text-muted-foreground hover:text-foreground"><Pencil size={14}/></button>
                      <button onClick={()=>handleDeletePreset(p.id)} className="p-2 rounded-xl text-red-500 hover:bg-red-50 transition-colors"><Trash2 size={14}/></button>
                    </div>
                  </div>
                ))}
                {presets.length===0 && <div className="liquid-glass rounded-2xl p-8 text-center text-muted-foreground">Пресетов нет</div>}
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════
            USERS TAB
        ════════════════════════════════════════════════ */}
        {tab === "users" && user.role === "admin" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-black text-lg">Пользователи</h2>
              <button onClick={()=>setCreateUserOpen(v=>!v)} className="flex items-center gap-1.5 bg-primary text-white rounded-full px-4 py-2 text-sm font-bold hover:bg-primary/90 transition-all">
                <Plus size={14}/> Создать
              </button>
            </div>

            {/* Create user form */}
            {createUserOpen && (
              <div className="liquid-glass rounded-2xl p-4 space-y-3 animate-fade-up">
                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Новый пользователь</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <input placeholder="Логин" value={userForm.username} onChange={e=>setUserForm(p=>({...p,username:e.target.value}))}
                    className="rounded-xl px-3 py-2 text-sm border border-border bg-background/60 focus:outline-none focus:ring-2 focus:ring-primary/30"/>
                  <div className="relative">
                    <input type={showPwd?"text":"password"} placeholder="Пароль" value={userForm.password} onChange={e=>setUserForm(p=>({...p,password:e.target.value}))}
                      className="w-full rounded-xl px-3 py-2 pr-10 text-sm border border-border bg-background/60 focus:outline-none focus:ring-2 focus:ring-primary/30"/>
                    <button type="button" onClick={()=>setShowPwd(v=>!v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
                      {showPwd?<EyeOff size={15}/>:<Eye size={15}/>}
                    </button>
                  </div>
                  <select value={userForm.role} onChange={e=>setUserForm(p=>({...p,role:e.target.value}))}
                    className="rounded-xl px-3 py-2 text-sm border border-border bg-background/60 focus:outline-none focus:ring-2 focus:ring-primary/30">
                    <option value="courier">Курьер</option>
                    <option value="admin">Администратор</option>
                  </select>
                </div>
                <button onClick={handleCreateUser} disabled={userLoading||!userForm.username||!userForm.password}
                  className="w-full bg-primary text-white rounded-full py-2 text-sm font-bold hover:bg-primary/90 disabled:opacity-50 transition-all">
                  {userLoading?"…":"Создать"}
                </button>
              </div>
            )}

            {userMsg && <p className={cn("text-sm font-semibold",userMsg.includes("✓")?"text-emerald-600":"text-red-500")}>{userMsg}</p>}

            {usersLoading ? (
              <div className="space-y-2">{[1,2,3].map(i=><div key={i} className="liquid-glass rounded-2xl h-14 animate-pulse"/>)}</div>
            ) : (
              <div className="space-y-2">
                {users.map(u => (
                  <div key={u.id} className="liquid-glass rounded-2xl p-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Users size={16} className="text-primary"/>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm">{u.username} {u.id===user.id && <span className="text-xs text-muted-foreground">(вы)</span>}</p>
                        <p className="text-xs text-muted-foreground capitalize">{u.role==="admin"?"Администратор":"Курьер"} · #{u.id}</p>
                      </div>
                      {u.id !== user.id && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button onClick={()=>{ setEditUser(u); setEditPwd(""); }} className="liquid-button p-2"><Pencil size={14}/></button>
                          <button onClick={()=>handleDeleteUser(u.id,u.username)} className="p-2 rounded-xl text-red-500 hover:bg-red-50 transition-colors"><Trash2 size={14}/></button>
                        </div>
                      )}
                      {u.id === user.id && (
                        <button onClick={()=>{ setEditUser(u); setEditPwd(""); }} className="liquid-button p-2"><Pencil size={14}/></button>
                      )}
                    </div>
                    {/* Inline edit */}
                    {editUser?.id === u.id && (
                      <div className="mt-3 pt-3 border-t border-border/30 space-y-2 animate-fade-up">
                        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Редактировать</p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                          <input defaultValue={u.username} id={`uname-${u.id}`}
                            className="rounded-xl px-3 py-2 text-sm border border-border bg-background/60 focus:outline-none focus:ring-2 focus:ring-primary/30"
                            placeholder="Логин"/>
                          <div className="relative">
                            <input type={showEditPwd?"text":"password"} value={editPwd} onChange={e=>setEditPwd(e.target.value)}
                              className="w-full rounded-xl px-3 py-2 pr-9 text-sm border border-border bg-background/60 focus:outline-none focus:ring-2 focus:ring-primary/30"
                              placeholder="Новый пароль (необязательно)"/>
                            <button type="button" onClick={()=>setShowEditPwd(v=>!v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
                              {showEditPwd?<EyeOff size={14}/>:<Eye size={14}/>}
                            </button>
                          </div>
                          {u.id !== user.id && (
                            <select defaultValue={u.role} id={`role-${u.id}`}
                              className="rounded-xl px-3 py-2 text-sm border border-border bg-background/60 focus:outline-none focus:ring-2 focus:ring-primary/30">
                              <option value="courier">Курьер</option>
                              <option value="admin">Администратор</option>
                            </select>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button onClick={()=>{setEditUser(null);setEditPwd("");}} className="flex-1 liquid-button py-2 text-xs font-semibold">Отмена</button>
                          <button
                            onClick={()=>{
                              const patch: any = {};
                              const nameEl = document.getElementById(`uname-${u.id}`) as HTMLInputElement;
                              if (nameEl?.value.trim() && nameEl.value.trim()!==u.username) patch.username=nameEl.value.trim();
                              if (editPwd) patch.password = editPwd;
                              if (u.id !== user.id) {
                                const roleEl = document.getElementById(`role-${u.id}`) as HTMLSelectElement;
                                if (roleEl?.value && roleEl.value!==u.role) patch.role=roleEl.value;
                              }
                              if (Object.keys(patch).length > 0) handleUpdateUser(u.id, patch);
                              else { setEditUser(null); setEditPwd(""); }
                            }}
                            disabled={userLoading}
                            className="flex-1 bg-primary text-white rounded-full py-2 text-xs font-bold hover:bg-primary/90 disabled:opacity-50 transition-all flex items-center justify-center gap-1">
                            <Save size={12}/>{userLoading?"…":"Сохранить"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {users.length===0 && <div className="liquid-glass rounded-2xl p-8 text-center text-muted-foreground">Нет пользователей</div>}
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════
            PRICES TAB
        ════════════════════════════════════════════════ */}
        {tab === "prices" && user.role === "admin" && (
          <div className="space-y-4 max-w-xl">
            <div className="flex items-center justify-between">
              <h2 className="font-black text-lg">Цены компонентов</h2>
              <button onClick={handleSavePrices} disabled={pricesSaving||!prices}
                className="flex items-center gap-1.5 bg-primary text-white rounded-full px-4 py-2 text-sm font-bold hover:bg-primary/90 disabled:opacity-50 transition-all">
                <Save size={14}/>{pricesSaving?"…":"Сохранить"}
              </button>
            </div>
            {pricesMsg && <p className={cn("text-sm font-semibold",pricesMsg.includes("✓")?"text-emerald-600":"text-red-500")}>{pricesMsg}</p>}
            {pricesLoading ? (
              <div className="space-y-2">{[1,2,3].map(i=><div key={i} className="liquid-glass rounded-2xl h-32 animate-pulse"/>)}</div>
            ) : prices && (
              <>
                <PriceSection title="База" items={[{key:"base_price",label:"Базовая цена"}]} prices={prices} onChange={setPriceVal}/>
                <PriceSection title="Браслеты" items={[
                  {key:["bracelet","plastic_solid"],label:"Пластик сплошной"},
                  {key:["bracelet","plastic_segmented"],label:"Пластик сегментированный"},
                  {key:["bracelet","metal_solid"],label:"Металл сплошной"},
                  {key:["bracelet","metal_segmented"],label:"Металл сегментированный"},
                  {key:["bracelet","resin"],label:"Смола"},
                  {key:["bracelet","leather"],label:"Кожа"},
                  {key:["bracelet","cotton_fabric"],label:"Ткань NATO"},
                ]} prices={prices} onChange={setPriceVal}/>
                <PriceSection title="Форма циферблата" items={[
                  {key:["geometry","circle"],label:"Круглый"},
                  {key:["geometry","square"],label:"Квадратный"},
                  {key:["geometry","star"],label:"Звёздный"},
                  {key:["geometry","drawn"],label:"Нестандартный"},
                ]} prices={prices} onChange={setPriceVal}/>
                <PriceSection title="Упаковка" items={[
                  {key:["box","standard"],label:"Стандарт"},
                  {key:["box","premium"],label:"Премиум"},
                  {key:["box","collector"],label:"Коллекционная"},
                ]} prices={prices} onChange={setPriceVal}/>
                <PriceSection title="Дополнения" items={[
                  {key:"addon_engraving",label:"Гравировка"},
                  {key:"addon_gift_wrap",label:"Лента + бант"},
                  {key:"addon_custom_face",label:"Кастомный циферблат"},
                  {key:"addon_skin_full",label:"Скин на корпус"},
                  {key:"addon_skin_stripe",label:"Скин на ремешок"},
                ]} prices={prices} onChange={setPriceVal}/>
              </>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════
            BOT TAB
        ════════════════════════════════════════════════ */}
        {tab === "bot" && user.role === "admin" && (
          <div className="space-y-4 max-w-lg">
            <h2 className="font-black text-lg">Telegram Bot</h2>
            <div className="liquid-glass rounded-2xl p-4 space-y-3">
              <button onClick={async()=>{ setWebhookLoading(true); const r=await fetch("/api/bot/webhook-info").then(r=>r.json()); setWebhookInfo(r); setWebhookLoading(false); }}
                disabled={webhookLoading} className="liquid-button px-4 py-2 text-sm font-semibold flex items-center gap-2">
                <RefreshCw size={14} className={webhookLoading?"animate-spin":""}/> Проверить вебхук
              </button>
              {webhookInfo && (
                <div className="text-xs font-mono bg-muted/40 rounded-xl p-3 space-y-1">
                  <p><b>URL:</b> {webhookInfo.result?.url||"не задан"}</p>
                  <p><b>Pending:</b> {webhookInfo.result?.pending_update_count??0}</p>
                  {webhookInfo.result?.last_error_message && <p className="text-red-500"><b>Ошибка:</b> {webhookInfo.result.last_error_message}</p>}
                </div>
              )}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Зарегистрировать вебхук</p>
                <input value={customWebhookUrl} onChange={e=>setCustomWebhookUrl(e.target.value)} placeholder="https://…/api/bot/webhook"
                  className="w-full rounded-xl px-3 py-2 text-sm border border-border bg-background/60 focus:outline-none focus:ring-2 focus:ring-primary/30"/>
                <button onClick={async()=>{ setWebhookLoading(true); const jwt=localStorage.getItem("jwt")??""; const r=await fetch("/api/bot/register-webhook",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${jwt}`},body:JSON.stringify({url:customWebhookUrl})}).then(r=>r.json()); setWebhookRegResult(r); setWebhookLoading(false); }}
                  disabled={webhookLoading||!customWebhookUrl} className="bg-primary text-white rounded-full px-4 py-2 text-sm font-bold hover:bg-primary/90 disabled:opacity-50 transition-all">
                  {webhookLoading?"…":"Зарегистрировать"}
                </button>
                {webhookRegResult && <p className={cn("text-xs font-mono",webhookRegResult.ok?"text-emerald-600":"text-red-500")}>{JSON.stringify(webhookRegResult)}</p>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Price section component ──────────────────────────────────────────────────

function PriceSection({ title, items, prices, onChange }: {
  title: string;
  items: { key: string|string[]; label: string }[];
  prices: any;
  onChange: (path:string[], val:any) => void;
}) {
  const get = (k: string|string[]) => {
    if (Array.isArray(k)) return prices[k[0]]?.[k[1]] ?? 0;
    return prices[k] ?? 0;
  };
  return (
    <div className="liquid-glass rounded-2xl p-4">
      <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-3">{title}</p>
      <div className="space-y-2">
        {items.map(item => (
          <div key={Array.isArray(item.key)?item.key.join("_"):item.key} className="flex items-center justify-between gap-3">
            <span className="text-sm text-foreground">{item.label}</span>
            <div className="flex items-center gap-1 shrink-0">
              <input
                type="number" min={0} max={50} step={1}
                value={get(item.key)}
                onChange={e=>onChange(Array.isArray(item.key)?item.key:[item.key], e.target.value)}
                className="w-16 rounded-lg px-2 py-1.5 text-sm text-center border border-border bg-background/60 focus:outline-none focus:ring-2 focus:ring-primary/30 font-mono font-bold"
              />
              <TgStar size={12}/>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
