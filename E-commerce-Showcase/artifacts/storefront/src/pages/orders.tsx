import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useListOrders, getListOrdersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Confetti } from "@/components/confetti";
import { getSessionId } from "@/lib/session";
import {
  Star,
  Clock,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Package,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
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

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; Icon: typeof Clock }> = {
  paid:      { label: "Paid",      color: "text-green-400",  bg: "bg-green-500/10",  border: "border-green-500/20",  Icon: CheckCircle2 },
  pending:   { label: "Pending",   color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/20", Icon: Clock },
  cancelled: { label: "Cancelled", color: "text-red-400",    bg: "bg-red-500/10",    border: "border-red-500/20",    Icon: XCircle },
  refunded:  { label: "Refunded",  color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/20", Icon: RotateCcw },
};

export default function Orders() {
  const sessionId = getSessionId();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [requestingId, setRequestingId] = useState<number | null>(null);
  const [location] = useLocation();

  const celebrationQuery = useMemo(() => new URLSearchParams(location.split("?")[1] ?? ""), [location]);
  const celebrationOrderId = celebrationQuery.get("orderId");
  const celebrationVisibleByDefault = celebrationQuery.get("paid") === "true";
  const [showCelebration, setShowCelebration] = useState<boolean>(celebrationVisibleByDefault);

  const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

  useEffect(() => {
    if (!celebrationVisibleByDefault) return;

    const timer = window.setTimeout(() => setShowCelebration(false), 7000);
    const cleanPath = location.split("?")[0] || "/orders";
    window.history.replaceState(null, "", cleanPath);

    return () => window.clearTimeout(timer);
  }, [celebrationVisibleByDefault, location]);

  const { data: orders, isLoading, refetch } = useListOrders(
    { sessionId },
    { query: { queryKey: getListOrdersQueryKey({ sessionId }) } }
  );

  const handleCancelRequest = async (orderId: number) => {
    setRequestingId(orderId);
    try {
      const res = await fetch(`${BASE}/api/orders/${orderId}/cancel-request`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Request failed");
      queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey({ sessionId }) });
      toast({
        title: "Cancellation requested",
        description: "An admin will review your request and issue a refund if approved.",
      });
    } catch {
      toast({ title: "Failed", description: "Could not submit cancellation request.", variant: "destructive" });
    } finally {
      setRequestingId(null);
    }
  };

  const sortedOrders = orders ? [...orders].reverse() : [];

  return (
    <Layout>
      <Confetti active={showCelebration} />
      <div className="max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-6 duration-700">
        {showCelebration && (
          <div className="mb-6 rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-5 text-white shadow-lg">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <div>
                  <p className="font-semibold text-white">Payment confirmed!</p>
                  <p className="text-sm text-muted-foreground">
                    {celebrationOrderId
                      ? `Order #${celebrationOrderId} is now paid. Great choice!`
                      : "Your Telegram payment succeeded — welcome back to your orders."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Package className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">My Orders</h1>
              <p className="text-xs text-muted-foreground">Session: {sessionId.slice(0, 12)}…</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="border-border rounded-full"
            onClick={() => refetch()}
          >
            <RefreshCw className="w-3.5 h-3.5 mr-2" />
            Refresh
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full rounded-2xl" />)}
          </div>
        ) : sortedOrders.length === 0 ? (
          <div className="py-20 text-center border border-border bg-card/30 rounded-2xl">
            <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No orders yet</h3>
            <p className="text-muted-foreground text-sm">Your orders will appear here after you check out via Telegram.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedOrders.map((order) => {
              const cfg = STATUS_CONFIG[order.status] ?? STATUS_CONFIG["pending"];
              const { Icon } = cfg;
              const hasCancelRequest = (order as unknown as { cancelRequested?: boolean }).cancelRequested;
              const isRequesting = requestingId === order.id;

              return (
                <div
                  key={order.id}
                  className={`bg-card border rounded-2xl p-5 ${hasCancelRequest ? "border-orange-500/20" : "border-border"}`}
                >
                  <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-bold text-foreground">Order #{order.id}</span>
                        <div className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-xs font-bold ${cfg.bg} ${cfg.border} ${cfg.color}`}>
                          <Icon className="w-3 h-3" />
                          {cfg.label}
                        </div>
                        {hasCancelRequest && (
                          <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border border-orange-500/30 bg-orange-500/10 text-orange-400 text-xs font-bold">
                            <AlertTriangle className="w-2.5 h-2.5" />
                            Cancel Requested
                          </div>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(order.createdAt), "MMMM d, yyyy 'at' HH:mm")}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 font-bold text-foreground">
                      <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                      {order.totalStars} Stars
                    </div>
                  </div>

                  <div className="space-y-2 mb-4">
                    {order.items.map(item => (
                      <div key={item.id} className="flex items-center gap-3 text-sm">
                        <img
                          src={item.product.imageUrl}
                          alt={item.product.name}
                          className="w-10 h-10 rounded-lg object-cover bg-muted border border-border shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-foreground truncate">{item.product.name}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-2">
                            <span
                              className="w-3 h-3 rounded-full border border-border inline-block shrink-0"
                              style={{ backgroundColor: item.selectedColor }}
                            />
                            {item.selectedColor} · Qty: {item.quantity} · ⭐ {item.priceStars}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {order.status === "paid" && !hasCancelRequest && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-border rounded-full text-xs"
                          disabled={isRequesting}
                        >
                          <AlertTriangle className="w-3 h-3 mr-1.5" />
                          {isRequesting ? "Sending…" : "Request Cancellation"}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="bg-card border border-border rounded-2xl">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Request cancellation for Order #{order.id}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will notify the admin. They will review and refund{" "}
                            <span className="text-yellow-400 font-bold">⭐ {order.totalStars} Stars</span> if approved.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="rounded-full">Never mind</AlertDialogCancel>
                          <AlertDialogAction
                            className="rounded-full bg-orange-500 hover:bg-orange-600 text-white font-bold"
                            onClick={() => handleCancelRequest(order.id)}
                          >
                            Request Cancellation
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}

                  {hasCancelRequest && order.status === "paid" && (
                    <p className="text-xs text-orange-400/80 flex items-center gap-1.5 mt-1">
                      <AlertTriangle className="w-3 h-3" />
                      Cancellation pending admin review
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
