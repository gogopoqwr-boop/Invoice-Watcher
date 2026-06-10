import React from 'react';
import { useListPresets } from '@workspace/api-client-react';
import { useLocation, Link } from 'wouter';
import { useWatchConfig } from '@/hooks/use-watch-config';
import { cn } from '@/lib/utils';

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
    <div className="min-h-[100dvh] bg-background p-6 md:p-10">

      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground mb-1">Выбери</p>
            <h1 className="text-3xl font-bold tracking-tight">Пресеты</h1>
          </div>
          <Link href="/configure">
            <button className="liquid-button px-5 py-2.5 text-sm font-semibold">
              С нуля →
            </button>
          </Link>
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="liquid-glass rounded-2xl h-52 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {presets?.map((preset) => (
              <button
                key={preset.id}
                onClick={() => handleSelectPreset(preset)}
                className="liquid-glass rounded-2xl overflow-hidden text-left group hover:scale-[1.02] hover:shadow-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <div className="h-36 bg-gradient-to-br from-slate-100 to-blue-50 flex items-center justify-center overflow-hidden">
                  {preset.imageUrl ? (
                    <img src={preset.imageUrl} alt={preset.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-80" />
                  ) : (
                    <div className="w-16 h-16 rounded-full border-4 border-slate-300/60" style={{ backgroundColor: preset.watchfaceColor }} />
                  )}
                </div>
                <div className="p-3">
                  <p className="font-semibold text-sm tracking-tight truncate">{preset.name}</p>
                  <p className="text-xs text-primary font-medium mt-0.5">{preset.priceStars} ⭐</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
