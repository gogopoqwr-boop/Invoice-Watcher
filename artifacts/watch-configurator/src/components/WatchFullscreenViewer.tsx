import React, { useEffect, useState, useCallback, useMemo } from 'react';
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
  { id: 'black_leather',    label: 'Чёрная кожа',        material: 'leather',        color: '#1c1917' },
  { id: 'cognac_leather',   label: 'Коньяк',              material: 'leather',        color: '#6b3a2a' },
  { id: 'tan_leather',      label: 'Карамель',            material: 'leather',        color: '#c2845a' },
  { id: 'white_leather',    label: 'Белая кожа',          material: 'leather',        color: '#f0ede8' },
  { id: 'black_nato',       label: 'Чёрный NATO',         material: 'cotton_fabric',  color: '#0f172a' },
  { id: 'khaki_nato',       label: 'Хаки NATO',           material: 'cotton_fabric',  color: '#4a5240' },
  { id: 'red_nato',         label: 'Красный NATO',        material: 'cotton_fabric',  color: '#7f1d1d' },
  { id: 'navy_nato',        label: 'Морской NATO',        material: 'cotton_fabric',  color: '#1e3a5f' },
  { id: 'olive_nato',       label: 'Олива NATO',          material: 'cotton_fabric',  color: '#556b2f' },
  { id: 'orange_nato',      label: 'Оранж NATO',          material: 'cotton_fabric',  color: '#c2410c' },
  { id: 'purple_nato',      label: 'Фиолет NATO',         material: 'cotton_fabric',  color: '#6b21a8' },
  { id: 'teal_nato',        label: 'Мята NATO',           material: 'cotton_fabric',  color: '#0f766e' },
  { id: 'silver_steel',     label: 'Нержавейка',          material: 'metal_solid',    color: '#c0c0c0' },
  { id: 'gold_steel',       label: 'Золото',              material: 'metal_solid',    color: '#b5942b' },
  { id: 'black_rubber',     label: 'Чёрный каучук',       material: 'plastic_solid',  color: '#1e1e1e' },
  { id: 'white_rubber',     label: 'Белый каучук',        material: 'plastic_solid',  color: '#f0f0f0' },
  { id: 'red_rubber',       label: 'Красный каучук',      material: 'plastic_solid',  color: '#dc2626' },
  { id: 'resin_ocean',      label: 'Смола «Океан»',       material: 'resin',          color: '#0c4a6e' },
  { id: 'resin_forest',     label: 'Смола «Лес»',         material: 'resin',          color: '#14532d' },
  { id: 'resin_amber',      label: 'Смола «Янтарь»',      material: 'resin',          color: '#78350f' },
];

const STRAP_GROUPS = [
  { label: 'Кожа',         material: 'leather' },
  { label: 'Нейлон NATO',  material: 'cotton_fabric' },
  { label: 'Металл',       material: 'metal_solid' },
  { label: 'Каучук',       material: 'plastic_solid' },
  { label: 'Смола',        material: 'resin' },
];

interface Props {
  preset: any;
  onClose: () => void;
  onBuy: (preset: any, braceletColor: string, braceletMaterial: string) => void;
  onConfigure: (preset: any) => void;
  originRect?: DOMRect | null;
}

function WatchScene() {
  const lastInteraction = React.useRef<number>(0);
  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight position={[5, 8, 6]} intensity={1.3} castShadow />
      <directionalLight position={[-3, -2, -4]} intensity={0.28} />
      <pointLight position={[-4, 2, 3]} intensity={0.7} color="#6366f1" />
      <hemisphereLight intensity={0.25} />
      <Environment preset="city" />
      <ContactShadows position={[0, -5.9, 0]} opacity={0.55} scale={14} blur={2.0} far={6} />
      <WatchModel step={2} lastInteractionRef={lastInteraction} />
      <OrbitControls
        enablePan={false}
        enableZoom={true}
        minDistance={4}
        maxDistance={13}
        rotateSpeed={0.55}
        onStart={() => { lastInteraction.current = Date.now(); }}
      />
    </>
  );
}

export default function WatchFullscreenViewer({ preset, onClose, onBuy, onConfigure, originRect }: Props) {
  const { updateConfig } = useWatchConfig();

  const initialCombo = BRACELET_COMBOS.find(
    c => c.color === preset.braceletColor && c.material === preset.braceletMaterial
  ) ?? BRACELET_COMBOS[0];

  const [selectedCombo, setSelectedCombo] = useState(initialCombo);
  const [phase, setPhase] = useState<'enter' | 'open'>('enter');

  const clipStart = useMemo(() => {
    if (!originRect) return 'inset(0% 0% 0% 0% round 0px)';
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const t = ((originRect.top / vh) * 100).toFixed(2);
    const l = ((originRect.left / vw) * 100).toFixed(2);
    const r = (((vw - originRect.right) / vw) * 100).toFixed(2);
    const b = (((vh - originRect.bottom) / vh) * 100).toFixed(2);
    return `inset(${t}% ${r}% ${b}% ${l}% round 24px)`;
  }, [originRect]);

  useEffect(() => {
    const t = requestAnimationFrame(() => requestAnimationFrame(() => setPhase('open')));
    return () => cancelAnimationFrame(t);
  }, []);

  useEffect(() => {
    updateConfig({
      presetId: preset.id,
      watchfaceGeometry: preset.watchfaceGeometry,
      watchfaceMaterial: preset.watchfaceMaterial,
      watchfaceColor: preset.watchfaceColor,
      braceletMaterial: selectedCombo.material,
      braceletType: preset.braceletType,
      braceletColor: selectedCombo.color,
      handsEnabled: preset.handsEnabled,
      handsColor: preset.handsColor ?? '#cbd5e1',
      watchfaceText: preset.watchfaceText ?? '',
      watchfaceTextMode: preset.watchfaceTextMode ?? 'center',
      handsCount: 3,
    });
  }, [preset.id, selectedCombo.color, selectedCombo.material]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const handleBuy = useCallback(() => {
    onBuy(preset, selectedCombo.color, selectedCombo.material);
  }, [preset, selectedCombo, onBuy]);

  const isOpen = phase === 'open';

  const content = (
    <div
      className="fixed inset-0 z-[80] flex flex-col md:flex-row overflow-hidden"
      style={{
        clipPath: isOpen ? 'inset(0% 0% 0% 0% round 0px)' : clipStart,
        opacity: isOpen ? 1 : 0,
        transform: isOpen ? 'scale(1)' : 'scale(0.96)',
        transition: isOpen
          ? 'clip-path 0.55s cubic-bezier(0.16,1,0.3,1), opacity 0.28s ease, transform 0.55s cubic-bezier(0.16,1,0.3,1)'
          : 'none',
      }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(32px)' }}
        onClick={onClose}
      />

      {/* ── 3D Canvas ── */}
      <div className="relative z-10 flex-none h-[48dvh] md:h-auto md:flex-1 md:w-[58%]">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse at 50% 35%, ${preset.watchfaceColor}30 0%, ${selectedCombo.color}18 55%, transparent 88%)`,
            transition: 'background 0.5s ease',
          }}
        />
        <Canvas
          camera={{ position: [0, -2.8, 7.2], fov: 42 }}
          gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
          style={{ width: '100%', height: '100%', background: 'transparent' }}
          dpr={[1, 2]}
          shadows
        >
          <WatchScene />
        </Canvas>

        <button
          onClick={onClose}
          className="absolute top-4 left-4 w-9 h-9 rounded-full flex items-center justify-center text-white/70 hover:text-white transition-colors"
          style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.14)', backdropFilter: 'blur(12px)' }}
        >
          ✕
        </button>

        {preset.collectionName && (
          <div
            className="absolute top-4 right-4 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest"
            style={{ background: 'rgba(255,255,255,0.10)', backdropFilter: 'blur(12px)', color: 'rgba(255,255,255,0.7)' }}
          >
            {preset.collectionName}
          </div>
        )}

        <div className="absolute bottom-4 left-0 right-0 flex justify-center pointer-events-none">
          <span className="text-[10px] uppercase tracking-[0.25em] text-white/22 font-semibold">Потяни · Прокрути</span>
        </div>
      </div>

      {/* ── Details + config panel ── */}
      <div
        className="relative z-10 flex-none h-[52dvh] md:h-auto md:w-[42%] flex flex-col overflow-hidden"
        style={{
          background: 'rgba(10,10,14,0.96)',
          backdropFilter: 'blur(32px)',
          borderTop: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        {/* Header — fixed */}
        <div className="px-5 pt-5 pb-3.5 border-b border-white/[0.06] shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.3em] text-white/30 mb-1">
                {preset.collectionName ?? 'Классика'}
              </p>
              <h2 className="text-xl font-black tracking-tight text-white leading-tight">{preset.name}</h2>
              {preset.description && (
                <p className="text-xs text-white/38 mt-1 leading-relaxed line-clamp-2">{preset.description}</p>
              )}
            </div>
            <div className="text-right shrink-0">
              <p className="text-2xl font-black text-white leading-none">{preset.priceStars}</p>
              <p className="text-xs text-white/30 mt-0.5">звёзд</p>
            </div>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          {/* Specs */}
          <div className="px-5 py-3.5 border-b border-white/[0.06]">
            <div className="grid grid-cols-2 gap-2">
              {[
                ['Корпус', MAT_LABELS[preset.watchfaceMaterial] ?? preset.watchfaceMaterial],
                ['Форма', preset.watchfaceGeometry],
                ['Стрелки', preset.handsEnabled ? '3 стрелки' : 'без стрелок'],
                ['Серия', preset.collectionName ?? 'Классика'],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl px-3 py-2" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <p className="text-[10px] uppercase tracking-widest text-white/28 mb-0.5">{k}</p>
                  <p className="text-xs font-bold text-white capitalize">{v}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Inline strap picker ── */}
          <div className="px-5 py-4">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] uppercase tracking-[0.3em] text-white/30 font-semibold">Ремешок</p>
              <div className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded-full border border-white/30"
                  style={{ backgroundColor: selectedCombo.color, boxShadow: `0 0 8px ${selectedCombo.color}88` }}
                />
                <span className="text-[11px] text-white/60 font-semibold">{selectedCombo.label}</span>
              </div>
            </div>

            <div className="space-y-4">
              {STRAP_GROUPS.map(group => {
                const items = BRACELET_COMBOS.filter(c => c.material === group.material);
                return (
                  <div key={group.material}>
                    <p className="text-[9px] uppercase tracking-[0.3em] text-white/20 font-semibold mb-2">
                      {group.label}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {items.map(combo => {
                        const active = selectedCombo.id === combo.id;
                        return (
                          <button
                            key={combo.id}
                            onClick={() => setSelectedCombo(combo)}
                            title={combo.label}
                            className={cn(
                              'flex items-center gap-2 px-2.5 py-1.5 rounded-xl transition-all duration-150',
                              active
                                ? 'ring-1 ring-white/40 bg-white/10'
                                : 'hover:bg-white/6 active:scale-95'
                            )}
                            style={{
                              border: active ? '1px solid rgba(255,255,255,0.25)' : '1px solid rgba(255,255,255,0.07)',
                            }}
                          >
                            <div
                              className="w-5 h-5 rounded-full shrink-0"
                              style={{
                                backgroundColor: combo.color,
                                boxShadow: active
                                  ? `0 0 10px ${combo.color}99, inset 0 0 0 1.5px rgba(255,255,255,0.3)`
                                  : 'inset 0 0 0 1px rgba(255,255,255,0.12)',
                              }}
                            />
                            <span className={cn(
                              'text-[10px] font-semibold leading-tight whitespace-nowrap transition-colors',
                              active ? 'text-white' : 'text-white/45'
                            )}>
                              {combo.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Actions — fixed at bottom */}
        <div
          className="px-5 py-4 space-y-2 shrink-0"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(10,10,14,0.98)' }}
        >
          <button
            onClick={handleBuy}
            className="w-full py-3 rounded-2xl font-black text-sm tracking-widest uppercase transition-all active:scale-[0.98]"
            style={{
              background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
              color: '#fff',
              boxShadow: '0 4px 24px rgba(99,102,241,0.35)',
            }}
          >
            Заказать — {preset.priceStars} зв.
          </button>
          <button
            onClick={() => onConfigure(preset)}
            className="w-full py-2.5 rounded-2xl text-sm font-bold tracking-wide text-white/55 hover:text-white/85 transition-colors"
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
