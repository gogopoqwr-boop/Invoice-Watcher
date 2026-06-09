import React from "react";
import { Link } from "wouter";
import { GlassPanel } from "@/components/ui/glass-panel";

export default function Home() {
  return (
    <div className="min-h-[100dvh] w-full bg-background flex flex-col items-center justify-center p-4 overflow-hidden relative">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
      
      <div className="z-10 text-center mb-16">
        <h1 className="text-4xl md:text-6xl font-bold tracking-widest text-white mb-2">НА_УТРАХ_4</h1>
        <p className="text-muted-foreground text-sm uppercase tracking-widest">At dawn, version 4</p>
      </div>

      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-8 z-10">
        <Link href="/presets" className="group cursor-pointer">
          <GlassPanel className="h-[400px] flex flex-col items-center justify-center transition-all duration-500 hover:scale-[1.02] hover:bg-white/10 group-hover:border-primary/50 relative overflow-hidden">
            <h2 className="text-3xl font-bold tracking-widest text-white">ЧАСЫ</h2>
          </GlassPanel>
        </Link>

        <div className="group cursor-default relative">
          <GlassPanel className="h-[400px] flex flex-col items-center justify-center opacity-50 relative overflow-hidden">
            <h2 className="text-3xl font-bold tracking-widest text-white">МЕРЧ</h2>
            <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <span className="text-sm font-medium tracking-widest text-white uppercase">Coming Soon</span>
            </div>
          </GlassPanel>
        </div>
      </div>
    </div>
  );
}
