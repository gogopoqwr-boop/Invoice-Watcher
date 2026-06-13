import React, { createContext, useContext, useState } from "react";
import { getOrCreateSessionId } from "@/lib/session";
import {
  WatchConfigInput,
  WatchConfigInputWatchfaceGeometry,
  WatchConfigInputWatchfaceMaterial,
  WatchConfigInputBraceletMaterial,
  WatchConfigInputBraceletType,
} from "@workspace/api-client-react";

type ApiConfigState = Omit<WatchConfigInput, "sessionId">;

export type BoxType = 'standard' | 'premium' | 'collector';

export type ExtendedConfigState = ApiConfigState & {
  presetId?: number;
  collectionName?: string;
  watchfaceText?: string;
  watchfaceTextMode?: "center" | "circular";
  handsCount?: number; // 0 | 2 | 3
  watchfaceBackgroundType?: "solid" | "gradient";
  watchfaceGradientEnd?: string;
  // Box setup (filled on /box step, before order creation)
  boxType?: BoxType;
  boxMessage?: string;
  giftWrap?: boolean;
  // Case size scale: 0.65–1.35 maps to ~32–48 mm equivalent
  watchfaceSize?: number;
};

const defaultState: ExtendedConfigState = {
  watchfaceGeometry: "circle",
  watchfaceMaterial: "metal",
  watchfaceSize: 1.0,
  watchfaceColor: "#1e293b",
  watchfaceBackgroundType: "solid",
  watchfaceGradientEnd: "#0f172a",
  braceletMaterial: "metal_solid",
  braceletType: "solid",
  braceletColor: "#0f172a",
  handsEnabled: true,
  handsCount: 3,
  handsColor: "#cbd5e1",
  watchfaceText: "",
  watchfaceTextMode: "center",
};

type WatchConfigContextType = {
  sessionId: string;
  config: ExtendedConfigState;
  updateConfig: (updates: Partial<ExtendedConfigState>) => void;
  activePart: "watchFace" | "strap" | "clasp" | null;
  setActivePart: (part: "watchFace" | "strap" | "clasp" | null) => void;
};

const WatchConfigContext = createContext<WatchConfigContextType | undefined>(undefined);

export function WatchConfigProvider({ children }: { children: React.ReactNode }) {
  const [sessionId] = useState<string>(() => getOrCreateSessionId());
  const [config, setConfig] = useState<ExtendedConfigState>(() => {
    try {
      const saved = typeof window !== "undefined" ? localStorage.getItem("watch_config_draft") : null;
      if (saved) return { ...defaultState, ...JSON.parse(saved) };
    } catch {}
    return defaultState;
  });
  const [activePart, setActivePart] = useState<"watchFace" | "strap" | "clasp" | null>(null);

  const updateConfig = (updates: Partial<ExtendedConfigState>) => {
    setConfig(prev => {
      const next = { ...prev, ...updates };
      try { localStorage.setItem("watch_config_draft", JSON.stringify(next)); } catch {}
      return next;
    });
  };

  return (
    <WatchConfigContext.Provider value={{ sessionId, config, updateConfig, activePart, setActivePart }}>
      {children}
    </WatchConfigContext.Provider>
  );
}

export function useWatchConfig() {
  const ctx = useContext(WatchConfigContext);
  if (!ctx) throw new Error("useWatchConfig must be used within WatchConfigProvider");
  return ctx;
}
