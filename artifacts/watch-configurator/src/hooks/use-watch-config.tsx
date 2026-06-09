import React, { createContext, useContext, useState, useEffect } from "react";
import { getOrCreateSessionId } from "@/lib/session";
import { WatchConfigInput, WatchConfigInputWatchfaceGeometry, WatchConfigInputWatchfaceMaterial, WatchConfigInputBraceletMaterial, WatchConfigInputBraceletType } from "@workspace/api-client-react";

type ConfigState = Omit<WatchConfigInput, "sessionId">;

const defaultState: ConfigState = {
  watchfaceGeometry: "circle",
  watchfaceMaterial: "metal",
  watchfaceColor: "#1e293b",
  braceletMaterial: "metal_solid",
  braceletType: "solid",
  braceletColor: "#0f172a",
  handsEnabled: true,
  handsColor: "#cbd5e1"
};

type WatchConfigContextType = {
  sessionId: string;
  config: ConfigState;
  updateConfig: (updates: Partial<ConfigState>) => void;
  activePart: "watchFace" | "strap" | "clasp" | null;
  setActivePart: (part: "watchFace" | "strap" | "clasp" | null) => void;
};

const WatchConfigContext = createContext<WatchConfigContextType | undefined>(undefined);

export function WatchConfigProvider({ children }: { children: React.ReactNode }) {
  const [sessionId, setSessionId] = useState<string>("");
  const [config, setConfig] = useState<ConfigState>(defaultState);
  const [activePart, setActivePart] = useState<"watchFace" | "strap" | "clasp" | null>(null);

  useEffect(() => {
    setSessionId(getOrCreateSessionId());
    const saved = localStorage.getItem("watch_config_draft");
    if (saved) {
      try {
        setConfig({ ...defaultState, ...JSON.parse(saved) });
      } catch (e) {
        // ignore
      }
    }
  }, []);

  const updateConfig = (updates: Partial<ConfigState>) => {
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
  const context = useContext(WatchConfigContext);
  if (!context) throw new Error("useWatchConfig must be used within WatchConfigProvider");
  return context;
}
