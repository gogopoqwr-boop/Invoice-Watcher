import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows } from '@react-three/drei';
import WatchModel from './WatchModel';
import { useWatchConfig } from '@/hooks/use-watch-config';

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

// Exported so Collections.tsx buy-modal can reuse them
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
      <WatchModel step={0} lastInteractionRef={lastInteraction} />
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
      braceletMaterial: preset.braceletMaterial,
      braceletType: preset.braceletType,
      braceletColor: preset.braceletColor,
      handsEnabled: preset.handsEnabled,
      handsColor: preset.handsColor ?? '#cbd5e1',
      watchfaceText: preset.watchfaceText ?? '',
      watchfaceTextMode: preset.watchfaceTextMode ?? 'center',
      handsCount: 3,
    });
  }, [preset.id]);

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
    onBuy(preset, preset.braceletColor, preset.braceletMaterial);
  }, [preset, onBuy]);

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
      <div className="relative z-10 flex-none h-[58dvh] md:h-auto md:flex-1 md:w-[62%] overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse at 50% 35%, ${preset.watchfaceColor}30 0%, ${preset.braceletColor}18 55%, transparent 88%)`,
          }}
        />
        <Canvas
          camera={{ position: [0, 0.5, 8.0], fov: 40 }}
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

      {/* ── Info panel ── */}
      <div
        className="relative z-10 flex-none h-[42dvh] md:h-auto md:w-[38%] flex flex-col justify-between"
        style={{
          background: 'rgba(10,10,14,0.97)',
          backdropFilter: 'blur(32px)',
          borderTop: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        {/* Watch info */}
        <div className="px-6 pt-6 pb-4 flex-1 flex flex-col justify-center gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.35em] text-white/30 mb-1">
              {preset.collectionName ?? 'Классика'}
            </p>
            <h2 className="text-2xl font-black tracking-tight text-white leading-tight mb-1">
              {preset.name}
            </h2>
            {preset.description && (
              <p className="text-xs text-white/38 leading-relaxed line-clamp-3">{preset.description}</p>
            )}
          </div>

          {/* Specs */}
          <div className="grid grid-cols-2 gap-2">
            {[
              ['Корпус', MAT_LABELS[preset.watchfaceMaterial] ?? preset.watchfaceMaterial],
              ['Форма', preset.watchfaceGeometry],
              ['Ремешок', MAT_LABELS[preset.braceletMaterial] ?? preset.braceletMaterial],
              ['Стрелки', preset.handsEnabled ? '3 стрелки' : 'без стрелок'],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl px-3 py-2" style={{ background: 'rgba(255,255,255,0.04)' }}>
                <p className="text-[10px] uppercase tracking-widest text-white/28 mb-0.5">{k}</p>
                <p className="text-xs font-bold text-white capitalize">{v}</p>
              </div>
            ))}
          </div>

          {/* Price */}
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-white">{preset.priceStars}</span>
            <span className="text-sm text-white/30">звёзд Telegram</span>
          </div>
        </div>

        {/* Actions */}
        <div
          className="px-6 pb-6 pt-4 flex flex-col gap-2"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
        >
          <button
            onClick={handleBuy}
            className="w-full py-3.5 rounded-2xl font-black text-sm tracking-widest uppercase transition-all active:scale-[0.98]"
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
            className="w-full py-3 rounded-2xl text-sm font-bold tracking-wide text-white/55 hover:text-white/85 transition-colors"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            Настроить ремешок и цвет →
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
