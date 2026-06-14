import React, { useEffect, Component } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import Home from "@/pages/Home";
import Collections from "@/pages/Collections";
import CollectionPage from "@/pages/CollectionPage";
import PresetViewer from "@/pages/PresetViewer";
import Configure from "@/pages/Configure";
import BoxSetup from "@/pages/BoxSetup";
import Payment from "@/pages/Payment";
import Orders from "@/pages/Orders";
import OrderDetail from "@/pages/OrderDetail";
import Login from "@/pages/Login";
import Admin from "@/pages/Admin";
import NotFound from "@/pages/not-found";

import { WatchConfigProvider } from "@/hooks/use-watch-config";
import { AuthProvider } from "@/hooks/use-auth";
import { ThemeProvider } from "@/hooks/use-theme";
import { CartProvider } from "@/hooks/use-cart";
import ThemeToggle from "@/components/ThemeToggle";

const queryClient = new QueryClient();

class ErrorBoundary extends Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-8 bg-background text-foreground">
          <p className="text-4xl">💥</p>
          <h1 className="text-xl font-bold">Что-то пошло не так</h1>
          <p className="text-sm text-muted-foreground text-center max-w-sm">
            {this.state.error.message}
          </p>
          <button
            className="mt-2 px-6 py-2 rounded-full bg-primary text-white text-sm font-semibold"
            onClick={() => { this.setState({ error: null }); window.location.href = '/'; }}
          >
            На главную
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function MouseGlassTracker() {
  useEffect(() => {
    const update = (e: MouseEvent) => {
      document.documentElement.style.setProperty("--mouse-x", `${e.clientX}px`);
      document.documentElement.style.setProperty("--mouse-y", `${e.clientY}px`);
    };
    window.addEventListener("mousemove", update, { passive: true });

    const purgeReplitBadge = () => {
      const pill = document.getElementById("replit-pill");
      if (pill) pill.remove();
      document.querySelectorAll<HTMLElement>('[class*="replit-badge"], iframe[src*="replit.com/badge"]').forEach(el => el.remove());
    };
    purgeReplitBadge();
    const obs = new MutationObserver(purgeReplitBadge);
    obs.observe(document.body, { childList: true, subtree: true });

    return () => {
      window.removeEventListener("mousemove", update);
      obs.disconnect();
    };
  }, []);
  return null;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/collections" component={Collections} />
      <Route path="/collections/:index" component={CollectionPage} />
      <Route path="/preset/:id" component={PresetViewer} />
      <Route path="/configure" component={Configure} />
      <Route path="/box" component={BoxSetup} />
      <Route path="/payment/:orderId" component={Payment} />
      <Route path="/orders/:id" component={OrderDetail} />
      <Route path="/orders" component={Orders} />
      <Route path="/login" component={Login} />
      <Route path="/admin" component={Admin} />
      <Route component={NotFound} />
    </Switch>
  );
}

function ThemeTogglePortal() {
  return (
    <div className="fixed bottom-5 right-5 z-50">
      <ThemeToggle />
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <AuthProvider>
              <WatchConfigProvider>
                <CartProvider>
                  <MouseGlassTracker />
                  <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
                    <ThemeTogglePortal />
                    <ErrorBoundary>
                      <Router />
                    </ErrorBoundary>
                  </WouterRouter>
                  <Toaster />
                </CartProvider>
              </WatchConfigProvider>
            </AuthProvider>
          </TooltipProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
