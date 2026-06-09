import React from 'react';
import { useListPresets } from '@workspace/api-client-react';
import { GlassPanel } from '@/components/ui/glass-panel';
import { LiquidButton } from '@/components/ui/liquid-button';
import { Link, useLocation } from 'wouter';
import { useWatchConfig } from '@/hooks/use-watch-config';

export default function Presets() {
  const { data: presets, isLoading } = useListPresets();
  const [, setLocation] = useLocation();
  const { updateConfig } = useWatchConfig();

  const handleSelectPreset = (preset: any) => {
    updateConfig({
      presetId: preset.id,
      watchfaceGeometry: preset.watchfaceGeometry,
      watchfaceMaterial: preset.watchfaceMaterial,
      watchfaceColor: preset.watchfaceColor,
      braceletMaterial: preset.braceletMaterial,
      braceletType: preset.braceletType,
      braceletColor: preset.braceletColor,
      handsEnabled: preset.handsEnabled,
    });
    setLocation('/configure');
  };

  return (
    <div className="min-h-[100dvh] bg-background text-white p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-12">
          <h1 className="text-3xl font-bold tracking-widest">ПРЕСЕТЫ</h1>
          <Link href="/configure">
            <LiquidButton>START FROM SCRATCH</LiquidButton>
          </Link>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map(i => (
              <GlassPanel key={i} className="h-64 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {presets?.map((preset) => (
              <GlassPanel key={preset.id} className="p-4 flex flex-col group cursor-pointer" onClick={() => handleSelectPreset(preset)}>
                <div className="flex-1 bg-black/20 rounded-lg mb-4 flex items-center justify-center relative overflow-hidden">
                   {preset.imageUrl ? <img src={preset.imageUrl} alt={preset.name} className="w-full h-full object-cover opacity-80 group-hover:scale-110 transition-transform duration-500" /> : <div className="text-xs text-muted-foreground uppercase tracking-widest">Preview</div>}
                </div>
                <h3 className="font-bold tracking-wider mb-1">{preset.name}</h3>
                <p className="text-sm text-primary">{preset.priceStars} ⭐</p>
              </GlassPanel>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}