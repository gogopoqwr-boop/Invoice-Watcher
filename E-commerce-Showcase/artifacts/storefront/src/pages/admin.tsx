import { useState, useEffect } from "react";
import { Link } from "wouter";
import {
  useListOrders,
  useRefundOrder,
  getListOrdersQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Star,
  Clock,
  CheckCircle2,
  XCircle,
  RotateCcw,
  ShieldCheck,
  RefreshCw,
  Lock,
  Users,
  Eye,
  TrendingUp,
  ShoppingBag,
  AlertTriangle,
  BarChart3,
} from "lucide-react";
import { format } from "date-fns";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; Icon: typeof Clock }> = {
  paid:      { label: "Paid",      color: "text-green-400",  bg: "bg-green-500/10",  border: "border-green-500/20",  Icon: CheckCircle2 },
  pending:   { label: "Pending",   color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/20", Icon: Clock },
  cancelled: { label: "Cancelled", color: "text-red-400",    bg: "bg-red-500/10",    border: "border-red-500/20",    Icon: XCircle },
  refunded:  { label: "Refunded",  color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/20", Icon: RotateCcw },
};

const ADMIN_PASSWORD = "novagear2025";

interface AnalyticsStats {
  uniqueVisitors: number;
  pageViews: number;
  checkoutStarts: number;
  totalOrders: number;
  paidOrders: number;
  cancelRequested: number;
  revenue: number;
  conversionRate: number;
}

export default function Admin() {
  const [authenticated, setAuthenticated] = useState(() => {
    return sessionStorage.getItem("admin-auth") === "1";
  });
  const [pw, setPw] = useState("");
  const [pwError, setPwError] = useState("");
  const [analytics, setAnalytics] = useState<AnalyticsStats | null>(null);
  const [activeTab, setActiveTab] = useState<"orders" | "analytics">("orders");

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [refundingId, setRefundingId] = useState<number | null>(null);
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

  const { data: orders, isLoading, refetch } = useListOrders(
    {},
    { query: { queryKey: getListOrdersQueryKey(), enabled: authenticated } }
  );

  const refundOrder = useRefundOrder();

  useEffect(() => {
    if (!authenticated) return;
    fetch(`${BASE}/api/analytics/stats`)
      .then(r => r.json())
      .then(data => setAnalytics(data as AnalyticsStats))
      .catch(() => {});
  }, [authenticated, BASE]);

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pw === ADMIN_PASSWORD) {
      sessionStorage.setItem("admin-auth", "1");
      setAuthenticated(true);
    } else {
      setPwError("Incorrect password");
    }
  };

  const handleRefund = (orderId: number, totalStars: number) => {
    setRefundingId(orderId);
    refundOrder.mutate(
      { id: orderId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
          toast({ title: "Refund issued", description: `⭐ ${totalStars} Stars returned to customer.` });
          setRefundingId(null);
        },
        onError: (err: unknown) => {
          const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Refund failed";
          toast({ title: "Refund failed", description: msg, variant: "destructive" });
          setRefundingId(null);
        },
      }
    );
  };

  const handleCancelApprove = async (orderId: number) => {
    setCancellingId(orderId);
    try {
      const res = await fetch(`${BASE}/api/orders/${orderId}/refund`, { method: "POST" });
      if (!res.ok) throw new Error("Refund failed");
      queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
      toast({ title: "Cancel approved", description: "Order refunded and cancelled." });
    } catch {
      toast({ title: "Failed", description: "Could not process cancellation.", variant: "destructive" });
    } finally {
      setCancellingId(null);
    }
  };

  const filtered = orders
    ? statusFilter === "all" ? orders : orders.filter(o => o.status === statusFilter)
    : [];

  const stats = orders
    ? {
        total: orders.length,
        paid: orders.filter(o => o.status === "paid").length,
        pending: orders.filter(o => o.status === "pending").length,
        refunded: orders.filter(o => o.status === "refunded").length,
        cancelRequested: orders.filter(o => (o as unknown as { cancelRequested?: boolean }).cancelRequested).length,
        revenue: orders.filter(o => o.status === "paid").reduce((s, o) => s + o.totalStars, 0),
      }
    : null;

  if (!authenticated) {
    return (
      <Layout>
        <div className="max-w-sm mx-auto mt-16 animate-in fade-in slide-in-from-bottom-6 duration-500">
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4">
              <Lock className="w-7 h-7 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Admin Access</h1>
            <p className="text-muted-foreground text-sm mt-1">Enter admin password to continue</p>
          </div>
          <form onSubmit={handlePasswordSubmit} className="bg-card border border-border rounded-2xl p-6 space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Password</label>
              <Input
                type="password"
                value={pw}
                onChange={e => { setPw(e.target.value); setPwError(""); }}
                placeholder="Admin password"
                required
                autoFocus
                className="rounded-xl"
              />
              {pwError && <p className="text-destructive text-xs mt-1">{pwError}</p>}
            </div>
            <Button type="submit" className="w-full rounded-xl">
              <ShieldCheck className="w-4 h-4 mr-2" /> Access Admin Panel
            </Button>
          </form>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-6 duration-700">

        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Admin Panel</h1>
              <p className="text-xs text-muted-foreground">NOVAGEAR · All sessions</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="border-border rounded-full"
              onClick={() => { refetch(); fetch(`${BASE}/api/analytics/stats`).then(r => r.json()).then(d => setAnalytics(d as AnalyticsStats)); }}
            >
              <RefreshCw className="w-3.5 h-3.5 mr-2" />
              Refresh
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="rounded-full text-muted-foreground"
              onClick={() => { sessionStorage.removeItem("admin-auth"); setAuthenticated(false); }}
            >
              <Lock className="w-3.5 h-3.5 mr-1" /> Lock
            </Button>
          </div>
        </div>

        {/* Tab nav */}
        <div className="flex gap-2 mb-6">
          {[
            { id: "orders" as const, label: "Orders", Icon: ShoppingBag },
            { id: "analytics" as const, label: "Analytics", Icon: BarChart3 },
          ].map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border transition-all ${
                activeTab === id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Analytics tab */}
        {activeTab === "analytics" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {analytics ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: "Unique Visitors", value: analytics.uniqueVisitors, Icon: Users, color: "text-blue-400" },
                    { label: "Page Views", value: analytics.pageViews, Icon: Eye, color: "text-cyan-400" },
                    { label: "Checkout Starts", value: analytics.checkoutStarts, Icon: TrendingUp, color: "text-purple-400" },
                    { label: "Conversion Rate", value: `${analytics.conversionRate}%`, Icon: BarChart3, color: "text-green-400" },
                    { label: "Total Orders", value: analytics.totalOrders, Icon: ShoppingBag, color: "text-white" },
                    { label: "Paid Orders", value: analytics.paidOrders, Icon: CheckCircle2, color: "text-green-400" },
                    { label: "Cancel Requests", value: analytics.cancelRequested, Icon: AlertTriangle, color: "text-orange-400" },
                    { label: "Revenue ⭐", value: analytics.revenue, Icon: Star, color: "text-yellow-400" },
                  ].map(({ label, value, Icon, color }) => (
                    <div key={label} className="bg-card border border-border rounded-2xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Icon className={`w-4 h-4 ${color}`} />
                        <span className="text-xs text-muted-foreground">{label}</span>
                      </div>
                      <div className={`text-2xl font-bold ${color}`}>{value}</div>
                    </div>
                  ))}
                </div>

                <div className="bg-card border border-border rounded-2xl p-6">
                  <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-primary" />
                    Order Funnel
                  </h3>
                  <div className="space-y-3">
                    {[
                      { label: "Visitors", value: analytics.uniqueVisitors, max: analytics.uniqueVisitors, color: "bg-blue-500" },
                      { label: "Checkout Starts", value: analytics.checkoutStarts, max: analytics.uniqueVisitors, color: "bg-purple-500" },
                      { label: "Completed Orders", value: analytics.paidOrders, max: analytics.uniqueVisitors, color: "bg-green-500" },
                    ].map(({ label, value, max, color }) => (
                      <div key={label}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-muted-foreground">{label}</span>
                          <span className="font-semibold text-foreground">{value}</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full ${color} rounded-full transition-all duration-700`}
                            style={{ width: max > 0 ? `${Math.min(100, (value / max) * 100)}%` : "0%" }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 rounded-2xl" />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Orders tab */}
        {activeTab === "orders" && (
          <>
            {/* Stats row */}
            {stats && (
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-6">
                {[
                  { label: "Total", value: stats.total, color: "text-foreground" },
                  { label: "Paid", value: stats.paid, color: "text-green-400" },
                  { label: "Pending", value: stats.pending, color: "text-yellow-400" },
                  { label: "Refunded", value: stats.refunded, color: "text-purple-400" },
                  { label: "Cancel Req.", value: stats.cancelRequested, color: "text-orange-400" },
                  { label: "Revenue ⭐", value: stats.revenue, color: "text-yellow-300" },
                ].map(s => (
                  <div key={s.label} className="glass-panel rounded-xl p-3 border border-border">
                    <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Filter tabs */}
            <div className="flex gap-2 mb-4 overflow-x-auto pb-1 no-scrollbar">
              {["all", "paid", "pending", "refunded", "cancelled"].map(f => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all whitespace-nowrap ${
                    statusFilter === f
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                  {f !== "all" && orders && (
                    <span className="ml-1 opacity-60">{orders.filter(o => o.status === f).length}</span>
                  )}
                </button>
              ))}
            </div>

            {/* Orders list */}
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground">
                No orders found{statusFilter !== "all" ? ` with status "${statusFilter}"` : ""}.
              </div>
            ) : (
              <div className="space-y-2">
                {[...filtered].reverse().map((order) => {
                  const cfg = STATUS_CONFIG[order.status] ?? STATUS_CONFIG["pending"];
                  const { Icon } = cfg;
                  const isRefunding = refundingId === order.id;
                  const isCancelling = cancellingId === order.id;
                  const hasCancelRequest = (order as unknown as { cancelRequested?: boolean }).cancelRequested;

                  return (
                    <div
                      key={order.id}
                      className={`bg-card border rounded-2xl p-4 ${hasCancelRequest ? "border-orange-500/30" : "border-border"}`}
                    >
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="flex items-start gap-3 min-w-0">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-bold text-foreground">#{order.id}</span>
                              <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-bold ${cfg.bg} ${cfg.border} ${cfg.color}`}>
                                <Icon className="w-2.5 h-2.5" />
                                {cfg.label}
                              </div>
                              {hasCancelRequest && (
                                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-orange-500/30 bg-orange-500/10 text-orange-400 text-xs font-bold">
                                  <AlertTriangle className="w-2.5 h-2.5" />
                                  Cancel Req.
                                </div>
                              )}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {format(new Date(order.createdAt), "MMM d, yyyy HH:mm")} · Session: {order.sessionId.slice(0, 10)}…
                            </div>
                            <div className="flex flex-wrap gap-2 mt-2">
                              {order.items.slice(0, 3).map(item => (
                                <div key={item.id} className="flex items-center gap-1.5 text-xs text-foreground">
                                  <img src={item.product.imageUrl} alt="" className="w-5 h-5 rounded object-cover bg-muted border border-border shrink-0" />
                                  <span className="truncate max-w-[120px]">{item.product.name}</span>
                                  <span className="text-muted-foreground shrink-0">×{item.quantity}</span>
                                </div>
                              ))}
                              {order.items.length > 3 && <span className="text-xs text-muted-foreground">+{order.items.length - 3} more</span>}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <div className="flex items-center gap-1 font-bold text-foreground text-sm">
                            <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                            {order.totalStars}
                          </div>

                          {hasCancelRequest && order.status === "paid" ? (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 text-xs border-orange-500/30 text-orange-400 hover:bg-orange-500/10 rounded-full font-bold"
                                  disabled={isCancelling}
                                >
                                  <AlertTriangle className="w-3 h-3 mr-1" />
                                  {isCancelling ? "Processing…" : "Approve Cancel"}
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="bg-card border border-border rounded-2xl">
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Approve cancellation & refund #{order.id}?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Returns <span className="text-yellow-400 font-bold">⭐ {order.totalStars} Stars</span> to the customer.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel className="rounded-full">Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="rounded-full bg-orange-500 hover:bg-orange-600 text-white font-bold"
                                    onClick={() => handleCancelApprove(order.id)}
                                  >
                                    Approve & Refund
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          ) : order.status === "paid" ? (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 text-xs border-destructive/30 text-destructive hover:bg-destructive/10 rounded-full font-bold"
                                  disabled={isRefunding}
                                >
                                  <RotateCcw className={`w-3 h-3 mr-1 ${isRefunding ? "animate-spin" : ""}`} />
                                  {isRefunding ? "…" : "Refund"}
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="bg-card border border-border rounded-2xl">
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Refund Order #{order.id}?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Returns <span className="text-yellow-400 font-bold">⭐ {order.totalStars} Stars</span> to the customer
                                    {order.telegramUserId ? ` (TG: ${order.telegramUserId})` : ""}.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel className="rounded-full">Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="rounded-full bg-destructive hover:bg-destructive/90 text-white font-bold"
                                    onClick={() => handleRefund(order.id, order.totalStars)}
                                  >
                                    Refund ⭐ {order.totalStars}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          ) : (
                            <span className="text-xs text-muted-foreground/40">—</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        <p className="text-center text-xs text-muted-foreground/40 mt-8">
          Admin panel · <Link href="/" className="hover:text-foreground transition-colors">Back to store</Link>
        </p>
      </div>
    </Layout>
  );
}
