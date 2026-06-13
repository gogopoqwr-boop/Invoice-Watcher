import React, { useEffect } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
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
import Login from "@/pages/Login";
import Admin from "@/pages/Admin";
import NotFound from "@/pages/not-found";

import { WatchConfigProvider } from "@/hooks/use-watch-config";
import { AuthProvider } from "@/hooks/use-auth";
import { ThemeProvider } from "@/hooks/use-theme";
import { CartProvider } from "@/hooks/use-cart";
import ThemeToggle from "@/components/ThemeToggle";

const queryClient = new QueryClient();

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
      <Route path="/orders" component={Orders} />
      <Route path="/login" component={Login} />
      <Route path="/admin" component={Admin} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AuthProvider>
            <WatchConfigProvider>
              <CartProvider>
                <MouseGlassTracker />
                <div className="fixed bottom-5 right-5 z-50">
                  <ThemeToggle />
                </div>
                <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
                  <Router />
                </WouterRouter>
                <Toaster />
              </CartProvider>
            </WatchConfigProvider>
          </AuthProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
