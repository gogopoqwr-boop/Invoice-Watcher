import React from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import Home from "@/pages/Home";
import Presets from "@/pages/Presets";
import Configure from "@/pages/Configure";
import Payment from "@/pages/Payment";
import Orders from "@/pages/Orders";
import Login from "@/pages/Login";
import Admin from "@/pages/Admin";
import NotFound from "@/pages/not-found";

import { WatchConfigProvider } from "@/hooks/use-watch-config";
import { AuthProvider } from "@/hooks/use-auth";

const queryClient = new QueryClient();

if (typeof window !== "undefined") {
  document.documentElement.classList.add("dark");
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/presets" component={Presets} />
      <Route path="/configure" component={Configure} />
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
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WatchConfigProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Router />
            </WouterRouter>
            <Toaster />
          </WatchConfigProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
