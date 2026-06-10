import { useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetCart,
  useUpdateCartItem,
  useRemoveFromCart,
  useCreateCheckoutToken,
  getGetCartQueryKey,
} from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { getSessionId } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Trash2, ShoppingCart, ArrowRight, Star } from "lucide-react";

export default function Cart() {
  const sessionId = getSessionId();
  const queryClient = useQueryClient();

  const { data: cart, isLoading } = useGetCart(
    { sessionId },
    { query: { enabled: true, queryKey: getGetCartQueryKey({ sessionId }) } }
  );

  const updateItem = useUpdateCartItem();
  const removeItem = useRemoveFromCart();
  const checkout = useCreateCheckoutToken();

  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [checkoutData, setCheckoutData] = useState<{ token: string; telegramLink: string; totalStars: number } | null>(null);

  const handleUpdateQuantity = (itemId: number, newQuantity: number) => {
    if (newQuantity < 1) return;
    updateItem.mutate(
      { itemId, data: { quantity: newQuantity } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetCartQueryKey({ sessionId }) });
        },
      }
    );
  };

  const handleRemove = (itemId: number) => {
    removeItem.mutate(
      { itemId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetCartQueryKey({ sessionId }) });
        },
      }
    );
  };

  const handleCheckout = () => {
    checkout.mutate(
      { data: { sessionId } },
      {
        onSuccess: (data) => {
          setCheckoutData(data);
          setCheckoutModalOpen(true);
        },
      }
    );
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto mt-8">
          <h1 className="text-3xl font-bold mb-8 text-white">Your Cart</h1>
          <div className="space-y-6">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-32 w-full rounded-2xl" />
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <Layout>
        <div className="max-w-md mx-auto mt-20 text-center glass-panel p-12 rounded-3xl animate-in zoom-in-95 duration-500">
          <div className="w-20 h-20 bg-card rounded-full flex items-center justify-center mx-auto mb-6 border border-white/5 shadow-[0_0_30px_rgba(0,184,255,0.1)]">
            <ShoppingCart className="w-10 h-10 text-primary" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-4">Cart is Empty</h2>
          <p className="text-muted-foreground mb-8">
            Your loadout is looking a bit light. Time to gear up.
          </p>
          <Link href="/">
            <Button size="lg" className="h-14 px-8 font-bold rounded-full">
              Browse Catalog
            </Button>
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-8 duration-700">
        <h1 className="text-3xl md:text-4xl font-bold mb-10 text-white flex items-center gap-4">
          Checkout Loadout
          <span className="text-sm font-medium bg-primary/20 text-primary px-3 py-1 rounded-full border border-primary/30">
            {cart.itemCount} items
          </span>
        </h1>

        <div className="grid lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2 space-y-6">
            {cart.items.map((item) => {
              const fallbackImage = `/images/category-${item.product.category}.png`;
              
              return (
                <div key={item.id} className="bg-card rounded-2xl border border-white/5 p-4 flex gap-6 items-center relative overflow-hidden group">
                  <div className="w-24 h-24 bg-black/40 rounded-xl overflow-hidden shrink-0 relative flex items-center justify-center">
                    <img 
                      src={item.product.imageUrl || fallbackImage} 
                      alt={item.product.name} 
                      className="w-full h-full object-cover mix-blend-screen"
                      onError={(e) => { (e.target as HTMLImageElement).src = fallbackImage; }}
                    />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <Link href={`/product/${item.product.id}`} className="font-bold text-white text-lg hover:text-primary transition-colors line-clamp-1 mb-1">
                      {item.product.name}
                    </Link>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground mb-3">
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-full border border-white/20" style={{ backgroundColor: item.selectedColor }} />
                        <span>{item.selectedColor}</span>
                      </div>
                      <span>•</span>
                      <div className="flex items-center gap-1 text-yellow-500">
                        <Star className="w-3.5 h-3.5 fill-yellow-500" />
                        {item.product.priceStars}
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center border border-white/10 rounded-lg bg-black/40 px-1 h-9">
                        <button
                          className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-white disabled:opacity-50"
                          onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                          disabled={updateItem.isPending}
                        >
                          -
                        </button>
                        <div className="w-8 text-center font-bold text-white text-sm">{item.quantity}</div>
                        <button
                          className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-white disabled:opacity-50"
                          onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                          disabled={updateItem.isPending}
                        >
                          +
                        </button>
                      </div>
                      
                      <div className="font-bold text-white flex items-center gap-1">
                        <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                        {item.product.priceStars * item.quantity}
                      </div>
                    </div>
                  </div>
                  
                  <button 
                    onClick={() => handleRemove(item.id)}
                    disabled={removeItem.isPending}
                    className="absolute top-4 right-4 text-muted-foreground hover:text-destructive hover:bg-destructive/10 p-2 rounded-full transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>

          <div className="bg-card rounded-3xl border border-white/5 p-8 h-fit sticky top-24 shadow-[0_8px_30px_rgba(0,0,0,0.5)]">
            <h3 className="text-xl font-bold text-white mb-6">Summary</h3>
            
            <div className="space-y-4 mb-6 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span className="flex items-center gap-1 text-white">
                  <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                  {cart.totalStars}
                </span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Transmission Fee</span>
                <span className="text-white">Free</span>
              </div>
            </div>
            
            <div className="border-t border-white/10 pt-6 mb-8">
              <div className="flex justify-between items-end">
                <span className="font-medium text-white">Total</span>
                <span className="text-3xl font-black text-white flex items-center gap-2">
                  <Star className="w-6 h-6 text-yellow-500 fill-yellow-500" />
                  {cart.totalStars}
                </span>
              </div>
            </div>
            
            <Button 
              className="w-full h-14 text-lg font-bold shadow-[0_0_20px_rgba(0,184,255,0.3)] hover:shadow-[0_0_30px_rgba(0,184,255,0.6)] transition-all bg-[#0088cc] hover:bg-[#0077b5] text-white border-0"
              onClick={handleCheckout}
              disabled={checkout.isPending}
            >
              Pay with Telegram ⭐
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={checkoutModalOpen} onOpenChange={setCheckoutModalOpen}>
        <DialogContent className="sm:max-w-md bg-card border-white/10 text-white">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-center">Complete Transaction</DialogTitle>
            <DialogDescription className="text-center text-muted-foreground">
              Finalize your payment securely via Telegram.
            </DialogDescription>
          </DialogHeader>
          
          {checkoutData && (
            <div className="flex flex-col items-center py-6">
              <div className="w-20 h-20 bg-[#0088cc]/10 rounded-full flex items-center justify-center mb-6 border border-[#0088cc]/30 shadow-[0_0_30px_rgba(0,136,204,0.3)]">
                <svg className="w-10 h-10 text-[#0088cc]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.223-.548.223l.188-2.85 5.18-4.68c.223-.198-.054-.31-.346-.116l-6.4 4.02-2.76-.86c-.6-.184-.614-.6.125-.89l10.736-4.13c.496-.184.93.11.725.96z"/>
                </svg>
              </div>
              
              <div className="text-center mb-8">
                <div className="text-sm text-muted-foreground mb-2">Total Amount</div>
                <div className="text-4xl font-black text-white flex items-center justify-center gap-2">
                  <Star className="w-8 h-8 text-yellow-500 fill-yellow-500" />
                  {checkoutData.totalStars}
                </div>
              </div>
              
              <a 
                href={checkoutData.telegramLink}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full block"
              >
                <Button className="w-full h-14 text-lg font-bold bg-[#0088cc] hover:bg-[#0077b5] text-white border-0 shadow-[0_0_20px_rgba(0,136,204,0.4)]">
                  Open in Telegram
                </Button>
              </a>
              
              <div className="mt-4 text-xs text-muted-foreground text-center">
                Once payment is complete, return to see your order status.
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
