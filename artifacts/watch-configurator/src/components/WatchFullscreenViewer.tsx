import React, { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows } from '@react-three/drei';
import WatchModel from './WatchModel';
import { useWatchConfig } from '@/hooks/use-watch-config';
import { cn } from '@/lib/utils';

const MAT_LABELS: Record<string, string> = {
  metal: 'Нержавейка',
  plastic: 'Пластик',
  metal_solid: 'Металл',
  metal_segmented: 'Сетка',
  plastic_solid: 'Резина',
  leather: 'Кожа',
  cotton_fabric: 'NATO нейлон',
  resin: 'Смола',
};

export const BRACELET_COMBOS = [
  { id: 'black_leather',  label: 'Чёрная кожа',    material: 'leather',        color: '#1c1917' },
  { id: 'cognac_leather', label: 'Коньяк',          material: 'leather',        color: '#6b3a2a' },
  { id: 'white_leather',  label: 'Белая кожа',      material: 'leather',        color: '#f0ede8' },
  { id: 'black_nato',     label: 'Чёрный NATO',     material: 'cotton_fabric',  color: '#0f172a' },
  { id: 'khaki_nato',     label: 'Хаки NATO',       material: 'cotton_fabric',  color: '#4a5240' },
  { id: 'red_nato',       label: 'Красный NATO',    material: 'cotton_fabric',  color: '#7f1d1d' },
  { id: 'navy_nato',      label: 'Морской NATO',    material: 'cotton_fabric',  color: '#1e3a5f' },
  { id: 'olive_nato',     label: 'Олива NATO',      material: 'cotton_fabric',  color: '#556b2f' },
  { id: 'silver_steel',   label: 'Нержавейка',      material: 'metal_solid',    color: '#c0c0c0' },
  { id: 'black_rubber',   label: 'Чёрный каучук',   material: 'plastic_solid',  color: '#1e1e1e' },
  { id: 'white_rubber',   label: 'Белый каучук',    material: 'plastic_solid',  color: '#f0f0f0' },
  { id: 'resin_ocean',    label: 'Смола «Океан»',   material: 'resin',          color: '#0c4a6e' },
];

interface Props {
  preset: any;
  onClose: () => void;
  onBuy: (preset: any, braceletColor: string, braceletMaterial: string) => void;
  onConfigure: (preset: any) => void;
}

function WatchScene() {
  const lastInteraction = React.useRef<number>(0);
  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight position={[5, 8, 6]} intensity={1.3} castShadow />
      <directionalLight position={[-3, -2, -4]} intensity={0.28} />
      <hemisphereLight intensity={0.25} />
      <Environment preset="city" />
      <ContactShadows position={[0, -5.9, 0]} opacity={0.55} scale={14} blur={2.0} far={6} />
      <WatchModel step={2} lastInteractionRef={lastInteraction} />
      <OrbitControls
        enablePan={false}
        enableZoom={false}
        rotateSpeed={0.55}
        onStart={() => { lastInteraction.current = Date.now(); }}
      />
    </>
  );
}

export default function WatchFullscreenViewer({ preset, onClose, onBuy, onConfigure }: Props) {
  const { updateConfig } = useWatchConfig();
  const [selectedCombo, setSelectedCombo] = useState<string | null>(null);
  const [localColor, setLocalColor] = useState(preset.braceletColor ?? '#1c1917');
  const [localMat, setLocalMat] = useState(preset.braceletMaterial ?? 'leather');
  const [entering, setEntering] = useState(true);

  useEffect(() => {
    // Two-frame delay for a smooth scale-up interpolation from card size
    const t = requestAnimationFrame(() =>
      requestAnimationFrame(() => setEntering(false))
    );
    return () => cancelAnimationFrame(t);
  }, []);

  useEffect(() => {
    updateConfig({
      presetId: preset.id,
      watchfaceGeometry: preset.watchfaceGeometry,
      watchfaceMaterial: preset.watchfaceMaterial,
      watchfaceColor: preset.watchfaceColor,
      braceletMaterial: localMat,
      braceletType: preset.braceletType,
      braceletColor: localColor,
      handsEnabled: preset.handsEnabled,
      handsColor: preset.handsColor ?? '#cbd5e1',
      watchfaceText: preset.watchfaceText ?? '',
      watchfaceTextMode: preset.watchfaceTextMode ?? 'center',
      handsCount: 3,
    });
  }, [preset.id, localColor, localMat]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const handleSelectCombo = useCallback((combo: typeof BRACELET_COMBOS[number]) => {
    setSelectedCombo(combo.id);
    setLocalColor(combo.color);
    setLocalMat(combo.material);
  }, []);

  const handleBuy = useCallback(() => {
    onBuy(preset, localColor, localMat);
  }, [preset, localColor, localMat, onBuy]);

  const content = (
    <div
      className="fixed inset-0 z-[80] flex flex-col md:flex-row"
      style={{
        opacity: entering ? 0 : 1,
        transform: entering ? 'scale(0.97)' : 'scale(1)',
        transition: 'opacity 0.22s ease, transform 0.22s cubic-bezier(0.34,1.2,0.64,1)',
      }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(24px)' }}
        onClick={onClose}
      />

      {/* ── 3D Canvas ── fills left/top depending on breakpoint */}
      <div className="relative z-10 flex-1 md:w-[58%] min-h-[46vh] md:min-h-0">
        {/* Gradient backdrop for the canvas so it's not pitch black */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse at 50% 40%, ${preset.watchfaceColor}22 0%, ${preset.braceletColor}14 55%, transparent 90%)`,
          }}
        />

        <Canvas
          camera={{ position: [0, -3.0, 7.0], fov: 42 }}
          gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
          style={{ width: '100%', height: '100%', background: 'transparent' }}
          dpr={[1, 2]}
          shadows
        >
          <WatchScene />
        </Canvas>

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 left-4 w-9 h-9 rounded-full flex items-center justify-center text-white/70 hover:text-white transition-colors"
          style={{
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.14)',
            backdropFilter: 'blur(12px)',
          }}
        >
          ✕
        </button>

        {/* Collection badge */}
        {preset.collectionName && (
          <div
            className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest"
            style={{ background: 'rgba(255,255,255,0.10)', backdropFilter: 'blur(12px)', color: 'rgba(255,255,255,0.7)' }}
          >
            {preset.collectionName}
          </div>
        )}

        {/* Drag hint */}
        <div className="absolute bottom-4 left-0 right-0 flex justify-center pointer-events-none">
          <span className="text-[10px] uppercase tracking-[0.25em] text-white/20 font-semibold">Потяни для вращения</span>
        </div>
      </div>

      {/* ── Details panel ── right on desktop, bottom on mobile */}
      <div
        className="relative z-10 md:w-[42%] flex flex-col overflow-y-auto"
        style={{
          background: 'rgba(12,12,16,0.92)',
          backdropFilter: 'blur(32px)',
          borderTop: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        {/* ─ Header ─ */}
        <div className="px-6 pt-6 pb-4 border-b border-white/[0.06]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.3em] text-white/30 mb-1">
                {preset.collectionName ?? 'Классика'}
              </p>
              <h2 className="text-2xl font-black tracking-tight text-white leading-tight">{preset.name}</h2>
              {preset.description && (
                <p className="text-xs text-white/40 mt-1.5 leading-relaxed line-clamp-2">{preset.description}</p>
              )}
            </div>
            <div className="text-right shrink-0">
              <p className="text-2xl font-black text-yellow-400 leading-none">{preset.priceStars}</p>
              <p className="text-xs text-white/30 mt-0.5">⭐ звёзд</p>
            </div>
          </div>
        </div>

        {/* ─ Specs ─ */}
        <div className="px-6 py-4 border-b border-white/[0.06]">
          <div className="grid grid-cols-2 gap-2">
            {[
              ['Корпус', MAT_LABELS[preset.watchfaceMaterial] ?? preset.watchfaceMaterial],
              ['Ремешок', MAT_LABELS[localMat] ?? localMat],
              ['Форма', preset.watchfaceGeometry],
              ['Стрелки', preset.handsEnabled ? '3 стрелки' : 'без стрелок'],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl px-3 py-2" style={{ background: 'rgba(255,255,255,0.04)' }}>
                <p className="text-[10px] uppercase tracking-widest text-white/30 mb-0.5">{k}</p>
                <p className="text-xs font-bold text-white capitalize">{v}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ─ Bracelet selection grid ─ */}
        <div className="px-6 py-4 border-b border-white/[0.06] flex-1">
          <p className="text-[10px] uppercase tracking-[0.3em] text-white/30 mb-3 font-semibold">
            Ремешок
          </p>
          <div className="grid grid-cols-3 gap-2">
            {BRACELET_COMBOS.map(combo => {
              const active = selectedCombo === combo.id || (!selectedCombo && combo.color === localColor && combo.material === localMat);
              return (
                <button
                  key={combo.id}
                  onClick={() => handleSelectCombo(combo)}
                  className={cn(
                    'flex flex-col items-center gap-1.5 p-2.5 rounded-2xl transition-all duration-150 text-center',
                    active
                      ? 'ring-2 ring-blue-400 bg-blue-400/10'
                      : 'hover:bg-white/5'
                  )}
                  style={{ border: active ? undefined : '1px solid rgba(255,255,255,0.06)' }}
                >
                  <div
                    className="w-8 h-8 rounded-full border-2 shrink-0"
                    style={{
                      backgroundColor: combo.color,
                      borderColor: active ? 'rgba(96,165,250,0.8)' : 'rgba(255,255,255,0.15)',
                      boxShadow: active ? '0 0 10px rgba(96,165,250,0.3)' : 'none',
                    }}
                  />
                  <span className="text-[10px] font-semibold text-white/60 leading-tight">
                    {combo.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ─ Actions ─ */}
        <div className="px-6 py-5 space-y-2.5">
          <button
            onClick={handleBuy}
            className="w-full py-3.5 rounded-2xl font-black text-sm tracking-widest uppercase transition-all active:scale-[0.98]"
            style={{
              background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
              color: '#fff',
              boxShadow: '0 4px 24px rgba(99,102,241,0.35)',
            }}
          >
            Заказать — {preset.priceStars} ⭐
          </button>
          <button
            onClick={() => onConfigure(preset)}
            className="w-full py-3 rounded-2xl text-sm font-bold tracking-wide text-white/60 hover:text-white/90 transition-colors"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            Настроить →
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
