import { Link, useLocation } from "wouter";
import { useGetCart } from "@workspace/api-client-react";
import { getSessionId } from "@/lib/session";
import { ShoppingCart, Package, ShieldCheck, Sun, Moon, User, LogOut, LogIn, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import { useState, useEffect } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getGetCartQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

export function Layout({ children }: { children: React.ReactNode }) {
  const sessionId = getSessionId();
  const [location] = useLocation();
  const { theme, toggle } = useTheme();
  const { user, logout, loading } = useAuth();
  const queryClient = useQueryClient();
  const [cartBounce, setCartBounce] = useState(false);
  const [prevCount, setPrevCount] = useState(0);

  const { data: cart } = useGetCart(
    { sessionId },
    {
      query: {
        enabled: true,
        queryKey: ["cart", sessionId],
      },
    }
  );

  const itemCount = cart?.itemCount || 0;

  useEffect(() => {
    if (itemCount > prevCount && prevCount !== 0) {
      setCartBounce(true);
      setTimeout(() => setCartBounce(false), 600);
    }
    setPrevCount(itemCount);
  }, [itemCount]);

  const isDark = theme === "dark";

  return (
    <div className={`min-h-screen flex flex-col relative ${theme}`}>
      {isDark && (
        <div className="fixed inset-0 pointer-events-none z-[-1] overflow-hidden">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 blur-[100px] rounded-full mix-blend-screen" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-accent/10 blur-[100px] rounded-full mix-blend-screen" />
        </div>
      )}

      <header className="sticky top-0 z-50 glass-panel border-b">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold tracking-tight flex items-center gap-2">
            <span className="text-primary">NOVA</span>
            <span className={isDark ? "text-white" : "text-foreground"}>GEAR</span>
          </Link>

          <nav className="flex items-center gap-1 sm:gap-4">
            <Link href="/" className={`hidden sm:block text-sm font-medium transition-colors hover:text-foreground ${location === '/' ? 'text-primary' : 'text-muted-foreground'}`}>
              Catalog
            </Link>
            <Link href="/orders" className={`hidden sm:flex text-sm font-medium transition-colors hover:text-foreground items-center gap-1.5 ${location === '/orders' ? 'text-primary' : 'text-muted-foreground'}`}>
              <Package className="w-3.5 h-3.5" />
              Orders
            </Link>
            {user?.isAdmin && (
              <Link href="/admin" className={`hidden sm:flex text-sm font-medium transition-colors hover:text-foreground items-center gap-1.5 ${location === '/admin' ? 'text-primary' : 'text-muted-foreground'}`}>
                <ShieldCheck className="w-3.5 h-3.5" />
                Admin
              </Link>
            )}

            {/* Theme Toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggle}
              className="rounded-full w-9 h-9"
              title={isDark ? "Switch to light mode" : "Switch to dark mode"}
            >
              {isDark ? <Sun className="w-4 h-4 text-yellow-400" /> : <Moon className="w-4 h-4" />}
            </Button>

            {/* User menu */}
            {!loading && (
              user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="rounded-full gap-2">
                      <div className="w-6 h-6 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-xs font-bold text-primary">
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="hidden sm:inline text-sm">{user.name}</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem asChild>
                      <Link href="/profile" className="flex items-center gap-2">
                        <User className="w-4 h-4" /> Profile
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/orders" className="flex items-center gap-2">
                        <Package className="w-4 h-4" /> My Orders
                      </Link>
                    </DropdownMenuItem>
                    {user.isAdmin && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                          <Link href="/admin" className="flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4" /> Admin Panel
                          </Link>
                        </DropdownMenuItem>
                      </>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive cursor-pointer"
                      onClick={async () => {
                        await logout();
                        queryClient.clear();
                      }}
                    >
                      <LogOut className="w-4 h-4 mr-2" /> Sign Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <div className="flex items-center gap-1">
                  <Link href="/login">
                    <Button variant="ghost" size="sm" className="rounded-full gap-1.5">
                      <LogIn className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Sign In</span>
                    </Button>
                  </Link>
                  <Link href="/register">
                    <Button size="sm" className="rounded-full gap-1.5">
                      <UserPlus className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Register</span>
                    </Button>
                  </Link>
                </div>
              )
            )}

            {/* Cart */}
            <Link href="/cart">
              <Button
                variant="secondary"
                size="sm"
                className={`relative group rounded-full ${cartBounce ? "animate-cart-bounce" : ""}`}
              >
                <ShoppingCart className="w-4 h-4 sm:mr-2 group-hover:text-primary transition-colors" />
                <span className="hidden sm:inline">Cart</span>
                {itemCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full">
                    {itemCount}
                  </span>
                )}
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-6 sm:py-8">
        {children}
      </main>

      {/* Mobile bottom nav */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 glass-panel border-t flex justify-around py-2 px-4">
        <Link href="/" className={`flex flex-col items-center gap-0.5 text-xs ${location === '/' ? 'text-primary' : 'text-muted-foreground'}`}>
          <Package className="w-5 h-5" />
          Catalog
        </Link>
        <Link href="/orders" className={`flex flex-col items-center gap-0.5 text-xs ${location === '/orders' ? 'text-primary' : 'text-muted-foreground'}`}>
          <ShieldCheck className="w-5 h-5" />
          Orders
        </Link>
        <Link href="/cart" className="relative flex flex-col items-center gap-0.5 text-xs text-muted-foreground">
          <ShoppingCart className={`w-5 h-5 ${location === '/cart' ? 'text-primary' : ''}`} />
          {itemCount > 0 && (
            <span className="absolute -top-1 left-1/2 translate-x-1 bg-primary text-primary-foreground text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full">
              {itemCount}
            </span>
          )}
          Cart
        </Link>
        <Link href={user ? "/profile" : "/login"} className={`flex flex-col items-center gap-0.5 text-xs ${location === '/login' || location === '/profile' ? 'text-primary' : 'text-muted-foreground'}`}>
          <User className="w-5 h-5" />
          {user ? "Me" : "Sign In"}
        </Link>
      </nav>

      <div className="sm:hidden h-16" />

      <footer className="hidden sm:block border-t border-border/30 py-8 mt-12 bg-card/50">
        <div className="container mx-auto px-4 text-center text-muted-foreground text-sm">
          <p>© {new Date().getFullYear()} NOVAGEAR. Premium Tech.</p>
          <p className="mt-2 text-xs opacity-50">Powered by Telegram Stars ⭐</p>
        </div>
      </footer>
    </div>
  );
}
