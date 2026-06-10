import React, { createContext, useContext, useState, useEffect } from "react";
import { getOrCreateSessionId } from "@/lib/session";
import {
  WatchConfigInput,
  WatchConfigInputWatchfaceGeometry,
  WatchConfigInputWatchfaceMaterial,
  WatchConfigInputBraceletMaterial,
  WatchConfigInputBraceletType,
} from "@workspace/api-client-react";

type ApiConfigState = Omit<WatchConfigInput, "sessionId">;

export type ExtendedConfigState = ApiConfigState & {
  watchfaceText?: string;
  handsCount?: number; // 0 | 2 | 3
  watchfaceBackgroundType?: "solid" | "gradient";
  watchfaceGradientEnd?: string;
};

const defaultState: ExtendedConfigState = {
  watchfaceGeometry: "circle",
  watchfaceMaterial: "metal",
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
  const [sessionId, setSessionId] = useState<string>("");
  const [config, setConfig] = useState<ExtendedConfigState>(defaultState);
  const [activePart, setActivePart] = useState<"watchFace" | "strap" | "clasp" | null>(null);

  useEffect(() => {
    setSessionId(getOrCreateSessionId());
    const saved = localStorage.getItem("watch_config_draft");
    if (saved) {
      try {
        setConfig({ ...defaultState, ...JSON.parse(saved) });
      } catch {
        // ignore
      }
    }
  }, []);

  const updateConfig = (updates: Partial<ExtendedConfigState>) => {
    setConfig(prev => {
      const next = { ...prev, ...updates };
      localStorage.setItem("watch_config_draft", JSON.stringify(next));
      return next;
    });
  };

  if (!sessionId) return null;

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
