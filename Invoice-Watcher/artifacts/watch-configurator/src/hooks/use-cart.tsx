import React, { createContext, useContext, useState, useCallback, useEffect } from "react";

export interface CartItem {
  key: string;
  presetId: number;
  presetName: string;
  priceStars: number;
  braceletColor: string;
  watchfaceColor: string;
}

interface CartContextValue {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "key">) => void;
  removeItem: (key: string) => void;
  clearCart: () => void;
  total: number;
}

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "cheblychas_cart";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const addItem = useCallback((item: Omit<CartItem, "key">) => {
    const key = `${item.presetId}-${item.braceletColor}-${Date.now()}`;
    setItems(prev => [...prev, { ...item, key }]);
  }, []);

  const removeItem = useCallback((key: string) => {
    setItems(prev => prev.filter(i => i.key !== key));
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const total = items.reduce((s, i) => s + i.priceStars, 0);

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, clearCart, total }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be inside CartProvider");
  return ctx;
}
