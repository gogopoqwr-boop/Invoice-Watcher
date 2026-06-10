import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Star, ShoppingCart, Check, Plus, Minus, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUpdateProductColor, useAddToCart, useUpdateCartItem, useGetCart, getGetCartQueryKey } from "@workspace/api-client-react";
import type { Product } from "@workspace/api-client-react";
import { getSessionId } from "@/lib/session";
import { useToast } from "@/hooks/use-toast";

interface ProductCardProps {
  product: Product;
  index: number;
}

const CATEGORY_SVG: Record<string, string> = {
  phones: `<svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="35" y="10" width="50" height="100" rx="8" fill="currentColor" opacity="0.15" stroke="currentColor" stroke-width="2"/>
    <rect x="42" y="20" width="36" height="60" rx="3" fill="currentColor" opacity="0.1"/>
    <circle cx="60" cy="92" r="5" fill="currentColor" opacity="0.4"/>
    <rect x="50" y="14" width="20" height="3" rx="1.5" fill="currentColor" opacity="0.3"/>
  </svg>`,
  laptops: `<svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="20" y="25" width="80" height="55" rx="5" fill="currentColor" opacity="0.15" stroke="currentColor" stroke-width="2"/>
    <rect x="28" y="33" width="64" height="40" rx="2" fill="currentColor" opacity="0.1"/>
    <rect x="10" y="80" width="100" height="8" rx="4" fill="currentColor" opacity="0.2"/>
    <rect x="45" y="80" width="30" height="4" rx="2" fill="currentColor" opacity="0.3"/>
  </svg>`,
  headsets: `<svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M30 60 C30 35 90 35 90 60" stroke="currentColor" stroke-width="4" fill="none" opacity="0.4"/>
    <rect x="18" y="55" width="18" height="30" rx="9" fill="currentColor" opacity="0.3"/>
    <rect x="84" y="55" width="18" height="30" rx="9" fill="currentColor" opacity="0.3"/>
    <line x1="60" y1="90" x2="60" y2="105" stroke="currentColor" stroke-width="3" opacity="0.25"/>
    <circle cx="60" cy="108" r="5" fill="currentColor" opacity="0.25"/>
  </svg>`,
  accessories: `<svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="60" cy="60" r="35" fill="currentColor" opacity="0.1" stroke="currentColor" stroke-width="2"/>
    <circle cx="60" cy="60" r="20" fill="currentColor" opacity="0.12" stroke="currentColor" stroke-width="1.5"/>
    <circle cx="60" cy="60" r="8" fill="currentColor" opacity="0.25"/>
    <line x1="60" y1="25" x2="60" y2="15" stroke="currentColor" stroke-width="2" opacity="0.3"/>
    <line x1="60" y1="95" x2="60" y2="105" stroke="currentColor" stroke-width="2" opacity="0.3"/>
    <line x1="25" y1="60" x2="15" y2="60" stroke="currentColor" stroke-width="2" opacity="0.3"/>
    <line x1="95" y1="60" x2="105" y2="60" stroke="currentColor" stroke-width="2" opacity="0.3"/>
  </svg>`,
};

export function ProductCard({ product, index }: ProductCardProps) {
  const [selectedColor, setSelectedColor] = useState(product.selectedColor);
  const [showQty, setShowQty] = useState(false);
  const [localQty, setLocalQty] = useState(1);
  const [floatKey, setFloatKey] = useState(0);
  const [showFloat, setShowFloat] = useState(false);
  const addToCart = useAddToCart();
  const updateCartItem = useUpdateCartItem();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const sessionId = getSessionId();

  const { data: cart } = useGetCart(
    { sessionId },
    { query: { queryKey: ["cart", sessionId], staleTime: 5000 } }
  );

  const cartItem = cart?.items?.find(
    (i) => i.productId === product.id && i.selectedColor === selectedColor
  );

  const handleColorSelect = (color: string, e: React.MouseEvent) => {
    e.preventDefault();
    setSelectedColor(color);
  };

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowFloat(true);
    setFloatKey(k => k + 1);
    setTimeout(() => setShowFloat(false), 900);

    addToCart.mutate(
      { data: { sessionId, productId: product.id, quantity: 1, selectedColor } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetCartQueryKey({ sessionId }) });
          queryClient.invalidateQueries({ queryKey: ["cart", sessionId] });
        },
      }
    );
  };

  const handleQtyChange = (delta: number, e: React.MouseEvent) => {
    e.preventDefault();
    if (!cartItem) return;
    const newQty = cartItem.quantity + delta;
    if (newQty < 1) return;
    updateCartItem.mutate(
      { itemId: cartItem.id, data: { quantity: newQty } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetCartQueryKey({ sessionId }) });
          queryClient.invalidateQueries({ queryKey: ["cart", sessionId] });
        },
      }
    );
  };

  const svgContent = CATEGORY_SVG[product.category] ?? CATEGORY_SVG["accessories"];
  const hasImage = !!product.imageUrl;

  return (
    <div
      className="group relative flex flex-col bg-card rounded-2xl border border-border overflow-hidden glow-hover animate-in fade-in slide-in-from-bottom-8 duration-500 fill-mode-both"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      {/* Product image / SVG illustration */}
      <Link href={`/product/${product.id}`} className="block relative aspect-square overflow-hidden bg-gradient-to-br from-card to-muted/30">
        {hasImage ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            className="object-cover w-full h-full transform group-hover:scale-105 transition-transform duration-700 ease-out"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center p-6 text-primary transition-colors duration-300"
            style={{ color: selectedColor !== "#000000" ? selectedColor : undefined }}
            dangerouslySetInnerHTML={{ __html: svgContent }}
          />
        )}

        {/* Price badge */}
        <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full text-xs font-bold text-white border border-white/10 flex items-center gap-1">
          <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
          {product.priceStars}
        </div>

        {/* Float animation */}
        {showFloat && (
          <div
            key={floatKey}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none animate-float-up"
          >
            <div className="bg-primary text-primary-foreground text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
              <ShoppingCart className="w-3 h-3" /> +1
            </div>
          </div>
        )}
      </Link>

      <div className="p-4 sm:p-5 flex flex-col flex-1 gap-3">
        <div>
          <div className="text-xs font-semibold text-primary mb-1 uppercase tracking-wider flex items-center gap-1">
            <Zap className="w-3 h-3" />
            {product.category}
          </div>
          <Link href={`/product/${product.id}`} className="text-base font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-snug">
            {product.name}
          </Link>
          {(product.reviewCount ?? 0) > 0 && (
            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
              <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
              <span className="font-medium text-foreground">{product.averageRating?.toFixed(1) || "5.0"}</span>
              <span>({product.reviewCount})</span>
            </div>
          )}
        </div>

        <div className="mt-auto flex items-center justify-between gap-2">
          {/* Color swatches */}
          {product.colors.length > 1 ? (
            <div className="flex gap-1.5 bg-muted/40 p-1.5 rounded-full border border-border">
              {product.colors.map((color) => (
                <button
                  key={color}
                  className={`w-5 h-5 rounded-full border-2 transition-all flex items-center justify-center ${
                    selectedColor === color ? "border-primary scale-110" : "border-transparent hover:scale-110"
                  }`}
                  style={{ backgroundColor: color }}
                  onClick={(e) => handleColorSelect(color, e)}
                  title={color}
                >
                  {selectedColor === color && <Check className="w-2.5 h-2.5 text-white drop-shadow" />}
                </button>
              ))}
            </div>
          ) : (
            <div />
          )}

          {/* Cart button or quantity control */}
          {cartItem ? (
            <div className="flex items-center gap-1 bg-primary/10 border border-primary/30 rounded-full px-1 py-1">
              <button
                onClick={(e) => handleQtyChange(-1, e)}
                className="w-6 h-6 rounded-full bg-primary/20 hover:bg-primary/40 transition-colors flex items-center justify-center"
              >
                <Minus className="w-3 h-3 text-primary" />
              </button>
              <span className="text-sm font-bold text-primary min-w-[1.2rem] text-center">
                {cartItem.quantity}
              </span>
              <button
                onClick={(e) => handleQtyChange(1, e)}
                className="w-6 h-6 rounded-full bg-primary/20 hover:bg-primary/40 transition-colors flex items-center justify-center"
              >
                <Plus className="w-3 h-3 text-primary" />
              </button>
            </div>
          ) : (
            <Button
              size="icon"
              onClick={handleAddToCart}
              disabled={addToCart.isPending}
              className="rounded-full h-9 w-9 shadow-[0_0_15px_rgba(0,184,255,0.25)] hover:shadow-[0_0_25px_rgba(0,184,255,0.5)] transition-all shrink-0"
            >
              <ShoppingCart className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
